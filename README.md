# Basecamp

Basecamp is a working Startup State prototype: a founder navigator, resource explorer, startup map, company submission flow, and admin console in one cheap-to-host Next.js application.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app runs without external credentials. AI defaults to a deterministic local guide. Add API keys or configure the Codex path from `/admin/ai` to use hosted model providers.

## Verification

```bash
npm run verify
```

That runs linting, type checks, unit tests, production build, and `npm audit`.

## Deployment Shape

The cheapest production-friendly shape is one container:

- Next.js server app
- CSV/JSON seed data
- writable storage mounted at `.basecamp-data`
- optional provider keys supplied as environment variables

Azure Container Apps or Azure App Service for Containers is the likely first target. AWS App Runner and GCP Cloud Run are also supported by the included `Dockerfile`.

See [docs/deployment/hosting-options.md](./docs/deployment/hosting-options.md).
