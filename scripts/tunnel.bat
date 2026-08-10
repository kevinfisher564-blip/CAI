@echo off
TITLE Character AI - RunPod SSH Tunnel Launcher
echo ==========================================================
echo  Character AI - Windows 11 SSH Tunnel Setup
echo ==========================================================
echo.
set /p RUNPOD_IP="Enter your RunPod Public IP (e.g. 198.51.100.24): "
set /p RUNPOD_PORT="Enter your RunPod SSH Port (e.g. 22044): "

echo.
echo Connecting SSH Tunnel: localhost:3000 -> RunPod:3000 and localhost:8000 -> RunPod:8000
echo Keep this window OPEN while chatting!
echo.

ssh -N -L 3000:localhost:3000 -L 8000:localhost:8000 root@%RUNPOD_IP% -p %RUNPOD_PORT%
pause
