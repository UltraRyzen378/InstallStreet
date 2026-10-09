$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'workers\task.ps1'),[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Task script syntax errors.' }
foreach ($name in @('Find-DesktopShortcut','Test-DesktopShortcut','New-DesktopShortcut')) {
    $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name },$true)
    . ([scriptblock]::Create($definition.Extent.Text))
}
$fixture = Join-Path $root ('tmp\shortcut-tests\' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
$shell = New-Object -ComObject WScript.Shell
try {
    $target = Join-Path $env:SystemRoot 'System32\cmd.exe'
    $existing = Join-Path $fixture 'Installer shortcut.lnk'
    $link = $shell.CreateShortcut($existing)
    $link.TargetPath = $target; $link.Arguments = '/d'; $link.WorkingDirectory = $env:SystemRoot + '\'; $link.Save()
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
    if (!(Test-DesktopShortcut 'Different name' $target $fixture '/d' $env:SystemRoot)) { throw 'Renamed shortcut or trailing directory separator was not matched.' }
    if (Test-DesktopShortcut 'Different name' $target $fixture '/c exit' $env:SystemRoot) { throw 'Different shortcut arguments were incorrectly matched.' }
    if (Test-DesktopShortcut 'Different name' $target $fixture '/d' $fixture) { throw 'Different working directory was incorrectly matched.' }
    New-DesktopShortcut 'Different name' $target $fixture '/d' $env:SystemRoot | Out-Null
    if (@(Get-ChildItem -LiteralPath $fixture -Filter '*.lnk').Count -ne 1) { throw 'Duplicate shortcut was created.' }
    New-DesktopShortcut 'New command' $target $fixture '/c exit' $env:SystemRoot | Out-Null
    if (!(Test-DesktopShortcut 'New command' $target $fixture '/c exit' $env:SystemRoot)) { throw 'Missing shortcut was not created.' }
    Write-Output 'Shortcut fixtures passed: renamed shortcut reuse, normalized directory matching, argument distinction, and missing shortcut creation.'
} finally {
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
    $resolved = [IO.Path]::GetFullPath($fixture)
    $allowed = [IO.Path]::GetFullPath((Join-Path $root 'tmp\shortcut-tests')) + '\'
    if (!$resolved.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid fixture cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
