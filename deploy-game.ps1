param([string]$AppId = '', [string]$EnvId = '')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Run-Checked {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed: $LASTEXITCODE" }
}
if (-not $AppId) { $AppId = (Read-Host 'MiniGame AppID (wx...)').Trim() }
if ($AppId -notmatch '^wx[0-9a-fA-F]{16}$') { throw 'Invalid MiniGame AppID' }
if (-not $EnvId) { $EnvId = (Read-Host 'Cloud environment associated with this MiniGame AppID').Trim() }
if ($EnvId -notmatch '^[a-zA-Z0-9-]+$') { throw 'Invalid cloud environment ID' }
$Utf8 = New-Object System.Text.UTF8Encoding($false)
$ProjectPath = Join-Path $PSScriptRoot 'project.config.json'
$Project = Get-Content $ProjectPath -Raw | ConvertFrom-Json
$Project.appid = $AppId
$Project.compileType = 'game'
$Project.miniprogramRoot = './'
$Project.cloudfunctionRoot = 'cloudfunctions/'
[IO.File]::WriteAllText($ProjectPath, ($Project | ConvertTo-Json -Depth 30), $Utf8)
$PrivatePath = Join-Path $PSScriptRoot 'project.private.config.json'
if (Test-Path $PrivatePath) {
    $Private = Get-Content $PrivatePath -Raw | ConvertFrom-Json
    $Private | Add-Member -NotePropertyName 'compileType' -NotePropertyValue 'game' -Force
    [IO.File]::WriteAllText($PrivatePath, ($Private | ConvertTo-Json -Depth 30), $Utf8)
}
$ClientConfig = @{ envId = $EnvId; functionName = 'flyingRoom' } | ConvertTo-Json -Compress
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'src\cloud-config.js'), "module.exports = $ClientConfig;`r`n", $Utf8)
$CloudPath = Join-Path $PSScriptRoot 'cloudbaserc.json'
$Cloud = Get-Content $CloudPath -Raw | ConvertFrom-Json
$Cloud.envId = $EnvId
[IO.File]::WriteAllText($CloudPath, ($Cloud | ConvertTo-Json -Depth 30), $Utf8)
$Tests = @(Get-ChildItem '.\tests\*.test.js' | ForEach-Object { $_.FullName })
Run-Checked 'node' (@('--test') + $Tests)
if (-not (Get-Command 'tcb.cmd' -ErrorAction SilentlyContinue)) {
    Run-Checked 'npm.cmd' @('install', '-g', '@cloudbase/cli')
}
Run-Checked 'tcb.cmd' @('login')
Run-Checked 'tcb.cmd' @('fn', 'deploy', 'flyingRoom', '-e', $EnvId, '--install-dependency', 'true', '--force')
Write-Host 'Import THIS repository root in WeChat DevTools, type: MiniGame.' -ForegroundColor Green
Write-Host $PSScriptRoot
Write-Host 'Create flying_rooms collection; permissions: { "read": false, "write": false }'
