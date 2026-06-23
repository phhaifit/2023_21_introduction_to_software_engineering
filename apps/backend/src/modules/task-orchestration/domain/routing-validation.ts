import type { EntityId, TaskRoutingSelection } from "@vcp/shared";

export class TaskRoutingValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid routing: ${issues.join(", ")}`);
    this.name = "TaskRoutingValidationError";
    this.issues = issues;
  }
}

export function parseTaskRoutingSelection(value: unknown): TaskRoutingSelection {
  const issues: string[] = [];

  if (value === null) {
    issues.push("routing cannot be null");
  } else if (value === undefined) {
    issues.push("routing is required");
  } else if (Array.isArray(value)) {
    issues.push("routing cannot be an array");
  } else if (typeof value !== "object") {
    issues.push("routing must be an object");
  } else {
    const routing = value as Record<string, unknown>;

    // Check mode is present and valid
    if (typeof routing.mode !== "string") {
      issues.push("routing.mode is required and must be a string");
    } else if (!["auto", "specific-agent", "predefined-workflow"].includes(routing.mode)) {
      issues.push(
        `routing.mode must be one of "auto", "specific-agent", or "predefined-workflow", got "${routing.mode}"`
      );
    } else {
      // Validate mode-specific requirements
      const mode = routing.mode as string;

      if (mode === "auto") {
        // Auto must have no targets
        if ("agentId" in routing && routing.agentId !== undefined && routing.agentId !== null) {
          issues.push("auto routing cannot include agentId");
        }
        if ("workflowId" in routing && routing.workflowId !== undefined && routing.workflowId !== null) {
          issues.push("auto routing cannot include workflowId");
        }
      } else if (mode === "specific-agent") {
        // Must have agentId, must not have workflowId
        if (!routing.agentId || typeof routing.agentId !== "string") {
          issues.push("specific-agent routing requires agentId");
        }
        if ("workflowId" in routing && routing.workflowId !== undefined && routing.workflowId !== null) {
          issues.push("specific-agent routing cannot include workflowId");
        }
      } else if (mode === "predefined-workflow") {
        // Must have workflowId, must not have agentId
        if (!routing.workflowId || typeof routing.workflowId !== "string") {
          issues.push("predefined-workflow routing requires workflowId");
        }
        if ("agentId" in routing && routing.agentId !== undefined && routing.agentId !== null) {
          issues.push("predefined-workflow routing cannot include agentId");
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new TaskRoutingValidationError(issues);
  }

  // Return a canonical fresh routing object, never return the caller's object
  const routing = value as Record<string, unknown>;
  const mode = routing.mode as string;

  if (mode === "auto") {
    return { mode: "auto" };
  } else if (mode === "specific-agent") {
    return { mode: "specific-agent", agentId: routing.agentId as EntityId<"agentId"> };
  } else {
    // mode === "predefined-workflow"
    return { mode: "predefined-workflow", workflowId: routing.workflowId as EntityId<"workflowId"> };
  }
}
