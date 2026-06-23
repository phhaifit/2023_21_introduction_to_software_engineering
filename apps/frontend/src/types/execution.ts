export type ExecutionStatus = "Running" | "Completed" | "Failed";

export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  startTime: string;
  duration: string;
}

export interface ExecutionLog {
  id: string;
  executionId: string;
  timestamp: string;
  message: string;
  level: "info" | "warning" | "error";
}
