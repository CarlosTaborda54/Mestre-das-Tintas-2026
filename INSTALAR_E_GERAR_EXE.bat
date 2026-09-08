@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Mestre das Tintas - Gerar instalador
color 1F
set "LOG=%CD%\build-log.txt"
set "NODE_DIR=%ProgramFiles%\nodejs"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"

echo ========================================================
echo   MESTRE DAS TINTAS - GERAR INSTALADOR WINDOWS
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
  echo Instale o Node.js LTS em https://nodejs.org/ e execute novamente.
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

echo.
echo Instalando dependencias do projeto...
echo ==== npm install ====>> "%LOG%"
call "%NPM_CMD%" install --include=dev --no-audit --no-fund >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERRO durante npm install.
  echo Consulte build-log.txt.
  type "%LOG%"
  pause
  exit /b 1
)

echo.
echo Gerando instalador NSIS e EXE portatil...
echo ==== npm run dist ====>> "%LOG%"
call "%NPM_CMD%" run dist >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERRO durante a compilacao.
  echo Consulte build-log.txt.
  type "%LOG%"
  pause
  exit /b 1
)

echo.
echo ========================================================
echo INSTALADOR GERADO COM SUCESSO
echo ========================================================
set "SETUP="
for /f "delims=" %%F in ('dir /b /o-d "dist\*-Setup.exe" 2^>nul') do if not defined SETUP set "SETUP=%%F"
if defined SETUP (
  echo Instalador: %CD%\dist\!SETUP!
  start "" "%CD%\dist\!SETUP!"
) else (
  echo O Setup.exe nao foi encontrado; abra a pasta dist.
  start "" "%CD%\dist"
)
echo.
echo Log completo: %LOG%
pause
