$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$vswhere=Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if(!(Test-Path -LiteralPath $vswhere)){throw 'Install Visual Studio C++ Build Tools to build this app.'}
$vs=& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if(!$vs){throw 'MSVC x64 build tools were not found.'}
$sdk=Join-Path $root 'tmp\webview2-sdk\build\native'
if(!(Test-Path (Join-Path $sdk 'include\WebView2.h'))){& node (Join-Path $PSScriptRoot 'prepare-webview2.js');if($LASTEXITCODE -ne 0){throw 'WebView2 SDK preparation failed.'}}
$dist=Join-Path $root 'dist\native';if(Test-Path $dist){Remove-Item -LiteralPath $dist -Recurse -Force};New-Item -ItemType Directory -Path $dist -Force|Out-Null
$objDir=Join-Path $root 'tmp\native-build';New-Item -ItemType Directory -Force -Path $objDir|Out-Null
$vcvars=Join-Path $vs 'VC\Auxiliary\Build\vcvars64.bat';$lines=& cmd.exe /d /s /c ('call "'+$vcvars+'" >nul && set');foreach($line in $lines){if($line -match '^([^=]+)=(.*)$'){[Environment]::SetEnvironmentVariable($Matches[1],$Matches[2],'Process')}}
$compiler=(Get-ChildItem (Join-Path $vs 'VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe')|Sort-Object FullName -Descending|Select-Object -First 1).FullName;if(!$compiler){throw 'cl.exe was not found.'}
$exe=Join-Path $dist 'InstallStreet.exe'
$args=@('/nologo','/EHsc','/MT','/std:c++17','/DUNICODE','/D_UNICODE','/DWIN32_LEAN_AND_MEAN',('/Fo'+(Join-Path $objDir 'host.obj')),('/I'+(Join-Path $sdk 'include')),(Join-Path $PSScriptRoot 'host.cpp'),'/link',('/LIBPATH:'+(Join-Path $sdk 'x64')),'WebView2LoaderStatic.lib','ole32.lib','shell32.lib','shlwapi.lib','comctl32.lib','advapi32.lib','user32.lib','gdi32.lib','/SUBSYSTEM:WINDOWS',('/OUT:'+$exe))
& $compiler @args;if($LASTEXITCODE -ne 0){throw 'WebView2 host compilation failed.'}
$manifestTool=(Get-Command mt.exe -ErrorAction Stop).Source
$manifestArgs=@('-manifest',(Join-Path $PSScriptRoot 'InstallStreet.manifest'),('-outputresource:'+$exe+';#1'))
& $manifestTool @manifestArgs
if($LASTEXITCODE -ne 0){throw 'Could not embed the administrator manifest in the WebView2 host.'}
Copy-Item (Get-Command node.exe -ErrorAction Stop).Source (Join-Path $dist 'node.exe')
$res=Join-Path $dist 'resources';$worker=Join-Path $res 'worker';$ui=Join-Path $res 'ui';$backend=Join-Path $res 'backend';$electron=Join-Path $res 'electron';$desktop=Join-Path $res 'desktop';foreach($d in @($worker,$ui,$backend,$electron,$desktop)){New-Item -ItemType Directory -Force -Path $d|Out-Null}
Copy-Item (Join-Path $root 'desktop\worker.js') (Join-Path $worker 'worker.js');Copy-Item (Join-Path $root 'desktop\platform.js') (Join-Path $desktop 'platform.js');Copy-Item (Join-Path $root 'desktop\native-preload.js') (Join-Path $ui 'native-preload.js');Copy-Item (Join-Path $PSScriptRoot 'install-webview2.ps1') (Join-Path $res 'install-webview2.ps1');Copy-Item (Join-Path $root 'package.json') (Join-Path $res 'package.json');Set-Content (Join-Path $res 'packaged.json') '{}' -Encoding ascii
Get-ChildItem (Join-Path $root 'electron') -File -Filter '*.js'|Where-Object Name -NotMatch '\.test\.js$'|Copy-Item -Destination $electron
Get-ChildItem (Join-Path $root 'electron') -File|Where-Object Extension -In @('.html','.css')|Copy-Item -Destination $ui;foreach($name in @('renderer.js','storage.js','update-renderer.js','updates.js','update-settings.js','app-roster.js','presets.js','preset-renderer.js','media.js')){Copy-Item (Join-Path $root "electron\$name") $ui};Copy-Item (Join-Path $root 'electron\assets') $ui -Recurse
foreach($name in @('TaskRuntime.dll','InstallStreet.Cli.exe','OscdimgSetup.exe','UpdateHelper.exe')){Copy-Item (Join-Path $root $name) $backend};Copy-Item (Join-Path $root 'StorageSense.exe') $dist
$files=@();$files+=Get-ChildItem (Join-Path $root 'AppL') -File -Filter '*.dll'|Where-Object Name -ne 'VMware.dll';$files+=Get-Item (Join-Path $root 'DisplayCity/DarkMode.dll'),(Join-Path $root 'DisplayCity/Wallpaper.dll'),(Join-Path $root 'DisplayCity/ConsumerFeatures.dll'),(Join-Path $root 'Files/showHiddenFiles.dll'),(Join-Path $root 'Files/showFileExtensions.dll'),(Join-Path $root 'VaultHouse/RunningIcon.dll'),(Join-Path $root 'VaultHouse/Appointer/desktopn.dll'),(Join-Path $root 'VaultHouse/Guards/LinkedInRemoval.dll'),(Join-Path $root 'VaultHouse/icons/.running/running.ico');foreach($file in $files){$relative=$file.FullName.Substring($root.Length).TrimStart('\');$to=Join-Path $backend $relative;New-Item -ItemType Directory -Force -Path (Split-Path $to)|Out-Null;Copy-Item -LiteralPath $file.FullName -Destination $to}
Write-Output "Native package payload: $dist"
