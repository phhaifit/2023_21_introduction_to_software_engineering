export type AgentStatus = "Idle" | "Active" | "Paused" | "Offline";

export type AgentType = "Import" | "Validation" | "Transformation" | "Notification";

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  activeWorkflowCount: number;
}
