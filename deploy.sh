#!/usr/bin/env bash
# deploy.sh — Reliable HTTPS deploy for COSMOS website
# Uses tmux so processes SURVIVE shell timeout (root cause of 502 errors)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8080}"
LOG="/tmp/cf_cosmos.log"
SESS="cosmos"

GREEN='\033[0;32m'; GOLD='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${GOLD}═══════════════════════════════════════${NC}"
echo -e "${GOLD}  COSMOS — Live Deploy${NC}"
echo -e "${GOLD}═══════════════════════════════════════${NC}"

# Step 1: Cleanup
echo -e "\n${GOLD}[1/5]${NC} Cleaning..."
fuser -k ${PORT}/tcp 2>/dev/null && echo "  freed port ${PORT}" || true
tmux kill-session -t "${SESS}" 2>/dev/null || true
sleep 2

# Step 2: Start HTTP server in tmux
echo -e "\n${GOLD}[2/5]${NC} Building & serving on port ${PORT}..."
tmux new-session -d -s "${SESS}" -x 180 -y 40
tmux send-keys -t "${SESS}" "cd ${DIR} && npm run build && cd dist && python3 -m http.server ${PORT}" Enter
sleep 5

# Step 3: Verify local
echo -n "  Verifying"
for i in $(seq 1 10); do
    if curl -s --max-time 2 "http://127.0.0.1:${PORT}" >/dev/null 2>&1; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Step 4: Start tunnel in new tmux window
echo -e "\n${GOLD}[4/5]${NC} Starting Cloudflare Tunnel..."
rm -f "${LOG}"
tmux new-window -t "${SESS}"
tmux send-keys -t "${SESS}:1" "cloudflared tunnel --url http://localhost:${PORT} 2>&1 | tee ${LOG}" Enter

echo -n "  Waiting for URL"
URL=""
for i in $(seq 1 40); do
    URL=$(grep -oP 'https?://[a-zA-Z0-9.-]+\.trycloudflare\.com' "${LOG}" 2>/dev/null | head -1)
    [ -n "$URL" ] && break
    echo -n "."
    sleep 2
done

# Step 5: Verify
echo -e "\n${GOLD}[5/5]${NC} Result:"
if [ -n "$URL" ]; then
    sleep 5  # wait for tunnel to warm up
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "  ${GREEN}✓ LIVE — HTTP ${HTTP_CODE}${NC}"
    else
        echo -e "  ${GOLD}⚠ Tunnel up, got HTTP ${HTTP_CODE} (may need a few more seconds)${NC}"
    fi
    echo -e "  ${GOLD}URL: ${URL}${NC}"
    echo ""
    echo "  Monitor: tmux attach -t ${SESS}  (Ctrl+b 0/1 to switch panes)"
    echo "  Stop:    tmux kill-session -t ${SESS}"
    echo "  Detach:  Ctrl+b d"
else
    echo -e "  ${RED}✗ No URL after 80s. Debug: tmux attach -t ${SESS}${NC}"
    exit 1
fi
