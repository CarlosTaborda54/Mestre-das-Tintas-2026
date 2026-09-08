$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Mestre das Tintas - gerar instalador" -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  } else { throw "Node.js LTS e winget nao foram encontrados. Instale o Node.js LTS em https://nodejs.org/" }
}
$env:Path = "$env:ProgramFiles\nodejs;$env:Path"
npm install --include=dev --no-audit --no-fund
npm run dist
Write-Host "Concluido. Veja a pasta dist." -ForegroundColor Green
