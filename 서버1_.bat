@echo off
title Shortsmong Backend - Port 8000
if exist ".venv\Scripts\activate.bat" call ".venv\Scripts\activate.bat"
python -m uvicorn web.app:app --host 0.0.0.0 --port 8000 --reload
pause
