# COSMOS — Deploy Guide

## Error 502 / 1033 — Root Cause & Fix

**Why the 502 happens:** If the HTTP server is started as a background process (`&`) inside a shell that gets killed (e.g. SSH timeout, tool timeout, terminal close), the server dies. By the time `cloudflared` connects, the origin is dead → 502.

**Fix:** Run both server and tunnel inside **tmux** — processes survive shell termination. The included `deploy.sh`:
1. Starts the HTTP server in tmux window 0
2. Verifies it responds (`curl` must return 200)
3. Starts cloudflared in tmux window 1
4. Waits for the tunnel URL to appear

---

## Requirements

- Node.js 18+ and npm
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) — for HTTPS tunnel
- tmux — for persistent background processes (optional, included in deploy.sh)

---

## Quick Deploy (one command)

```bash
cd cosmos-space
chmod +x deploy.sh
./deploy.sh
```

Output example:
```
[1/5] Cleaning...
[2/5] Starting HTTP server on port 8080...
[3/5] Verifying... ✓
[4/5] Starting Cloudflare Tunnel...
  Waiting for URL...................
[5/5] Result:
  ✓ LIVE — HTTP 200
  URL: https://some-words.trycloudflare.com
```

---

## Manual Steps (tmux — prevents 502)

### 1. Start server in tmux

```bash
tmux new-session -d -s cosmos -x 180 -y 40
tmux send-keys -t cosmos "cd ./ && python3 -m http.server 8080" Enter
sleep 3
```

### 2. Verify it's alive

```bash
curl -s --max-time 3 http://127.0.0.1:8080 | head -3
# Must show: <!DOCTYPE html>
```

### 3. Start tunnel in new tmux window

```bash
tmux new-window -t cosmos
tmux send-keys -t cosmos:1 "cloudflared tunnel --url http://localhost:8080 2>&1 | tee /tmp/cf.log" Enter
```

### 4. Wait 15–25s for URL

```bash
sleep 20
grep -oP 'https?://[a-zA-Z0-9.-]+\.trycloudflare\.com' /tmp/cf.log
```

### 5. Verify

```bash
curl -sI --max-time 10 "https://YOUR-URL.trycloudflare.com" | head -3
# Should return: HTTP/2 200
```

---

## tmux Session Layout

```
cosmos: 0  →  python3 -m http.server 8080
cosmos: 1  →  cloudflared tunnel --url http://localhost:8080
```

| Command | Description |
|---------|-------------|
| `tmux attach -t cosmos` | View both panes |
| `Ctrl+b, 0` | Switch to server window |
| `Ctrl+b, 1` | Switch to tunnel window |
| `Ctrl+b, d` | Detach (keep running in background) |
| `tmux kill-session -t cosmos` | Stop everything |

---

## Troubleshooting

### 502 Bad Gateway (most common)
**Cause:** HTTP server died when the shell timed out. The tunnel connected to a dead origin.

**Fix:**
```bash
fuser -k 8080/tcp 2>/dev/null          # kill server
tmux kill-session -t cosmos 2>/dev/null # kill tmux
sleep 3
./deploy.sh                             # fresh deploy
```

### 502 persists
The tunnel might need time to warm up. Wait 10s and retry:
```bash
curl -sI --max-time 10 "https://YOUR-URL.trycloudflare.com"
```
If still 502 after 30s, run `deploy.sh` again.

### Rate limited by Cloudflare (429)
Quick tunnels are rate-limited per IP. Wait 60s between retries:
```bash
tmux kill-session -t cosmos 2>/dev/null
sleep 60
./deploy.sh
```

### Tunnel URL never appears
- Prechecks from Cloudflare take ~10s
- URL appears 10–20s after prechecks (20–30s total)
- Check manually: `tmux attach -t cosmos`, then `Ctrl+b, 1`

### Page loads but no 3D (blank canvas)
- Three.js loads from CDN (`jsdelivr.net`) — check internet is working
- Open browser devtools → Console tab → look for errors
- Test locally first: `python3 -m http.server 8080` → `http://localhost:8080`

### Port 8080 in use
```bash
fuser -k 8080/tcp 2>/dev/null
```

---

## Permanent Hosting (Free)

### GitHub Pages
```bash
git init
git add .
git commit -m "Initial commit — COSMOS 3D space"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```
Then enable Pages in repo Settings → Pages → deploy from `main` / `root`.

### Netlify
1. Go to [netlify.com](https://netlify.com)
2. Drag the project folder to the deploy zone
3. Done — live HTTPS URL instantly

### Surge.sh
```bash
npm install -g surge
surge ./ your-site.surge.sh
```

---

## Files

| File | Description |
|------|-------------|
| `index.html` | Full 3D COSMOS website (self-contained, loads Three.js from CDN) |
| `deploy.sh` | Deploy script — starts server, verifies, tunnels via cloudflared |
| `DEPLOY.md` | This file |
| `README.md` | Project overview |
| `.gitignore` | Ignores logs and temp files |

---

## Privacy

This project contains **no telemetry, no analytics, no tracking, no cookies**. All code runs client-side. The only external resource is the Three.js library loaded from jsdelivr CDN. No data leaves your browser.
