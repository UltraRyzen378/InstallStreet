$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dist = [IO.Path]::GetFullPath((Join-Path $root 'dist'))
$prefix = $dist.TrimEnd('\') + '\'
$releases = Join-Path $dist 'releases'
New-Item -ItemType Directory -Path $releases -Force | Out-Null
foreach ($file in Get-ChildItem -LiteralPath $dist -File) {
    if ($file.Name -notmatch '^InstallStreet-(\d+\.\d+\.\d+)-x64\.(msi|zip)$') { continue }
    $folder = [IO.Path]::GetFullPath((Join-Path $releases $Matches[1]))
    $target = [IO.Path]::GetFullPath((Join-Path $folder $file.Name))
    if (!$file.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -or !$target.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Package path escaped dist.' }
    if (Test-Path -LiteralPath $target) { throw "Package already exists; refusing to overwrite: $target" }
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    Move-Item -LiteralPath $file.FullName -Destination $target
}
$index = @('# InstallStreet packages', '', 'Newest versions first. Each folder includes SHA256SUMS.txt.', '')
foreach ($folder in Get-ChildItem -LiteralPath $releases -Directory | Where-Object Name -Match '^\d+\.\d+\.\d+$' | Sort-Object { [version]$_.Name } -Descending) {
    $files = @(Get-ChildItem -LiteralPath $folder.FullName -File | Where-Object Extension -In @('.msi','.zip') | Sort-Object Name)
    $hashes = $files | ForEach-Object {
        $stream = [IO.File]::OpenRead($_.FullName)
        $sha = [Security.Cryptography.SHA256]::Create()
        try { ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() + '  ' + $_.Name }
        finally { $stream.Dispose(); $sha.Dispose() }
    }
    Set-Content -LiteralPath (Join-Path $folder.FullName 'SHA256SUMS.txt') -Value $hashes -Encoding ascii
    foreach ($file in $files) { $index += '- [' + $file.Name + '](releases/' + $folder.Name + '/' + $file.Name + ')' }
}
Set-Content -LiteralPath (Join-Path $dist 'PACKAGES.md') -Value $index -Encoding utf8
# Keep the previous flat checksum manifest as historical metadata, not a current index.
$legacy = Join-Path $dist 'SHA256SUMS.txt'
if (Test-Path -LiteralPath $legacy) {
    $archive = Join-Path $releases ('previous-checksums-' + [guid]::NewGuid().ToString('N') + '.txt')
    Move-Item -LiteralPath $legacy -Destination $archive
}
Write-Output ('Packages organized in ' + $releases)
