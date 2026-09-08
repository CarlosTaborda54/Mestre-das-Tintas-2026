@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Mestre das Tintas - Abrir aplicativo
color 1F
set "LOG=%CD%\app-start-log.txt"
set "NODE_DIR=%ProgramFiles%\nodejs"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

echo ========================================================
echo   MESTRE DAS TINTAS - ABRIR APLICATIVO
echo ========================================================
echo.

where node >nul 2>&1
if not errorlevel 1 (
  set "NODE_EXE=node"
  set "NPM_CMD=npm.cmd"
  goto node_ok
)
if exist "%NODE_EXE%" goto node_ok

echo Node.js LTS nao encontrado.
where winget >nul 2>&1
if errorlevel 1 (
  echo ERRO: winget nao esta disponivel neste Windows.
  echo Instale o Node.js LTS e execute este arquivo novamente.
  pause
  exit /b 1
)

echo Instalando Node.js LTS automaticamente...
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo ERRO ao instalar o Node.js.
  pause
  exit /b 1
)
set "PATH=%NODE_DIR%;%PATH%"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

:node_ok
"%NODE_EXE%" --version > "%LOG%" 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao ficou disponivel.
  type "%LOG%"
  pause
  exit /b 1
)
"%NPM_CMD%" --version >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERRO: npm nao ficou disponivel.
  type "%LOG%"
  pause
  exit /b 1
)

if not exist "node_modules\electron\electron.exe" (
  echo Instalando dependencias do aplicativo pela primeira vez...
  echo ==== npm install ====>> "%LOG%"
  call "%NPM_CMD%" install --include=dev --no-audit --no-fund >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo ERRO durante npm install.
    echo Consulte app-start-log.txt.
    type "%LOG%"
    pause
    exit /b 1
  )
)

echo.
echo Abrindo o Mestre das Tintas em Electron...
echo Nao abra app\index.html diretamente no Edge.
echo.
call "%NPM_CMD%" start
if errorlevel 1 (
  echo.
  echo O aplicativo nao conseguiu iniciar. Consulte app-start-log.txt.
  pause
)
endlocal
