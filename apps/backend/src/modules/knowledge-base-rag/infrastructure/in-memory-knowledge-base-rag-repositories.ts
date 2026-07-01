import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDataSourceListFilters,
  KnowledgeDataSourceRepository
} from "../application/knowledge-data-source-repository.ts";
import type {
  KnowledgeDocumentListFilters,
  KnowledgeDocumentListResult,
  KnowledgeDocumentRepository
} from "../application/knowledge-document-repository.ts";
import type {
  KnowledgeIngestionJobListFilters,
  KnowledgeIngestionJobListResult,
  KnowledgeIngestionJobRepository
} from "../application/knowledge-ingestion-job-repository.ts";
import type {
  KnowledgeSyncJobListFilters,
  KnowledgeSyncJobListResult,
  KnowledgeSyncJobRepository,
  KnowledgeSyncScopeRepository
} from "../application/knowledge-sync-repositories.ts";
import type { KnowledgeDataSource } from "../domain/knowledge-data-source.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";
import type {
  KnowledgeSyncJob,
  KnowledgeSyncJobEvent,
  KnowledgeSyncScopeNode
} from "../domain/knowledge-sync.ts";

export class InMemoryKnowledgeDocumentRepository
  implements KnowledgeDocumentRepository
{
  private readonly documents = new Map<string, KnowledgeDocument>();
  private readonly chunks = new Map<string, KnowledgeDocumentChunk>();

  async listDocuments(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeDocumentListFilters = {}
  ): Promise<KnowledgeDocumentListResult> {
    let items = [...this.documents.values()]
      .filter((document) => document.workspaceId === workspaceId)
      .filter((document) => !document.deletedAt);

    if (filters.statuses && filters.statuses.length > 0) {
      const statuses = new Set(filters.statuses);
      items = items.filter((document) => statuses.has(document.indexingStatus));
    }

    if (filters.sourceId) {
      items = items.filter((document) => document.sourceId === filters.sourceId);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      items = items.filter(
        (document) =>
          document.displayName.toLowerCase().includes(search) ||
          document.fileName.toLowerCase().includes(search)
      );
    }

    items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    return {
      items: items.slice(offset, offset + pageSize).map(copyDocument),
      total
    };
  }

  async getDocumentById(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeDocument | null> {
    const document = this.documents.get(documentId);
    return document && document.workspaceId === workspaceId
      ? copyDocument(document)
      : null;
  }

  async saveDocument(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    this.documents.set(document.documentId, copyDocument(document));
    return copyDocument(document);
  }

  async listDocumentChunks(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ) {
    const items = [...this.chunks.values()]
      .filter((chunk) => chunk.workspaceId === workspaceId)
      .filter((chunk) => chunk.documentId === documentId)
      .sort((left, right) => left.chunkIndex - right.chunkIndex);

    return {
      items: items.map(copyChunk),
      total: items.length
    };
  }

  async saveDocumentChunk(chunk: KnowledgeDocumentChunk) {
    this.chunks.set(chunk.chunkId, copyChunk(chunk));
    return copyChunk(chunk);
  }
}

export class InMemoryKnowledgeIngestionJobRepository
  implements KnowledgeIngestionJobRepository
{
  private readonly jobs = new Map<string, KnowledgeIngestionJob>();

  async findNextQueuedJob(
    workspaceId: EntityId<"workspaceId">
  ): Promise<KnowledgeIngestionJob | null> {
    const job = [...this.jobs.values()]
      .filter((candidate) => candidate.workspaceId === workspaceId)
      .filter((candidate) => candidate.status === "pending")
      .sort((left, right) => {
        const byQueuedAt = left.queuedAt.localeCompare(right.queuedAt);
        return byQueuedAt === 0 ? left.jobId.localeCompare(right.jobId) : byQueuedAt;
      })[0];

    return job ? copyIngestionJob(job) : null;
  }

  async listIngestionJobs(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeIngestionJobListFilters = {}
  ): Promise<KnowledgeIngestionJobListResult> {
    let items = [...this.jobs.values()].filter((job) => job.workspaceId === workspaceId);

    if (filters.documentId) {
      items = items.filter((job) => job.documentId === filters.documentId);
    }

    if (filters.statuses && filters.statuses.length > 0) {
      const statuses = new Set(filters.statuses);
      items = items.filter((job) => statuses.has(job.status));
    }

    items.sort((left, right) => right.queuedAt.localeCompare(left.queuedAt));
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    return {
      items: items.slice(offset, offset + pageSize).map(copyIngestionJob),
      total
    };
  }

  async getIngestionJobById(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeIngestionJob | null> {
    const job = this.jobs.get(jobId);
    return job && job.workspaceId === workspaceId ? copyIngestionJob(job) : null;
  }

  async saveIngestionJob(job: KnowledgeIngestionJob) {
    this.jobs.set(job.jobId, copyIngestionJob(job));
    return copyIngestionJob(job);
  }
}

export class InMemoryKnowledgeDataSourceRepository
  implements KnowledgeDataSourceRepository
{
  private readonly dataSources = new Map<string, KnowledgeDataSource>();

  async listDataSources(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeDataSourceListFilters = {}
  ): Promise<KnowledgeDataSource[]> {
    let items = [...this.dataSources.values()].filter(
      (source) => source.workspaceId === workspaceId
    );

    if (filters.provider) {
      items = items.filter((source) => source.provider === filters.provider);
    }

    if (filters.statuses && filters.statuses.length > 0) {
      const statuses = new Set(filters.statuses);
      items = items.filter((source) => statuses.has(source.connectionStatus));
    }

    return items
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(copyDataSource);
  }

  async getDataSourceById(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<KnowledgeDataSource | null> {
    const source = this.dataSources.get(sourceId);
    return source && source.workspaceId === workspaceId ? copyDataSource(source) : null;
  }

  async saveDataSource(source: KnowledgeDataSource) {
    this.dataSources.set(source.sourceId, copyDataSource(source));
    return copyDataSource(source);
  }
}

export class InMemoryKnowledgeSyncScopeRepository
  implements KnowledgeSyncScopeRepository
{
  private readonly nodes = new Map<string, KnowledgeSyncScopeNode>();

  async getSyncScope(
    workspaceId: EntityId<"workspaceId">,
    sourceId?: string
  ): Promise<KnowledgeSyncScopeNode[]> {
    return [...this.nodes.values()]
      .filter((node) => node.workspaceId === workspaceId)
      .filter((node) => !sourceId || node.sourceId === sourceId)
      .sort((left, right) => {
        const bySource = left.sourceId.localeCompare(right.sourceId);
        return bySource === 0
          ? left.displayName.localeCompare(right.displayName)
          : bySource;
      })
      .map(copySyncScopeNode);
  }

  async saveSyncScopeNodes(
    workspaceId: EntityId<"workspaceId">,
    nodes: readonly KnowledgeSyncScopeNode[]
  ): Promise<KnowledgeSyncScopeNode[]> {
    const saved = nodes.map((node) => ({ ...node, workspaceId }));

    for (const node of saved) {
      this.nodes.set(node.scopeNodeId, copySyncScopeNode(node));
    }

    return saved.map(copySyncScopeNode);
  }
}

export class InMemoryKnowledgeSyncJobRepository
  implements KnowledgeSyncJobRepository
{
  private readonly jobs = new Map<string, KnowledgeSyncJob>();
  private readonly events = new Map<string, KnowledgeSyncJobEvent>();

  async listSyncJobs(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeSyncJobListFilters = {}
  ): Promise<KnowledgeSyncJobListResult> {
    let items = [...this.jobs.values()].filter((job) => job.workspaceId === workspaceId);

    if (filters.sourceId) {
      items = items.filter((job) => job.sourceId === filters.sourceId);
    }

    if (filters.statuses && filters.statuses.length > 0) {
      const statuses = new Set(filters.statuses);
      items = items.filter((job) => statuses.has(job.status));
    }

    items.sort((left, right) => right.queuedAt.localeCompare(left.queuedAt));
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    return {
      items: items.slice(offset, offset + pageSize).map(copySyncJob),
      total
    };
  }

  async getSyncJobById(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeSyncJob | null> {
    const job = this.jobs.get(jobId);
    return job && job.workspaceId === workspaceId ? copySyncJob(job) : null;
  }

  async saveSyncJob(job: KnowledgeSyncJob) {
    this.jobs.set(job.jobId, copySyncJob(job));
    return copySyncJob(job);
  }

  async appendSyncJobEvent(event: KnowledgeSyncJobEvent) {
    this.events.set(event.syncJobEventId, copySyncJobEvent(event));
    return copySyncJobEvent(event);
  }

  async listSyncJobEvents(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeSyncJobEvent[]> {
    return [...this.events.values()]
      .filter((event) => event.workspaceId === workspaceId)
      .filter((event) => event.jobId === jobId)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .map(copySyncJobEvent);
  }
}

function copyDocument(document: KnowledgeDocument): KnowledgeDocument {
  return { ...document };
}

function copyChunk(chunk: KnowledgeDocumentChunk): KnowledgeDocumentChunk {
  return { ...chunk };
}

function copyIngestionJob(job: KnowledgeIngestionJob): KnowledgeIngestionJob {
  return { ...job };
}

function copyDataSource(source: KnowledgeDataSource): KnowledgeDataSource {
  return { ...source };
}

function copySyncScopeNode(node: KnowledgeSyncScopeNode): KnowledgeSyncScopeNode {
  return { ...node };
}

function copySyncJob(job: KnowledgeSyncJob): KnowledgeSyncJob {
  return { ...job };
}

function copySyncJobEvent(event: KnowledgeSyncJobEvent): KnowledgeSyncJobEvent {
  return { ...event };
}
