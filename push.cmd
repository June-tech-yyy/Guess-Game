@echo off
setlocal
rem Push this repo to GitHub.  Usage:  push.cmd June-tech-yyy/same-frequency
set REPO=%~1
if "%REPO%"=="" (
  echo Usage: push.cmd ^<user^>/^<repo^>
  exit /b 1
)
if not "%REPO:~0,8%"=="https://" set REPO=https://github.com/%REPO%
if not "%REPO:~-4%"==".git" set REPO=%REPO%.git
echo Remote: %REPO%
git remote remove origin >nul 2>&1
git remote add origin %REPO%
git branch -M main
git push -u origin main
if errorlevel 1 (
  echo.
  echo Failed. Two usual reasons:
  echo   1^) The repo does not exist yet - create an EMPTY one at https://github.com/new
  echo      Do not tick README / .gitignore / license, or the push will be rejected.
  echo   2^) Not signed in - the first push opens a browser window to authorize.
  exit /b 1
)
echo.
echo Done. Next time: git add -A ^&^& git commit -m "..." ^&^& git push
