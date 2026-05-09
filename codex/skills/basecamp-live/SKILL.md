---
name: basecamp-live
description: Use this skill when working on the Basecamp codebase and you need live visibility into the running Basecamp platform. It uses a Basecamp-generated Codex live URL and token to inspect health, read logs, run focused API requests, trigger deploy pulls, restart services, and verify changes against the real Jetson deployment.
---

# Basecamp Live

Use the bundled `scripts/basecamp-live.js` helper as the default way to inspect and operate the running Basecamp platform.

## Inputs

- Prefer the environment variables `BASECAMP_CODEX_URL` and `BASECAMP_CODEX_TOKEN`.
- If environment variables are missing, use the persistent helper config at `$CODEX_HOME/basecamp-live.json` when `CODEX_HOME` is set, or `~/.codex/basecamp-live.json` as the default fallback.
- Only ask the user for the Basecamp URL and Codex live token if neither the environment nor the helper config provides them.
- Do not guess the URL or token.

## Working Loop

1. Read current live state first.
2. Inspect focused logs or API routes around the symptom.
3. Make the smallest code or operational action needed.
4. Verify through live Basecamp APIs after the change.
5. Report what changed and what the live platform showed.

## Safety Rules

- Ask for confirmation before disruptive live actions:
  - triggering a deploy pull/build/restart
  - restarting the Basecamp service
  - changing platform settings
  - deleting entities, user data, or credentials
- Prefer read-only inspection until the user clearly wants a live mutation.
- Use normal git or GitHub workflows for code publishing, then use the Basecamp helper to deploy and verify.

## Default Commands

- `node scripts/basecamp-live.js overview`
  Reads health, runtime metadata, host resources, git state, and latest deploy state.

- `node scripts/basecamp-live.js logs --lines 120`
  Reads recent journal logs for the Basecamp service plus the latest deploy log tail.

- `node scripts/basecamp-live.js deploy-run --confirm deploy`
  Starts a Basecamp-managed pull, install, build, and service restart job. Use only after explicit confirmation.

- `node scripts/basecamp-live.js deploy-status`
  Reads the latest deploy job state and log path.

- `node scripts/basecamp-live.js services-restart --confirm restart`
  Restarts the Basecamp systemd service. Use only after explicit confirmation.

- `node scripts/basecamp-live.js request /api/healthz`
  Calls any Basecamp API path when a dedicated helper command does not fit.

## When To Use Which Command

- Use `overview` at the start of live investigation or right after deploy.
- Use `logs` for focused runtime symptoms.
- Use `deploy-run` and `deploy-status` around release work.
- Use `request` for focused reads from Basecamp APIs.

## Verification Guidance

- After deploying, check `deploy-status`, `overview`, and `/api/healthz`.
- After runtime-sensitive changes, inspect logs for the restarted service.
- If a request fails, surface the exact Basecamp error instead of inferring hidden causes.
