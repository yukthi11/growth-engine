$DOCKER_BIN = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

Write-Host "🚀 Starting Growth Engine Bunker (Backend)..." -ForegroundColor Cyan
& $DOCKER_BIN compose up --build -d
Write-Host "`n✅ Bunker is live!" -ForegroundColor Green
Write-Host "API: http://localhost:5000" -ForegroundColor Gray
Write-Host "Check status anytime with: ./status-backend.ps1" -ForegroundColor Gray
