@echo off
title Shortsmong Frontend - Port 5173
set "PATH=C:\Program Files\nodejs;%PATH%"
pushd "%~dp0react-app"
call npm run dev
popd
pause
