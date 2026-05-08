# Jetson Orin Nano Deployment

Basecamp can run on the shared Jetson as a small production Next.js service behind HomeBrain's Caddy reverse proxy.

## Runtime Shape

- Local service port: `4302`
- Bind address: `127.0.0.1`
- Public hostname: `https://basecamp.ntechr.com`
- Reverse proxy health path: `/api/healthz`
- Persistent storage: `/mnt/nvme/apps/Basecamp/.basecamp-data`

The app has no resident database. It reads seed data from `data/` and writes runtime sessions, uploads, admin overrides, geocode cache, icon cache, and optional Codex auth state under `BASECAMP_STORAGE_DIR`.

## Install On The Jetson

```bash
sudo mkdir -p /mnt/nvme/apps
sudo chown -R matt:matt /mnt/nvme/apps
cd /mnt/nvme/apps
git clone https://github.com/mefree2098/Basecamp.git
cd Basecamp
cp deploy/jetson/basecamp.env.example .env.production
npm ci
npm run build
mkdir -p .basecamp-data
```

Edit `.env.production` and add any Google Maps, SMTP, hosted AI, or Codex settings you want enabled. The defaults keep cache workers conservative for a Jetson that is already running HomeBrain and Axiom.

## systemd Service

```bash
sudo cp deploy/jetson/basecamp.service.example /etc/systemd/system/basecamp.service
sudo systemctl daemon-reload
sudo systemctl enable --now basecamp
systemctl status basecamp --no-pager
curl -fsS http://127.0.0.1:4302/api/healthz
```

The service uses `NODE_OPTIONS=--max-old-space-size=384` for a small steady-state memory envelope. If a future feature legitimately needs more server heap, raise that value in the unit.

## HomeBrain Reverse Proxy Route

Create a HomeBrain-managed Caddy route with:

- Hostname: `basecamp.ntechr.com`
- Upstream protocol: `http`
- Upstream host: `127.0.0.1`
- Upstream port: `4302`
- Health check path: `/api/healthz`
- TLS mode: automatic
- WebSocket support: off
- Strip prefix: empty

After applying the Caddy config:

```bash
curl -fsS https://basecamp.ntechr.com/api/healthz
curl -I https://basecamp.ntechr.com/
```

## Shared-Host Notes

Avoid running `npm ci` or `npm run build` during HomeBrain or Axiom deploys. Runtime is light, but installs/builds can briefly compete for CPU and RAM on the 8 GB Jetson.

For the first public run, keep:

```bash
BASECAMP_GEOCODE_BATCH_SIZE=25
BASECAMP_ICON_BATCH_SIZE=8
BASECAMP_ICON_CONCURRENCY=2
BASECAMP_PUBLIC_BUSINESS_IMPORT_LIMIT=250
```

Those settings only slow background enrichment/import work; they do not affect normal page serving.
