import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { agentManagementMockInput } from "../../frontend/src/features/agent-management/agent-management-mock-data.ts";
import { createAgentManagementViewModel } from "../../frontend/src/features/agent-management/agent-management-view.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));

const requiredShellFiles = [
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "frontend/src/main.tsx",
  "frontend/src/App.tsx",
  "frontend/src/features/agent-management/agent-management-page.tsx",
  "frontend/src/features/agent-management/agent-management-mock-data.ts"
];

for (const file of requiredShellFiles) {
  assert.ok(existsSync(join(root, file)), `missing app shell file: ${file}`);
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.equal(packageJson.scripts.dev, "vite --host 127.0.0.1");
assert.equal(packageJson.scripts.build, "vite build");
assert.equal(packageJson.dependencies.react.startsWith("^18."), true);
assert.equal(packageJson.dependencies["react-dom"].startsWith("^18."), true);
assert.ok(packageJson.devDependencies.vite, "Vite must be available for the app shell");

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
assert.match(indexHtml, /<div id="root"><\/div>/);
assert.match(indexHtml, /\/frontend\/src\/main\.tsx/);

const appSource = readFileSync(join(root, "frontend/src/App.tsx"), "utf8");
assert.match(appSource, /AgentManagementPage/);
assert.match(appSource, /Agent Management/);

const pageSource = readFileSync(
  join(root, "frontend/src/features/agent-management/agent-management-page.tsx"),
  "utf8"
);
assert.match(pageSource, /createAgentManagementViewModel/);
assert.match(pageSource, /agentManagementMockInput/);
assert.doesNotMatch(pageSource, /backend\/src/);

const viewSource = readFileSync(
  join(root, "frontend/src/features/agent-management/agent-management-view.ts"),
  "utf8"
);
assert.doesNotMatch(viewSource, /backend\/src/);

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
