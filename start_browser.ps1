# Cari path instalasi Google Chrome secara dinamis
$candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe")
)

$chromePath = $null
foreach ($path in $candidates) {
    if ($path -and (Test-Path $path)) {
        $chromePath = $path
        break
    }
}

if (-not $chromePath) {
    $chromePath = "chrome.exe" # Fallback jika ada di system PATH
}

$profileDir = Join-Path $env:USERPROFILE ".web-llm-orchestrator\chrome-profile"

if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Membuka Google Chrome dengan Remote Debugging Port 9222" -ForegroundColor Green
Write-Host "Path Chrome      : $chromePath" -ForegroundColor DarkGray
Write-Host "Profil terisolasi: $profileDir" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

Start-Process -FilePath $chromePath -ArgumentList `
    "--remote-debugging-port=9222", `
    "--user-data-dir=`"$profileDir`"", `
    "--disable-background-timer-throttling", `
    "--disable-backgrounding-occluded-windows", `
    "https://claude.ai", "https://gemini.google.com/app?hl=id", "https://chat.qwen.ai", "https://chatgpt.com"

Write-Host "Browser Chrome telah dibuka dengan tab Claude, Gemini, Qwen, dan ChatGPT!" -ForegroundColor Green
Write-Host "Profil disimpan di luar repositori proyek demi keamanan." -ForegroundColor Yellow
Write-Host "Jendela browser ini jangan ditutup selama komunikasi berlangsung." -ForegroundColor DarkGray
