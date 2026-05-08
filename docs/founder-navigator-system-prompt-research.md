# Founder Navigator System Prompt Research

Source refresh: 2026-05-08

This document stores the live-source facts and prompt-design requirements for the Founder Navigator. It is meant to keep the assistant prompt grounded in the Startup State brief, the official Startup State journey, and the provided datasets.

## Primary Sources

Challenge brief:
- https://startupstate.netlify.app/
- Source HTML mirror linked by the brief: https://dpaste.com/8M5UQRQWQ.txt

Starter data links from the challenge brief:
- Resources spreadsheet: https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/edit?usp=sharing
- Resources CSV export: https://docs.google.com/spreadsheets/d/1AdfJ9TDWdICQuzoYQn-6cBmUkOVXWD8mTqJNDnuKD-E/export?format=csv
- Map data spreadsheet: https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/edit?usp=sharing
- Map data CSV export: https://docs.google.com/spreadsheets/d/1D9CUtXpyPubOkt51wD9SDCpglkQv6W6oa33iTs73cCk/export?format=csv
- Live Startup State site: https://startup.utah.gov/
- Reference startup map: https://www.pampam.city/utah-startup-map-rtqSlvDvpOKV8Y5VrdZN

Local ingested dataset files:
- `data/resources.csv`
- `data/companies.csv`

## Product Brief Facts

The brief frames the resource problem this way:
- Utah has strong resources for founders: education, access to capital, mentorship, counseling, community networks, and support across the lifecycle.
- The failure mode is findability. Startup State is comprehensive, but founders experience it as a library when they need a guide.
- The Founder Navigator must help a founder find what they need in under two minutes.
- Personalization is required. A landscaping owner in St. George and a pre-revenue founder in Lehi should receive different paths.
- The resource data is provided as a complete spreadsheet with categories, descriptions, and links.
- Content must be updatable without a developer because new programs launch constantly.
- AI is encouraged.
- The prototype must be live and clickable, personalized, production-quality, and ready for both founders and investor-facing demos.

## Validation Personas

Use these as regression scenarios for the prompt and recommendation behavior.

1. Jordan, 20, Salt Lake City
   - Pre-seed founder with an idea but no business yet.
   - Needs first-step resources and should not be pushed straight to funding.

2. Maria, 38, Washington County
   - Small agricultural operation near St. George.
   - Rural, woman-owned, looking to scale.
   - Needs agriculture, rural, women, Washington County, operations, and growth resources.

3. Marcus, 34, Ogden, Weber County
   - Veteran starting a custom fabrication and manufacturing business.
   - Early stage.
   - Needs veteran, manufacturing, registration/licensure, operations, workforce, and possibly local mentor resources.

4. Priya, 31, Salt Lake City
   - B2B SaaS founder, 18 months in, paying customers.
   - Ready to raise first venture round.
   - Needs angel/VC/pitch resources, not basic idea-stage content unless there is a missing prerequisite.

5. David, 45, Provo, Utah County
   - Medical device company, 12 employees, FDA cleared.
   - Growth-stage and looking to expand internationally.
   - Needs growth funding, international trade, workforce, strategic planning, and possibly life-sciences resources.

6. Dr. Amir, 29, Salt Lake City
   - University of Utah PhD candidate with novel technology.
   - Wants to commercialize research and has never started a business.
   - Needs commercialization, idea validation, university/community resources, formation, business planning, and mentor guidance.

## Dataset Inventory

Resources dataset:
- Row count from local CSV: 213
- Linked source: Resources spreadsheet above
- Local schema: `id`, `Title`, `description`, `Communities`, `Industries`, `Locations`, `Topics`, `link`, `email`
- App-normalized model: `Resource` with `id`, `slug`, `title`, `description`, `communities`, `industries`, `locations`, `topics`, `stages`, `link`, optional `email`, and freshness metadata.

Resource topics:
- Entrepreneurship Communities: 163
- Funding: 151
- Late Stage Growth: 123
- Start a Business: 57
- Marketing and Sales: 47
- Other: 39
- Close or Exit a Business: 26
- International Trade: 26
- Relocate a Business to Utah: 25
- Taxes and Finance: 24

Resource communities:
- Any: 22
- Multicultural: 20
- Rural: 20
- Student: 18
- Women: 14
- Veteran: 11
- New American: 8

Resource industries:
- Arts and Entertainment and Recreation
- Hospitality and Food Services
- Consumer Packaged Goods
- Manufacturing
- Agriculture
- Life Sciences and Healthcare
- Software and Information Technology
- Aerospace and Defense
- Other
- Financial Services

Resource locations:
- All 29 Utah counties are represented.
- Highest row counts include Salt Lake, Davis, Morgan, Tooele, Weber, Washington, Iron, Beaver, Garfield, Kane, Utah, Wasatch, and Summit.

Company/map dataset:
- Row count from local CSV: 222
- Linked source: Map data spreadsheet above
- Local schema: `Display Type`, `LinkedIn Link (map it to Links to get the logo)`, `Startup Name`, `Full Address`, `Description of startup`, `Website`, `Stage`, `# of Employees`, `Section`
- Company stages: Seed 113, Series A 53, Series B 19, Pre-Seed 15, Series C 8, Series D+ 8, Bootstrapped 3.
- Company sectors: B2B Software 121, Consumer 37, Bio/Medical Tech 18, FinTech 18, Energy 9, Security 9, Marketplaces 8.
- Employee bands: 11-50 87, 2-10 73, 51-200 41, 201-500 13, 501-1K 5, 1K-5K 1.

## Official Startup State Journey

The official Startup State journey is the backbone for plan ordering. The assistant should map founder needs to these steps, then select exact resource pages from the spreadsheet.

| Step | Page | URL | Prompt use |
| --- | --- | --- | --- |
| 1 | Find Your Big Idea | https://startup.utah.gov/find-idea/ | For idea-stage founders who have not clarified the problem, customer, or business concept. |
| 2 | Important Business Skills | https://startup.utah.gov/business-skills/ | For founders who know their craft but need accounting, marketing, sales, operations, or startup basics. |
| 3 | Business Validation | https://startup.utah.gov/business-validation/ | For pre-revenue or early founders who need market research, customer interviews, and proof of demand. |
| 4 | Build your product or service | https://startup.utah.gov/build-product/ | For founders turning a validated idea into a product, service, prototype, or first offer. |
| 5 | Develop your brand and marketing strategy | https://startup.utah.gov/develop-brand/ | For naming, positioning, audience, marketing channel, and first sales path work. |
| 6 | Write your Business Plan | https://startup.utah.gov/business-plan-step/ | For business model, market, operations, funding story, and planning prerequisites. |
| 7 | Registration and Licensure | https://startup.utah.gov/registration/ | For state/local registration and legal licensure sequencing. |
| 8 | Establish Business Operations | https://startup.utah.gov/business-operations/ | For bank account, accounting, records, HR/staffing, insurance, and operational foundation. |
| 9 | Fund Your Small Business | https://startup.utah.gov/fund-small-business/ | For loans, grants, venture capital, angel investors, competitions, crowdfunding, and funding readiness. |
| 10 | Find Office Space | https://startup.utah.gov/find-space/ | For office, coworking, and workspace needs. |
| 11 | Pay Your Taxes | https://startup.utah.gov/pay-taxes/ | For state tax responsibilities and Tax Commission resources. |
| 12 | Join a Community | https://startup.utah.gov/join-community/ | For chambers, networks, peer groups, mentors, and local ecosystem support. |
| 13 | Growth Stage Funding | https://startup.utah.gov/growth-funding/ | For growth capital, investor pitch prep, grants, loans, angel, and VC paths. |
| 14 | Strategic Planning for Growth | https://startup.utah.gov/strategic-planning/ | For scaling systems, leadership, management, and growth planning. |
| 15 | Workforce and Talent Acquisition | https://startup.utah.gov/workforce/ | For hiring, talent pipeline, compensation, training, and workforce resources. |
| 16 | Obtain Government Contracts | https://startup.utah.gov/government-contracts-2/ | For federal/state contracting and Apex/SBA-style contract support. |
| 17 | International Trade | https://startup.utah.gov/international-trade-2/ | For export, overseas markets, trade support, and international expansion. |
| 18 | Relocate Your Business to Utah | https://startup.utah.gov/relocate-business/ | For companies considering Utah relocation, incentives, and state advantages. |
| 19 | Sell or Close Your Business | https://startup.utah.gov/close-business/ | For closure, succession, legal status changes, and exit-related obligations. |

## Business Plan Generator Fields

The assistant should help founders prepare answers before opening or filling the Business Plan Generator.

Generator URL: https://startup.utah.gov/business-plan/

Sections and fields:
- Identity: business name, owners, email, phone, address, 1-2 sentence elevator pitch.
- Problem Worth Solving: describe the customer problem.
- Our Solution: explain the solution, differentiation, and whether the solution can fit a price customers will pay.
- Target Market: individual, small business, corporation, or other, plus details about expected customers.
- Competition: market/competitor research method, including online research, surveys/interviews, or other.
- Marketing Activities: social media, content marketing, paid advertising, or other, plus strategy details.
- Expense: financing method, major startup expenses.
- Revenue: projected annual revenue range and revenue plan.
- Milestones: primary goal for the next year and supporting details.
- Teams and Key Roles: alone or with partners, partner names, team details.
- Vision and Resources: long-term vision, legal requirements, permits, licenses, and whether they have been researched.
- Final Statement: why the founder believes the business will succeed in Utah.

Prompt implication:
- If the active step is business planning, guide one section at a time.
- Ask for missing facts rather than generating fictional details.
- Encourage founders to keep answers they can paste into the official page.

## Funding Page Intelligence

Fund Your Small Business:
- URL: https://startup.utah.gov/fund-small-business/
- Appropriate for startup costs, early operating capital, grants, loans, investors, competitions, and crowdfunding.
- Funding paths named on the page include grants/government funding, crowdfunding, competitions and accelerators, small business loans, angel investors, and venture capital.
- Readiness requirements mentioned include business plan, financial statements, a clear use of funds, a prepared pitch, and understanding pros/cons of funding options.

Growth Stage Funding:
- URL: https://startup.utah.gov/growth-funding/
- Appropriate for companies scaling past basic startup formation.
- Includes pitch preparation, government grants, SBIR/STTR and innovation funding, competitions, crowdfunding, loans, angel investors, and venture capital.
- Prompt should distinguish startup funding from growth-stage funding.

## System Prompt Operating Model

The extensive system prompt should enforce this behavior:

1. Act as a state-assigned personal assistant.
   - The assistant is accountable for getting the founder through the process.
   - It should be warm, concise, and operational.

2. Create a plan first.
   - On the first substantive founder message, create an ordered plan before deep-diving into a single resource.
   - The plan should use the official journey order unless the founder's stage clearly requires a later branch.
   - The plan should be visible as a tracked checklist in the UI.

3. Track each request/task status.
   - Use conceptual statuses: Done, Active, Queued, Blocked.
   - Exactly one unfinished item should be Active.
   - Completed items should not be reassigned or repeated.
   - Blocked items should trigger a clarifying question or an advisor route.

4. Work step by step.
   - After plan creation, the assistant should focus on the Active item.
   - It should provide the exact URL for the active page.
   - It should tell the founder what to prepare, what to click or choose, what fields mean, and what to report back.
   - It should ask one missing question at a time if it needs founder-specific facts.

5. Use exact links.
   - Prefer direct action pages over broad homepages.
   - Cite every named resource as `[resource:id]`.
   - Use the resource spreadsheet links for exact page selection.
   - Use official journey pages for sequencing and page guidance.

6. Personalize heavily.
   - Stage: idea, validate, start, fund, grow, exit.
   - Location: city/county, rural, Washington County/St. George, Lehi/Utah County, Ogden/Weber, Salt Lake, etc.
   - Community: Women, Veteran, Student, Rural, Multicultural, New American.
   - Industry: agriculture, manufacturing, B2B SaaS/software, life sciences/medical devices, financial services, consumer, hospitality, etc.
   - Need: registration, local permits, funding, mentor, pitch, workforce, export, government contracts, closure.

7. Do not hallucinate.
   - If the data does not include an exact program, eligibility rule, deadline, funding amount, or contact, the assistant must say what to verify and where.
   - For permits and legal compliance, it should route to state/local verification rather than claiming final authority.

8. End properly.
   - When all plan items are done, say the plan is complete.
   - Ask what else the founder needs help with next.

## Suggested Response Shape

Initial plan turn:

```text
I created a working plan. Active step: [first required step].

Done: none yet
Active: [first step]
Queued: [remaining steps in order]

1. [Concrete action on the active page with exact URL.] [resource:id]
2. [What to prepare or what the form/page will ask for.]
3. [What to tell Basecamp after completing it.]
```

Continuation turn:

```text
Nice, I have [completed step] marked done. Active step: [next step].

Done: [completed steps]
Active: [next step]
Queued: [remaining steps]

1. Open [exact page URL]. [resource:id]
2. Prepare [specific details].
3. Tell me [specific completion signal] and I will move you forward.
```

Completion turn:

```text
Everything in this plan is complete.

What else can I help you with: funding, hiring, local licensing, taxes, mentors, growth planning, or something else?
```

## Update Path

The prompt should assume content is updatable:
- Non-technical admins can upload resource CSVs through the admin import flow.
- Imported resources should preserve exact links, topics, communities, industries, locations, and contact email.
- New resource rows should become eligible for recommendation without code changes.
- Prompt behavior should depend on data fields and direct URLs, not hardcoded one-off lists, except for the official Startup State journey order and foundational first-stop links.
