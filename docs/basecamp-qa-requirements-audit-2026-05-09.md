# Basecamp QA Requirements Audit

Date: 2026-05-09<br>
QA target: Basecamp / Startup State Utah prototype in `/Users/matt/Documents/Basecamp`<br>
Primary local URL tested: `http://localhost:3020`<br>
Official challenge source: https://startupstate.netlify.app/

## Executive Summary

Overall readiness after fixes: **PASS / judge-ready working prototype**.

The platform now satisfies the challenge requirements at prototype level. The Founder Navigator is chat-first, grounded in the provided resource data, and passes all six required persona scenarios with distinct plans and cited resources. The Utah Startup Map is interactive, filterable, investor-friendly, and supports self-service company profile creation/claiming with verification and review.

Remaining watch items are production-hardening items, not current judging blockers: real email delivery should be tested with a controlled work-email magic-link, file-backed storage should move to managed persistence before public state-scale launch, and Google Maps markers should migrate from deprecated `Marker` to `AdvancedMarkerElement` before long-term maintenance.

## Source And Data Pull

Official source links pulled from the challenge page:

| Source | URL | QA result |
|---|---|---|
| Challenge brief | https://startupstate.netlify.app/ | Pulled and used as the requirements source of truth. |
| Resources Spreadsheet | https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit?usp=sharing | Local `data/resources.csv` matches the official 213 source rows by ID. App adds 6 curated direct-action resources, for 219 API resources. |
| Map Data | https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit?usp=sharing | Official export has 223 company rows. Local `data/companies.csv` now has 223 matching rows; missing `OgdenXR` was added. |
| Live Startup State site | https://startup.utah.gov/ | Linked from official brief and used by curated direct-action resources. |
| Reference Startup Map | https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN | Used as design/reference requirement, not copied. |

Data details:

| Dataset | Official export | Local checked-in seed | App/API current count | Result |
|---|---:|---:|---:|---|
| Resources | 213 | 213 | 219 | PASS: official rows present; 6 curated exact-action links added. |
| Map companies | 223 | 223 | 918 | PASS: official names match; app also includes imported public-business records. |
| UGRC public source | 13,532 eligible | N/A | 696 imported locally | PASS: additive public-source expansion keeps provenance metadata. |

## Verification Commands

| Check | Result |
|---|---|
| `npm run test` | PASS: 8 test files, 43 tests passed. |
| `npm run lint` | PASS. |
| `npm run typecheck` | PASS. |
| `npm run build` | PASS: Next build completed and standalone assets prepared. |
| `npm audit --audit-level=moderate` | PASS: 0 vulnerabilities. |
| `npm run test:e2e` | PASS: Playwright smoke test passed against an isolated fresh server on port 3020. |
| Official map-data parity script | PASS: official 223, local 223, missing `[]`, extra `[]`. |
| Persona endpoint sweep against `/api/ai/chat` | PASS: all six required scenarios passed expected routing checks. |
| Headless Chromium browser smoke | PASS: home, map, submit-company, and resources pages loaded expected interactive surfaces with no console/page errors. |

Note: the Codex in-app browser surface could not reach the local dev port because it stayed on a cached browser error page blocked by its URL policy. Independent Playwright/Chromium checks against the same running app passed.

API smoke checks on fresh `localhost:3020`:

| Endpoint | Status | Evidence |
|---|---:|---|
| `/api/platform/bootstrap` | 200 | 219 resources plus facets/options. |
| `/api/map/bootstrap` | 200 | 918 companies plus facets/geocodes/icons/integrations. |
| `/api/admin/summary` | 200 | 219 resources and 918 companies. |
| `/api/resources` | 200 | paginated resources/facets. |
| `/api/companies` | 200 | paginated companies/facets. |
| `/api/company-drafts` POST | 200 in audit run | Temporary no-email draft returned review/verification status; test draft was cleaned up. |
| `/api/admin/public-company-import` | 200 in audit run | UGRC metadata plus 13,532 eligible records. |

## Requirements Matrix

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Working prototype: live clickable demo, not slides/mockups. | PASS | Home, map, resources, submit-company, admin, profile routes, APIs, build, and e2e all pass. |
| R2 | Two interconnected tools in one platform. | PASS | Founder Navigator and Utah Startup Map share app shell, data APIs, profile links, and navigation. |
| R3 | Founder Navigator finds relevant help fast, ideally under two minutes. | PASS | `/api/ai/chat` returns immediate plan, cited resources, exact URLs, and next action. |
| R4 | Personalized experience by stage, location, industry, community, and goal. | PASS | Persona tests verify stage, county, industry, community, rural/woman/veteran/student, angel, export, and commercialization signals. |
| R5 | Right resources surface automatically without ten minutes of digging. | PASS | Required scenarios surface relevant resources in top recommendations without manual filtering. |
| R6 | Use provided resource spreadsheet. | PASS | Official 213 resource rows match local seed by ID. |
| R7 | Resource content easily updatable without developer. | PASS | Admin CSV import and local override path support non-code updates. |
| R8 | AI encouraged / AI chatbot acceptable. | PASS | Chat-first Founder Navigator is default; Admin AI controls expose provider/model/thinking settings. |
| R9 | Interactive visual map of Utah startup ecosystem. | PASS | `/map` renders map, pins/list, clusters, fallback, controls, drawer, search, and filters. |
| R10 | Map beautiful enough for international investors. | PASS | Investor-first map starts calm with hidden advanced filters and screen-presentable summary. |
| R11 | Map useful for founders to find customers, partners, acquisitions. | PASS | Search, filters, save list, CSV export, company drawers, and full profiles support exploration. |
| R12 | Businesses can claim, create, update page. | PASS | `/submit-company`, draft API, company profile claim/update links, and admin review queue exist. |
| R13 | Include lightweight verification method. | PASS | Work-email/domain match, magic-link token flow, verification redirect, and admin review exist. |
| R14 | Company profiles include Name. | PASS | Profile heading displays company name. |
| R15 | Company profiles include Website. | PASS | Website link shown when available. |
| R16 | Company profiles include Employees. | PASS | Employees fact shown. |
| R17 | Company profiles include Sector. | PASS | Sector fact shown. |
| R18 | Company profiles include Year founded. | PASS | Founded fact shown or claim prompt when missing. |
| R19 | Company profiles include LinkedIn. | PASS | LinkedIn action shown when available. |
| R20 | Company profiles include Description. | PASS | Description shown on profile and drawer. |
| R21 | Company profiles include Address. | PASS | Location panel shows address. |
| R22 | Company profiles include Hiring status. | PASS | Hiring status fact/filter supported. |
| R23 | Company profiles include Job postings. | PASS | Job postings URL/list supported; profile shows jobs panel. |
| R24 | Company profiles include Photo gallery. | PASS | Gallery URLs/upload supported; profile shows gallery panel. |
| R25 | Map filterable by sector. | PASS | Quick chips and advanced sector filter. |
| R26 | Map filterable by size. | PASS | Employee-band size filter. |
| R27 | Map filterable by stage. | PASS | Stage filter. |
| R28 | Map filterable by hiring status. | PASS | Hiring chip and advanced hiring filter. |
| R29 | Map filterable by location. | PASS | Location filter and search. |
| R30 | Map should reward exploration. | PASS | Clusters, search, drawer, profiles, save list, CSV, Street View, and view controls. |
| R31 | New resources/companies without redeployment. | PASS | CSV imports, claim drafts, admin approval, and public-source importer support content updates. |
| R32 | Dual audience: founder and investor. | PASS | Founder Navigator passes founder scenarios; map supports investor ecosystem overview. |
| R33 | Production quality suitable for state government website. | PASS with watch items | Build/lint/typecheck/tests/audit pass; UI polished; remaining hardening is storage/email/marker migration. |
| R34 | Reference map inspiration from PamPam. | PASS | Visual, interactive, filterable investor map, not table-only. |
| R35 | Winning build may go live on startup.utah.gov. | PASS with watch items | Official links, state-friendly UX, admin imports, profile verification, and production build are in place. |
| R36 | Judging: usability and experience. | PASS | Chat-first flow, exact-page guide, concise plan cards, and calm investor map. |
| R37 | Judging: technical execution and scalability. | PASS | API-first Next app, typed loaders, admin tools, tests, and production build. |
| R38 | Judging: design and visual impact. | PASS | Browser smoke confirms polished founder/map/company surfaces. |
| R39 | Judging: innovation and creativity. | PASS | Exact-page AI guide, claimable ecosystem map, public-data enrichment, and admin review workflow. |

## AI Test Case QA

Test method: called `/api/ai/chat` on fresh `localhost:3020` with deterministic default settings:

```json
{ "provider": "mock", "model": "basecamp-local-guide", "thinkingLevel": "medium" }
```

| Persona | Expected | Actual post-fix result | Verdict |
|---|---|---|---|
| Jordan, 20, Salt Lake City, pre-seed idea/no business | First-step founder path, not investor-ready VC path. | Plan starts with "Clarify the problem, customer, and first business idea"; top resources include SCORE, FSTEP Idea Explorer, Utah SBDC, and Get Started: Business Idea Challenge; no VC/angel resources in top action set. | PASS |
| Maria, 38, Washington County, rural woman-owned agriculture scaling | Rural/agriculture/Southern Utah/woman-aware growth resources. | Top resources include Utah Tech Atwood Innovation Center, USU Remote Online Initiative, St George Downtown Farmers Market, SBA Thrive, and Rural Utah Chamber Coalition. | PASS |
| Marcus, 34, Ogden/Weber veteran custom fabrication/manufacturing | Formation plus veteran support and no wrong-county false positive. | Answer explicitly mentions veteran context; top resources include Veteran-Owned Business Registration Utah, STRIVE, Veteran Business Resource Center, and formation/EIN sequence; Washington Area Chamber no longer appears in the top set. | PASS |
| Priya, 31, Salt Lake City B2B SaaS raising first venture round, asks for angels/VCs | Capital-readiness and angel/VC discovery, no setup chores. | Plan starts with business plan/financials/use-of-funds; top resources are Park City Angels, Salt Lake Angels, Red Rock Angels, Startup Ignition Ventures, and Peterson Ventures; no business bank account guidance. | PASS |
| David, 45, Provo medical device, FDA cleared, international expansion | Export/international trade plus growth-stage resources. | Plan starts with export readiness; top resources are World Trade Center Utah, U.S. Commercial Service, Utah Inland Port Authority, Business Resource Center - Utah Tech University, and Sorenson Impact Fund. | PASS |
| Dr. Amir, 29, University of Utah PhD commercializing novel technology | Commercialization-first path before generic formation. | Plan starts with invention/IP/university commercialization path; top resources include Utah Innovation Center, BYU Rollins Center, University of Utah Lassonde Entrepreneurship Institute, UVU Entrepreneur Institute, and SBA Thrive. | PASS |

## Issues Fixed From Initial Audit

| Initial finding | Fix | Verification |
|---|---|---|
| `pre-seed` over-routed Jordan to venture capital. | Funding/VC intent now requires fundraising context and idea/no-business/first-step intent suppresses VC. | Jordan persona endpoint test passes. |
| David did not prioritize export resources. | International/export intent now strongly boosts World Trade Center Utah, U.S. Commercial Service, and adjacent trade resources. | David persona endpoint test passes. |
| Amir was routed to generic formation. | Research/commercialization intent now produces commercialization plan and university/innovation resources. | Amir persona endpoint test passes. |
| Maria was too generic. | Rural/agriculture/Southern Utah/women signals now boost specialized resources and demote weak blank-link action resources. | Maria persona endpoint test passes. |
| Marcus missed veteran context and showed a wrong-county chamber. | Veteran/manufacturing handling now reserves veteran resources and excludes focused resources from unrelated counties. | Marcus persona endpoint test passes. |
| Priya asked for angels but got mostly VC/fund resources. | Explicit angel intent now boosts angel groups above other capital resources. | Priya persona endpoint test passes. |
| Official map seed missed `OgdenXR`. | Added official `OgdenXR` row to `data/companies.csv`. | Official/local map parity script passes. |
| Playwright e2e could reuse a stale server. | E2E config now uses isolated port 3020 with no existing-server reuse. | `npm run test:e2e` passes. |

## Browser QA

| Surface | Result | Evidence |
|---|---|---|
| Home / Founder Navigator | PASS | Founder’s Navigator, Startup State assistant, Send button, exact-page panel, and resume UI visible. |
| Map | PASS | Where Utah is building, startups-in-view count, More filters, list/map exploration, and investor view visible. |
| Resources | PASS | Resource Explorer, filters, direct resource cards, Save/Open actions visible. |
| Submit company | PASS | Claim/create page, company fields, job/gallery fields, hiring status, Submit for review, verification explanation visible. |
| Company profile | PASS in initial audit | Required profile fields/panels present for seeded companies. |
| Admin / imports | PASS in initial audit | Counts, CSV import, public source preview, freshness review, and AI controls present. |

## Production Quality Watch Items

| Watch item | Severity | Why it matters | Suggested next action |
|---|---|---|---|
| Real email verification delivery not fully tested. | P2 | Claim verification depends on email delivery in production. | Run a controlled work-email magic-link test with configured SMTP before public launch. |
| File-backed storage is prototype-grade. | P2 | Acceptable for hackathon, not ideal for state-scale auditability. | Move drafts/uploads/imports to managed DB/object storage if selected for go-live. |
| External pages in iframe can be blocked. | P3 | Exact-page panel may hit frame restrictions on some third-party sites. | Keep direct URL visible and add blocked-frame fallback messaging if needed. |
| Google Maps `Marker` API is deprecated. | P3 | Browser console warned about long-term deprecation. | Migrate to `AdvancedMarkerElement` before long-term production maintenance. |

## Judge-Readiness Scorecard

| Judging area | QA read |
|---|---|
| Usability & Experience, 30% | PASS: required personas now produce distinct, useful, fast guidance; map is calm and explorable. |
| Technical Execution, 25% | PASS: build, lint, typecheck, tests, e2e, audit, API routes, admin imports, and data parity pass. |
| Design & Visual Impact, 25% | PASS: investor map and founder surfaces are polished enough for demo. |
| Innovation & Creativity, 20% | PASS: chat-first exact-page guide plus claimable ecosystem map and public-data enrichment are differentiated. |

## Final QA Verdict

Basecamp now checks out against the full challenge requirements for a working prototype. The required AI persona cases pass, official seed data parity passes, the map/profile/self-service flows are present, and the local production build/test stack is green.
