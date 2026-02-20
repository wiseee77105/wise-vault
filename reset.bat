@echo off
echo 🔮 WiseVault - Resetting ghost processes...
echo Cleaning up ports 3001 and 5173...

taskkill /F /IM node.exe /T 2>nul
taskkill /F /IM cmd.exe /FI "WINDOWTITLE eq npm*" 2>nul

echo.
echo ✅ Done! All WiseVault processes have been stopped.
echo You can now run "npm run dev" again.
pause
