## 1. Setup

- [x] 1.1 Add `react-router-dom` to `apps/frontend/package.json` and install dependencies.

## 2. Core Implementation

- [x] 2.1 Refactor `App.tsx` to set up `createBrowserRouter` or `<BrowserRouter>`.
- [x] 2.2 Configure routes for all existing pages (`/dashboard`, `/workflows`, `/workflow-editor`, `/executions`, `/agents`, `/knowledge-base-rag`, `/billing`, `/settings`).
- [x] 2.3 Implement the default redirection from `/` to `/dashboard`.

## 3. Navigation Update

- [x] 3.1 Update `Sidebar.tsx` to use `NavLink` or `useLocation` from `react-router-dom` to manage active state and navigation, removing the custom `onNavigate` prop.
- [x] 3.2 Update `main.tsx` if routing setup requires wrapping the App component with context providers from `react-router-dom`.

## 4. Verification

- [x] 4.1 Run type checks, format, and lint commands.
- [x] 4.2 Verify deep linking works by directly visiting `/agents` in the browser.
- [x] 4.3 Verify the active tab state in Sidebar updates correctly when navigating.
- [x] 4.4 Run unit and E2E tests to ensure nothing was broken by changing the navigation structure.
