import type { ApiMeta, ApiPaginationMeta, ErrorCode } from "@vcp/shared/contracts/api.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";
import {
  KNOWLEDGE_BASE_RAG_API_ROUTES,
  type ConnectKnowledgeDataSourceRequest,
  type IngestionJobDto,
  type KnowledgeBaseApiError,
  type KnowledgeDataSourceDto,
  type KnowledgeDataSourceStatus,
  type KnowledgeDocumentDto,
  type PrepareUploadRequest,
  type PrepareUploadResponse,
  type RequestKnowledgeSyncJobRequest,
  type SyncJobDto,
  type SyncScopeNodeDto,
  type UpdateSyncScopeRequest,
  type UploadValidationRequest,
  type UploadValidationResponse,
  type KnowledgeSyncJobStatus
} from "@vcp/shared/contracts/knowledge-base-rag.ts";

export type KnowledgeDocumentListFilters = {
  search?: string;
  sourceId?: string;
  statuses?: readonly KnowledgeIndexStatus[];
  page?: number;
  pageSize?: number;
};

export type KnowledgeIngestionJobListFilters = {
  documentId?: EntityId<"documentId">;
  statuses?: readonly KnowledgeIndexStatus[];
  page?: number;
  pageSize?: number;
};

export type KnowledgeDataSourceListFilters = {
  provider?: KnowledgeDataSourceDto["provider"];
  statuses?: readonly KnowledgeDataSourceStatus[];
};

export type KnowledgeSyncJobListFilters = {
  sourceId?: string;
  statuses?: readonly KnowledgeSyncJobStatus[];
  page?: number;
  pageSize?: number;
};

export type KnowledgeBaseRagApiClient = {
  listDocuments(
    workspaceId: EntityId<"workspaceId">,
    filters?: KnowledgeDocumentListFilters
  ): Promise<{ items: KnowledgeDocumentDto[]; pagination: ApiPaginationMeta }>;
  validateUploadCandidates(
    workspaceId: EntityId<"workspaceId">,
    request: UploadValidationRequest
  ): Promise<UploadValidationResponse>;
  prepareUpload(
    workspaceId: EntityId<"workspaceId">,
    request: PrepareUploadRequest
  ): Promise<PrepareUploadResponse>;
  listIngestionJobs(
    workspaceId: EntityId<"workspaceId">,
    filters?: KnowledgeIngestionJobListFilters
  ): Promise<{ items: IngestionJobDto[]; pagination: ApiPaginationMeta }>;
  listDataSources(
    workspaceId: EntityId<"workspaceId">,
    filters?: KnowledgeDataSourceListFilters
  ): Promise<KnowledgeDataSourceDto[]>;
  connectDataSource(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string,
    request?: ConnectKnowledgeDataSourceRequest
  ): Promise<KnowledgeDataSourceDto>;
  getSyncScope(
    workspaceId: EntityId<"workspaceId">,
    sourceId?: string
  ): Promise<SyncScopeNodeDto[]>;
  updateSyncScope(
    workspaceId: EntityId<"workspaceId">,
    request: UpdateSyncScopeRequest
  ): Promise<SyncScopeNodeDto[]>;
  requestManualSync(
    workspaceId: EntityId<"workspaceId">,
    request: RequestKnowledgeSyncJobRequest
  ): Promise<SyncJobDto>;
  listSyncJobs(
    workspaceId: EntityId<"workspaceId">,
    filters?: KnowledgeSyncJobListFilters
  ): Promise<{ items: SyncJobDto[]; pagination: ApiPaginationMeta }>;
};

export type KnowledgeBaseRagApiClientErrorKind =
  | "api"
  | "network"
  | "malformed-response"
  | "invalid-request";

export class KnowledgeBaseRagApiClientError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;
  readonly status?: number;
  readonly kind: KnowledgeBaseRagApiClientErrorKind;

  constructor(input: {
    message: string;
    code?: ErrorCode;
    details?: Record<string, unknown>;
    status?: number;
    kind: KnowledgeBaseRagApiClientErrorKind;
  }) {
    super(input.message);
    this.name = "KnowledgeBaseRagApiClientError";
    this.code = input.code ?? "system.unexpected_error";
    this.details = input.details;
    this.status = input.status;
    this.kind = input.kind;
  }
}

type FetchImplementation = typeof fetch;

type ApiEnvelope<T> = {
  data: T;
  meta: ApiMeta;
};

export function createKnowledgeBaseRagApiClient(input: {
  fetchImplementation?: FetchImplementation;
  baseUrl?: string;
} = {}): KnowledgeBaseRagApiClient {
  const fetchImplementation = input.fetchImplementation ?? fetch;
  const baseUrl = input.baseUrl?.replace(/\/$/, "") ?? "";

  async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
    let response: Response;

    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers
        }
      });
    } catch {
      throw new KnowledgeBaseRagApiClientError({
        message: "Unable to reach the Knowledge Base / RAG API.",
        kind: "network"
      });
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      throw malformedResponse(response.status);
    }

    if (!isRecord(body) || typeof body.ok !== "boolean") {
      throw malformedResponse(response.status);
    }

    if (body.ok === false) {
      const error = body.error;

      if (!isRecord(error) || typeof error.code !== "string" || typeof error.message !== "string") {
        throw malformedResponse(response.status);
      }

      throw new KnowledgeBaseRagApiClientError({
        code: error.code as KnowledgeBaseApiError["code"],
        message: error.message,
        details: isRecord(error.details) ? error.details : undefined,
        status: response.status,
        kind: "api"
      });
    }

    if (!("data" in body) || !isRecord(body.meta)) {
      throw malformedResponse(response.status);
    }

    return {
      data: body.data as T,
      meta: body.meta as ApiMeta
    };
  }

  return {
    listDocuments: async (workspaceId, filters) => {
      const response = await request<KnowledgeDocumentDto[]>(
        withQuery(routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.documents, { workspaceId }), {
          search: filters?.search,
          sourceId: filters?.sourceId,
          statuses: filters?.statuses,
          page: filters?.page,
          pageSize: filters?.pageSize
        })
      );

      return {
        items: response.data,
        pagination: requirePagination(response.meta)
      };
    },
    validateUploadCandidates: async (workspaceId, payload) =>
      requestJson<UploadValidationResponse>(
        routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.validateUploads, { workspaceId }),
        payload
      ),
    prepareUpload: async (workspaceId, payload) =>
      requestJson<PrepareUploadResponse>(
        routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.prepareUploads, { workspaceId }),
        payload
      ),
    listIngestionJobs: async (workspaceId, filters) => {
      const response = await request<IngestionJobDto[]>(
        withQuery(routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.ingestionJobs, { workspaceId }), {
          documentId: filters?.documentId,
          statuses: filters?.statuses,
          page: filters?.page,
          pageSize: filters?.pageSize
        })
      );

      return {
        items: response.data,
        pagination: requirePagination(response.meta)
      };
    },
    listDataSources: (workspaceId, filters) =>
      requestData<KnowledgeDataSourceDto[]>(
        withQuery(routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.dataSources, { workspaceId }), {
          provider: filters?.provider,
          statuses: filters?.statuses
        })
      ),
    connectDataSource: (workspaceId, sourceId, payload = {}) =>
      requestJson<KnowledgeDataSourceDto>(
        routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.connectDataSource, {
          workspaceId,
          sourceId
        }),
        payload
      ),
    getSyncScope: (workspaceId, sourceId) =>
      requestData<SyncScopeNodeDto[]>(
        withQuery(routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.syncScope, { workspaceId }), {
          sourceId
        })
      ),
    updateSyncScope: (workspaceId, payload) =>
      requestJson<SyncScopeNodeDto[]>(
        routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.syncScope, { workspaceId }),
        payload,
        "PUT"
      ),
    requestManualSync: (workspaceId, payload) =>
      requestJson<SyncJobDto>(
        routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.syncJobs, { workspaceId }),
        payload
      ),
    listSyncJobs: async (workspaceId, filters) => {
      const response = await request<SyncJobDto[]>(
        withQuery(routePath(KNOWLEDGE_BASE_RAG_API_ROUTES.syncJobs, { workspaceId }), {
          sourceId: filters?.sourceId,
          statuses: filters?.statuses,
          page: filters?.page,
          pageSize: filters?.pageSize
        })
      );

      return {
        items: response.data,
        pagination: requirePagination(response.meta)
      };
    }
  };

  async function requestData<T>(path: string): Promise<T> {
    return (await request<T>(path)).data;
  }

  async function requestJson<T>(
    path: string,
    payload: unknown,
    method: "POST" | "PUT" = "POST"
  ): Promise<T> {
    assertSafeRequestPayload(payload);

    return (await request<T>(path, {
      method,
      body: JSON.stringify(payload)
    })).data;
  }
}

function routePath(
  template: string,
  params: { workspaceId: EntityId<"workspaceId">; sourceId?: string }
): string {
  return template
    .replace(":workspaceId", encodeURIComponent(params.workspaceId))
    .replace(":sourceId", encodeURIComponent(params.sourceId ?? ""));
}

function withQuery(path: string, query: {
  search?: string;
  sourceId?: string;
  provider?: string;
  statuses?: readonly string[];
  documentId?: string;
  page?: number;
  pageSize?: number;
}): string {
  const params = new URLSearchParams();

  if (query.search) params.set("search", query.search);
  if (query.sourceId) params.set("sourceId", query.sourceId);
  if (query.provider) params.set("provider", query.provider);
  if (query.documentId) params.set("documentId", query.documentId);
  for (const status of query.statuses ?? []) {
    params.append("status", status);
  }
  if (query.page) params.set("page", query.page.toString());
  if (query.pageSize) params.set("pageSize", query.pageSize.toString());

  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

const FORBIDDEN_REQUEST_KEYS = [
  "workspaceId",
  "actorId",
  "userId",
  "ownerId",
  "createdBy",
  "updatedBy",
  "requestedBy",
  "requestedByUserId",
  "connectedBy",
  "connectedByUserId",
  "id",
  "documentId",
  "chunkId",
  "jobId",
  "scopeNodeId",
  "syncJobEventId",
  "status",
  "ingestionStatus",
  "indexingStatus",
  "connectionStatus",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "queuedAt",
  "startedAt",
  "completedAt",
  "failedAt",
  "storageKey",
  "objectKey",
  "privateUrl",
  "vectorRef",
  "vectorConfig",
  "rawEmbedding",
  "embeddingVector",
  "queuePayload"
] as const;

const FORBIDDEN_PRIVATE_KEY_FRAGMENTS = [
  "credential",
  "secret",
  "token",
  "password",
  "refresh",
  "private",
  "rawembedding",
  "embeddingvector",
  "vectorconfig",
  "queuepayload"
] as const;

function assertSafeRequestPayload(payload: unknown): void {
  const violations = new Set<string>();
  collectForbiddenKeys(payload, "", violations);

  if (violations.size > 0) {
    throw new KnowledgeBaseRagApiClientError({
      message: `Unsafe Knowledge Base / RAG request payload: ${[...violations].sort().join(", ")}`,
      kind: "invalid-request",
      code: "validation.invalid_input",
      details: { fields: [...violations].sort() }
    });
  }
}

function collectForbiddenKeys(
  value: unknown,
  path: string,
  violations: Set<string>
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectForbiddenKeys(item, `${path}[${index}]`, violations);
    });
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    const normalizedKey = key.toLowerCase();
    if (
      FORBIDDEN_REQUEST_KEYS.some((forbidden) => forbidden.toLowerCase() === normalizedKey) ||
      FORBIDDEN_PRIVATE_KEY_FRAGMENTS.some((forbidden) => normalizedKey.includes(forbidden))
    ) {
      violations.add(childPath);
    }
    collectForbiddenKeys(child, childPath, violations);
  }
}

function requirePagination(meta: ApiMeta): ApiPaginationMeta {
  if (!meta.pagination) {
    throw malformedResponse(200);
  }

  return meta.pagination;
}

function malformedResponse(status: number): KnowledgeBaseRagApiClientError {
  return new KnowledgeBaseRagApiClientError({
    message: "The Knowledge Base / RAG API returned an invalid response.",
    status,
    kind: "malformed-response"
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
