#Requires -Version 5.1
<#
.SYNOPSIS
  Web Clipper Windows 一键部署脚本（自动安装 Node.js 环境并启动、打开浏览器）

.DESCRIPTION
  1) 检测并自动安装 Node.js LTS（优先 winget，失败则下载官方 MSI 静默安装）
  2) 安装前后端依赖，生成 backend/.env
  3) 启动后端与前端开发服务器（-Prod 时改为构建并以单端口方式启动）
  4) 等待服务就绪后自动打开浏览器

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install.ps1
  powershell -ExecutionPolicy Bypass -File .\install.ps1 -Prod
#>
[CmdletBinding()]
param(
  # 生产模式：构建前端并由后端单端口托管（默认开发模式，前后端热更新）
  [switch]$Prod,
  # 仅安装环境与依赖，不启动服务
  [switch]$InstallOnly
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeMinMajor = 20
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[!]   $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[x]   $msg" -ForegroundColor Red }

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Find-Node {
  foreach ($candidate in @('node', (Join-Path $env:ProgramFiles 'nodejs\node.exe'))) {
    try {
      $v = & $candidate -v 2>$null
      if ($LASTEXITCODE -eq 0 -and $v) { return $v }
    } catch {}
  }
  return $null
}

function Get-NodeMajor($version) {
  if (-not $version) { return 0 }
  return [int](($version -replace '^v', '') -split '\.')[0]
}

function Install-NodeByMsi {
  Write-Host '正在获取 Node.js LTS 最新版本号 ...'
  $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
  $lts = $index | Where-Object { $_.lts } | Select-Object -First 1
  if (-not $lts) { throw '无法从 nodejs.org 获取 LTS 版本信息' }
  $version = $lts.version
  $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x86' }
  $msi = Join-Path $env:TEMP "node-$version-$arch.msi"
  $url = "https://nodejs.org/dist/$version/node-$version-$arch.msi"
  Write-Host "下载 $url ..."
  Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing
  Write-Host '静默安装 Node.js ...'
  $p = Start-Process msiexec.exe -ArgumentList @('/i', "`"$msi`"", '/qn', '/norestart') -Wait -PassThru
  if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) {
    throw "Node.js 安装失败，msiexec 退出码 $($p.ExitCode)"
  }
}

function Ensure-Node {
  Refresh-Path
  $version = Find-Node
  if ((Get-NodeMajor $version) -ge $NodeMinMajor) {
    Write-Ok "已检测到 Node.js $version"
    return
  }

  Write-Step '安装 Node.js LTS'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host '使用 winget 安装 Node.js LTS ...'
    try {
      & winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent
    } catch {
      Write-Warn "winget 安装出现异常：$($_.Exception.Message)"
    }
    Refresh-Path
  } else {
    Write-Warn '未检测到 winget'
  }

  $version = Find-Node
  if ((Get-NodeMajor $version) -lt $NodeMinMajor) {
    Write-Warn '改为下载官方 MSI 安装包'
    try {
      Install-NodeByMsi
      Refresh-Path
    } catch {
      Write-Err "MSI 安装失败：$($_.Exception.Message)"
    }
    $version = Find-Node
  }

  if ((Get-NodeMajor $version) -lt $NodeMinMajor) {
    Write-Err 'Node.js 仍不可用，请手动安装后重试：https://nodejs.org/zh-cn/download'
    exit 1
  }
  Write-Ok "Node.js 安装完成：$version"
}

function Install-Deps($dir, $name) {
  Write-Step "安装 $name 依赖"
  $lock = Join-Path $dir 'package-lock.json'
  Push-Location $dir
  try {
    if (Test-Path $lock) { & npm ci } else { & npm install }
    if ($LASTEXITCODE -ne 0) {
      Write-Warn '依赖安装失败，可尝试切换镜像后重试：npm config set registry https://registry.npmmirror.com'
      throw "npm 退出码 $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
  Write-Ok "$name 依赖就绪"
}

function Wait-Port($port, $seconds = 60) {
  Write-Host "等待端口 $port 就绪 ..."
  for ($i = 0; $i -lt $seconds; $i++) {
    $client = New-Object Net.Sockets.TcpClient
    try {
      $client.Connect('127.0.0.1', $port)
      $client.Close()
      return $true
    } catch {
      Start-Sleep -Seconds 1
    } finally {
      if ($client) { $client.Dispose() }
    }
  }
  return $false
}

# ---------- 开始执行 ----------
if (-not (Test-Admin)) {
  Write-Warn '安装运行环境需要管理员权限，正在申请提升 ...'
  $psArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
  if ($Prod) { $psArgs += '-Prod' }
  if ($InstallOnly) { $psArgs += '-InstallOnly' }
  Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $psArgs
  exit
}

Set-Location $Root
Write-Host "项目目录：$Root" -ForegroundColor Gray

Ensure-Node
Install-Deps (Join-Path $Root 'backend') '后端'
Install-Deps (Join-Path $Root 'frontend') '前端'

# 生成后端环境变量文件
$envFile = Join-Path $Root 'backend\.env'
$envExample = Join-Path $Root 'backend\.env.example'
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Copy-Item $envExample $envFile
  Write-Ok '已生成 backend\.env（AI/推送等可选配置可按需修改）'
}

if ($InstallOnly) {
  Write-Ok '环境与依赖安装完成（-InstallOnly 未启动服务）'
  exit 0
}

if ($Prod) {
  Write-Step '构建前端静态产物'
  Push-Location (Join-Path $Root 'frontend')
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "前端构建失败，npm 退出码 $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
  Write-Ok '前端构建完成'

  Write-Step '启动服务（单端口，后端托管前端）'
  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', "title Web Clipper (生产) && cd /d `"$Root\backend`" && set SERVE_DIST=true && node src/server.js")
  if (Wait-Port 3001) {
    Start-Process 'http://localhost:3001'
    Write-Ok '已打开浏览器：http://localhost:3001'
  } else {
    Write-Warn '服务启动较慢或失败，请查看新打开的窗口日志'
  }
} else {
  Write-Step '启动服务（开发模式，前后端热更新）'
  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', "title Web Clipper Backend && cd /d `"$Root\backend`" && npm run dev")
  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k', "title Web Clipper Frontend && cd /d `"$Root\frontend`" && npm run dev")
  if (Wait-Port 5173) {
    Start-Process 'http://localhost:5173'
    Write-Ok '已打开浏览器：http://localhost:5173'
  } else {
    Write-Warn '前端启动较慢或失败，请查看新打开的窗口日志'
  }
}

Write-Host ''
Write-Ok '部署完成。首次使用请在页面注册账号。'
Write-Host '关闭弹出的两个命令行窗口即可停止服务。' -ForegroundColor Gray
