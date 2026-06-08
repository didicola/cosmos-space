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
npm install
npm run dev
# Open http://localhost:5173
```

## Production Build

```bash
npm run build
npm run preview
# Output in dist/ — deploy anywhere
```

## Live HTTPS (instant, no account)

```bash
# Requires cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
chmod +x deploy.sh
./deploy.sh
```

This builds, serves, and creates a temporary public HTTPS URL via Cloudflare Tunnel.

## Permanent Hosting

- **GitHub Pages** — push to repo, enable Pages (deploys from dist/ or root)
- **Netlify** — drag the dist/ folder to netlify.com
- **Surge.sh** — `surge ./dist your-site.surge.sh`

## Tech

- [Three.js](https://threejs.org) 0.184 — 3D rendering (ES modules via npm)
- [Vite](https://vite.dev) 8 — dev server with HMR, optimized builds
- Procedural textures — Canvas2D + FBM noise (zero image assets)
- Custom GLSL shaders — twinkling stars, sun corona animation
- [Cloudflare Tunnel](https://cloudflare.com) — free HTTPS (optional)

## Privacy

No telemetry, analytics, tracking, or cookies. All code runs client-side. The only external resource is Three.js from jsdelivr CDN. No data leaves your browser.
