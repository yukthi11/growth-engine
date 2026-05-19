$DOCKER_BIN = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

function Start-Engine {
    Write-Host "🚀 Starting Growth Engine Bunker..." -ForegroundColor Cyan
    & $DOCKER_BIN compose up --build -d
    Write-Host "✅ Bunker is live at http://localhost:5000" -ForegroundColor Green
}

function Stop-Engine {
    Write-Host "🛑 Stopping Growth Engine Bunker..." -ForegroundColor Yellow
    & $DOCKER_BIN compose down
    Write-Host "💤 Bunker is offline." -ForegroundColor Gray
}

function Status-Engine {
    & $DOCKER_BIN compose ps
}

# Create helper scripts
Set-Content -Path "start-backend.ps1" -Value "& '$PSScriptRoot\engine.ps1'; Start-Engine"
Set-Content -Path "stop-backend.ps1" -Value "& '$PSScriptRoot\engine.ps1'; Stop-Engine"
Set-Content -Path "status-backend.ps1" -Value "& '$PSScriptRoot\engine.ps1'; Status-Engine"

Write-Host "Quick commands created! You can now use:" -ForegroundColor Green
Write-Host "  ./start-backend.ps1"
Write-Host "  ./stop-backend.ps1"
Write-Host "  ./status-backend.ps1"
