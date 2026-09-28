#!/usr/bin/env bash
# Web Clipper 数据备份脚本（JSON 文件存储 + 本地化图片）
#
# 用法（宿主机部署）：
#   DATA_DIR=/app/backend/data BACKUP_DIR=./backups ./deploy/backup.sh
#
# 用法（Docker 数据卷）：
#   docker run --rm -v wc_data:/data -v "$PWD/backups":/backup alpine \
#     tar -czf /backup/web-clipper-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
#
# 恢复：
#   停止服务后执行 tar -xzf <备份文件> -C <数据目录的父目录>，再启动服务
set -euo pipefail

DATA_DIR="${DATA_DIR:-/app/backend/data}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/web-clipper-data-$STAMP.tar.gz"

if [ ! -d "$DATA_DIR" ]; then
  echo "数据目录不存在：$DATA_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
tar -czf "$OUT" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
echo "备份完成：$OUT ($(du -h "$OUT" | cut -f1))"
