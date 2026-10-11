param([string]$PackageDirectory = 'dist\native')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$packageRoot = [IO.Path]::GetFullPath((Join-Path $root $PackageDirectory))
$runtime = Join-Path $packageRoot 'node.exe'
$backend = Join-Path $packageRoot 'resources\backend'
foreach ($file in @('InstallStreet.exe','StorageSense.exe','node.exe','resources\install-webview2.ps1','resources\worker\worker.js','resources\electron\main.js','resources\desktop\platform.js','resources\ui\index.html','resources\ui\storage.html','resources\ui\native-preload.js','resources\backend\InstallStreet.Cli.exe','resources\backend\TaskRuntime.dll')) {
    if (!(Test-Path -LiteralPath (Join-Path $packageRoot $file))) { throw "Missing native runtime file: $file" }
}
foreach ($file in (Get-ChildItem -LiteralPath $backend -Recurse -File | Where-Object { $_.Extension -in @('.dll','.exe') })) {
    $assembly = [Reflection.Assembly]::LoadFrom($file.FullName)
    [void]$assembly.GetTypes()
}
$stage = Join-Path $root ('tmp\fresh-pc-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
$probe = Join-Path $stage 'probe.js'
@'
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const root=process.argv[2],resources=path.join(root,'resources');assert.ok(process.versions.node);assert.ok(fs.existsSync(path.join(root,'InstallStreet.exe')));
for(const name of ['index.html','storage.html','renderer.js','storage.js','styles.css','storage.css','update-renderer.js','updates.js','update-settings.js','app-roster.js','presets.js','preset-renderer.js','media.js','native-preload.js'])assert.ok(fs.statSync(path.join(resources,'ui',name)).size>0,name);
const source=JSON.parse(fs.readFileSync(path.join(resources,'ui/assets/apps/SOURCES.json'),'utf8'));assert.ok(source.sources.length>=18);for(const logo of source.sources){const file=path.join(resources,'ui/assets/apps',logo.app+(logo.app==='iloader'?'.svg':'.png'));assert.ok(fs.statSync(file).size>0,file)}
const {createGitIdentity}=require(path.join(resources,'electron/git-identity.js'));const {publicCatalog}=require(path.join(resources,'electron/maintenance.js'));const missing=async()=>{const e=new Error('not installed');e.code='ENOENT';throw e};
(async()=>{const state=await createGitIdentity(missing,()=>false,{}).status();assert.deepEqual(state,{gitInstalled:false,ghInstalled:false,name:'',email:''});assert.ok(publicCatalog().some(item=>item.id==='run-all'));console.log('Native fresh-PC dependency probe passed: bundled Node backend, UI assets, logos, and missing Git/gh handling.')})().catch(e=>{console.error(e);process.exitCode=1});
'@ | Set-Content -LiteralPath $probe -Encoding UTF8
$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = $runtime
$start.Arguments = '"' + $probe + '" "' + $packageRoot + '"'
$start.WorkingDirectory = $stage; $start.UseShellExecute = $false; $start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
$start.EnvironmentVariables['PATH'] = Join-Path $env:SystemRoot 'System32'
foreach ($name in @('NODE_PATH','NODE_OPTIONS','PYTHONPATH','NVM_HOME','NVM_SYMLINK','DOTNET_ROOT')) { $start.EnvironmentVariables.Remove($name) }
try {
    $process = [Diagnostics.Process]::Start($start); $stdout = $process.StandardOutput.ReadToEnd(); $stderr = $process.StandardError.ReadToEnd(); $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "Fresh-PC probe failed: $stderr $stdout" }
    Write-Output $stdout.Trim()
    Write-Output 'Packaged backend assemblies loaded with built-in .NET Framework; this checks dependencies, not a clean-VM installation.'
} finally { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
