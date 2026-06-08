# COSMOS 3D Space — Deployment Summary

## Live Site

- **URL:** https://didiicola.github.io/cosmos-space/
- **Repo:** https://github.com/didicola/cosmos-space
- **Status:** Live (HTTP 200, GitHub Pages)

## What Was Built

### Files (5 committed)

| File | Purpose |
|------|---------|
| `index.html` | 3D solar system with Three.js (14k stars, 8 planets, orbits, Saturn rings, bloom, hover labels) |
| `deploy.sh` | tmux-based deploy script (HTTP server + cloudflared tunnel) |
| `DEPLOY.md` | Generic deploy guide with troubleshooting |
| `README.md` | Project overview with privacy notice |
| `.gitignore` | Standard ignores (logs, tmp) |

### Deployment

- **Hosting:** GitHub Pages (main branch, root path)
- **CDN:** Three.js loaded from jsdelivr (zero build tools)
- **Auth:** OAuth device flow via `gh` CLI + browser code entry
- **Token saved to:** `~/.config/gh/hosts.yml`

## How to Deploy Yourself (step by step)

### 1. Create repo on GitHub

```bash
# Install GitHub CLI (if not installed)
sudo apt-get install gh -y

# Authenticate (opens browser for OAuth device flow)
gh auth login --web -h github.com

# Create repo and push
gh repo create cosmos-space --public --description "Interactive 3D solar system with Three.js"
```

Or via API with a token:

```bash
TOKEN="ghp_your_token_here"
curl -s -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"name":"cosmos-space","description":"Interactive 3D solar system with Three.js","private":false}' \
  "https://api.github.com/user/repos"
```

### 2. Push code

```bash
cd cosmos-space
git init
git add .
git commit -m "Initial commit — COSMOS 3D space exploration"
git remote add origin https://github.com/YOUR_USER/cosmos-space.git
git push -u origin main
```

### 3. Enable GitHub Pages

```bash
# Via gh CLI
gh api repos/YOUR_USER/cosmos-space/pages \
  --method POST \
  -f source='{"branch":"main","path":"/"}' \
  --jq '.html_url'

# Or via curl
curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"source":{"branch":"main","path":"/"}}' \
  "https://api.github.com/repos/YOUR_USER/cosmos-space/pages"
```

### 4. Verify

```bash
curl -sI "https://YOUR_USER.github.io/cosmos-space/"
# Should return HTTP 200
```

### Alternative: Browser-only (no CLI)

1. Go to https://github.com/new
2. Create repo named `cosmos-space` (Public)
3. Go to repo Settings → Pages → main branch → root → Save
4. Wait 1-2 minutes for deployment

## How to Clone & Use

```bash
git clone https://github.com/didicola/cosmos-space.git
cd cosmos-space
python3 -m http.server 8080
# Open http://localhost:8080
```

For temporary HTTPS:
```bash
./deploy.sh
```

## Tech Stack

- Three.js 0.160.0 (CDN)
- Cloudflare Tunnel (optional, for temp HTTPS)
- Zero dependencies, single-file HTML
