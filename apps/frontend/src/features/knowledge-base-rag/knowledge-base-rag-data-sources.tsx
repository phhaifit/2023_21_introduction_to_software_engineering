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
  navigateToOAuth?: (url: string) => void;
  onConfigureScope?: () => void;
};

export function KnowledgeBaseDataSourcesScreen(props: KnowledgeBaseDataSourcesScreenProps) {
  const {
    apiClient = defaultApiClient,
    workspaceId = DEMO_WORKSPACE_ID,
    navigateToOAuth = (url) => window.location.assign(url),
    onConfigureScope
  } = props;
  const [dataSources, setDataSources] = useState<KnowledgeDataSourceDto[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    getGoogleDriveCallbackMessage
  );
  const [retryKey, setRetryKey] = useState(0);
  const callbackErrorMessage = getGoogleDriveCallbackError();
  const metrics = useMemo(() => createDataSourceMetrics(dataSources), [dataSources]);

  useEffect(() => {
    let isActive = true;

    setLoadState("loading");
    setErrorMessage(null);

    apiClient
      .listDataSources(workspaceId)
      .then((sources) => {
        if (!isActive) return;
        setDataSources(sources.filter((source) => source.provider === "google_drive"));
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

  async function handleConnect() {
    if (connectingSourceId) return;

    setConnectingSourceId("google-drive");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await apiClient.startGoogleDriveOAuth(workspaceId, {
        displayName: "Google Drive"
      });
      navigateToOAuth(result.authorizationUrl);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setConnectingSourceId(null);
    }
  }

  async function handleDisconnect(sourceId: string) {
    setConnectingSourceId(sourceId);
    setErrorMessage(null);
    try {
      const disconnected = await apiClient.disconnectDataSource(workspaceId, sourceId);
      setDataSources((sources) =>
        sources.map((source) =>
          source.sourceId === sourceId ? disconnected : source
        )
      );
      setSuccessMessage("Google Drive disconnected.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setConnectingSourceId(null);
    }
  }

  async function handleManualSync(sourceId: string) {
    setConnectingSourceId(sourceId);
    setErrorMessage(null);
    try {
      await apiClient.requestManualSync(workspaceId, { sourceId });
      setSuccessMessage("Google Drive manual sync queued.");
    } catch (error) {
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
          helperText="External source connections"
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
      {callbackErrorMessage ? (
        <div className="knowledge-base-rag-data-sources-feedback" role="alert">
          {callbackErrorMessage}
        </div>
      ) : null}

      <KnowledgeBaseSectionCard
        title="External data sources"
        eyebrow="Data source connections"
        description="Google Drive is the only supported external source. OAuth credentials remain backend-only."
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
                onConnect={() => void handleConnect()}
                onDisconnect={() => void handleDisconnect(source.sourceId)}
                onConfigureScope={onConfigureScope}
                onSync={() => void handleManualSync(source.sourceId)}
                source={source}
              />
            ))}
          </div>
        ) : null}

        {loadState === "loaded" && dataSources.length === 0 ? (
          <KnowledgeBaseEmptyState
            title="Connect Google Drive"
            description="Connect a limited Google Drive account to import selected folders or files."
            action={
              <button type="button" onClick={() => void handleConnect()}>
                Connect Google Drive
              </button>
            }
          />
        ) : null}
      </KnowledgeBaseSectionCard>
    </div>
  );
}

type DataSourceCardProps = {
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onConfigureScope?: () => void;
  onSync: () => void;
  source: KnowledgeDataSourceDto;
};

function DataSourceCard({
  isConnecting,
  onConnect,
  onDisconnect,
  onConfigureScope,
  onSync,
  source
}: DataSourceCardProps) {
  const provider = mapProvider(source.provider);
  const status = mapDataSourceStatus(source.status);
  const canConnect = source.status !== "connected" && source.status !== "syncing";
  const hasConfiguredScope = source.selectedScopeNodeCount > 0;
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
          { label: "Connected account", value: source.connectedAccountEmail ?? "Not available" },
          { label: "Last sync", value: source.lastSyncAt ? formatDate(source.lastSyncAt) : "Not synced" },
          { label: "Updated", value: formatDate(source.updatedAt) }
        ]}
      />

      {failureText ? (
        <p className="knowledge-base-rag-data-source-card__failure">{failureText}</p>
      ) : null}

      {source.status === "connected" ? (
        <div className="knowledge-base-rag-data-source-card__guidance">
          {!hasConfiguredScope ? (
            <p>
              Google Drive is connected. Configure Synchronization Scope before
              running sync.
            </p>
          ) : null}
          <p>
            Connect only authorizes the app. Files are imported only after you add
            Google Drive file IDs or folder IDs in Synchronization Scope and run
            Sync now.
          </p>
          <p>
            For privacy and performance, the app does not import your entire Google
            Drive after connection.
          </p>
        </div>
      ) : null}

      <div className="knowledge-base-rag-data-source-card__action">
        {canConnect ? (
          <button type="button" disabled={isConnecting} onClick={onConnect}>
            {isConnecting ? "Connecting..." : "Connect Google Drive"}
          </button>
        ) : (
          <>
            <button
              className="knowledge-base-rag-data-source-card__sync"
              type="button"
              disabled={isConnecting || !hasConfiguredScope}
              onClick={onSync}
              title={
                hasConfiguredScope
                  ? undefined
                  : "Add at least one Google Drive file ID or folder ID in Synchronization Scope before syncing."
              }
            >
              {isConnecting ? "Working..." : "Sync now"}
            </button>
            {!hasConfiguredScope && onConfigureScope ? (
              <button
                className="knowledge-base-rag-data-source-card__configure"
                type="button"
                disabled={isConnecting}
                onClick={onConfigureScope}
              >
                Configure scope
              </button>
            ) : null}
            <button
              className="knowledge-base-rag-data-source-card__disconnect"
              type="button"
              disabled={isConnecting}
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function getGoogleDriveCallbackMessage(): string | null {
  if (typeof window === "undefined") return null;
  const status = new URLSearchParams(window.location.search).get("googleDrive");
  if (status === "connected") return "Google Drive connected successfully.";
  if (status === "error") {
    return null;
  }
  return null;
}

function getGoogleDriveCallbackError(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("googleDrive") === "error"
    ? "Google Drive could not be connected. Try again."
    : null;
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
