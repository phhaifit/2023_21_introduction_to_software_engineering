import { useEffect, useMemo, useState } from "react";

import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDataSourceDto,
  KnowledgeDataSourceStatus
} from "@vcp/shared/contracts/knowledge-base-rag.ts";

import {
  createKnowledgeBaseRagApiClient,
  type KnowledgeBaseRagApiClient
} from "./knowledge-base-rag-api-client.ts";
import {
  KnowledgeBaseEmptyState,
  KnowledgeBaseMetadataList,
  KnowledgeBaseMetricCard,
  KnowledgeBaseSectionCard,
  KnowledgeBaseStatusBadge
} from "./knowledge-base-rag-components.tsx";
import type {
  ExternalDataSourceProvider,
  ExternalDataSourceStatus
} from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-data-sources.css";

const defaultApiClient = createKnowledgeBaseRagApiClient();

const providerLabels: Record<ExternalDataSourceProvider, string> = {
  "google-drive": "Google Drive",
  notion: "Notion",
  confluence: "Confluence"
};

export type KnowledgeBaseDataSourcesScreenProps = {
  apiClient?: KnowledgeBaseRagApiClient;
  workspaceId?: EntityId<"workspaceId">;
};

export function KnowledgeBaseDataSourcesScreen(props: KnowledgeBaseDataSourcesScreenProps) {
  const { apiClient = defaultApiClient, workspaceId = DEMO_WORKSPACE_ID } = props;
  const [dataSources, setDataSources] = useState<KnowledgeDataSourceDto[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const metrics = useMemo(() => createDataSourceMetrics(dataSources), [dataSources]);

  useEffect(() => {
    let isActive = true;

    setLoadState("loading");
    setErrorMessage(null);

    apiClient
      .listDataSources(workspaceId)
      .then((sources) => {
        if (!isActive) return;
        setDataSources(sources);
        setLoadState("loaded");
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setDataSources([]);
        setErrorMessage(getErrorMessage(error));
        setLoadState("error");
      });

    return () => {
      isActive = false;
    };
  }, [apiClient, retryKey, workspaceId]);

  async function handleConnect(sourceId: string) {
    if (connectingSourceId) return;

    setConnectingSourceId(sourceId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const connectedSource = await apiClient.connectDataSource(workspaceId, sourceId);
      setDataSources((currentSources) =>
        currentSources.map((source) =>
          source.sourceId === sourceId ? connectedSource : source
        )
      );
      setSuccessMessage(`${connectedSource.displayName} connection placeholder recorded.`);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setConnectingSourceId(null);
    }
  }

  return (
    <div className="knowledge-base-rag-data-sources">
      <div className="knowledge-base-rag-data-sources-metrics" aria-label="Data source summary">
        <KnowledgeBaseMetricCard
          label="Data sources"
          value={metrics.total}
          helperText="External source placeholders"
        />
        <KnowledgeBaseMetricCard
          label="Connected"
          value={metrics.connected}
          helperText="Sources ready for sync"
        />
        <KnowledgeBaseMetricCard
          label="Syncing"
          value={metrics.syncing}
          helperText="Sources currently refreshing"
        />
        <KnowledgeBaseMetricCard
          label="Needs attention"
          value={metrics.failed}
          helperText="Sources with safe failure summaries"
        />
      </div>

      {successMessage ? (
        <div
          className="knowledge-base-rag-data-sources-feedback knowledge-base-rag-data-sources-feedback--success"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <KnowledgeBaseSectionCard
        title="External data sources"
        eyebrow="Data source connections"
        description="Review source placeholders and record safe connection intent without credentials."
      >
        {loadState === "loading" ? (
          <div className="knowledge-base-rag-data-sources-feedback" role="status">
            Loading data sources...
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className="knowledge-base-rag-data-sources-feedback" role="alert">
            <div>
              <h3>Unable to load data sources</h3>
              <p>{errorMessage}</p>
            </div>
            <button type="button" onClick={() => setRetryKey((current) => current + 1)}>
              Retry
            </button>
          </div>
        ) : null}

        {errorMessage && loadState === "loaded" ? (
          <div className="knowledge-base-rag-data-sources-feedback" role="alert">
            {errorMessage}
          </div>
        ) : null}

        {loadState === "loaded" && dataSources.length > 0 ? (
          <div className="knowledge-base-rag-data-source-list" role="list">
            {dataSources.map((source) => (
              <DataSourceCard
                isConnecting={connectingSourceId === source.sourceId}
                key={source.sourceId}
                onConnect={() => void handleConnect(source.sourceId)}
                source={source}
              />
            ))}
          </div>
        ) : null}

        {loadState === "loaded" && dataSources.length === 0 ? (
          <KnowledgeBaseEmptyState
            title="No data sources available"
            description="Connect source placeholders before selecting synchronization scope."
          />
        ) : null}
      </KnowledgeBaseSectionCard>
    </div>
  );
}

type DataSourceCardProps = {
  isConnecting: boolean;
  onConnect: () => void;
  source: KnowledgeDataSourceDto;
};

function DataSourceCard({ isConnecting, onConnect, source }: DataSourceCardProps) {
  const provider = mapProvider(source.provider);
  const status = mapDataSourceStatus(source.status);
  const canConnect = source.status !== "connected" && source.status !== "syncing";
  const failureText = source.failure?.errorMessage;

  return (
    <article className="knowledge-base-rag-data-source-card" role="listitem">
      <div className="knowledge-base-rag-data-source-card__header">
        <div>
          <p>{providerLabels[provider]}</p>
          <h3>{source.displayName}</h3>
        </div>
        <KnowledgeBaseStatusBadge status={status} />
      </div>

      <KnowledgeBaseMetadataList
        className="knowledge-base-rag-data-source-card__metadata"
        items={[
          { label: "Selected scope", value: source.selectedScopeNodeCount.toString() },
          { label: "Last sync", value: source.lastSyncAt ? formatDate(source.lastSyncAt) : "Not synced" },
          { label: "Updated", value: formatDate(source.updatedAt) }
        ]}
      />

      {failureText ? (
        <p className="knowledge-base-rag-data-source-card__failure">{failureText}</p>
      ) : null}

      <div className="knowledge-base-rag-data-source-card__action">
        <button type="button" disabled={!canConnect || isConnecting} onClick={onConnect}>
          {isConnecting ? "Connecting..." : canConnect ? "Connect source" : "Connected"}
        </button>
      </div>
    </article>
  );
}

function createDataSourceMetrics(dataSources: KnowledgeDataSourceDto[]) {
  return {
    total: dataSources.length,
    connected: countByStatus(dataSources, "connected"),
    syncing: countByStatus(dataSources, "syncing"),
    failed: countByStatus(dataSources, "failed")
  };
}

function countByStatus(
  dataSources: KnowledgeDataSourceDto[],
  status: KnowledgeDataSourceStatus
): number {
  return dataSources.filter((source) => source.status === status).length;
}

function mapProvider(provider: KnowledgeDataSourceDto["provider"]): ExternalDataSourceProvider {
  return provider === "google_drive" ? "google-drive" : provider;
}

function mapDataSourceStatus(status: KnowledgeDataSourceStatus): ExternalDataSourceStatus {
  return status === "not_connected" ? "not-connected" : status;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The Knowledge Base / RAG API could not be reached.";
}
