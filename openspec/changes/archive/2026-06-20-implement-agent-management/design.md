## Context

Agent management owns the virtual employee lifecycle inside a workspace. The foundation provides module folders, shared IDs/statuses, and a boundary rule that workflow, task, tools, and RAG modules must consume agent information through public contracts.

## Goals / Non-Goals

**Goals:**
- Implement workspace-scoped agent list, create, update, enable, disable, and delete.
- Store agent role, model, instructions, and lifecycle status.
- Generate or update agent skill configuration content through the module boundary.
- Expose safe agent summaries for workflow and task modules.

**Non-Goals:**
- Execute tasks or route prompts to agents.
- Build complex autonomous handoff behavior.
- Implement model provider billing or advanced model management.

## Decisions

1. Keep agents workspace-scoped.
   - Rationale: Agents represent employees of a virtual company and must not leak across workspaces.
   - Alternative considered: Global reusable agents. Rejected for V1 because workspace-specific instructions and permissions are required.

2. Treat `skill.md` generation as module-owned configuration output.
   - Rationale: Agent management owns instructions and behavior limits, while OpenClaw runtime details stay behind adapters.
   - Alternative considered: Let users edit raw runtime files directly. Rejected because validation and auditability would be weak.

3. Use lifecycle states instead of deleting active agent records immediately.
   - Rationale: Other modules may reference agents in workflows or task history.
   - Alternative considered: Hard-delete every agent immediately. Rejected because it can break historical references.

4. Publish public agent summaries.
   - Rationale: Workflow and task modules need agent name/status/model without importing private agent repositories.

## Risks / Trade-offs

- Skill file generation can drift from stored configuration -> Generate from canonical stored fields and test output shape.
- Deleting agents referenced by workflows can create broken workflows -> Validate references and prefer disabled/deleted lifecycle states.
- Model names may vary by provider -> Store model as a validated string or enum that can be extended later.
