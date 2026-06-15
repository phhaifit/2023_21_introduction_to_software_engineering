import { ExecutionLog } from "../types/execution";

export const mockLogs: ExecutionLog[] = [
  {
    id: "log-1",
    executionId: "exe-1",
    timestamp: "2026-06-16 08:28:12",
    message: "Initializing Data Pipeline Alpha execution...",
    level: "info"
  },
  {
    id: "log-2",
    executionId: "exe-1",
    timestamp: "2026-06-16 08:28:15",
    message: "Data Import Agent: Started CSV file validation.",
    level: "info"
  },
  {
    id: "log-3",
    executionId: "exe-1",
    timestamp: "2026-06-16 08:29:00",
    message: "Validation Agent: Schema mismatch detected in row 452. Proceeding with caution.",
    level: "warning"
  },
  {
    id: "log-4",
    executionId: "exe-1",
    timestamp: "2026-06-16 08:30:10",
    message: "Transformation Agent: Initiated currency transformation step.",
    level: "info"
  },
  {
    id: "log-5",
    executionId: "exe-3",
    timestamp: "2026-06-16 04:59:05",
    message: "System Health Checker execution started.",
    level: "info"
  },
  {
    id: "log-6",
    executionId: "exe-3",
    timestamp: "2026-06-16 05:00:00",
    message: "ERROR - Microservice 'payment-gateway' failed to respond. Request timed out.",
    level: "error"
  },
  {
    id: "log-7",
    executionId: "exe-3",
    timestamp: "2026-06-16 05:00:05",
    message: "Execution halted. Status updated to Failed.",
    level: "error"
  }
];
