$DOCKER_BIN = "C:\Program Files\Docker\Docker\resources\bin\docker.exe"

Write-Host "📊 Growth Engine Bunker Status:" -ForegroundColor Cyan
& $DOCKER_BIN compose ps
