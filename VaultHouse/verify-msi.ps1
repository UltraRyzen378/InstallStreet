param([string]$Msi = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$config = Get-Content -LiteralPath (Join-Path $root 'electron-builder.json') -Raw | ConvertFrom-Json
if (!$Msi) {
    $Msi = 'dist\InstallStreet-' + $package.version + '-x64.msi'
    if (!(Test-Path -LiteralPath (Join-Path $root $Msi))) { $Msi = 'dist\releases\' + $package.version + '\InstallStreet-' + $package.version + '-x64.msi' }
}
$path = [IO.Path]::GetFullPath((Join-Path $root $Msi))
if (!(Test-Path -LiteralPath $path)) { throw "MSI not found: $path" }
$installer = New-Object -ComObject WindowsInstaller.Installer
$db = $null
try {
    $db = $installer.OpenDatabase($path, 0)
    foreach ($entry in @(@('ProductName','InstallStreet'),@('ProductVersion',$package.version),@('UpgradeCode',('{' + ([guid]$config.msi.upgradeCode).ToString().ToUpperInvariant() + '}')))) {
        $sql = 'SELECT `Value` FROM `Property` WHERE `Property` = ''' + $entry[0] + ''''
        $view = $db.OpenView($sql)
        $view.Execute()
        $record = $view.Fetch()
        if (!$record) { throw ('Missing MSI property: ' + $entry[0]) }
        $value = $record.StringData(1)
        if ($entry[0] -eq 'ProductVersion') { $value = ([version]$value).ToString(3) }
        if ($entry[0] -eq 'UpgradeCode') { $value = '{' + ([guid]$value).ToString().ToUpperInvariant() + '}' }
        if ($value -ne $entry[1]) { throw ('Unexpected MSI property: ' + $entry[0] + ' = ' + $value) }
        $view.Close()
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($view)
    }
    $view = $db.OpenView('SELECT `FileName` FROM `File`')
    $view.Execute()
    $names = @()
    while ($record = $view.Fetch()) { $names += $record.StringData(1).Split('|')[-1] }
    $view.Close()
    foreach ($required in @('InstallStreet.exe','StorageSense.exe','InstallStreet.Cli.exe','UpdateHelper.exe','TaskRuntime.dll','GoogleChrome.dll','IconsExtract.dll','Git.dll','GitHubCLI.dll','desktopn.dll','Wallpaper.dll','ConsumerFeatures.dll','Dimmer.dll','Python.dll','iTunes.dll','iCloud.dll','iLoader.dll','VeraCrypt.dll','WinRAR.dll','LinkedInRemoval.dll','running.ico','app.asar')) {
        if ($names -notcontains $required) { throw "Missing MSI payload: $required" }
    }
    Write-Output ('MSI metadata and ' + $names.Count + ' payload files verified.')
} finally {
    if ($db) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($db) }
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($installer)
}
