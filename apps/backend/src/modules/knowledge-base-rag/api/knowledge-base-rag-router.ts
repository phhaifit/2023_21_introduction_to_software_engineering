import { Router, type Request, type Response } from "express";

import { KNOWLEDGE_BASE_RAG_API_ROUTES } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import { canPerform } from "../../../shared/rbac/permissions.ts";
import type { RequestContext } from "../../../shared/auth/request-context.ts";
import type { KnowledgeDocumentUseCases } from "../application/knowledge-document-use-cases.ts";
import type { KnowledgeUploadUseCases } from "../application/knowledge-upload-use-cases.ts";
import type { KnowledgeIngestionUseCases } from "../application/knowledge-ingestion-use-cases.ts";
import type { KnowledgeDataSourceUseCases } from "../application/knowledge-data-source-use-cases.ts";
import type { KnowledgeSyncUseCases } from "../application/knowledge-sync-use-cases.ts";
import type { KnowledgeRetrievalSearchUseCase } from "../application/knowledge-retrieval-search-use-case.ts";
import type { KnowledgeRagAnswerUseCase } from "../application/knowledge-rag-answer-use-case.ts";
import {
  KnowledgeBaseRagValidationError,
  KnowledgeDataSourceNotFoundError,
  KnowledgeDocumentNotFoundError,
  KnowledgeFileStorageError,
  KnowledgeIngestionJobNotFoundError,
  KnowledgeRetrievalError,
  KnowledgeRagAnswerError,
  KnowledgeSyncJobNotFoundError
} from "../application/knowledge-base-rag-errors.ts";
import {
  createPaginationMeta,
  sendKnowledgeBaseRagApiFailure,
  sendKnowledgeBaseRagApiSuccess,
  sendKnowledgeBaseRagPaginatedApiSuccess
} from "./api-response.ts";
import {
  parseConnectDataSourceRequest,
  parseListQuery,
  parseKnowledgeRetrievalSearchRequest,
  parseKnowledgeRagAnswerRequest,
  parsePrepareUploadRequest,
  parseRequestKnowledgeSyncJobRequest,
  parseUpdateSyncScopeRequest,
  parseUploadValidationRequest
} from "./knowledge-base-rag-request-parsers.ts";
import { parseKnowledgeUploadMultipartRequest } from "./knowledge-base-rag-multipart-parser.ts";
import type { CheckoutUseCases } from "../../subscription-payment/application/checkout-use-cases.ts";

export type KnowledgeBaseRagRouterDependencies = {
  documentUseCases: KnowledgeDocumentUseCases;
  uploadUseCases: KnowledgeUploadUseCases;
  ingestionUseCases: KnowledgeIngestionUseCases;
  dataSourceUseCases: KnowledgeDataSourceUseCases;
  syncUseCases: KnowledgeSyncUseCases;
  retrievalSearchUseCase: KnowledgeRetrievalSearchUseCase;
  ragAnswerUseCase: KnowledgeRagAnswerUseCase;
  checkoutUseCases?: CheckoutUseCases;
};

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export function createKnowledgeBaseRagRouter(
  dependencies: KnowledgeBaseRagRouterDependencies
): Router {
  const router = Router({ mergeParams: true });

  router.get(
    KNOWLEDGE_BASE_RAG_API_ROUTES.documents,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceWorkspaceContext(request);
        const filters = parseListQuery(request.query as Record<string, unknown>);
        const result = await dependencies.documentUseCases.listDocuments(workspaceId, {
          page: filters.page,
          pageSize: filters.pageSize,
          search: filters.search,
          sourceId: filters.sourceId,
          statuses: filters.statuses as any
        });

        return {
          data: result.items,
          pagination: createPaginationMeta(
            filters.page ?? 1,
            filters.pageSize ?? 20,
            result.total
          )
        };
      });
    }
  );

  router.post(
    KNOWLEDGE_BASE_RAG_API_ROUTES.uploadDocuments,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId, actorId } = enforceKnowledgeManagePermission(request);
        const files = await parseKnowledgeUploadMultipartRequest(request);

        return dependencies.uploadUseCases.uploadDocuments(
          workspaceId,
          actorId,
          files
        );
      });
    }
  );

  router.post(
    KNOWLEDGE_BASE_RAG_API_ROUTES.validateUploads,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceKnowledgeManagePermission(request);
        const payload = parseUploadValidationRequest(request.body);

        return dependencies.uploadUseCases.validateUploadCandidates(
          workspaceId,
          payload
        );
      });
    }
  );

  router.post(
    KNOWLEDGE_BASE_RAG_API_ROUTES.prepareUploads,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId, actorId } = enforceKnowledgeManagePermission(request);

        // Quota Enforcement: Chặn nếu dung lượng lưu trữ của workspace đã đạt giới hạn tối đa
        if (dependencies.checkoutUseCases) {
          const usage = await dependencies.checkoutUseCases.getWorkspaceResourceUsage(
            workspaceId,
            actorId
          );
          if (usage.storage.used >= usage.storage.max) {
            throw new QuotaExceededError("Dung lượng lưu trữ tài liệu của gói dịch vụ hiện tại đã đạt tối đa. Vui lòng nâng cấp gói cước để tiếp tục.");
          }
        }

        const payload = parsePrepareUploadRequest(request.body);

        return dependencies.uploadUseCases.prepareUpload(
          workspaceId,
          actorId,
          payload
        );
      });
    }
  );

  router.get(
    KNOWLEDGE_BASE_RAG_API_ROUTES.ingestionJobs,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceWorkspaceContext(request);
        const filters = parseListQuery(request.query as Record<string, unknown>);
        const result = await dependencies.ingestionUseCases.listIngestionJobs(workspaceId, {
          documentId: filters.documentId as EntityId<"documentId"> | undefined,
          page: filters.page,
          pageSize: filters.pageSize,
          statuses: filters.statuses as any
        });

        return {
          data: result.items,
          pagination: createPaginationMeta(
            filters.page ?? 1,
            filters.pageSize ?? 20,
            result.total
          )
        };
      });
    }
  );

  router.get(
    KNOWLEDGE_BASE_RAG_API_ROUTES.dataSources,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceWorkspaceContext(request);
        const filters = parseListQuery(request.query as Record<string, unknown>);

        return dependencies.dataSourceUseCases.listDataSources(workspaceId, {
          provider: filters.provider as any,
          statuses: filters.statuses as any
        });
      });
    }
  );

  router.post(
    KNOWLEDGE_BASE_RAG_API_ROUTES.connectDataSource,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId, actorId } = enforceKnowledgeManagePermission(request);
        const payload = parseConnectDataSourceRequest(request.body);

        return dependencies.dataSourceUseCases.connectDataSourcePlaceholder(
          workspaceId,
          requirePathParam(request, "sourceId"),
          actorId,
          payload
        );
      });
    }
  );

  router.get(
    KNOWLEDGE_BASE_RAG_API_ROUTES.syncScope,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceWorkspaceContext(request);
        const filters = parseListQuery(request.query as Record<string, unknown>);

        return dependencies.syncUseCases.getSyncScope(workspaceId, filters.sourceId);
      });
    }
  );

  router.put(
    KNOWLEDGE_BASE_RAG_API_ROUTES.syncScope,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceKnowledgeManagePermission(request);
        const payload = parseUpdateSyncScopeRequest(request.body);

        return dependencies.syncUseCases.updateSyncScope(workspaceId, payload);
      });
    }
  );

  router.post(
    KNOWLEDGE_BASE_RAG_API_ROUTES.syncJobs,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId, actorId } = enforceKnowledgeManagePermission(request);
        const payload = parseRequestKnowledgeSyncJobRequest(request.body);

        return dependencies.syncUseCases.requestManualSync(
          workspaceId,
          actorId,
          payload
        );
      });
    }
  );

  router.get(
    KNOWLEDGE_BASE_RAG_API_ROUTES.syncJobs,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceWorkspaceContext(request);
        const filters = parseListQuery(request.query as Record<string, unknown>);
        const result = await dependencies.syncUseCases.listSyncJobs(workspaceId, {
          page: filters.page,
          pageSize: filters.pageSize,
          sourceId: filters.sourceId,
          statuses: filters.statuses as any
        });

        return {
          data: result.items,
          pagination: createPaginationMeta(
            filters.page ?? 1,
            filters.pageSize ?? 20,
            result.total
          )
        };
      });
    }
  );

  router.post(
    KNOWLEDGE_BASE_RAG_API_ROUTES.retrievalSearch,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceWorkspaceContext(request);
        const payload = parseKnowledgeRetrievalSearchRequest(request.body);
        return dependencies.retrievalSearchUseCase.search(workspaceId, payload);
      });
    }
  );

  router.post(
    KNOWLEDGE_BASE_RAG_API_ROUTES.ragAnswer,
    async (request: Request, response: Response) => {
      await handleKnowledgeBaseRagRequest(request, response, async () => {
        const { workspaceId } = enforceWorkspaceContext(request);
        const payload = parseKnowledgeRagAnswerRequest(request.body);
        return dependencies.ragAnswerUseCase.answer(workspaceId, payload);
      });
    }
  );

  return router;
}

async function handleKnowledgeBaseRagRequest<T>(
  request: Request,
  response: Response,
  action: () => Promise<T | { data: T[]; pagination: ReturnType<typeof createPaginationMeta> }>
): Promise<void> {
  try {
    const result = await action();
    if (isPaginatedResult(result)) {
      sendKnowledgeBaseRagPaginatedApiSuccess(
        request,
        response,
        result.data,
        result.pagination
      );
      return;
    }

    sendKnowledgeBaseRagApiSuccess(request, response, result);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      sendKnowledgeBaseRagApiFailure(
        request,
        response,
        "auth.unauthorized",
        error.message
      );
      return;
    }

    if (error instanceof AuthorizationError) {
      sendKnowledgeBaseRagApiFailure(
        request,
        response,
        "auth.forbidden",
        error.message
      );
      return;
    }

    if (error instanceof KnowledgeBaseRagValidationError) {
      sendKnowledgeBaseRagApiFailure(
        request,
        response,
        "validation.invalid_input",
        error.message,
        { issues: error.issues }
      );
      return;
    }

    if (error instanceof KnowledgeFileStorageError) {
      sendKnowledgeBaseRagApiFailure(
        request,
        response,
        "system.unexpected_error",
        error.message
      );
      return;
    }

    if (error instanceof KnowledgeRetrievalError) {
      sendKnowledgeBaseRagApiFailure(
        request,
        response,
        "system.unexpected_error",
        error.message
      );
      return;
    }

    if (error instanceof KnowledgeRagAnswerError) {
      sendKnowledgeBaseRagApiFailure(
        request,
        response,
        "system.unexpected_error",
        error.message
      );
      return;
    }

    if (error instanceof QuotaExceededError) {
      sendKnowledgeBaseRagApiFailure(
        request,
        response,
        "subscription.required",
        error.message
      );
      return;
    }

    if (
      error instanceof KnowledgeDocumentNotFoundError ||
      error instanceof KnowledgeIngestionJobNotFoundError ||
      error instanceof KnowledgeDataSourceNotFoundError ||
      error instanceof KnowledgeSyncJobNotFoundError
    ) {
      sendKnowledgeBaseRagApiFailure(
        request,
        response,
        "knowledge.access_denied",
        error.message
      );
      return;
    }

    sendKnowledgeBaseRagApiFailure(
      request,
      response,
      "system.unexpected_error",
      "Unexpected Knowledge Base / RAG API error."
    );
  }
}

function enforceWorkspaceContext(
  request: Request
): { workspaceId: EntityId<"workspaceId">; actorId: EntityId<"userId">; context: RequestContext } {
  const context = getRequestContext(request);
  const routeWorkspaceId = requirePathParam(request, "workspaceId") as EntityId<"workspaceId">;

  if (!context.user) {
    throw new AuthenticationError("Authentication required.");
  }

  if (!context.workspace) {
    throw new AuthorizationError("Workspace context required.");
  }

  if (context.workspace.workspaceId !== routeWorkspaceId) {
    throw new AuthorizationError("Workspace route does not match request context.");
  }

  return {
    workspaceId: routeWorkspaceId,
    actorId: context.user.userId,
    context
  };
}

function enforceKnowledgeManagePermission(
  request: Request
): { workspaceId: EntityId<"workspaceId">; actorId: EntityId<"userId">; context: RequestContext } {
  const scoped = enforceWorkspaceContext(request);
  const decision = canPerform(scoped.context.workspace!.role, "knowledge:manage");

  if (!decision.allowed) {
    throw new AuthorizationError(decision.reason ?? "Knowledge Base / RAG access denied.");
  }

  return scoped;
}

function requirePathParam(request: Request, name: string): string {
  const rawValue = request.params[name];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (!value || value.trim() === "") {
    throw new KnowledgeBaseRagValidationError([`${name} path parameter is required`]);
  }

  return value;
}

function getRequestContext(request: Request): RequestContext {
  return ((request as any).context ?? { requestId: "knowledge-base-rag-request" }) as RequestContext;
}

function isPaginatedResult<T>(
  value: T | { data: T[]; pagination: ReturnType<typeof createPaginationMeta> }
): value is { data: T[]; pagination: ReturnType<typeof createPaginationMeta> } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "data" in value &&
      "pagination" in value
  );
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
