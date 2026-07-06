import { useEffect, useState } from "react";

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
  KnowledgeBaseSectionCard,
  KnowledgeBaseStatusBadge
} from "./knowledge-base-rag-components.tsx";
import type { ExternalDataSourceStatus } from "./knowledge-base-rag-view.ts";

import "./knowledge-base-rag-data-sources.css";

const defaultApiClient = createKnowledgeBaseRagApiClient();

export type KnowledgeBaseDataSourcesScreenProps = {
  apiClient?: KnowledgeBaseRagApiClient;
  workspaceId?: EntityId<"workspaceId">;
  navigateToOAuth?: (url: string) => void;
  onConnectionChanged?: () => void;
};

export function KnowledgeBaseDataSourcesScreen(props: KnowledgeBaseDataSourcesScreenProps) {
  const {
    apiClient = defaultApiClient,
    workspaceId = DEMO_WORKSPACE_ID,
    navigateToOAuth = (url) => window.location.assign(url),
    onConnectionChanged
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

  useEffect(() => {
    if (!successMessage) return;
    cleanGoogleDriveCallbackQuery();
    const timer = window.setTimeout(() => setSuccessMessage(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

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
      onConnectionChanged?.();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setConnectingSourceId(null);
    }
  }

  return (
    <div className="knowledge-base-rag-data-sources">
      {successMessage ? (
        <div
          className="knowledge-base-rag-data-sources-feedback knowledge-base-rag-data-sources-feedback--success"
          role="status"
        >
          <span>{successMessage}</span>
          <button
            className="knowledge-base-rag-data-sources-feedback__dismiss"
            type="button"
            aria-label="Dismiss Google Drive notice"
            onClick={() => setSuccessMessage(null)}
          >
            ×
          </button>
        </div>
      ) : null}
      {callbackErrorMessage ? (
        <div className="knowledge-base-rag-data-sources-feedback" role="alert">
          {callbackErrorMessage}
        </div>
      ) : null}

      <KnowledgeBaseSectionCard
        title="Google Drive"
        eyebrow="Connection"
        description="Connect Google Drive to import selected files or folders into the Knowledge Base."
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
  source: KnowledgeDataSourceDto;
};

function DataSourceCard({
  isConnecting,
  onConnect,
  onDisconnect,
  source
}: DataSourceCardProps) {
  const status = mapDataSourceStatus(source.status);
  const canConnect = source.status !== "connected" && source.status !== "syncing";
  const failureText = source.failure?.errorMessage;

  return (
    <article className="knowledge-base-rag-data-source-card" role="listitem">
      <div className="knowledge-base-rag-data-source-card__header">
        <div>
          <p>Google Drive</p>
          <h3>{source.displayName || "Google Drive"}</h3>
        </div>
        <KnowledgeBaseStatusBadge status={status} />
      </div>

      <KnowledgeBaseMetadataList
        className="knowledge-base-rag-data-source-card__metadata"
        items={[
          { label: "Selected items", value: source.selectedScopeNodeCount.toString() },
          { label: "Connected account", value: source.connectedAccountEmail ?? "Not available" },
          { label: "Auto Sync", value: source.autoSyncEnabled ? "On" : "Off" },
          {
            label: "Frequency",
            value: source.autoSyncEnabled
              ? source.autoSyncFrequency === "hourly"
                ? "Hourly"
                : "Daily"
              : "Not scheduled"
          },
          { label: "Last sync", value: source.lastSyncAt ? formatDate(source.lastSyncAt) : "Not synced" },
          {
            label: "Last result",
            value:
              source.lastSyncStatus === "completed"
                ? "Completed"
                : source.lastSyncStatus === "failed"
                  ? "Failed"
                  : "No result"
          }
        ]}
      />

      {failureText ? (
        <p className="knowledge-base-rag-data-source-card__failure">{failureText}</p>
      ) : null}

      {source.status === "connected" ? (
        <div className="knowledge-base-rag-data-source-card__guidance">
          <p>
            Connect authorizes Google Drive. Drive content chooses what to import.
            Auto Sync keeps selected content updated on a schedule.
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
          <button
            className="knowledge-base-rag-data-source-card__disconnect"
            type="button"
            disabled={isConnecting}
            onClick={onDisconnect}
          >
            Disconnect
          </button>
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

function cleanGoogleDriveCallbackQuery(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("googleDrive")) return;
  url.searchParams.delete("googleDrive");
  url.searchParams.delete("sourceId");
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
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
