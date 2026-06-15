import { Agent } from "../types/agent";

export const mockAgents: Agent[] = [
  {
    id: "agent-1",
    name: "Data Import Agent",
    type: "Import",
    status: "Active",
    activeWorkflowCount: 2
  },
  {
    id: "agent-2",
    name: "Validation Agent",
    type: "Validation",
    status: "Active",
    activeWorkflowCount: 1
  },
  {
    id: "agent-3",
    name: "Transformation Agent",
    type: "Transformation",
    status: "Idle",
    activeWorkflowCount: 0
  },
  {
    id: "agent-4",
    name: "Notification Agent",
    type: "Notification",
    status: "Active",
    activeWorkflowCount: 3
  }
];
