#!/usr/bin/env bash
# 小红书私信推送联调测试（参考文档：https://fe-video-qc.xhscdn.com/fe-platform-file/104101b831o4jt31h06s68p465hi00000000002njnvv4o.pdf）
# 使用方式：RELAY_HOST=101.132.138.196 TENANT_ID=CR8QboXRya9BXtsb9ixc7tdFntd ./scripts/webhook-test-curl.sh

RELAY_HOST="${RELAY_HOST:-101.132.138.196}"
PORT="${PORT:-3000}"
TENANT_ID="${TENANT_ID:-CR8QboXRya9BXtsb9ixc7tdFntd}"
BASE_URL="http://${RELAY_HOST}:${PORT}"
WEBHOOK_URL="${BASE_URL}/webhook/leads/${TENANT_ID}"
PAYLOAD_FILE="$(dirname "$0")/test-webhook-payload.json"

echo "消息接收地址（测试链接）: ${WEBHOOK_URL}"
echo "请求体: scripts/test-webhook-payload.json"
echo ""
echo "执行 curl 测试:"
echo "  curl -s -w \"\\nHTTP: %{http_code}\\n\" -X POST \"${WEBHOOK_URL}\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d @\"${PAYLOAD_FILE}\""
echo ""

if [ -f "$PAYLOAD_FILE" ]; then
  curl -s -w "\nHTTP: %{http_code}\n" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d @"$PAYLOAD_FILE"
else
  echo "未找到 $PAYLOAD_FILE"
  exit 1
fi
