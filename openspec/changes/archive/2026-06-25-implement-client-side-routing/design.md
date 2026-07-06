## Context

The current Frontend application uses a simple `useState<PageKey>` in `App.tsx` to render different views. While simple, it prevents direct linking to pages, breaks browser history, and creates a disconnected user experience where the URL always reads `http://localhost:5173/`.

## Goals / Non-Goals

**Goals:**
- Replace state-based routing with `react-router-dom` v6.
- Enable direct URL access to pages (e.g., `/agents`, `/workflows`).
- Provide an automatic redirect from `/` to the Dashboard page (`/dashboard`).
- Preserve the existing `Sidebar` navigation layout, ensuring active link highlighting works with the router.

**Non-Goals:**
- We will not implement complex nested routing beyond the top-level sidebar items unless already required by the app structure.
- We will not implement route-level code splitting/lazy loading at this stage, as the app is still in a prototype phase.

## Decisions

### Decision 1: Use `react-router-dom` v6
**Rationale:** `react-router-dom` is the industry standard for React client-side routing. Version 6 provides a clean API and integrates easily with Vite setups.
**Alternatives considered:** `@tanstack/react-router` offers more type-safety but might be overkill for this straightforward prototype shell. State-based routing (current) breaks deep linking.

### Decision 2: Keep App Shell Layout as a Root Route
**Rationale:** The `Sidebar` and `<main>` layout should be defined in a root layout component. All the individual pages (Workflows, Agents, etc.) will be rendered as `<Outlet />` children of this root layout. This avoids re-rendering the sidebar on every navigation.

## Risks / Trade-offs

- **Risk:** Existing props like `DEMO_WORKSPACE_ID` passed to `<AgentManagementPage>` need to be managed.
  - **Mitigation:** We can pass it directly in the route element definition to preserve identical behavior.
- **Risk:** Sidebar `activePage` prop must now sync with the actual URL location instead of local state.
  - **Mitigation:** Update `Sidebar.tsx` to use `useLocation()` or `NavLink` from `react-router-dom` to determine active state, replacing the custom `onNavigate` callback.
