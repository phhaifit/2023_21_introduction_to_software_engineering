## Why

Currently, the Frontend App Shell relies on React state (`useState`) to manage active pages without integrating a standard client-side router. This causes three main issues:
1. The application defaults to the "workflows" page regardless of the initial path accessed.
2. URLs do not change when users navigate between pages via the Sidebar, disabling deep linking and URL sharing.
3. Browser history features (back/forward navigation) are broken.
We need to implement a URL-based routing system to provide a standard, expected web application experience.

## What Changes

- Introduce a standard routing library (e.g., `react-router-dom`) into the `@vcp/frontend` workspace.
- Refactor `App.tsx` and the `Sidebar` to utilize URL-based routing instead of state-based routing.
- Map existing component pages (e.g., Dashboard, Workflows, Agents, etc.) to specific URL paths (e.g., `/dashboard`, `/workflows`, `/agents`).
- Ensure the application properly redirects from `/` to `/dashboard`.

## Capabilities

### New Capabilities
- `client-side-routing`: Implement URL-based routing, deep linking, and browser history support for the Frontend application.

### Modified Capabilities

## Impact

- Frontend entry points (`App.tsx`, `main.tsx`)
- `Sidebar` component (`apps/frontend/src/components/layout/Sidebar.tsx`)
- New frontend dependency required (`react-router-dom`).
