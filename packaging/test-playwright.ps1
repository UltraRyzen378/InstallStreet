# Validates the Playwright task without downloading or installing applications.
# Usage: .\packaging\test-playwright.ps1 [-Build]
[CmdletBinding()]
param([switch]$Build)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$startingLocation = Get-Location
$taskDataRoot = Join-Path ([IO.Path]::GetTempPath()) ('installstreet-playwright-test-' + [guid]::NewGuid().ToString('N'))

function Assert-Check([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
}
function Assert-Throws([scriptblock]$Action, [string]$Expected) {
    try { & $Action } catch {
        if ($_.Exception.Message -notlike ('*' + $Expected + '*')) { throw }
        return
    }
    throw "Expected failure: $Expected"
}

try {
    Set-Location -LiteralPath $root
    $parseErrors = $null
    $tokens = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'workers\task.ps1'), [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors) { throw ($parseErrors | Out-String) }
    # Load only these function definitions, never the task script's execution block.
    foreach ($name in @('Get-PlaywrightProject', 'Test-Playwright', 'Install-Playwright')) {
        $definition = $ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name}, $true)
        if (!$definition) { throw "Missing function: $name" }
        Invoke-Expression $definition.Extent.Text
    }

    function Refresh-TaskEnvironment {}
    $script:calls = @()
    $script:failInit = $true
    $script:failBrowsers = $false
    $script:missingNode = $false
    function Mock-Npm {
        $script:calls += ('npm ' + ($args -join ' '))
        $global:LASTEXITCODE = 0
        if ($script:failInit) { $global:LASTEXITCODE = 17 }
    }
    function Mock-Node {
        $script:calls += ('node ' + ($args -join ' '))
        $global:LASTEXITCODE = 0
        if ($script:failBrowsers) { $global:LASTEXITCODE = 23 }
    }
    function Get-Command {
        param($Name, $ErrorAction)
        if ($Name -eq 'npm.cmd') { return @{ Source = 'Mock-Npm' } }
        if ($Name -eq 'node.exe' -and !$script:missingNode) { return @{ Source = 'Mock-Node' } }
        return $null
    }

    Assert-Check (!(Test-Playwright)) 'An absent installation must not pass detection.'
    Assert-Check ($script:calls.Count -eq 0) 'Check must not initialize or download packages.'
    Assert-Throws { Install-Playwright } 'initialization failed: 17'
    Assert-Check ($PWD.Path -eq $root -and $script:calls.Count -eq 1) 'Initialization failure must stop this task and restore the working directory.'

    $script:failInit = $false
    Install-Playwright
    # PowerShell functions consume the standalone -- token; native npm.cmd receives it.
    Assert-Check ($script:calls[1] -match 'npm init playwright@latest --yes.*--quiet') 'Initializer must use noninteractive defaults.'
    Assert-Check ($script:calls[-1] -match 'cli.js install$') 'Browsers must be installed after initialization.'
    $project = Get-PlaywrightProject
    Set-Content -LiteralPath (Join-Path $project 'package.json') -Value '{}'
    Set-Content -LiteralPath (Join-Path $project 'playwright.config.ts') -Value 'keep my config'
    $script:failBrowsers = $true
    Assert-Throws { Install-Playwright } 'browser installation failed: 23'
    Assert-Check ($script:calls[-2] -eq 'npm install --save-dev @playwright/test@latest') 'Retry must repair packages.'
    Assert-Check ((Get-Content -LiteralPath (Join-Path $project 'playwright.config.ts')) -eq 'keep my config') 'Retry must preserve user configuration.'
    Assert-Check ($PWD.Path -eq $root) 'Browser failure must restore the working directory.'
    $script:missingNode = $true
    Assert-Throws { Install-Playwright } 'needs Node.js and npm'
    Write-Host 'PASS: Playwright worker checks (no application installs or downloads).'

    & node.exe --test --test-isolation=none electron/presets.test.js
    if ($LASTEXITCODE -ne 0) { throw "Preset and media tests failed: $LASTEXITCODE" }
    if ($Build) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'VaultHouse\build.ps1')
        if ($LASTEXITCODE -ne 0) { throw "Native task build failed: $LASTEXITCODE" }
    }
    Write-Host 'Playwright validation completed successfully.'
} finally {
    Set-Location -LiteralPath $startingLocation.Path
    # Delete only this script's unique, verified temporary fixture directory.
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    $fixture = [IO.Path]::GetFullPath($taskDataRoot)
    if (!$fixture.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($fixture) -notmatch '^installstreet-playwright-test-[a-f0-9]{32}$') {
        throw 'Refusing to remove an unexpected fixture path.'
    }
    if (Test-Path -LiteralPath $fixture) { Remove-Item -LiteralPath $fixture -Recurse -Force }
}
