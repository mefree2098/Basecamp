# Basecamp

Basecamp is the Startup State prototype: a founder navigator, resource explorer, Utah startup map, company submission flow, and admin console in one cheap-to-host Next.js application.

## What It Includes

- **Utah Startup Map**: Google Maps-backed startup ecosystem map with clustering, zoom controls, Street View, satellite mode, heatmap mode, sector chips, fast filtering, URL-shareable filter state, CSV export, saved lists, comparison, and partner/customer discovery actions.
- **Server-side geocoding cache**: company addresses are geocoded on the server and persisted under `.basecamp-data` so Google Geocoding API usage stays efficient.
- **Company logos**: startup websites are scanned server-side for favicons, touch icons, and manifest icons, then cached and shown on markers, popovers, drawers, and profile pages.
- **Selectable themes**: the default Startup State look remains available, and the Tech theme adds a dark neon UI skin, glowing map markers, and an embedded Google Maps dark style fallback.
- **Self-service profiles**: companies can submit profile drafts with rich company details, jobs, ATS/careers links, uploaded gallery photos, and website/domain verification.
- **Claim verification**: profile claims use a work-email magic link and domain matching against the company website before admin review.
- **Admin console**: operators can import CSV updates, review pending company-profile diffs, approve/reject drafts, and manage provider settings.
- **AI guide**: the app runs without external model credentials and can be upgraded through `/admin/ai` with hosted providers or Codex path integration.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app works without external credentials, but Google Maps, geocoding, SMTP email, and hosted AI providers are enabled through environment variables.

## Environment

Copy `.env.example` to `.env.local` and fill only the services you want enabled.

Key settings:

```bash
BASECAMP_STORAGE_DIR=.basecamp-data

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID=
GOOGLE_MAPS_GEOCODING_API_KEY=
BASECAMP_GEOCODE_BATCH_SIZE=260

BASECAMP_ICON_BATCH_SIZE=32
BASECAMP_ICON_CONCURRENCY=10

BASECAMP_PUBLIC_URL=http://localhost:3000
BASECAMP_EMAIL_PROVIDER=smtp
BASECAMP_EMAIL_FROM=basecamp@ntechr.com
BASECAMP_SMTP_HOST=mail.freestonefamily.com
BASECAMP_SMTP_PORT=587
BASECAMP_SMTP_SECURE=false
BASECAMP_SMTP_REQUIRE_TLS=true
BASECAMP_SMTP_USER=basecamp@ntechr.com
BASECAMP_SMTP_PASS=
```

Local runtime caches and uploads live in `.basecamp-data`, which is intentionally ignored by git.

`NEXT_PUBLIC_GOOGLE_MAPS_TECH_MAP_ID` is optional. If you create a cloud-based Google Maps style for the Tech theme, attach it to a dedicated Map ID and put it there; otherwise the app uses the embedded dark Google Maps style array.

## Data And Admin Workflows

- Seed CSV/JSON data is loaded from the repo.
- Admin imports and approved company drafts are written as local overrides in `.basecamp-data`.
- Company draft verification links land at `/api/company-drafts/verify`.
- Gallery uploads are served from `/api/uploads/gallery/:filename`.
- ATS/careers previews are imported through `/api/ats/preview`.
- Company icon discovery is exposed at `/api/company-icons` and refreshes cached logos without blocking the map page.

## API Platform Boundary

Basecamp is intentionally shaped as one backend API with web, iPhone, and iPad clients sitting on top of it. Frontend routes render thin client shells and load platform data through same-origin API endpoints instead of importing server data loaders directly.

Primary client contracts:

- `GET /api/platform/bootstrap`: founder navigator resources, facets, and default option lists.
- `POST /api/ai/chat`: grounded guide responses and recommended next-step resources.
- `POST /api/recommendations`: deterministic non-LLM recommendations and plan cards.
- `GET /api/resources`: filterable Startup State resource catalog.
- `GET /api/companies` and `GET /api/companies/:slug`: startup map lists and company profile details.
- `GET /api/map/bootstrap`: map companies, facets, cached geocodes, and cached company icons.
- `GET /api/admin/summary`: admin counts and review queue summaries.
- `POST /api/company-drafts`, `PATCH /api/company-drafts`, `POST /api/admin/imports`, and upload/ATS routes: write workflows.

## Verification

```bash
npm run verify
```

That runs linting, type checks, unit tests, production build, and `npm audit`.

## Deployment Shape

The simplest production-friendly shape is one container:

- Next.js server app
- CSV/JSON seed data
- writable storage mounted at `.basecamp-data`
- optional provider, Google Maps, SMTP, and AI keys supplied as environment variables

The production app exposes `GET /api/healthz` and `GET /healthz` for reverse proxies and container health checks. Health returns `503` if the runtime storage path is not writable.

Azure Container Apps or Azure App Service for Containers is the likely first target. AWS App Runner and GCP Cloud Run are also supported by the included `Dockerfile`.

For the shared NVIDIA Jetson Orin Nano Super host behind HomeBrain's Caddy reverse proxy, use `PORT=4302`, `HOSTNAME=127.0.0.1`, and `https://basecamp.ntechr.com`; see [docs/deployment/jetson-orin-nano.md](./docs/deployment/jetson-orin-nano.md).

The repo also includes the non-secret imported Utah public-business seed data and server-side map/icon caches under `data/`, so a fresh Jetson checkout starts with the same public map dataset as the local build.

See [docs/deployment/hosting-options.md](./docs/deployment/hosting-options.md).
