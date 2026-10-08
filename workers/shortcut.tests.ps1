$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$errors = $null; $tokens = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'workers\task.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Task source has parse errors.' }
foreach ($statement in $ast.EndBlock.Statements) {
    if ($statement -is [Management.Automation.Language.FunctionDefinitionAst]) { . ([scriptblock]::Create($statement.Extent.Text)) }
}
$fixture = Join-Path $root ('tmp\shortcut-tests\' + [Guid]::NewGuid().ToString('N'))
$desktop = Join-Path $fixture 'Desktop'
New-Item -ItemType Directory -Path $desktop -Force | Out-Null
$target = Join-Path $fixture 'app.exe'
$other = Join-Path $fixture 'other.exe'
Set-Content -LiteralPath $target -Value 'fixture only'
Set-Content -LiteralPath $other -Value 'fixture only'
if (Test-DesktopShortcut 'Fixture' $target $desktop) { throw 'A missing shortcut must not be ready.' }
New-DesktopShortcut 'Fixture' $target $desktop
if (!(Test-DesktopShortcut 'Fixture' $target $desktop)) { throw 'Correct shortcut was not detected.' }
if (Test-DesktopShortcut 'Fixture' $other $desktop) { throw 'Wrong target must not be ready.' }
New-DesktopShortcut 'Fixture' $other $desktop
if (!(Test-DesktopShortcut 'Fixture' $other $desktop)) { throw 'Incorrect shortcut was not repaired.' }
$failed = $false
try { New-DesktopShortcut 'Missing' (Join-Path $fixture 'missing.exe') $desktop } catch { $failed = $true }
if (!$failed) { throw 'Missing executable must be rejected.' }
New-DesktopShortcut 'Fixture' $target $desktop '-app'
if (!(Test-DesktopShortcut 'Fixture' $target $desktop '-app')) { throw 'Launch arguments were not retained.' }
if (Test-DesktopShortcut 'Fixture' $target $desktop '') { throw 'Wrong launch arguments must not be ready.' }
Write-Output 'Desktop shortcut tests passed. Real desktop was not changed.'

