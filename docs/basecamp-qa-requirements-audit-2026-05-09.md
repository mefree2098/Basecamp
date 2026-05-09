# Basecamp QA Requirements Audit

Date: 2026-05-09
QA target: Basecamp / Startup State Utah prototype in `/Users/matt/Documents/Basecamp`
Primary tested build: fresh production build served at `http://127.0.0.1:3034` with isolated QA storage
Official challenge source: [AI Builder Day - Utah GOED](https://startupstate.netlify.app/)

## Executive Summary

Overall verdict: **PASS for hackathon judging / PASS-WATCH for go-live readiness**.

Basecamp satisfies the core challenge: it is a working clickable prototype with a chat-first Founder Navigator, a visual Utah Startup Map, self-service company profile submission, admin content-update paths, and polished founder/investor surfaces. The required six AI personas all receive meaningfully different guidance grounded in the supplied resource dataset.

The main remaining risks are not showstoppers for a Sunday prototype, but they matter before a public state launch. The earlier map-default, University of Utah ranking, blank-row, `St George`, Suazo title, and funding-negation findings were corrected in this pass.

| Severity | Finding | QA read |
|---|---|---|
| P1 | None found. | No blocker currently prevents the prototype from being demonstrated. |
| P2 | Company verification email API returned `sent`, but no real inbox click-through was completed in this QA pass. | The API and UI flow exist; run a controlled real-domain verification before public launch. |
| P2 | Persistence is prototype-grade file storage. | Acceptable for hackathon; move drafts, sessions, uploads, imports, and audit logs to managed DB/object storage for production. |
| P3 | Google Maps console warns that `google.maps.Marker` is deprecated. | Not currently broken, but migrate to `AdvancedMarkerElement` before long-term maintenance. |

## Source And Data Pull

| Source | URL | Evidence |
|---|---|---|
| Challenge brief | https://startupstate.netlify.app/ | Used as the requirements source of truth. |
| Resources Spreadsheet | https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit?usp=sharing | Export parsed successfully. Official source has 213 resource rows. |
| Map Data | https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit?usp=sharing | Export parsed successfully. Official source currently has 221 named company rows. |
| Live Startup State | https://startup.utah.gov/ | Used by curated direct-action resource links. |
| Reference Startup Map | https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN | Used as inspiration requirement, not copied. |
| UGRC public source | https://gis.utah.gov/products/sgid/society/open-source-places/ | Admin preview returned 13,532 eligible public business records; 696 are checked in as additive extra map data. |

## Data Parity

| Dataset | Official source export | Local checked-in seed | Runtime/API count | Result |
|---|---:|---:|---:|---|
| Resources | 213 rows | 213 rows | 219 resources | PASS. All official resource IDs are present; app adds 6 curated direct-action startup links. |
| Startup map seed | 221 named rows | 221 usable named rows, 0 blank records | 221 seed profiles in seed-only map mode | PASS. No named source company is missing. |
| Public company expansion | 13,532 eligible UGRC records | 696 imported records | 917 total company profiles when `Extra data` is enabled | PASS. Additive and provenance-backed; default investor view now starts seed-only. |
| Map support data | N/A | `data/google-geocodes.server.json`, `data/company-icons.server.json` | 207 geocoded locations, 195 cached icons | PASS. |

## Verification Runs

| Check | Result | Notes |
|---|---|---|
| `npm run lint` | PASS | ESLint completed with zero warnings. |
| `npm run typecheck` | PASS | `tsc --noEmit` passed. |
| `npm run test` | PASS | 8 test files, 47 tests passed. |
| `npm audit --audit-level=moderate` | PASS | 0 vulnerabilities. |
| `npm run build` | PASS | Next 16.2.5 production build completed and standalone assets were prepared. |
| `npm run test:e2e` | BLOCKED IN DEFAULT LOCAL ENV | Port `3020` was already occupied by `node` PID 29889, and Next's dev-server lock prevented a second dev server from starting on another port. |
| Playwright smoke against fresh production server | PASS | Production smoke passed against `http://127.0.0.1:3034`: health 200, map seed-only, wizard chat visible. |
| Browser UI smoke | PASS | Browser render verified map seed-only mode and Founder Wizard chat surface. |
| Browser console | PASS-WATCH | No app errors observed in sampled logs; one Google Maps marker deprecation warning. |

## API Smoke

All checks below ran against the fresh production server on `127.0.0.1:3034`.

| Endpoint / flow | Status | Evidence |
|---|---:|---|
| `/api/healthz` | 200 | Service ok; runtime storage writable. |
| `/api/platform/bootstrap` | 200 | 219 resources plus founder options for industries, counties, communities. |
| `/api/map/bootstrap` | 200 | 917 companies, 207 geocoded locations, 195 icons, Google Maps settings present. |
| `/api/admin/summary` | 200 | 219 resources, 917 companies, 61 freshness flags. |
| `/api/resources?stage=fund` | 200 | 162 matching fund-stage resources. |
| `/api/companies?sector=B2B%20Software` | 200 | 122 matching companies. |
| `/api/companies/pura` | 200 | Required profile fields present; founded year/gallery are claim-fillable but currently empty. |
| `/api/admin/public-company-import` | 200 | UGRC preview returned 13,532 eligible records. |
| `/api/company-drafts` POST | 200 | QA draft created, domain match true, pending email verification, email delivery status `sent`. |
| `/api/company-drafts` GET | 200 | QA draft appeared in review queue. |
| `/api/auth/sign-in` | 200 | Site-provider QA founder created. |
| `/api/founder-sessions` POST/GET/PATCH | 200 | Saved a turn, listed the session, and updated completed step progress. |

## Requirements Matrix

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| R01 | Working prototype, live clickable demo, not slides/mockups. | PASS | Production build, routes, APIs, browser smoke, and Playwright smoke passed. |
| R02 | Build two interconnected tools in one platform. | PASS | Founder Navigator, Resource Explorer, Startup Map, company profiles, admin, and shared APIs live in one app shell. |
| R03 | If building both products, fundamentals must not be half-baked. | PASS-WATCH | Both tools function; go-live hardening remains around storage and real email verification. |
| R04 | Founder Navigator should help founders find what they need in under two minutes. | PASS | Chat response returns plan, exact links, and top resource cards immediately in mock/local-guide mode. |
| R05 | Experience should adapt to founder situation. | PASS | Six official personas plus four custom QA scenarios route differently with grounded recommendations. |
| R06 | First-time founder should differ from scaling company looking for capital. | PASS | Jordan receives idea/mentor/validation; Priya receives angel/VC capital-readiness; David receives export plan. |
| R07 | Right resources surface automatically without extended digging. | PASS | `/api/ai/chat` returns top recommendations without manual filters. |
| R08 | Use provided resource spreadsheet. | PASS | All 213 official resource rows are present by ID. |
| R09 | Resource data must be updatable without developer redeploy. | PASS | Admin CSV import stores local overrides; freshness flags surface review needs. |
| R10 | AI is encouraged / chatbot acceptable. | PASS | Chat-first Founder Navigator is primary; Admin AI page supports provider/model settings. |
| R11 | Map should show what is being built in Utah. | PASS | Default seed-only mode shows 221 official startup profiles; `Extra data` can expand to 917 mixed company/public-business profiles. |
| R12 | Map must be interactive and visual. | PASS | Google/fallback map, pins/clusters, drawer, filters, zoom/fit, Street View control, CSV/save actions. |
| R13 | Map should be investor-presentation ready. | PASS | Visual shell is polished and now starts on the cleaner seed-only investor view. |
| R14 | Map should help founders find customers, partners, or acquisitions. | PASS | Search, sector/location filters, profiles, saved list, CSV export, and public-source expansion support discovery. |
| R15 | Companies can claim, create, and update own page. | PASS | `/submit-company`, profile `Claim or update`, draft API, and admin review queue verified. |
| R16 | Lightweight verification method included. | PASS-WATCH | Work-email/domain check and magic-link flow exist; real inbox click-through not completed in this pass. |
| R17 | Profile includes Name. | PASS | Pura profile and submission form verified. |
| R18 | Profile includes Website. | PASS | Website link on profile; website field in submission form. |
| R19 | Profile includes Employees. | PASS | Employee band shown on profile and form. |
| R20 | Profile includes Sector. | PASS | Sector shown on profile and form. |
| R21 | Profile includes Year founded. | PASS | Field shown; seeded companies can add during claim. |
| R22 | Profile includes LinkedIn. | PASS | LinkedIn link shown where available; field exists in form. |
| R23 | Profile includes Description. | PASS | Description shown on profile and map drawer; field exists in form. |
| R24 | Profile includes Address. | PASS | Location/address panel shown; full address field exists in form. |
| R25 | Profile includes Hiring status. | PASS | Hiring status fact/filter/form field verified. |
| R26 | Profile includes Job postings. | PASS | Jobs panel, jobs URL, ATS preview/import, and job-posting textarea exist. |
| R27 | Profile includes Photo gallery. | PASS | Gallery panel, URL textarea, and image upload exist. |
| R28 | Map filterable by sector. | PASS | Quick sector chips and advanced sector select verified. |
| R29 | Map filterable by size. | PASS | Advanced size/employee-band select verified. |
| R30 | Map filterable by stage. | PASS | Advanced stage select verified. |
| R31 | Map filterable by hiring status. | PASS | Hiring chip and advanced hiring select verified. |
| R32 | Map filterable by location. | PASS | Location select and search verified. |
| R33 | Map should reward exploration. | PASS | Clusters, drawers, full profiles, save list, CSV export, view menu, Street View control. |
| R34 | Reference map inspiration considered. | PASS | Interactive map experience exists rather than table-only directory. |
| R35 | New resources and companies can be added constantly. | PASS | CSV import, public import preview, claim drafts, and admin approval paths verified. |
| R36 | Dual audience ready: time-pressed founder and first-time investor. | PASS | Founder flow passes personas; investor map now starts with the official seed set and leaves public-record expansion behind the explicit `Extra data` toggle. |
| R37 | Production quality suitable for state government / international investors. | PASS-WATCH | Build and UI are strong; managed storage, real verification, and marker deprecation remain before public launch. |
| R38 | Live site replacement/enhancement path. | PASS-WATCH | Exact Startup State links, production build, admin operations, and API-first structure exist; managed infrastructure remains next. |
| R39 | Usability & Experience judging criterion. | PASS | Chat-first and map-first flows are usable; the map default dataset and University of Utah commercialization ranking were corrected after the QA pass. |
| R40 | Technical Execution judging criterion. | PASS | Typecheck, lint, tests, build, audit, APIs, and production-server smoke passed. |
| R41 | Design & Visual Impact judging criterion. | PASS | Visual surfaces are demo-ready; investor map now defaults to the cleaner official startup seed set. |
| R42 | Innovation & Creativity judging criterion. | PASS | Exact-page AI guide, saved plans, claimable profiles, public-data enrichment, and admin imports differentiate the build. |

## AI Persona QA

Method: posted each official scenario to `/api/ai/chat` with the app's deterministic default settings:

```json
{ "provider": "mock", "model": "basecamp-local-guide", "thinkingLevel": "medium" }
```

All six responses returned `guardrails.deterministicFilters=true`, `guardrails.citationsRequired=true`, and `guardrails.externalBrowsingUsed=false`.

| Persona | Expected routing | Observed plan and top visible resources | Verdict |
|---|---|---|---|
| Jordan, 20, Salt Lake City, idea/no business | First-step idea clarity, mentor/SBDC, validation; no VC push. | Active: clarify problem/customer/idea. Top resources: SCORE find a mentor, FSTEP Idea Explorer, SCORE, Utah SBDC free consultation, Get Started: Business Idea Challenge. | PASS |
| Maria, 38, Washington County, rural woman-owned agriculture scaling | Southern Utah, rural/agriculture, woman-aware growth support. | Active: pick growth bottleneck. Top resources: Utah Tech Atwood Innovation Center, USU Remote Online Initiative, St George Downtown Farmers Market, SBA Thrive, Rural Utah Chamber Coalition. | PASS |
| Marcus, 34, Ogden veteran manufacturing startup | Formation basics plus veteran/manufacturing support. | Active: choose business name/entity. Top resources: Startup State registration and licensure, Veteran-Owned Business Registration Utah, STRIVE, Veteran Business Resource Center, IRS EIN. | PASS |
| Priya, 31, Salt Lake City B2B SaaS raising first venture round | Capital-readiness, angel/VC discovery, no formation chores. | Active: prepare business plan/financials/use-of-funds. Top resources: Park City Angels, Salt Lake Angels, Red Rock Angels, Startup Ignition Ventures, Grix. UI chat also verified this exact response and side-panel resource. | PASS |
| David, 45, Provo medical device, FDA cleared, international expansion | Export/international trade plus growth-stage life-science context. | Active: confirm export readiness. Top resources: U.S. Commercial Service, World Trade Center Utah, Sorenson Impact Fund, Utah Inland Port Authority, Business Resource Center - Utah Tech University. | PASS |
| Dr. Amir, 29, University of Utah PhD commercializing technology | Commercialization/IP/university path before generic formation. | Active: map invention/IP/university commercialization path. Top resources: Utah Innovation Center, University of Utah Lassonde Entrepreneurship Institute, Kem C. Gardner Policy Institute, Altitude Labs, Utah Innovation Fund. | PASS |

Persona-specific notes:

| Persona | Quality notes |
|---|---|
| Jordan | Correctly avoids angel/VC routing and starts with mentor/idea exploration. Sixth/seventh API recommendations are less targeted, but the default UI shows the strongest first five. |
| Maria | Strong differentiated rural/Southern Utah/agriculture response. |
| Marcus | Correctly includes veteran resources and formation sequence; no wrong-county chamber surfaced in the top set. |
| Priya | Strongest AI result: exact angel groups first, capital-readiness language, no bank-account/EIN regression. |
| David | Correct export-first plan. International trade resources now remain first, with life-science/growth resources behind them. |
| Amir | Correct commercialization-first plan. University of Utah and adjacent commercialization resources now outrank other-campus entrepreneurship centers. |

## Custom Founder Wizard QA

Method: posted four additional QA-created scenarios to `/api/ai/chat` on the fresh production build with the deterministic local guide. These are not part of the official brief; they were added to catch edge cases in inference and recommendation quality.

| Scenario | Expected behavior | Observed top resources / plan | Verdict |
|---|---|---|---|
| Ogden food-truck founder: needs licensing, registration, local setup, `not investors yet`. | Start-stage formation path; do not route to capital just because `investors` appears in a negated phrase. | Active: choose business name/entity. Top resources: Startup State registration and licensure, IRS EIN, Startup State business bank account, Utah form a new business, Utah SBDC free consultation. | PASS |
| Davis County aerospace/defense manufacturer with 35 employees: government contracts and worker training. | Growth-stage path emphasizing contracting, defense, and workforce resources. | Active: pick growth bottleneck. Top resources: APEX Accelerator, SBA, 47G, Davis Tech BRC, Utah Tech BRC. | PASS |
| New American woman in Salt Lake City opening childcare service. | Formation basics plus community-specific support; no capital-readiness routing. | Active: choose business name/entity. Top resources: Startup State registration and licensure, Women's Business Center, Utah Hispanic Chamber, Suazo Business Center, A Bolder Way Forward. | PASS |
| Moab small retailer closing or selling, with tax/licensing/employee obligations. | Exit-stage plan with advisor/agency obligations; no venture routing. | Active: clarify sale/succession/closure/relocation. Top resources: SCORE, SBDC, StartUp State, plus lower-priority broad resources. | PASS |

## Browser Surface QA

| Surface | Result | Evidence |
|---|---|---|
| Home / Founder Navigator | PASS | Heading, chat composer, save/resume controls, provider buttons, exact-page panel, and starter prompts visible. |
| Founder Navigator AI turn | PASS | Priya scenario produced capital-readiness plan, Park City Angels side panel, and angel resource strip. |
| Map default view | PASS | Map loads seed-only by default with `Extra data` off. Filters, CSV, save, view controls visible. |
| Map seed-only view | PASS | Default seed-only mode shows `Seed data only` and 221 startups in view. |
| Resources page | PASS | Resource Explorer, search, filters by stage/topic/county/industry/community, save/open actions visible. |
| Submit company | PASS | Required profile fields, job/gallery controls, hiring status, submit, and verification explanation visible. |
| Company profile | PASS | Pura profile shows required fields/panels and claim/update link. |
| Admin | PASS | Counts, Google Maps settings, CSV import, public source preview, review queue, freshness review, and AI entry visible. |

## Recommended Next Fixes

1. Run a real controlled company-claim verification using an inbox the team owns, then approve and verify the profile appears on the map.
2. Plan post-hackathon migration from file-backed storage to managed DB/object storage.
3. Migrate Google Maps markers to `AdvancedMarkerElement`.

## Post-Audit Corrections Applied

| Finding | Correction | Re-test result |
|---|---|---|
| Investor map defaulted to the expanded public-record dataset. | Changed the startup map default so `Extra data` starts off and the map opens on the official seed dataset. | PASS |
| University of Utah commercialization prompts were allowing other-campus resources too high in the ranking. | Boosted same-campus/commercialization matches and demoted other-campus commercialization centers when the prompt names University of Utah context. | PASS |
| Founder Wizard needed stronger routing for contract/workforce, exit, and community-specific founder contexts. | Added deterministic scoring and custom tests for those patterns, including an inclusive New American/woman founder case. | PASS |
| A founder saying `not investors yet` could still be inferred as funding-stage because the keyword `investors` was present. | Added funding/VC negation handling and broadened start-stage detection for licensing/opening language. | PASS |
| `data/companies.csv` contained two blank records and inconsistent `St George` labeling. | Removed blank records and normalized `St George` to `St. George` during company loading/geocoding. | PASS |
| Suazo resource title displayed as its full description. | Corrected the seed title to `Suazo Business Center`, preserved the detailed description, and normalized CSV line endings after the edit. | PASS |

## Final QA Verdict

Basecamp is judge-ready as a working prototype. It covers the official brief, uses the supplied data, provides differentiated AI guidance for all six official personas, and gives both founders and investors usable workflows. The highest-impact QA findings from this pass were corrected; remaining items are production-readiness work around real email verification, managed storage, and Google Maps marker modernization.
