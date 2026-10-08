$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$errors = $null; $tokens = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'workers\task.ps1'),[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Task source has parse errors.' }
foreach ($statement in $ast.EndBlock.Statements) {
    if ($statement -is [Management.Automation.Language.FunctionDefinitionAst]) { . ([scriptblock]::Create($statement.Extent.Text)) }
}
foreach ($entry in @(@('Rufus','Find-Rufus'),@('Visual Studio Code','Find-VSCode'))) {
    $target = & $entry[1]
    if ($target) { New-DesktopShortcut $entry[0] $target }
    else { Write-Output ($entry[0] + ' is not installed yet; its setup task will install it and create the shortcut.') }
}
