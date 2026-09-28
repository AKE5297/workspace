#!/usr/bin/env bash
# 部署后健康检查：验证前端页面与后端接口是否可访问
#
# 用法：
#   BASE_URL=http://localhost ./deploy/verify.sh
#   BASE_URL=https://your-domain.com ./deploy/verify.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
BASE_URL="${BASE_URL%/}"

check() {
  local path="$1"
  local label="$2"
  local code
  code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$BASE_URL$path")"
  if [ "$code" = "200" ]; then
    echo "OK   $label ($path -> $code)"
  else
    echo "FAIL $label ($path -> $code)"
    return 1
  fi
}

check /api/health "后端健康检查"
check / "前端首页"

echo "全部检查通过：$BASE_URL"
