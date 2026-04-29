#!/usr/bin/env bash
# 前端部署到轻量级应用服务器：先 build，再 rsync 上传
# 配置：在 deploy.env 中填写 DEPLOY_HOST、DEPLOY_USER、DEPLOY_PATH（见 deploy.env.example）

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 自动加载 deploy.env（若存在）
if [ -f "$SCRIPT_DIR/deploy.env" ]; then
  set -a
  # shellcheck source=deploy.env
  source "$SCRIPT_DIR/deploy.env"
  set +a
fi

if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_USER" ] || [ -z "$DEPLOY_PATH" ]; then
  echo "请先配置 deploy.env（可复制 deploy.env.example 并修改）："
  echo "  DEPLOY_HOST=你的服务器域名或IP"
  echo "  DEPLOY_USER=SSH 用户名"
  echo "  DEPLOY_PATH=服务器上前端静态文件目录"
  exit 1
fi

echo ">>> 构建前端..."
npm run build

echo ">>> 上传 dist 到 $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH ..."
# 跳过主机密钥确认，避免首次连接交互
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
if [ -n "$DEPLOY_PASS" ]; then
  command -v sshpass >/dev/null 2>&1 || { echo "请安装 sshpass: brew install sshpass"; exit 1; }
  sshpass -p "$DEPLOY_PASS" rsync -avz --delete -e "ssh $SSH_OPTS" dist/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
else
  rsync -avz --delete -e "ssh $SSH_OPTS" dist/ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"
fi

echo ">>> 部署完成。前端访问: https://$DEPLOY_HOST/ （取决于你 Nginx 配置）"
