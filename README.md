# COSMOS — 3D Space Exploration

An interactive 3D solar system built with Three.js. Explore planets, orbits, and deep space — right in your browser.

## Features

- 14,000-star background field with color variety
- 8 planets with realistic relative sizes and orbital speeds
- Saturn's rings, Jupiter's bands
- Glowing sun with multi-layer corona
- Bloom post-processing for atmospheric depth
- Hover to identify planets
- Drag to orbit, scroll to zoom
- Orbit lines toggle, auto-rotate, focus views

## Quick Start

```bash
# Serve locally
python3 -m http.server 8080
# Open http://localhost:8080
```

## Live HTTPS (instant, no account)

```bash
# Requires cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
chmod +x deploy.sh
./deploy.sh
```

This creates a temporary public HTTPS URL via Cloudflare Tunnel.

## Permanent Hosting

- **GitHub Pages** — push to a repo, enable Pages
- **Netlify** — drag the folder to netlify.com
- **Surge.sh** — `surge ./ your-site.surge.sh`

## Tech

- [Three.js](https://threejs.org) — 3D rendering (loaded from CDN)
- [Cloudflare Tunnel](https://cloudflare.com) — free HTTPS (optional)
- Zero build tools, zero dependencies

## Privacy

No telemetry, analytics, tracking, or cookies. All code runs client-side. The only external resource is Three.js from jsdelivr CDN. No data leaves your browser.
