# Growth Engine Unified Starter
# Starts backend, workers and frontend in separate background processes

Write-Host "🚀 Starting Backend Server (Port 5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"

Write-Host "⚙️ Starting Background Workers..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run worker"

Write-Host "🌐 Starting Frontend (Port 5173)..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "✅ All systems ignition!" -ForegroundColor Green
Write-Host "Backend: http://127.0.0.1:5000"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Workers: Running in a dedicated background window"

