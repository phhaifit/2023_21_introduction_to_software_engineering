import type {
  KnowledgeDataSourceStatus,
  KnowledgeDocumentSource
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SafeJsonValue } from "./safe-json.ts";

export type KnowledgeDataSourceProvider = Exclude<KnowledgeDocumentSource, "upload">;

export type KnowledgeDataSource = {
  sourceId: string;
  workspaceId: EntityId<"workspaceId">;
  provider: KnowledgeDataSourceProvider;
  displayName: string;
  connectionStatus: KnowledgeDataSourceStatus;
  selectedScopeNodeCount: number;
  lastSyncAt?: string;
  connectedByUserId?: EntityId<"userId">;
  safeMetadata?: SafeJsonValue;
  createdAt: string;
  updatedAt: string;
};
