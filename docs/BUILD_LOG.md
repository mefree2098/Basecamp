# Basecamp Build Log

This file is the continuity thread for future Codex runs. Keep it current when the app changes.

## Source Context Ingested

- `basecampbuild.md`: production blueprint for Startup State founder navigator, resource search, startup map, company claims, admin publishing, AI guardrails, and deployment.
- `codexpath.md`: Codex app-server integration model, auth modes, model discovery, hosted callback completion, writable `CODEX_HOME`, and file-backed credential storage.
- AI Builder Day brief: https://startupstate.netlify.app/?utm_source=luma
- Live Startup State site IA: https://startup.utah.gov/
- Resource CSV: 213 seeded records copied to `data/resources.csv`.
- Map CSV: 222 seeded company records copied to `data/companies.csv`.
- Reference map: https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN

## Architecture Decision

Use a single containerized Next.js application instead of the initial EKS-style plan. The user explicitly prioritized simplicity, low hosting cost, local operation, and likely Azure deployment. This keeps the prototype cheap and portable while preserving clear seams for Postgres, managed object storage, and queue workers later.

## Completed

- Set up Next.js App Router with TypeScript, ESLint, Vitest, Playwright config, Dockerfile, and GitHub Actions-ready scripts.
- Added seed ingestion for Startup State resources and Utah startup companies.
- Built founder navigator with deterministic prefiltering, guided/manual modes, cited recommendations, local plan cards, and provider-backed AI fallback.
- Built manual resource explorer with search and filters.
- Built low-cost Utah startup map using projected seeded address coordinates and no required map API key.
- Built company profile pages and self-service company draft submission flow.
- Built admin import/review console for non-technical CSV updates without redeployment.
- Built AI settings UI for OpenAI API key, Codex path, Anthropic, Gemini, model selection, and thinking level.
- Ported a server-side Codex app-server integration scaffold with bundled `@openai/codex`, writable home resolution, file credential store enforcement, model listing, auth health, and hosted login endpoints.
- Added local tests for recommendation ranking and model catalog.
- Fixed visual QA issues found after launch: company map loader now handles trimmed CSV headers, duplicate company slugs are uniqued, compact grid sections no longer stretch headings, and company draft submission returns clean validation errors.
- Fixed Codex hosted login completion for current `@openai/codex`: callback completion now relays the pasted localhost callback URL into the pending Codex listener instead of calling the unsupported `account/login/complete` RPC, handles the current nested `account/read` and `model/list` response shapes, and keeps localhost-only validation around the sensitive callback token.
- Changed Codex sign-in UX to match the CLI-style local flow: local Basecamp can ask the backend to open the generated OpenAI auth URL in the system browser, keep the Codex listener alive, poll auth/model status automatically, and reserve callback paste as a hidden fallback only when a pending login exists.
- Reworked the first-run product surface after re-reading the AI Builder Day brief: the home page now leads with one calm founder question, guided mode shows only stage/county/goal, manual mode reveals the full filters, resource/map/admin depth lives behind navigation, and AI settings are reachable only from the Admin surface.
- Fixed Codex chat turns for `@openai/codex` 0.129.0 by reading the nested `thread.id`, sending the current `text_elements` input shape, and waiting for streamed `item/agentMessage/delta` plus `turn/completed` notifications before rendering the final answer.
- Cropped the generated iconography sheet into a proper app icon for the header/favicons.
- Replaced the static/bobbing assistant image with a stateful Basecamp guide pet component modeled after Codex pet behavior: idle, thinking, ready, speaking, and error states use different motion, face, orbit, status text, and reduced-motion-safe CSS.
- Strengthened the Basecamp guide prompt so provider-backed answers must reduce overwhelm, name a clear first stop, cite every named resource, avoid invented eligibility/compliance claims, and stay concise.
- Verified the app with lint, typecheck, unit tests, production build, npm audit, Playwright smoke test, and manual Playwright UI passes across desktop/mobile.
- Initialized git, created private GitHub repo `mefree2098/Basecamp`, pushed `main`, and confirmed GitHub CI passed.
- Kept the Azure Container App workflow manual-only until Azure secrets are configured, so normal pushes run CI without a failing deploy job.

## Verification Completed

- `npm run verify`: passed.
- `npm run test:e2e`: passed.
- Browser QA fallback: Playwright loaded `/`, `/map`, `/admin/ai`, and `/submit-company`; screenshots were written to `test-results/`; no console errors remained.
- `GET /api/ai/codex-auth-health`: returns a clean unauthenticated/login-required health response with the effective writable Codex home.
- After local Codex login, `GET /api/ai/codex-auth-health` reports authenticated ChatGPT auth with 5 visible Codex models, and the admin UI refreshes the model dropdown to current Codex models such as `gpt-5.5`.
- `GET /api/ai/codex-models?startLogin=1&openBrowser=1` detects existing Codex auth without requiring manual callback paste; clicking Sign in in the admin UI switches to Codex mode and reports the authenticated model catalog.
- `POST /api/ai/chat` with `provider=codexPath` now returns a real Codex guide answer for the default founder prompt instead of falling back with `missing field threadId`.
- Browser QA on `/` confirms the simplified guided first view has no top-level AI nav/settings duplicate, no initial resource/map wall, a distinct manual filter mode, and no visible Codex thread error after submit.
- Browser QA on `/` confirms the assistant is now a stateful guide pet rather than an image bounce: it shows an idle status before submission, switches to a thinking state while the request runs, and shows a ready state after the answer renders.

## Next Steps

- Future hardening: replace file-backed overrides with managed Postgres before running multiple writable replicas.
- Configure Azure secrets and run the manual Azure deployment workflow when ready.

## Deployment Notes

- Local: `npm install && npm run dev`.
- Single container: use included `Dockerfile`.
- Azure recommended first: Container Apps or App Service for Containers with persistent storage mounted at `.basecamp-data`.
- AWS: App Runner or ECS Fargate for the same container.
- GCP: Cloud Run for the same container.
- Use managed Postgres when multi-instance writes or larger moderation queues become necessary.
