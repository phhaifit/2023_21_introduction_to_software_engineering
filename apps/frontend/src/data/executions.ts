import { Execution } from "../types/execution";

export const mockExecutions: Execution[] = [
  {
    id: "exe-1",
    workflowId: "wf-1",
    workflowName: "Data Pipeline Alpha",
    status: "Running",
    startTime: "2026-06-16 08:28:10",
    duration: "2m 15s"
  },
  {
    id: "exe-2",
    workflowId: "wf-4",
    workflowName: "Monthly Report Generator",
    status: "Completed",
    startTime: "2026-06-01 00:00:05",
    duration: "4m 32s"
  },
  {
    id: "exe-3",
    workflowId: "wf-5",
    workflowName: "System Health Checker",
    status: "Failed",
    startTime: "2026-06-16 04:59:00",
    duration: "1m 05s"
  },
  {
    id: "exe-4",
    workflowId: "wf-2",
    workflowName: "Customer Sync Flow",
    status: "Completed",
    startTime: "2026-06-15 17:40:00",
    duration: "3m 12s"
  },
  {
    id: "exe-5",
    workflowId: "wf-1",
    workflowName: "Data Pipeline Alpha",
    status: "Failed",
    startTime: "2026-06-15 08:30:00",
    duration: "1m 45s"
  }
];
