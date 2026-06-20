# Agent Management UI/API Manual Test

Use this checklist to verify the API-backed browser flow for the OpenSpec change
`connect-agent-management-ui-api`.

## Start The App

Install dependencies if they are not present:

```bash
npm install
```

Start the local Express API and Vite app together:

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

The command starts:

- Agent Management API: `http://127.0.0.1:3001`
- Vite UI: usually `http://127.0.0.1:5173`

Vite proxies `/api` to the local API. No database or OpenClaw service is required.
The in-memory data resets to the two seed agents whenever the API process restarts.

## Browser Checklist

- [ ] The browser shows the Virtual Company Platform app shell.
- [ ] The Agent Management page is mounted.
- [ ] A loading message appears briefly before the API-backed list renders.
- [ ] The list shows seeded `Research Agent` with `Enabled` status.
- [ ] The list shows seeded `Support Agent` with `Disabled` status.
- [ ] The enabled agent row shows `Disable` and `Delete` controls.
- [ ] The disabled agent row shows `Enable` and `Delete` controls.
- [ ] Creating a valid agent refreshes the list and clears the create form.
- [ ] Submitting an invalid create form displays field errors without clearing values.
- [ ] Clicking `Edit` loads role, model, and private instructions from the API.
- [ ] Saving an edit refreshes the corresponding row.
- [ ] Disabling an enabled agent changes its status and exposes `Enable`.
- [ ] Enabling a disabled agent changes its status and exposes `Disable`.
- [ ] Cancelling delete confirmation leaves the agent unchanged.
- [ ] Confirming delete removes the agent from the active list.
- [ ] Clicking `New agent` returns the form to create mode.

## Error Check

1. Stop only the API process or stop `npm run dev` and start `npm run dev:web`.
2. Reload the browser.
3. Confirm the page displays a recoverable load error and a `Retry` button instead of mock data.
4. Restart `npm run dev`, then click `Retry` and confirm the seeded list returns.

## Smoke Check

Run the production build smoke check before handoff:

```bash
npm run build
```

Prisma persistence, real RBAC/workspace membership, production server composition,
Playwright automation, and OpenClaw skill writing remain outside this change.
