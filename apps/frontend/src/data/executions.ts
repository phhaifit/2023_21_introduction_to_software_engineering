export interface ExecutionRecord {
  runId: string;
  workflowId: string;
  workflowName: string;
  status: "running" | "success" | "failed" | "cancelled";
  duration: string;
  startedAt: string;
}

export const mockExecutions: ExecutionRecord[] = [
  {
    runId: "run_alpha_001",
    workflowId: "wf_1",
    workflowName: "Data Pipeline Alpha",
    status: "running",
    duration: "12m 45s",
    startedAt: "2026-06-24 06:30"
  },
  {
    runId: "run_alpha_002",
    workflowId: "wf_1",
    workflowName: "Data Pipeline Alpha",
    status: "success",
    duration: "45m 12s",
    startedAt: "2026-06-23 14:00"
  },
  {
    runId: "run_sync_001",
    workflowId: "wf_2",
    workflowName: "Customer Sync Flow",
    status: "failed",
    duration: "2m 05s",
    startedAt: "2026-06-23 09:15"
  },
  {
    runId: "run_report_001",
    workflowId: "wf_4",
    workflowName: "Monthly Report Generator",
    status: "success",
    duration: "1h 15m",
    startedAt: "2026-06-01 00:05"
  },
  {
    runId: "run_health_001",
    workflowId: "wf_5",
    workflowName: "System Health Checker",
    status: "cancelled",
    duration: "0m 45s",
    startedAt: "2026-06-16 05:00"
  }
];
