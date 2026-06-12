Get-NetTCPConnection -LocalPort 3000,5000 -ErrorAction SilentlyContinue | Where-Object State -eq Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host "Ports cleared"
