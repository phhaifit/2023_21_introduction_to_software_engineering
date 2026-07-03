import type {
  ConnectKnowledgeDataSourceRequest,
  KnowledgeRagAnswerRequest,
  KnowledgeRetrievalSearchRequest,
  PrepareUploadRequest,
  RequestKnowledgeSyncJobRequest,
  UpdateSyncScopeRequest,
  UploadCandidateFileDto,
  UploadValidationRequest
} from "@vcp/shared/contracts/knowledge-base-rag.ts";

import { KnowledgeBaseRagValidationError } from "../application/knowledge-base-rag-errors.ts";

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
  "sourceId",
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
  "credential",
  "credentials",
  "secret",
  "secrets",
  "token",
  "accessToken",
  "refreshToken",
  "password",
  "rawEmbedding",
  "embedding",
  "embeddingVector",
  "vector",
  "vectorRef",
  "vectorConfig",
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

export type ListQueryFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  sourceId?: string;
  provider?: string;
  statuses?: string[];
  documentId?: string;
};

export function parseListQuery(query: Record<string, unknown>): ListQueryFilters {
  return {
    page: parseOptionalPositiveInteger(query["page"], "page"),
    pageSize: parseOptionalPositiveInteger(query["pageSize"], "pageSize"),
    search: parseOptionalTrimmedString(query["search"]),
    sourceId: parseOptionalTrimmedString(query["sourceId"]),
    provider: parseOptionalTrimmedString(query["provider"]),
    statuses: parseStatusList(query["status"] ?? query["statuses"]),
    documentId: parseOptionalTrimmedString(query["documentId"])
  };
}

export function parseUploadValidationRequest(body: unknown): UploadValidationRequest {
  const payload = requirePlainObject(body, "upload validation request");
  assertNoForbiddenRequestKeys(payload);

  return {
    files: requireUploadCandidates(payload["files"])
  };
}

export function parsePrepareUploadRequest(body: unknown): PrepareUploadRequest {
  const payload = requirePlainObject(body, "prepare upload request");
  assertNoForbiddenRequestKeys(payload);

  return {
    files: requireUploadCandidates(payload["files"])
  };
}

export function parseConnectDataSourceRequest(
  body: unknown
): ConnectKnowledgeDataSourceRequest {
  const payload = body === undefined ? {} : requirePlainObject(body, "connect data source request");
  assertNoForbiddenRequestKeys(payload);

  return {
    displayName: parseOptionalTrimmedString(payload["displayName"]),
    providerAccountLabel: parseOptionalTrimmedString(payload["providerAccountLabel"])
  };
}

export function parseUpdateSyncScopeRequest(body: unknown): UpdateSyncScopeRequest {
  const payload = requirePlainObject(body, "update sync scope request");
  assertNoForbiddenRequestKeys(payload);

  return {
    selectedScopeNodeIds: requireStringArray(
      payload["selectedScopeNodeIds"],
      "selectedScopeNodeIds"
    )
  };
}

export function parseRequestKnowledgeSyncJobRequest(
  body: unknown
): RequestKnowledgeSyncJobRequest {
  const payload = body === undefined ? {} : requirePlainObject(body, "request sync job request");
  assertNoForbiddenRequestKeys(payload, ["sourceId"]);

  return {
    sourceId: parseOptionalTrimmedString(payload["sourceId"]),
    scopeNodeIds: payload["scopeNodeIds"] === undefined
      ? undefined
      : requireStringArray(payload["scopeNodeIds"], "scopeNodeIds")
  };
}

export function parseKnowledgeRetrievalSearchRequest(
  body: unknown
): KnowledgeRetrievalSearchRequest {
  const payload = requirePlainObject(body, "knowledge retrieval request");
  assertNoForbiddenRequestKeys(payload);
  assertOnlyKeys(payload, ["query", "topK", "filters"], "knowledge retrieval request");

  const filtersValue = payload["filters"];
  let filters: KnowledgeRetrievalSearchRequest["filters"];
  if (filtersValue !== undefined) {
    const filterPayload = requirePlainObject(filtersValue, "filters");
    assertOnlyKeys(
      filterPayload,
      ["documentIds", "sourceTypes", "sourceLocators", "statuses"],
      "filters"
    );
    filters = {
      documentIds:
        filterPayload["documentIds"] === undefined
          ? undefined
          : requireStringArray(filterPayload["documentIds"], "filters.documentIds") as any,
      sourceTypes:
        filterPayload["sourceTypes"] === undefined
          ? undefined
          : requireStringArray(filterPayload["sourceTypes"], "filters.sourceTypes") as any,
      sourceLocators:
        filterPayload["sourceLocators"] === undefined
          ? undefined
          : requireStringArray(
              filterPayload["sourceLocators"],
              "filters.sourceLocators"
            ),
      statuses:
        filterPayload["statuses"] === undefined
          ? undefined
          : requireStringArray(filterPayload["statuses"], "filters.statuses") as any
    };
  }

  return {
    query: requireString(payload["query"], "query"),
    topK:
      payload["topK"] === undefined
        ? undefined
        : requireFiniteNumber(payload["topK"], "topK"),
    filters
  };
}

export function parseKnowledgeRagAnswerRequest(
  body: unknown
): KnowledgeRagAnswerRequest {
  const payload = requirePlainObject(body, "knowledge RAG answer request");
  assertNoForbiddenRequestKeys(payload);
  assertOnlyKeys(
    payload,
    ["query", "topK", "filters", "answerOptions"],
    "knowledge RAG answer request"
  );

  const retrieval = parseKnowledgeRetrievalSearchRequest({
    query: payload["query"],
    topK: payload["topK"],
    filters: payload["filters"]
  });
  const answerOptionsValue = payload["answerOptions"];
  let answerOptions: KnowledgeRagAnswerRequest["answerOptions"];
  if (answerOptionsValue !== undefined) {
    const options = requirePlainObject(answerOptionsValue, "answerOptions");
    assertOnlyKeys(
      options,
      ["maxAnswerLength", "includeCitations"],
      "answerOptions"
    );
    answerOptions = {
      maxAnswerLength:
        options["maxAnswerLength"] === undefined
          ? undefined
          : requireFiniteNumber(
              options["maxAnswerLength"],
              "answerOptions.maxAnswerLength"
            ),
      includeCitations:
        options["includeCitations"] === undefined
          ? undefined
          : requireBoolean(
              options["includeCitations"],
              "answerOptions.includeCitations"
            )
    };
  }

  return {
    ...retrieval,
    answerOptions
  };
}

export function assertNoForbiddenRequestKeys(
  value: unknown,
  allowedForbiddenKeys: readonly string[] = []
): void {
  const violations = new Set<string>();
  collectForbiddenKeys(value, "", violations, new Set(allowedForbiddenKeys));

  if (violations.size > 0) {
    throw new KnowledgeBaseRagValidationError(
      [...violations].sort().map((path) => `${path} is server-owned or private`)
    );
  }
}

function requireUploadCandidates(value: unknown): UploadCandidateFileDto[] {
  if (!Array.isArray(value)) {
    throw new KnowledgeBaseRagValidationError(["files must be an array"]);
  }

  return value.map((candidate, index) => {
    const payload = requirePlainObject(candidate, `files[${index}]`);
    assertNoForbiddenRequestKeys(payload);

    return {
      clientFileId: requireString(payload["clientFileId"], `files[${index}].clientFileId`),
      fileName: requireString(payload["fileName"], `files[${index}].fileName`),
      mediaType: requireString(payload["mediaType"], `files[${index}].mediaType`),
      sizeBytes: requireFiniteNumber(payload["sizeBytes"], `files[${index}].sizeBytes`)
    };
  });
}

function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KnowledgeBaseRagValidationError([`${label} must be an object`]);
  }

  return value as Record<string, unknown>;
}

function assertOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string
): void {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw new KnowledgeBaseRagValidationError(
      unknownKeys.sort().map((key) => `${label}.${key} is not supported`)
    );
  }
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new KnowledgeBaseRagValidationError([`${path} must be a string`]);
  }

  return value;
}

function requireFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new KnowledgeBaseRagValidationError([`${path} must be a finite number`]);
  }

  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new KnowledgeBaseRagValidationError([`${path} must be a boolean`]);
  }
  return value;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new KnowledgeBaseRagValidationError([`${path} must be an array`]);
  }

  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

function parseOptionalPositiveInteger(value: unknown, path: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(parsed) || Number(parsed) < 1) {
    throw new KnowledgeBaseRagValidationError([`${path} must be a positive integer`]);
  }

  return Number(parsed);
}

function parseOptionalTrimmedString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new KnowledgeBaseRagValidationError(["query/body value must be a string"]);
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseStatusList(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : String(value).split(",");
  const statuses = values
    .map((status) => String(status).trim())
    .filter((status) => status.length > 0);

  return statuses.length > 0 ? statuses : undefined;
}

function collectForbiddenKeys(
  value: unknown,
  path: string,
  violations: Set<string>,
  allowedForbiddenKeys: ReadonlySet<string>
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectForbiddenKeys(item, `${path}[${index}]`, violations, allowedForbiddenKeys);
    });
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    const normalizedKey = key.toLowerCase();
    if (
      (FORBIDDEN_REQUEST_KEYS.some((forbidden) => forbidden.toLowerCase() === normalizedKey) ||
        FORBIDDEN_PRIVATE_KEY_FRAGMENTS.some((forbidden) =>
          normalizedKey.includes(forbidden)
        )) &&
      !allowedForbiddenKeys.has(key)
    ) {
      violations.add(childPath);
    }
    collectForbiddenKeys(child, childPath, violations, allowedForbiddenKeys);
  }
}
