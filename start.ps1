# Start Datrix dev environment
# Run from the Datrix/ root directory

Write-Host "Starting Datrix backend (FastAPI on :8000)..." -ForegroundColor Cyan
$backend = Start-Process -FilePath ".\backend\.venv\Scripts\uvicorn.exe" `
    -ArgumentList "app.main:app", "--reload", "--port", "8000" `
    -WorkingDirectory ".\backend" -PassThru

Write-Host "Starting Datrix frontend (Vite on :5173)..." -ForegroundColor Cyan
$node = (Get-Command npm).Source
$frontend = Start-Process -FilePath $node `
    -ArgumentList "run", "dev" `
    -WorkingDirectory ".\frontend" -PassThru

Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  API docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor Yellow

try {
    Wait-Process -Id $backend.Id
} finally {
    Stop-Process -Id $backend.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -ErrorAction SilentlyContinue
}
