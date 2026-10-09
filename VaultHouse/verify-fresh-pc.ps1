param([string]$PackageDirectory = 'dist\win-unpacked', [string]$RuntimeExecutable = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$packageRoot = [IO.Path]::GetFullPath((Join-Path $root $PackageDirectory))
if (!$RuntimeExecutable) { $RuntimeExecutable = Join-Path $packageRoot 'InstallStreet.exe' }
$backend = Join-Path $packageRoot 'resources\backend'
foreach ($file in @('InstallStreet.exe','StorageSense.exe','resources\backend\UpdateHelper.exe','resources\app.asar','icudtl.dat','resources.pak','chrome_100_percent.pak','chrome_200_percent.pak','v8_context_snapshot.bin')) {
    if (!(Test-Path -LiteralPath (Join-Path $packageRoot $file))) { throw "Missing bundled runtime file: $file" }
}
# Load the actual shipped managed assemblies using Windows PowerShell's built-in
# .NET Framework. No compiler, .NET SDK, or task execution is involved.
foreach ($file in (Get-ChildItem -LiteralPath $backend -Recurse -File | Where-Object { $_.Extension -in @('.dll','.exe') })) {
    $assembly = [Reflection.Assembly]::LoadFrom($file.FullName)
    [void]$assembly.GetTypes()
}
$stage = Join-Path $root ('tmp\fresh-pc-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
$probe = Join-Path $stage 'probe.js'
@'
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const archive = process.argv[2];
assert.ok(process.versions.electron && process.versions.node && process.versions.chrome);
const { createGitIdentity } = require(path.join(archive,'electron/git-identity.js'));
const { publicCatalog } = require(path.join(archive,'electron/maintenance.js'));
const missing = async () => { const error=new Error('not installed');error.code='ENOENT';throw error; };
(async()=>{
 const state=await createGitIdentity(missing,()=>false,process.env).status();
 assert.deepEqual(state,{gitInstalled:false,ghInstalled:false,name:'',email:''});
 assert.ok(publicCatalog().some(item=>item.id==='run-all'));
 for(const name of ['index.html','storage.html','preload.js','renderer.js','storage.js','styles.css','storage.css','update-renderer.js','updates.js','update-settings.js'])
   assert.ok(fs.readFileSync(path.join(archive,'electron',name)).length);
 console.log('Fresh-PC dependency probe passed: bundled Electron/Node/Chromium, UI assets, and missing Git/gh handling.');
})().catch(error=>{console.error(error);process.exitCode=1;});
'@ | Set-Content -LiteralPath $probe -Encoding UTF8
$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = [IO.Path]::GetFullPath($RuntimeExecutable)
$start.Arguments = '"' + $probe + '" "' + (Join-Path $packageRoot 'resources\app.asar') + '"'
$start.WorkingDirectory = $stage
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.EnvironmentVariables['ELECTRON_RUN_AS_NODE'] = '1'
$start.EnvironmentVariables['PATH'] = (Join-Path $env:SystemRoot 'System32')
foreach ($name in @('NODE_PATH','NODE_OPTIONS','PYTHONPATH','NVM_HOME','NVM_SYMLINK','DOTNET_ROOT')) { $start.EnvironmentVariables.Remove($name) }
$process = [Diagnostics.Process]::Start($start)
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()
if ($process.ExitCode -ne 0) { throw "Fresh-PC dependency probe failed: $stderr $stdout" }
Write-Output $stdout.Trim()
Write-Output 'Packaged backend assemblies loaded with built-in .NET Framework. No installers or maintenance commands ran.'
Write-Output 'This is a dependency-isolation check, not a clean Windows virtual-machine installation test.'
