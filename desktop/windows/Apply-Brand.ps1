param([Parameter(Mandatory)][string]$Build, [Parameter(Mandatory)][string]$Resources)
$ErrorActionPreference = 'Stop'
$mark = [IO.File]::ReadAllText((Join-Path $Resources 'voidify-mark.svg')).Trim()
$badge = '<div id="voidify-welcome-brand">' + $mark.Replace('<svg ', '<svg aria-hidden="true" ') + '<span>voidify</span></div>'
foreach ($directory in 'Client/Apps/login','Roaming/spicetify/Extracted/Raw/login','Roaming/spicetify/Extracted/Themed/login') {
    $login = Join-Path $Build $directory
    $index = Join-Path $login 'index.html'
    if (!(Test-Path -LiteralPath $index)) { continue }
    Copy-Item -LiteralPath (Join-Path $Resources 'voidify-login.css'),(Join-Path $Resources 'voidify-mark.svg') -Destination $login -Force
    $html = [IO.File]::ReadAllText($index)
    if (!$html.Contains('id="voidify-welcome-brand"')) {
        $html = $html.Replace('</head>','<link rel="stylesheet" href="voidify-login.css"></head>')
        $html = [regex]::Replace($html,'(<body\b[^>]*>)',('$1' + $badge), 'IgnoreCase')
        $html = [regex]::Replace($html,'<title>[^<]*</title>','<title>Voidify</title>', 'IgnoreCase')
        [IO.File]::WriteAllText($index,$html)
    }
}
