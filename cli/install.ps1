& {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $repo = 'BombedByXander/voidify'
    $commit = (Invoke-RestMethod "https://api.github.com/repos/$repo/commits/main").sha
    $raw = "https://raw.githubusercontent.com/$repo/$commit"
    $stage = Join-Path ([IO.Path]::GetTempPath()) ("voidify-setup-" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $stage | Out-Null
    $files = @{'Apply-Brand.ps1'='desktop/windows/Apply-Brand.ps1'; 'voidify-login.css'='desktop/windows/voidify-login.css'; 'voidify-mark.svg'='marketplace/src/assets/icon-filled.svg'; 'Install-Desktop.ps1'='desktop/windows/Install-Desktop.ps1'; 'Player.cs'='desktop/windows/Player.cs'; 'voidify-desktop.js'='desktop/windows/voidify-desktop.js'; 'voidify.ico'='docs/public/images/favicon.ico'; 'cli-assets.json'='cli-assets.json'}
    try {
        foreach ($name in $files.Keys) {
            Invoke-WebRequest -UseBasicParsing -Uri "$raw/$($files[$name])" -OutFile (Join-Path $stage $name)
        }
        & ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $stage 'Install-Desktop.ps1')))) -Resources $stage
    } finally {
        foreach ($name in $files.Keys) {
            $item = Join-Path $stage $name
            if (Test-Path -LiteralPath $item) { Remove-Item -LiteralPath $item -Force }
        }
        [IO.Directory]::Delete($stage)
    }
}
