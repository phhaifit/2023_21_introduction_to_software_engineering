import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDataSourceListFilters,
  KnowledgeDataSourceRepository
} from "../application/knowledge-data-source-repository.ts";
import type { KnowledgeAccessGrantRepository } from "../application/knowledge-access-grant-repository.ts";
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
import type { KnowledgeAccessGrant } from "../domain/knowledge-access-grant.ts";
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

  async deleteDocumentChunks(
    workspaceId: EntityId<"workspaceId">,
    documentId: EntityId<"documentId">
  ): Promise<void> {
    for (const [chunkId, chunk] of this.chunks) {
      if (chunk.workspaceId === workspaceId && chunk.documentId === documentId) {
        this.chunks.delete(chunkId);
      }
    }
  }
}

export class InMemoryKnowledgeAccessGrantRepository
  implements KnowledgeAccessGrantRepository
{
  private readonly grants = new Map<string, KnowledgeAccessGrant>();

  async findAccessGrant(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">
  ): Promise<KnowledgeAccessGrant | null> {
    const grant = [...this.grants.values()].find(
      (candidate) =>
        candidate.workspaceId === workspaceId &&
        candidate.agentId === agentId &&
        candidate.documentId === documentId
    );
    return grant ? copyAccessGrant(grant) : null;
  }

  async listActiveDocumentIds(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">
  ): Promise<EntityId<"documentId">[]> {
    return [...this.grants.values()]
      .filter((grant) => grant.workspaceId === workspaceId)
      .filter((grant) => grant.agentId === agentId)
      .filter((grant) => grant.status === "active")
      .map((grant) => grant.documentId)
      .sort();
  }

  async hasActiveDocumentGrant(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    documentId: EntityId<"documentId">
  ): Promise<boolean> {
    return [...this.grants.values()].some(
      (grant) =>
        grant.workspaceId === workspaceId &&
        grant.agentId === agentId &&
        grant.documentId === documentId &&
        grant.status === "active"
    );
  }

  async saveAccessGrant(grant: KnowledgeAccessGrant): Promise<KnowledgeAccessGrant> {
    for (const [grantId, existing] of this.grants) {
      if (
        existing.workspaceId === grant.workspaceId &&
        existing.documentId === grant.documentId &&
        existing.agentId === grant.agentId
      ) {
        this.grants.delete(grantId);
      }
    }
    this.grants.set(grant.knowledgeAccessGrantId, copyAccessGrant(grant));
    return copyAccessGrant(grant);
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

  async listAllDataSources(
    filters: KnowledgeDataSourceListFilters = {}
  ): Promise<KnowledgeDataSource[]> {
    return this.filterDataSources([...this.dataSources.values()], filters);
  }

  async listDataSources(
    workspaceId: EntityId<"workspaceId">,
    filters: KnowledgeDataSourceListFilters = {}
  ): Promise<KnowledgeDataSource[]> {
    const items = [...this.dataSources.values()].filter(
      (source) => source.workspaceId === workspaceId
    );
    return this.filterDataSources(items, filters);
  }

  private filterDataSources(
    sources: KnowledgeDataSource[],
    filters: KnowledgeDataSourceListFilters
  ): KnowledgeDataSource[] {
    let items = sources;
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
    const sourceIds = new Set(saved.map((node) => node.sourceId));
    const retainedIds = new Set(saved.map((node) => node.scopeNodeId));
    for (const [scopeNodeId, node] of this.nodes) {
      if (
        node.workspaceId === workspaceId &&
        sourceIds.has(node.sourceId) &&
        !retainedIds.has(scopeNodeId)
      ) {
        this.nodes.delete(scopeNodeId);
      }
    }

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

  async createSyncJobIfNoActiveSource(
    job: KnowledgeSyncJob
  ): Promise<KnowledgeSyncJob | null> {
    const active = [...this.jobs.values()].some(
      (candidate) =>
        candidate.sourceId === job.sourceId &&
        (candidate.status === "pending" || candidate.status === "syncing")
    );
    if (active) return null;
    return this.saveSyncJob(job);
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

function copyAccessGrant(grant: KnowledgeAccessGrant): KnowledgeAccessGrant {
  return { ...grant };
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
