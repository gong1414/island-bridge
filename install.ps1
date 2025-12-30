# Island Bridge installer for Windows
# Usage: irm https://raw.githubusercontent.com/gong1414/island-bridge/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "gong1414/island-bridge"
$InstallDir = "$env:LOCALAPPDATA\Programs\ibridge"

function Get-LatestVersion {
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    return $response.tag_name
}

function Install-IBridge {
    Write-Host ""
    $Version = Get-LatestVersion
    if (-not $Version) {
        Write-Host "Error: Could not get latest version" -ForegroundColor Red
        exit 1
    }

    Write-Host "🏝️  Installing Island Bridge $Version..." -ForegroundColor Cyan
    Write-Host "    Platform: windows-amd64"

    $Filename = "ibridge-windows-amd64.exe"
    $Url = "https://github.com/$Repo/releases/download/$Version/$Filename"

    Write-Host "    Downloading from: $Url"

    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $OutFile = Join-Path $InstallDir "ibridge.exe"

    # Download
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing

    Write-Host ""
    Write-Host "✅ Island Bridge installed to $OutFile" -ForegroundColor Green
    Write-Host ""

    # Check if in PATH
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($UserPath -notlike "*$InstallDir*") {
        Write-Host "⚠️  $InstallDir is not in your PATH" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Run this command to add it permanently:" -ForegroundColor White
        Write-Host ""
        Write-Host "   [Environment]::SetEnvironmentVariable('Path', `$env:Path + ';$InstallDir', 'User')" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   Then restart your terminal."
        Write-Host ""
        Write-Host "   Or run ibridge directly:" -ForegroundColor White
        Write-Host "   $OutFile --help" -ForegroundColor Cyan
    } else {
        Write-Host "🌉 Run 'ibridge --help' to get started!" -ForegroundColor Green
    }
}

Install-IBridge

