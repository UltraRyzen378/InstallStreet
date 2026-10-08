param([string]$Zip = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
if (!$Zip) { $Zip = 'dist\InstallStreet-' + $package.version + '-x64.zip' }
$path = [IO.Path]::GetFullPath((Join-Path $root $Zip))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($path)
try {
    foreach ($file in @('InstallStreet.exe','StorageSense.exe','resources/app.asar','resources/backend/InstallStreet.Cli.exe','resources/backend/TaskRuntime.dll','resources/backend/AppL/Dimmer.dll','resources/backend/AppL/Python.dll','resources/backend/AppL/iTunes.dll','resources/backend/AppL/iCloud.dll','resources/backend/AppL/iLoader.dll','resources/backend/DisplayCity/Wallpaper.dll','resources/backend/DisplayCity/ConsumerFeatures.dll','resources/backend/VaultHouse/Appointer/desktopn.dll','resources/backend/VaultHouse/Guards/LinkedInRemoval.dll')) {
        if (!$archive.GetEntry($file)) { throw "Missing portable payload: $file" }
    }
    if ($archive.Entries | Where-Object { $_.FullName -match '(^|/)gh-profile\.json$|(^|/)(node_modules|StatusHQ|tmp)/' }) { throw 'Personal or development files were included in the portable ZIP.' }
    Write-Output ('Portable ZIP payload verified: ' + $archive.Entries.Count + ' entries.')
} finally { $archive.Dispose() }
