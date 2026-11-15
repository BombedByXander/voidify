$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

#region Variables
$voidifyFolderPath = "$env:LOCALAPPDATA\voidify"
#endregion Variables

#region Functions
function Write-Success {
  [CmdletBinding()]
  param ()
  process {
    Write-Host -Object ' > OK' -ForegroundColor 'Green'
  }
}

function Write-Unsuccess {
  [CmdletBinding()]
  param ()
  process {
    Write-Host -Object ' > ERROR' -ForegroundColor 'Red'
  }
}

function Test-Admin {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object "Checking if the script is not being run as administrator..." -NoNewline
  }
  process {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    -not $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  }
}

function Test-PowerShellVersion {
  [CmdletBinding()]
  param ()
  begin {
    $PSMinVersion = [version]'5.1'
  }
  process {
    Write-Host -Object 'Checking if your PowerShell version is compatible...' -NoNewline
    $PSVersionTable.PSVersion -ge $PSMinVersion
  }
}

function Get-Voidify {
  [CmdletBinding()]
  param ()
  begin {
    $machine = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $machine = $env:PROCESSOR_ARCHITEW6432 }
    if ($machine -eq 'AMD64') {
      $architecture = 'x64'
    }
    elseif ($machine -eq 'ARM64') {
      $architecture = 'arm64'
    }
    else {
      $architecture = 'x32'
    }
    if ($v) {
      if ($v -match '^\d+\.\d+\.\d+$') {
        $targetVersion = $v
      }
      else {
        Write-Warning -Message "You have specified an invalid voidify version: $v `nThe version must be in the following format: 1.2.3"
        Pause
        exit
      }
    }
    else {
      Write-Host -Object 'Fetching the latest voidify version...' -NoNewline
      $latestRelease = Invoke-RestMethod -Uri 'https://api.github.com/repos/BombedByXander/voidify/releases/latest'
      $targetVersion = $latestRelease.tag_name -replace 'v', ''
      Write-Success
    }
    $archivePath = Join-Path ([IO.Path]::GetTempPath()) ("voidify-" + [guid]::NewGuid() + ".zip")
  }
  process {
    Write-Host -Object "Downloading voidify v$targetVersion..." -NoNewline
    $Parameters = @{
      Uri             = "https://github.com/BombedByXander/voidify/releases/download/v$targetVersion/voidify-$targetVersion-windows-$architecture.zip"
      UseBasicParsing = $true
      OutFile         = $archivePath
    }
    $release = Invoke-RestMethod "https://api.github.com/repos/BombedByXander/voidify/releases/tags/v$targetVersion"
    $asset = $release.assets | Where-Object name -eq "voidify-$targetVersion-windows-$architecture.zip"
    Invoke-WebRequest @Parameters
    $digest = 'sha256:' + (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($digest -ne $asset.digest) { throw 'Voidify release checksum mismatch.' }
    Write-Success
  }
  end {
    $archivePath
  }
}

function Add-VoidifyToPath {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object 'Making voidify available in the PATH...' -NoNewline
    $user = [EnvironmentVariableTarget]::User
    $path = [Environment]::GetEnvironmentVariable('PATH', $user)
  }
  process {
    if ($path -notlike "*$voidifyFolderPath*") {
      $path = "$path;$voidifyFolderPath"
    }
  }
  end {
    [Environment]::SetEnvironmentVariable('PATH', $path, $user)
    if (($env:PATH -split ';') -notcontains $voidifyFolderPath) {
      $env:PATH = "$env:PATH;$voidifyFolderPath"
    }
    Write-Success
  }
}

function Install-Voidify {
  [CmdletBinding()]
  param ()
  begin {
    Write-Host -Object 'Installing voidify...'
  }
  process {
    $archivePath = Get-Voidify
    Write-Host -Object 'Extracting voidify...' -NoNewline
    Expand-Archive -Path $archivePath -DestinationPath $voidifyFolderPath -Force
    Write-Success
    Add-VoidifyToPath
  }
  end {
    Remove-Item -Path $archivePath -Force -ErrorAction 'SilentlyContinue'
    Write-Host -Object 'voidify was successfully installed!' -ForegroundColor 'Green'
  }
}
#endregion Functions

#region Main
#region Checks
if (-not (Test-PowerShellVersion)) {
  Write-Unsuccess
  Write-Warning -Message 'PowerShell 5.1 or higher is required to run this script'
  Write-Warning -Message "You are running PowerShell $($PSVersionTable.PSVersion)"
  Write-Host -Object 'PowerShell 5.1 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/skypeforbusiness/set-up-your-computer-for-windows-powershell/download-and-install-windows-powershell-5-1'
  Write-Host -Object 'PowerShell 7 install guide:'
  Write-Host -Object 'https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows'
  Pause
  exit
}
else {
  Write-Success
}
if (-not (Test-Admin)) {
  Write-Unsuccess
  Write-Warning -Message "The script was run as administrator. This can result in problems with the installation process or unexpected behavior. Do not continue if you do not know what you are doing."
  $Host.UI.RawUI.Flushinputbuffer()
  $choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription '&Yes', 'Abort installation.'),
    (New-Object System.Management.Automation.Host.ChoiceDescription '&No', 'Resume installation.')
  )
  $choice = $Host.UI.PromptForChoice('', 'Do you want to abort the installation process?', $choices, 0)
  if ($choice -eq 0) {
    Write-Host -Object 'voidify installation aborted' -ForegroundColor 'Yellow'
    Pause
    exit
  }
}
else {
  Write-Success
}
#endregion Checks

#region Voidify
$installedVoidify = Join-Path -Path $voidifyFolderPath -ChildPath 'voidify.exe'
if (-not (Test-Path -LiteralPath $installedVoidify -PathType Leaf)) {
  $installedCommand = Get-Command -Name 'voidify' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($installedCommand) {
    $installedVoidify = $installedCommand.Source
  }
  else {
    $installedVoidify = $null
  }
}

if ($installedVoidify) {
  $Host.UI.RawUI.Flushinputbuffer()
  $choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription '&Yes', 'Run voidify update.'),
    (New-Object System.Management.Automation.Host.ChoiceDescription '&No', 'Continue with installation.')
  )
  $choice = $Host.UI.PromptForChoice('', 'Voidify is already installed. Do you want to fix your installation?', $choices, 0)
  if ($choice -eq 0) {
    & $installedVoidify update
    if ($LASTEXITCODE -ne 0) {
      throw "Voidify update failed with exit code $LASTEXITCODE."
    }
    return
  }
}

Install-Voidify
Write-Host -Object "`nRun" -NoNewline
Write-Host -Object ' voidify -h ' -NoNewline -ForegroundColor 'Cyan'
Write-Host -Object 'to get started'
#endregion Voidify

#region Marketplace
$Host.UI.RawUI.Flushinputbuffer()
$choices = [System.Management.Automation.Host.ChoiceDescription[]] @(
    (New-Object System.Management.Automation.Host.ChoiceDescription "&Yes", "Install Voidify Marketplace."),
    (New-Object System.Management.Automation.Host.ChoiceDescription "&No", "Do not install Voidify Marketplace.")
)
$choice = $Host.UI.PromptForChoice('', "`nDo you also want to install Voidify Marketplace? It will become available within the Spotify client, where you can easily install themes and extensions.", $choices, 0)
if ($choice -eq 1) {
  Write-Host -Object 'voidify Marketplace installation aborted' -ForegroundColor 'Yellow'
}
else {
  Write-Host -Object 'Starting the voidify Marketplace installation script..'
  $exe = Join-Path $voidifyFolderPath 'voidify.exe'
  & $exe config custom_apps marketplace current_theme marketplace inject_css 1 replace_colors 1
  if ($LASTEXITCODE) { throw 'Voidify Marketplace configuration failed.' }
  & $exe auto apply
  if ($LASTEXITCODE) { throw 'Voidify could not apply Marketplace. Check the CLI output above.' }
}
#endregion Marketplace
#endregion Main
