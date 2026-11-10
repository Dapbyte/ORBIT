@echo off
title Web-LLM Browser Runner (Port 9222)
echo ========================================================
echo Membuka Google Chrome dengan Remote Debugging Port 9222
echo Profil terisolasi: %USERPROFILE%\.web-llm-orchestrator\chrome-profile
echo ========================================================

if not exist "%USERPROFILE%\.web-llm-orchestrator\chrome-profile" (
    mkdir "%USERPROFILE%\.web-llm-orchestrator\chrome-profile"
)

set "CHROME_BIN=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_BIN%" set "CHROME_BIN=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_BIN%" set "CHROME_BIN=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_BIN%" set "CHROME_BIN=chrome.exe"

start "" "%CHROME_BIN%" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\.web-llm-orchestrator\chrome-profile" --disable-background-timer-throttling --disable-backgrounding-occluded-windows "https://claude.ai" "https://gemini.google.com/app?hl=id" "https://chat.qwen.ai" "https://chatgpt.com"

echo Browser Chrome telah dibuka dengan tab Claude, Gemini, Qwen, dan ChatGPT.
echo Profil disimpan di luar repositori proyek demi keamanan data.
echo Jendela browser ini jangan ditutup selama komunikasi berlangsung.
