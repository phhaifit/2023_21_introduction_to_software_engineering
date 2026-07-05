import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeDataSourceStatus } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { KnowledgeDataSource } from "../domain/knowledge-data-source.ts";

export type KnowledgeDataSourceListFilters = {
  statuses?: readonly KnowledgeDataSourceStatus[];
  provider?: KnowledgeDataSource["provider"];
};

export type KnowledgeDataSourceRepository = {
  listAllDataSources(
    filters?: KnowledgeDataSourceListFilters
  ): Promise<KnowledgeDataSource[]>;
  listDataSources(
    workspaceId: EntityId<"workspaceId">,
    filters?: KnowledgeDataSourceListFilters
  ): Promise<KnowledgeDataSource[]>;
  getDataSourceById(
    workspaceId: EntityId<"workspaceId">,
    sourceId: string
  ): Promise<KnowledgeDataSource | null>;
  saveDataSource(source: KnowledgeDataSource): Promise<KnowledgeDataSource>;
};
