import type {
  WorkspaceSummaryDto,
  WorkspaceDetailDto,
  WorkspaceDeleteAckDto
} from "@vcp/shared/contracts/workspace-management.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { authorizedFetch } from "../../shared/api/authorized-fetch.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type { WorkspaceStatus } from "@vcp/shared/contracts/statuses.ts";

// ---------------------------------------------------------------------------
// Original backend types (running server has a different contract)
// ---------------------------------------------------------------------------

type OriginalStatus =
  | "provisioning"
  | "active"
  | "failed"
  | "deleting"
  | "delete_failed"
  | "deleted";

type OriginalProfile = "standard" | "premium";

type OriginalWorkspaceSummary = {
  workspaceId: string;
  name: string;
  status: OriginalStatus;
  requestedProfile?: OriginalProfile | null;
  createdAt: string;
  updatedAt: string;
  failure?: { code: string; message: string } | null;
};

type OriginalCreateAccepted = {
  workspace: OriginalWorkspaceSummary;
  operation: { operationId: string | null; status: string };
};

type OriginalDeleteAccepted = {
  workspaceId: string;
  status: "deleting";
  operation: { operationId: string | null; status: string };
  acceptedAt: string;
};

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapStatus(s: OriginalStatus): WorkspaceStatus {
  switch (s) {
    case "provisioning":    return "pending";
    case "active":          return "running";
    case "deleting":        return "stopping";
    case "delete_failed":
    case "failed":          return "failed";
    case "deleted":         return "deleted";
  }
}

function isWorkspaceStatus(value: unknown): value is WorkspaceStatus {
  return value === "pending" ||
    value === "running" ||
    value === "failed" ||
    value === "stopping" ||
    value === "deleted";
}

function mapProfile(p?: OriginalProfile | null): SubscriptionPlan {
  if (p === "premium") return "premium";
  if (p === "standard") return "standard";
  return "free";
}

function mapSummary(ws: OriginalWorkspaceSummary): WorkspaceSummaryDto {
  return {
    workspaceId: ws.workspaceId as WorkspaceSummaryDto["workspaceId"],
    name: ws.name,
    status: mapStatus(ws.status),
    plan: mapProfile(ws.requestedProfile),
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
  };
}

function normalizeSummary(ws: OriginalWorkspaceSummary | WorkspaceSummaryDto): WorkspaceSummaryDto {
  if (isWorkspaceStatus((ws as WorkspaceSummaryDto).status)) {
    return ws as WorkspaceSummaryDto;
  }

  return mapSummary(ws as OriginalWorkspaceSummary);
}

function mapDetail(ws: OriginalWorkspaceSummary): WorkspaceDetailDto {
  return {
    ...mapSummary(ws),
    runtimeUrl: undefined,
    agentCount: 0,
    workflowCount: 0,
    toolCount: 0,
  };
}

function generateIdempotencyKey(): string {
  // UUID matches /^[A-Za-z0-9_.:-]{8,128}$/ since hex + hyphens are all covered
  return crypto.randomUUID();
}

function workspaceAuthHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = { ...(extra as Record<string, string> | undefined) };
  const token = globalThis.localStorage?.getItem("vcp.auth.token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

const BASE = "/api/workspaces";

async function parseOkResponse<T>(res: Response): Promise<T> {
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: server trả về response không hợp lệ (không phải JSON).`);
  }

  if (!res.ok || (typeof json === "object" && json !== null && (json as any).ok === false)) {
    const errBody = json as any;
    const message: string =
      errBody?.error?.message ??
      errBody?.message ??
      `HTTP ${res.status}`;
    throw new Error(message);
  }

  return (json as any).data as T;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listWorkspaces(): Promise<WorkspaceSummaryDto[]> {
  const res = await authorizedFetch(BASE, { credentials: "include" });
  // Original returns cursor-paginated: { ok, data: [], meta: { cursor } }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: server trả về response không hợp lệ.`);
  }

  if (!res.ok || (json as any)?.ok === false) {
    throw new Error((json as any)?.error?.message ?? `HTTP ${res.status}`);
  }

  const list = ((json as any).data ?? []) as Array<OriginalWorkspaceSummary | WorkspaceSummaryDto>;
  return list.map(normalizeSummary);
}

export async function createWorkspace(
  body: { name: string; plan: SubscriptionPlan }
): Promise<WorkspaceSummaryDto> {
  // "free" plan is not supported by the original backend; map to "standard"
  const requestedProfile: OriginalProfile =
    body.plan === "premium" ? "premium" : "standard";

  const res = await authorizedFetch(BASE, {
    method: "POST",
    credentials: "include",
    headers: workspaceAuthHeaders({
      "Content-Type": "application/json",
      "Idempotency-Key": generateIdempotencyKey(),
    }),
    body: JSON.stringify({ name: body.name, plan: body.plan, requestedProfile }),
  });

  const data = await parseOkResponse<OriginalCreateAccepted | WorkspaceSummaryDto>(res);
  return "workspace" in data ? mapSummary(data.workspace) : normalizeSummary(data);
}

export async function getWorkspaceDetail(
  workspaceId: string
): Promise<WorkspaceDetailDto> {
  const res = await authorizedFetch(`${BASE}/${workspaceId}`, { credentials: "include" });
  const ws = await parseOkResponse<OriginalWorkspaceSummary | WorkspaceDetailDto>(res);
  if ("agentCount" in ws && isWorkspaceStatus(ws.status)) {
    return ws;
  }
  return mapDetail(ws as OriginalWorkspaceSummary);
}

export async function deleteWorkspace(
  workspaceId: string
): Promise<WorkspaceDeleteAckDto> {
  const res = await authorizedFetch(`${BASE}/${workspaceId}`, {
    method: "DELETE",
    credentials: "include",
    headers: workspaceAuthHeaders({
      "Idempotency-Key": generateIdempotencyKey(),
    }),
  });

  const data = await parseOkResponse<OriginalDeleteAccepted>(res);
  return {
    workspaceId: data.workspaceId as WorkspaceDeleteAckDto["workspaceId"],
    status: "stopping",
  };
}
