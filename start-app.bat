@echo off
echo Starting Global Connect Application...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd server ;npm install ;npm start"

echo Waiting 5 seconds for backend to start...
timeout /t 5 /nobreak > nul

echo Starting Frontend Client...
start "Frontend Client" cmd /k "cd client ;npm install;npm start"

echo.
echo Application is starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to close this window...
pause > nul
