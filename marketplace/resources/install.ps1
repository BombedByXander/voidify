[CmdletBinding()]
param(
    [Parameter()]
    [switch]$BypassAdmin
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$exe = Join-Path $env:LOCALAPPDATA 'voidify\voidify.exe'
if (-not (Test-Path -LiteralPath $exe)) {
    throw 'Install Voidify first using the PowerShell command in the repository README.'
}
$flags = @()
if ($BypassAdmin) { $flags += '--bypass-admin' }
& $exe @flags config custom_apps marketplace current_theme marketplace inject_css 1 replace_colors 1
if ($LASTEXITCODE) { throw 'Voidify configuration failed.' }
& $exe @flags auto apply
if ($LASTEXITCODE) { throw 'Voidify could not apply Marketplace.' }
