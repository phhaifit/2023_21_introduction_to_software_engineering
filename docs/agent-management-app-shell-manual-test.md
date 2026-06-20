# Agent Management App Shell Manual Test

Use this checklist to manually verify the app shell for the OpenSpec change
`integrate-agent-management-app-shell`.

## Start The App

Install dependencies if they are not present:

```bash
npm install
```

Run the Vite app:

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

The page must load without starting backend API, database, or OpenClaw services.

## Browser Checklist

- [ ] The browser shows the Virtual Company Platform app shell.
- [ ] The Agent Management page is mounted.
- [ ] The list shows `Research Agent` with `Enabled` status.
- [ ] The list shows `Support Agent` with `Disabled` status.
- [ ] The enabled agent row shows `Disable` and `Delete` controls.
- [ ] The disabled agent row shows `Enable` and `Delete` controls.
- [ ] The form section is visible in create mode.
- [ ] Clicking `Edit` on an agent shows the edit form surface for that agent.
- [ ] Clicking `New agent` returns the form to create mode.

## Smoke Check

Run the production build smoke check before handoff:

```bash
npm run build
```

This change uses mock frontend data only. API integration, persistence, RBAC,
and OpenClaw skill writing are intentionally outside this change.
