[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Resources,
    [string]$Destination = (Join-Path $env:LOCALAPPDATA 'VoidifyDesktop'),
    [string]$SpotifyDirectory = (Join-Path $env:APPDATA 'Spotify'),
    [string]$ProgramsDirectory = [Environment]::GetFolderPath('Programs'),
    [switch]$SkipShortcut
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
function Read-VersionField($File, $Pattern) {
    if (Test-Path -LiteralPath $File) {
        foreach ($line in [IO.File]::ReadLines($File)) {
            if ($line -match $Pattern) { return $Matches[1] }
        }
    }
}
function Copy-ClientFiles($Source, $Target) {
    foreach ($file in Get-ChildItem -LiteralPath $Source -File) {
        if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            $file.Name -in @('uninstall.exe','SpotifyLauncher.exe')) { continue }
        if ($file.Extension -in @('.exe','.dll','.sig','.pak','.bin') -or
            $file.Name -in @('icudtl.dat','vk_swiftshader_icd.json','toast_icon.png','crash_reporter.cfg')) {
            Copy-Item -LiteralPath $file.FullName -Destination $Target
        }
    }
    foreach ($name in @('locales','swiftshader')) {
        $dir = Join-Path $Source $name
        if (Test-Path -LiteralPath $dir -PathType Container) {
            $out = New-Item -ItemType Directory -Path (Join-Path $Target $name)
            Get-ChildItem -LiteralPath $dir -File | Copy-Item -Destination $out.FullName
        }
    }
}
$spotifyExe = Join-Path $SpotifyDirectory 'Spotify.exe'
if (!(Test-Path -LiteralPath $spotifyExe -PathType Leaf)) {
    throw 'Voidify Desktop needs the Windows desktop download from spotify.com. Open it once before setup. Store-only installations are not supported by the private player.'
}
$fileVersion = (Get-Item -LiteralPath $spotifyExe).VersionInfo.ProductVersion
$prefsVersion = Read-VersionField (Join-Path $SpotifyDirectory 'prefs') '^app\.last-launched-version="?([^"]+)"?$'
if (!$prefsVersion -or ($prefsVersion -ne $fileVersion -and !$prefsVersion.StartsWith("$fileVersion."))) {
    throw 'Open the installed Spotify client once after its latest update, then run setup again.'
}
$apps = Join-Path $SpotifyDirectory 'Apps'
if (!(Test-Path -LiteralPath (Join-Path $apps 'xpui.spa'))) {
    $legacy = Join-Path $env:APPDATA 'spicetify'
    $backupVersion = Read-VersionField (Join-Path $legacy 'config-xpui.ini') '^version\s*=\s*(\S+)\s*$'
    $apps = Join-Path $legacy 'Backup'
    if ($backupVersion -ne $prefsVersion -or !(Test-Path -LiteralPath (Join-Path $apps 'xpui.spa'))) {
        throw 'Spotify is already patched and a matching stock backup could not be found. Provide a clean Spotify desktop installation of this version.'
    }
}
$machine = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$arch = @{ AMD64='x64'; ARM64='arm64'; x86='x32' }[$machine]
$assets = Get-Content -Raw -LiteralPath (Join-Path $Resources 'cli-assets.json') | ConvertFrom-Json
$asset = $assets | Where-Object name -like "*-windows-$arch.zip"
if (!$asset) { throw "Unsupported architecture: $machine" }
$Destination = [IO.Path]::GetFullPath($Destination)
$builds = New-Item -Force -ItemType Directory -Path (Join-Path $Destination 'Builds')
$lock = [IO.File]::Open((Join-Path $Destination 'install.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
try {
    $archive = Join-Path $Destination $asset.name
    if (!(Test-Path -LiteralPath $archive) -or "sha256:$((Get-FileHash -LiteralPath $archive).Hash)" -ne $asset.digest) {
        Write-Host 'Downloading the Voidify engine and themes...'
        $part = "$archive.part"
        Invoke-WebRequest -UseBasicParsing -Uri $asset.url -OutFile $part
        if ("sha256:$((Get-FileHash -LiteralPath $part).Hash)" -ne $asset.digest) { throw 'Unexpected release checksum.' }
        Move-Item -LiteralPath $part -Destination $archive -Force
    }
    $fingerprint = $prefsVersion + $asset.digest
    foreach ($name in 'Install-Desktop.ps1','Player.cs','voidify-desktop.js','voidify-taskbar.ico','voidify-mark.svg','voidify-login.css','voidify-ui.css','voidify-color.ini','Apply-Brand.ps1') {
        $fingerprint += (Get-FileHash -LiteralPath (Join-Path $Resources $name)).Hash
    }
    $current = Join-Path $Destination 'current.txt'
    $reuse = $false
    if (Test-Path -LiteralPath $current) {
        $id = [IO.File]::ReadAllText($current)
        if ($id -match '^[0-9a-f]{32}$') {
            $build = Join-Path $builds.FullName $id
            $marker = Join-Path $build 'ready.txt'
            $reuse = (Test-Path -LiteralPath $marker) -and ([IO.File]::ReadAllText($marker) -eq $fingerprint) -and
                (Test-Path -LiteralPath (Join-Path $build 'Voidify.exe')) -and
                (Test-Path -LiteralPath (Join-Path $build 'Client/Apps/xpui/spicetify-routes-marketplace.js'))
        }
    }
    if (!$reuse) {
        $build = (New-Item -ItemType Directory -Path (Join-Path $builds.FullName ([guid]::NewGuid().ToString('N')))).FullName
        $client = (New-Item -ItemType Directory -Path (Join-Path $build 'Client')).FullName
        $appFiles = New-Item -ItemType Directory -Path (Join-Path $client 'Apps')
        Write-Host "Copying Spotify $fileVersion into Voidify Desktop..."
        Copy-ClientFiles $SpotifyDirectory $client
        Get-ChildItem -LiteralPath $apps -File -Filter '*.spa' | Copy-Item -Destination $appFiles.FullName
        $engine = Join-Path $build 'Engine'
        Expand-Archive -LiteralPath $archive -DestinationPath $engine
        # The engine archive predates the desktop branding assets.
        $manifestFile = Join-Path $engine 'CustomApps/marketplace/manifest.json'
        $manifest = [IO.File]::ReadAllText($manifestFile) | ConvertFrom-Json
        $manifest.icon = [IO.File]::ReadAllText((Join-Path $Resources 'voidify-mark.svg')).Trim()
        $manifest.'active-icon' = $manifest.icon
        [IO.File]::WriteAllText($manifestFile, ($manifest | ConvertTo-Json -Depth 8))
        Copy-Item -LiteralPath (Join-Path $Resources 'voidify-desktop.js') -Destination (Join-Path $engine 'Extensions')
        Copy-Item -LiteralPath (Join-Path $Resources 'voidify-taskbar.ico') -Destination $build
        $theme = New-Item -ItemType Directory -Force -Path (Join-Path $engine 'Themes/Voidify')
        Copy-Item -LiteralPath (Join-Path $Resources 'voidify-ui.css') -Destination (Join-Path $theme.FullName 'user.css')
        Copy-Item -LiteralPath (Join-Path $Resources 'voidify-color.ini') -Destination (Join-Path $theme.FullName 'color.ini')
        $launcher = Join-Path $build 'Voidify.exe'
        $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
        & $compiler /nologo /target:winexe "/out:$launcher" "/win32icon:$build\voidify-taskbar.ico" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $Resources 'Player.cs')
        if ($LASTEXITCODE) { throw 'Failed to compile the Voidify player launcher.' }
        $prefs = Join-Path $build 'prefs'
        [IO.File]::WriteAllText($prefs, ('app.last-launched-version="' + $prefsVersion + '"'))
        $config = (New-Item -ItemType Directory -Path (Join-Path $build 'Config')).FullName
        $ini = @"
[Setting]
spotify_path = $client
prefs_path = $prefs
current_theme = Voidify
color_scheme = Midnight
inject_css = 1
replace_colors = 1
check_spicetify_update = 0
[AdditionalOptions]
custom_apps = marketplace
extensions = voidify-desktop.js
"@
        [IO.File]::WriteAllText((Join-Path $config 'config-xpui.ini'), $ini)
        $saved = @{}
        $privateEnv = @{SPICETIFY_CONFIG=$config; SPICETIFY_STATE=$null; USERPROFILE=(Join-Path $build 'User'); APPDATA=(Join-Path $build 'Roaming'); LOCALAPPDATA=(Join-Path $build 'Local')}
        try {
            foreach ($key in $privateEnv.Keys) {
                $saved[$key] = [Environment]::GetEnvironmentVariable($key)
                [Environment]::SetEnvironmentVariable($key,$privateEnv[$key])
            }
            & (Join-Path $engine 'voidify.exe') backup apply --no-restart
            if ($LASTEXITCODE -or !(Test-Path -LiteralPath (Join-Path $client 'Apps\xpui\spicetify-routes-marketplace.js'))) { throw 'Could not prepare the private player. See the CLI output above.' }
        } finally {
            foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key,$saved[$key]) }
        }
        & ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $Resources 'Apply-Brand.ps1')))) -Build $build -Resources $Resources
        [IO.File]::WriteAllText((Join-Path $build 'ready.txt'), $fingerprint)
    }
    $launcher = Join-Path $build 'Voidify.exe'
    if (!$SkipShortcut) {
        $programs = $ProgramsDirectory
        $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $programs 'Voidify.lnk'))
        $shortcut.TargetPath = $launcher
        $shortcut.WorkingDirectory = $build
        $shortcut.IconLocation = "$build\voidify-taskbar.ico,0"
        $shortcut.Description = 'Voidify Desktop'
        $shortcut.Save()
    }
    if (!$reuse) {
        $next = Join-Path $Destination 'next.txt'
        [IO.File]::WriteAllText($next, (Split-Path -Leaf $build))
        if ([IO.File]::Exists($current)) { [IO.File]::Replace($next,$current,(Join-Path $Destination 'previous.txt')) }
        else { [IO.File]::Move($next,$current) }
    }
    Write-Host "Voidify Desktop is ready: $launcher"
} finally {
    $lock.Dispose()
}
