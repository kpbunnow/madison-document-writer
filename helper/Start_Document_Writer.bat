@echo off
rem Document Writer (diagnostics): first installation and troubleshooting by IT.
setlocal EnableExtensions DisableDelayedExpansion
set "PYTHONDONTWRITEBYTECODE=1"
title Document Writer (diagnostics)
echo Document Writer (diagnostics). This window shows start-up progress.
echo Closing this window stops a Document Writer helper started from it.
set "DW_LAUNCH=%~dp0launch.py"
if exist "%LOCALAPPDATA%\MadisonDocWriter\verified-install.json" set "DW_LAUNCH=%LOCALAPPDATA%\MadisonDocWriter\launch.py"
py -3 -c "import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
if errorlevel 1 goto try_python
py -3 -B "%DW_LAUNCH%" --share "%~dp0."
goto finished
:try_python
python -c "import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
if errorlevel 1 goto missing_python
python -B "%DW_LAUNCH%" --share "%~dp0."
goto finished
:missing_python
echo Python 3.10 or later was not found. Ask IT to install Python and enable its launcher.
pause
exit /b 1
:finished
if not errorlevel 1 exit /b 0
echo.
echo The launcher log is in %LOCALAPPDATA%\MadisonDocWriter\logs\launcher.log
pause
exit /b 1
