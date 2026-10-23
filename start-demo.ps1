# Starts the full local AgroSaarthi stack, each service in its own PowerShell window:
#   MongoDB (local dev) -> model service (TEST FIXTURE model) -> backend API -> Angular web app.
# Usage (from the repository root):  powershell -ExecutionPolicy Bypass -File .\start-demo.ps1
# Close the four windows to stop everything. Requires backend/.env (see docs/LOCAL_RUN.md).
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$envFile = Join-Path $root 'backend\.env'
if (-not (Test-Path $envFile)) { throw "backend\.env not found. Follow docs/LOCAL_RUN.md first." }

# Read the shared model-service token from backend/.env without printing it.
$tokenLine = Get-Content $envFile | Where-Object { $_ -match '^MODEL_SERVICE_TOKEN=' } | Select-Object -First 1
if (-not $tokenLine) { throw "MODEL_SERVICE_TOKEN missing in backend\.env" }
$token = $tokenLine.Substring('MODEL_SERVICE_TOKEN='.Length)

function Test-Port([int]$port) {
  # ng serve listens on IPv6 localhost (::1) only, the others on 127.0.0.1 - try both.
  foreach ($addr in @('127.0.0.1', '::1')) {
    try { $c = New-Object Net.Sockets.TcpClient($addr, $port); $c.Close(); return $true } catch { }
  }
  return $false
}
function Start-Window([string]$title, [string]$dir, [string]$command) {
  $full = "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location '$dir'; $command"
  Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $full | Out-Null
}
function Wait-Port([int]$port, [string]$name, [int]$seconds = 90) {
  for ($i = 0; $i -lt $seconds; $i++) { if (Test-Port $port) { Write-Host "  $name is up (port $port)"; return } ; Start-Sleep -Seconds 1 }
  Write-Warning "$name did not open port $port within $seconds s - check its window."
}

Write-Host 'Starting AgroSaarthi demo stack...'
if (Test-Port 27017) { Write-Host '  MongoDB already running' } else {
  Start-Window 'AgroSaarthi - MongoDB' (Join-Path $root 'backend') 'npm run dev:mongo'
  Wait-Port 27017 'MongoDB' 120
}
if (Test-Port 8000) { Write-Host '  Model service already running' } else {
  $ms = Join-Path $root 'model-service'
  if (-not (Test-Path (Join-Path $ms 'models\test-fixture\model_card.json'))) {
    & (Join-Path $ms '.venv\Scripts\python.exe') (Join-Path $ms 'scripts\build_test_fixture.py') (Join-Path $ms 'models\test-fixture')
  }
  Start-Window 'AgroSaarthi - model service' $ms "`$env:MODEL_SERVICE_TOKEN='$token'; `$env:MODEL_DIR='models/test-fixture'; `$env:PORT='8000'; `$env:HOST='127.0.0.1'; .\.venv\Scripts\python.exe -m app"
  Wait-Port 8000 'Model service'
}
if (Test-Port 4000) { Write-Host '  Backend API already running' } else {
  Start-Window 'AgroSaarthi - API' (Join-Path $root 'backend') 'npx tsx src/server.ts'
  Wait-Port 4000 'Backend API'
}
if (Test-Port 4200) { Write-Host '  Web app already running' } else {
  Start-Window 'AgroSaarthi - web' (Join-Path $root 'frontend') 'npx ng serve --port 4200'
  Wait-Port 4200 'Web app' 180
}
Write-Host ''
Write-Host 'Ready: http://localhost:4200'
Start-Process 'http://localhost:4200'
