# Hosting Options

Basecamp is built as one portable container to minimize cost and operational complexity.

## Local

```bash
npm install
npm run dev
```

No database, map key, or AI key is required. Seed data lives in `data/`; operator uploads write to `.basecamp-data/`.

## Jetson Orin Nano

Use this when hosting on the shared NVIDIA Jetson behind HomeBrain's Caddy reverse proxy:

- Run the production server on `127.0.0.1:4302`.
- Set `BASECAMP_PUBLIC_URL=https://basecamp.ntechr.com`.
- Store writable data at `/mnt/nvme/apps/Basecamp/.basecamp-data`.
- Use `/api/healthz` as the HomeBrain reverse proxy health path.

See [Jetson Orin Nano Deployment](./jetson-orin-nano.md).

## Azure, Recommended First

Cheapest simple options:

1. Azure Container Apps with one container replica for demos.
2. Azure App Service for Containers if you want simpler always-on web app semantics.

Use environment variables:

- `BASECAMP_STORAGE_DIR=/data/basecamp`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY` as needed
- `CODEX_HOME=/home/site/.codex/basecamp` on App Service

For Codex path auth, use a persistent writable volume for `CODEX_HOME`.

## AWS

Cheapest simple options:

1. AWS App Runner for the container if Codex path is not required.
2. ECS Fargate with EFS if Codex auth persistence is required.

Set `CODEX_HOME=/mnt/efs/.codex/basecamp` when using EFS.

## GCP

Cheapest simple option:

1. Cloud Run for the container.

Use Secret Manager for API keys. For Codex path, mount persistent storage or use the API-key providers instead.

## When To Add Postgres

Move from file-backed overrides to managed Postgres when any of these become true:

- Multiple app replicas need to accept admin writes.
- Reviewer queues need assignment/history/search.
- Company claims need durable verification tokens.
- Analytics need longer retention.
- You need row-level access controls for authenticated workbench data.
