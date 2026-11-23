param(
    [Parameter(Mandatory = $true)] [string] $VcpkgRoot,
    [Parameter(Mandatory = $true)] [string] $OutputDirectory
)

$ErrorActionPreference = 'Stop'
if (-not $env:VCToolsRedistDir) {
    throw 'Run this script from a Visual Studio Developer PowerShell.'
}
$crt = Get-ChildItem -LiteralPath (Join-Path $env:VCToolsRedistDir 'x64') -Directory -Filter 'Microsoft.VC*.CRT' |
    Sort-Object Name -Descending | Select-Object -First 1
if (-not $crt) { throw 'The x64 Visual C++ app-local runtime was not found.' }

$root = Split-Path -Parent $PSScriptRoot
$env:VCPKG_ROOT = (Resolve-Path -LiteralPath $VcpkgRoot).Path
$env:VCPKGRS_DYNAMIC = '1'
$vcpkg = Join-Path $env:VCPKG_ROOT 'vcpkg.exe'
$output = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Specify a new output directory.' }
$export = Join-Path ([System.IO.Path]::GetTempPath()) ('upright-pic-' + [guid]::NewGuid())
$target = Join-Path $root 'target'
$triplet = 'x86_64-pc-windows-msvc'

Push-Location -LiteralPath $root
try {
    & $vcpkg install 'libheif[core,kvazaar,libde265]:x64-windows' --classic
    if ($LASTEXITCODE -ne 0) { throw 'Could not install the HEIC build dependencies.' }
    & cargo build --locked --release --target $triplet --target-dir $target
    if ($LASTEXITCODE -ne 0) { throw 'The Windows build failed.' }
    & $vcpkg export 'libheif:x64-windows' --raw "--output-dir=$export" --output=codecs
    if ($LASTEXITCODE -ne 0) { throw 'Could not collect the HEIC runtime DLLs.' }

    $installed = Join-Path $export 'codecs/installed/x64-windows'
    New-Item -ItemType Directory -Path $output | Out-Null
    Copy-Item -LiteralPath (Join-Path $target "$triplet/release/upright-pic.exe") -Destination $output
    Get-ChildItem -LiteralPath (Join-Path $installed 'bin') -Filter '*.dll' |
        Copy-Item -Destination $output
    Get-ChildItem -LiteralPath $crt.FullName -Filter '*.dll' | Copy-Item -Destination $output
    $licenses = New-Item -ItemType Directory -Path (Join-Path $output 'licenses')
    Copy-Item -LiteralPath (Join-Path $root 'assets/NOTICE'), (Join-Path $root 'assets/Apache-2.0.txt') -Destination $licenses.FullName
    Get-ChildItem -LiteralPath (Join-Path $installed 'share') -Filter 'copyright' -Recurse -File |
        ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $licenses.FullName ($_.Directory.Name + '.txt')) }
    & (Join-Path $output 'upright-pic.exe') --version
    if ($LASTEXITCODE -ne 0) { throw 'The packaged executable failed to start.' }
} finally {
    Pop-Location
    if (Test-Path -LiteralPath $export) { Remove-Item -LiteralPath $export -Recurse -Force }
}
