import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { agentManagementMockInput } from "@vcp/frontend/features/agent-management/agent-management-mock-data.ts";
import { createAgentManagementViewModel } from "@vcp/frontend/features/agent-management/agent-management-view.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

const requiredShellFiles = [
  "apps/frontend/index.html",
  "apps/frontend/vite.config.ts",
  "tsconfig.json",
  "apps/frontend/src/main.tsx",
  "apps/frontend/src/App.tsx",
  "apps/frontend/src/assets/agent-management/agents-hero.png",
  "apps/frontend/src/components/layout/Sidebar.tsx",
  "apps/frontend/src/features/agent-management/agent-management-api-client.ts",
  "apps/frontend/src/features/agent-management/agent-management-page.tsx",
  "apps/frontend/src/features/agent-management/agent-management-mock-data.ts",
  "apps/backend/src/local-agent-management-server.ts"
];

for (const file of requiredShellFiles) {
  assert.ok(existsSync(join(root, file)), `missing app shell file: ${file}`);
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.match(packageJson.scripts.dev, /concurrently/);
assert.equal(packageJson.scripts["dev:api"], "npm run dev --workspace=@vcp/backend");
assert.equal(packageJson.scripts["dev:web"], "npm run dev --workspace=@vcp/frontend");
assert.equal(packageJson.scripts.build, "npm run build --workspace=@vcp/frontend");
assert.deepEqual(packageJson.workspaces, ["packages/*", "apps/*"]);

const frontendPackageJson = JSON.parse(
  readFileSync(join(root, "apps/frontend/package.json"), "utf8")
);
assert.equal(frontendPackageJson.dependencies.react.startsWith("^18."), true);
assert.equal(frontendPackageJson.dependencies["react-dom"].startsWith("^18."), true);
assert.equal(frontendPackageJson.dependencies["lucide-react"].startsWith("^"), true);
assert.ok(frontendPackageJson.devDependencies.vite, "Vite must be available for the app shell");
assert.equal(frontendPackageJson.dependencies["@vcp/backend"], undefined);
assert.equal(frontendPackageJson.dependencies["@vcp/database"], undefined);

const indexHtml = readFileSync(join(root, "apps/frontend/index.html"), "utf8");
assert.match(indexHtml, /<div id="root"><\/div>/);
assert.match(indexHtml, /\/src\/main\.tsx/);
assert.doesNotMatch(indexHtml, /fonts\.googleapis/);
assert.doesNotMatch(indexHtml, /Material Symbols/);
assert.doesNotMatch(indexHtml, /tailwindcss/);

const appSource = readFileSync(join(root, "apps/frontend/src/App.tsx"), "utf8");
assert.match(appSource, /AgentManagementPage/);
assert.match(appSource, /Agent Management/);
assert.match(appSource, /DEMO_WORKSPACE_ID/);

const sidebarSource = readFileSync(join(root, "apps/frontend/src/components/layout/Sidebar.tsx"), "utf8");
assert.match(sidebarSource, /from "lucide-react"/);
assert.match(sidebarSource, /aria-label=\{toggleLabel\}/);
assert.match(sidebarSource, /sidebar--collapsed/);
assert.match(sidebarSource, /Ask for help/);

const pageSource = readFileSync(
  join(root, "apps/frontend/src/features/agent-management/agent-management-page.tsx"),
  "utf8"
);
assert.match(pageSource, /createAgentManagementViewModel/);
assert.match(pageSource, /listAgents/);
assert.match(pageSource, /agentsHeroUrl/);
assert.match(pageSource, /accessMode = "manager"/);
assert.doesNotMatch(pageSource, /agentManagementMockInput/);
assert.doesNotMatch(pageSource, /apps\/backend/);
assert.doesNotMatch(pageSource, /Material Symbols/);
assert.doesNotMatch(pageSource, /tailwindcss/);

const viteConfig = readFileSync(join(root, "apps/frontend/vite.config.ts"), "utf8");
assert.match(viteConfig, /"\/api"/);
assert.match(viteConfig, /127\.0\.0\.1:3001/);

const viewSource = readFileSync(
  join(root, "apps/frontend/src/features/agent-management/agent-management-view.ts"),
  "utf8"
);
assert.doesNotMatch(viewSource, /apps\/backend/);

const mockStatuses = agentManagementMockInput.agents.map((agent) => agent.status);
assert.ok(mockStatuses.includes("enabled"), "mock data must include an enabled agent");
assert.ok(mockStatuses.includes("disabled"), "mock data must include a disabled agent");

const viewModel = createAgentManagementViewModel(agentManagementMockInput);
assert.equal(viewModel.list.rows.length, 2);
assert.equal(viewModel.form.title, "Create agent");
assert.deepEqual(
  viewModel.list.rows.find((row) => row.status === "enabled")?.actions.map((action) => action.kind),
  ["disable", "delete"]
);
assert.deepEqual(
  viewModel.list.rows.find((row) => row.status === "disabled")?.actions.map((action) => action.kind),
  ["enable", "delete"]
);

console.log("agent management app shell checks passed");
