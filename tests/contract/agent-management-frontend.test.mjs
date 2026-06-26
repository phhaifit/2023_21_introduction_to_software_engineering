import assert from "node:assert/strict";

import {
  createAgentManagementViewModel,
  renderAgentManagementView
} from "@vcp/frontend/features/agent-management/agent-management-view.ts";

const enabledAgent = {
  agentId: "agent-enabled",
  workspaceId: "workspace-a",
  name: "Research Agent",
  role: "Researcher",
  model: "gemini-2.5-flash",
  status: "enabled",
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T01:00:00.000Z"
};

const disabledAgent = {
  ...enabledAgent,
  agentId: "agent-disabled",
  name: "Support Agent",
  role: "Support",
  status: "disabled"
};

const createForm = {
  mode: "create",
  values: {
    name: "",
    role: "",
    model: "gemini-2.5-flash",
    instructions: ""
  }
};

{
  const viewModel = createAgentManagementViewModel({
    agents: [enabledAgent, disabledAgent],
    selectedAgentId: "agent-enabled",
    form: createForm
  });

  assert.equal(viewModel.list.isEmpty, false);
  assert.equal(viewModel.list.rows[0].name, "Research Agent");
  assert.equal(viewModel.list.rows[0].statusLabel, "Enabled");
  assert.equal(viewModel.list.rows[0].canBeSelectedForNewWork, true);
  assert.deepEqual(
    viewModel.list.rows[0].actions.map((action) => action.kind),
    ["disable", "delete"]
  );
  assert.equal(viewModel.list.rows[1].statusLabel, "Disabled");
  assert.equal(viewModel.list.rows[1].canBeSelectedForNewWork, false);
  assert.deepEqual(
    viewModel.list.rows[1].actions.map((action) => action.kind),
    ["enable", "delete"]
  );
}

{
  const html = renderAgentManagementView({
    agents: [enabledAgent, disabledAgent],
    selectedAgentId: "agent-enabled",
    form: createForm
  });

  assert.match(html, /Research Agent/);
  assert.match(html, /Researcher/);
  assert.match(html, /gemini-2\.5-flash/);
  assert.match(html, /aria-label="Agents table"/);
  assert.match(html, /<tr class="agent-row/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /aria-label="Open actions for Research Agent"/);
  assert.match(html, /role="menu" aria-label="Actions for Research Agent"/);
  assert.match(html, />Configure</);
  assert.match(html, /aria-label="Rename Research Agent"/);
  assert.match(html, /aria-label="Duplicate Research Agent"/);
  assert.match(html, /data-action="disable"/);
  assert.match(html, /data-action="enable"/);
  assert.match(html, /data-action="delete"/);
  assert.match(html, /data-confirmation="Deleting an agent prevents future selection\."/);
}

{
  const html = renderAgentManagementView({
    agents: [],
    form: {
      ...createForm,
      errors: {
        name: "Name is required",
        role: "Role is required",
        instructions: "Instructions are required",
        form: "Fix the highlighted fields"
      }
    }
  });

  assert.match(html, /No active agents yet\./);
  assert.match(html, /Create agent/);
  assert.match(html, /role="alert">Fix the highlighted fields/);
  assert.match(html, /id="agent-name-error"/);
  assert.match(html, /aria-invalid="true" aria-describedby="agent-name-error"/);
}

{
  const html = renderAgentManagementView({
    agents: [enabledAgent],
    form: {
      mode: "edit",
      values: {
        name: "Research Agent",
        role: "Analyst",
        model: "gemini-2.5-flash-lite",
        instructions: "Prepare weekly analysis."
      }
    }
  });

  assert.match(html, /Edit agent/);
  assert.match(html, /Save changes/);
  assert.match(html, /name="name" value="Research Agent" readonly/);
  assert.match(html, /name="role" value="Analyst"/);
  assert.match(html, /Prepare weekly analysis\./);
}

{
  const html = renderAgentManagementView({
    agents: [
      {
        ...enabledAgent,
        name: "<script>alert(1)</script>",
        role: "Research & Ops"
      }
    ],
    form: createForm
  });

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Research &amp; Ops/);
}

console.log("agent management frontend checks passed");
