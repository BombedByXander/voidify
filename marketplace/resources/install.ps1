$programs = [Environment]::GetFolderPath('Programs')
$shortcut = Join-Path $programs 'Voidify.lnk'
if (!(Test-Path -LiteralPath $shortcut)) {
    throw 'Install Voidify Desktop using the Windows command in the Voidify README. Setup includes Marketplace.'
}
Write-Host 'Voidify Desktop includes Marketplace. Open Voidify from the Start menu.'
