$DOCKER_BIN = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

Write-Host "🛑 Stopping Growth Engine Bunker..." -ForegroundColor Yellow
& $DOCKER_BIN compose down
Write-Host "`n💤 Bunker is offline. Your data is safe." -ForegroundColor Gray
