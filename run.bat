@echo off
cd /d "%~dp0"
if not exist ".env" (
  echo Copy .env.example to .env and configure it first.
  pause
  exit /b 1
)
if not exist "node_modules" (
  call npm install
  if errorlevel 1 pause & exit /b 1
)
call npm start
pause
