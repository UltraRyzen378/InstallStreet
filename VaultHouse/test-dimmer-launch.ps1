$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'workers\task.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Task script has syntax errors.' }
$definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Start-Dimmer' }, $true)
if (!$definition) { throw 'Start-Dimmer function is missing.' }
& {
    param($source)
    . ([scriptblock]::Create($source))
    $script:taskValid = $true; $script:taskRunning = $false; $script:taskLaunches = @()
    function Test-DimmerBinary([string]$Path) { return $script:taskValid }
    function Get-Process($Id, $Name, $ErrorAction) {
        if ($Id) { return [pscustomobject]@{ SessionId = 99 } }
        if ($script:taskRunning) { return [pscustomobject]@{ SessionId = 99 } }
    }
    function Start-Process($FilePath, $WorkingDirectory, $WindowStyle, [switch]$PassThru) {
        $script:taskLaunches += [pscustomobject]@{ Path = $FilePath; Directory = $WorkingDirectory; Style = $WindowStyle; PassThru = $PassThru.IsPresent }
        return [pscustomobject]@{ Id = 123 }
    }
    $target = 'C:\Fixture Apps\Dimmer\Dimmer.exe'
    Start-Dimmer $target | Out-Null
    if ($script:taskLaunches.Count -ne 1 -or $script:taskLaunches[0].Path -ne $target -or $script:taskLaunches[0].Directory -ne 'C:\Fixture Apps\Dimmer' -or $script:taskLaunches[0].Style -ne 'Hidden') { throw 'Expected background launch of the verified binary.' }
    $script:taskRunning = $true
    Start-Dimmer $target | Out-Null
    if ($script:taskLaunches.Count -ne 1) { throw 'Duplicate Dimmer launch was not suppressed.' }
    $script:taskValid = $false; $failed = $false
    try { Start-Dimmer $target | Out-Null } catch { $failed = $true }
    if (!$failed -or $script:taskLaunches.Count -ne 1) { throw 'Unverified binary launch was not blocked.' }
} $definition.Body.Parent.Extent.Text
Write-Output 'Dimmer launch fixtures passed: background launch, duplicate suppression, and binary verification. No applications were launched.'
