import { Workflow } from "../types/workflow";

export const mockWorkflows: Workflow[] = [
  {
    id: "wf-1",
    name: "Data Pipeline Alpha",
    description: "Imports daily transactions, validates schema, and runs transformations.",
    status: "Running",
    stepCount: 4,
    lastUpdated: "2026-06-16 08:30"
  },
  {
    id: "wf-2",
    name: "Customer Sync Flow",
    description: "Syncs customer records between CRM and internal database.",
    status: "Published",
    stepCount: 3,
    lastUpdated: "2026-06-15 17:45"
  },
  {
    id: "wf-3",
    name: "Inventory Validation",
    description: "Checks stock counts, flags discrepancies, and alerts managers.",
    status: "Draft",
    stepCount: 2,
    lastUpdated: "2026-06-14 11:20"
  },
  {
    id: "wf-4",
    name: "Monthly Report Generator",
    description: "Aggregates monthly usage data and sends PDF report to partners.",
    status: "Completed",
    stepCount: 4,
    lastUpdated: "2026-06-01 00:05"
  },
  {
    id: "wf-5",
    name: "System Health Checker",
    description: "Pings microservices, collects health status, and updates status page.",
    status: "Failed",
    stepCount: 3,
    lastUpdated: "2026-06-16 05:00"
  }
];
