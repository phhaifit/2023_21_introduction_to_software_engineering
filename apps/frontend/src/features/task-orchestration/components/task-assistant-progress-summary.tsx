import type { CreatedTaskRecord } from "../model/task-types";
import { toTaskPresentationStatus } from "../model/task-lifecycle";
import { TaskMarkdown } from "./task-markdown";

export interface TaskAssistantProgressSummaryProps {
  task: CreatedTaskRecord;
  /** @deprecated - use the composer Stop button instead; kept for prop-compat */
  onCancelTask?: () => void;
}

type ActivityKind = "agent" | "search" | "tool" | "file" | "thinking";

const TASK_STATUS_LABELS: Record<NonNullable<ReturnType<typeof toTaskPresentationStatus>>, string> = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled"
};

interface ActivityLabel {
  readonly kind: ActivityKind;
  readonly label: string;
  readonly hint: string;
}

interface RuntimeActivityItem {
  readonly id: string;
  readonly kind: ActivityKind;
  readonly summary: string;
  readonly text: string;
}

export function TaskAssistantProgressSummary({ task }: TaskAssistantProgressSummaryProps) {
  const presentationStatus = toTaskPresentationStatus(task.status);
  const visibleSteps = task.processingSnapshot.steps.filter(
    (step) => step.status === "active" || step.status === "completed" || step.status === "failed"
  );
  const isLive = task.status === "queued" || task.status === "running";
  const hasCapturedRuntimeProgress = visibleSteps.length > 0 || task.processingSnapshot.logs.length > 0;
  const runtimeActivity = buildRuntimeActivityItems(task);

  if (!presentationStatus || (!isLive && !hasCapturedRuntimeProgress) || (!isLive && runtimeActivity.length === 0)) {
    return null;
  }

  const latestRuntimeActivity = runtimeActivity.at(-1);
  const statusText = latestRuntimeActivity?.text || (task.status === "queued" ? "Waiting for runtime..." : "Working on it");

  return (
    <div className="task-assistant-progress" aria-live="polite">
      <span className="sr-only" aria-label={`Task status: ${TASK_STATUS_LABELS[presentationStatus]}`}>
        {TASK_STATUS_LABELS[presentationStatus]}
      </span>
      <TaskMarkdown
        className="task-assistant-progress__text task-markdown"
        aria-label="Assistant runtime status"
        text={statusText}
      />
    </div>
  );
}

export function hasDisplayableRuntimeActivity(task: CreatedTaskRecord): boolean {
  return buildRuntimeActivityItems(task).length > 0;
}

function buildRuntimeActivityItems(task: CreatedTaskRecord): RuntimeActivityItem[] {
  const items: RuntimeActivityItem[] = [];
  const seen = new Set<string>();
  const indexByStepId = new Map<string, number>();
  const indexBySummary = new Map<string, number>();

  for (const step of task.processingSnapshot.steps) {
    if (step.status !== "active" && step.status !== "completed" && step.status !== "failed") {
      continue;
    }
    const activity = resolveActivityLabel(step.label);
    if (!isDisplayableActivity(activity, step.label)) {
      continue;
    }
    const text = activity.hint && activity.hint !== activity.label && !isGenericActivityHint(activity.hint)
      ? `${activity.label}\n\n${activity.hint}`
      : activity.label;
    const key = normalizeActivityKey(text);
    const summaryKey = normalizeActivityKey(activity.label);
    if (seen.has(key) || indexBySummary.has(summaryKey)) {
      continue;
    }
    seen.add(key);
    indexByStepId.set(step.id, items.length);
    indexBySummary.set(summaryKey, items.length);
    items.push({
      id: `step-${step.id}-${step.status}`,
      kind: activity.kind,
      summary: activity.label,
      text
    });
  }

  for (const log of task.processingSnapshot.logs) {
    const classifier = getActivityClassifierText(log.message);
    const activity = resolveActivityLabel(classifier);
    if (!isDisplayableActivity(activity, classifier)) {
      continue;
    }
    const text = log.message.trim();
    const key = normalizeActivityKey(text);
    const summaryKey = normalizeActivityKey(activity.label);
    const existingIndex = indexByStepId.get(log.stepId) ?? indexBySummary.get(summaryKey);
    if (existingIndex !== undefined) {
      seen.delete(normalizeActivityKey(items[existingIndex]?.text ?? ""));
      items[existingIndex] = {
        id: `log-${log.id}`,
        kind: activity.kind,
        summary: activity.label,
        text
      };
      seen.add(key);
      indexBySummary.set(summaryKey, existingIndex);
      continue;
    }
    if (seen.has(key) || indexBySummary.has(summaryKey)) {
      continue;
    }
    seen.add(key);
    indexBySummary.set(summaryKey, items.length);
    items.push({
      id: `log-${log.id}`,
      kind: activity.kind,
      summary: activity.label,
      text
    });
  }

  return items;
}

function normalizeActivityKey(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function getActivityClassifierText(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return stripMarkdownMarkers(firstLine ?? text);
}

function stripMarkdownMarkers(text: string): string {
  return text
    .replace(/^[-*+]\s+/, "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim();
}

function isDisplayableActivity(activity: ActivityLabel, rawText?: string): boolean {
  const label = stripMarkdownMarkers(rawText ?? activity.label).toLowerCase();
  if (activity.kind === "tool" || activity.kind === "search" || activity.kind === "file" || activity.kind === "thinking") {
    return true;
  }
  if (isGenericRuntimeActivity(label)) {
    return false;
  }
  if (/\b(message|respond|stream|output|final|response|composing)\b/.test(label)) {
    return false;
  }
  return label.length > 0;
}

function isGenericRuntimeActivity(label: string): boolean {
  return /^(start|started|finish|finishing|finished|end|ended|openclaw activity|processing|queued)$/.test(label);
}

function isGenericActivityHint(hint: string): boolean {
  return /^OpenClaw .+ activity$/i.test(hint.trim());
}

export function resolveActivityLabel(rawLabel: string): ActivityLabel {
  const label = rawLabel.trim() || "Processing";
  const lower = stripMarkdownMarkers(label).toLowerCase();
  const cleanLabel = stripMarkdownMarkers(label);

  if (lower === "searching web") {
    return {
      kind: "search",
      label: cleanLabel,
      hint: "OpenClaw web search activity"
    };
  }

  if (lower.startsWith("calling ") || lower === "running command" || lower === "calling api") {
    return {
      kind: "tool",
      label: cleanLabel,
      hint: "OpenClaw tool activity"
    };
  }

  if (lower.startsWith("reading ")) {
    return {
      kind: "file",
      label: cleanLabel,
      hint: "OpenClaw reading activity"
    };
  }

  if (lower === "browsing web") {
    return {
      kind: "search",
      label: cleanLabel,
      hint: "OpenClaw browser activity"
    };
  }

  if (lower === "composing response") {
    return {
      kind: "agent",
      label: cleanLabel,
      hint: "OpenClaw response activity"
    };
  }

  if (lower === "thinking" || /\b(reasoning|thinking|thought|planning|deliberat|reflect)\b/.test(lower)) {
    return {
      kind: "thinking",
      label: "Thinking",
      hint: cleanLabel
    };
  }

  if (/\b(tool|function|call|calling|execute|command|api)\b/.test(lower)) {
    return {
      kind: "tool",
      label: "Calling tool",
      hint: cleanLabel
    };
  }

  if (/\b(search|web|browser|browse|retriev|lookup|google)\b/.test(lower)) {
    return {
      kind: "search",
      label: "Searching web",
      hint: cleanLabel
    };
  }

  if (/\b(file|read|write|document|workspace|artifact)\b/.test(lower)) {
    return {
      kind: "file",
      label: "Reading workspace",
      hint: cleanLabel
    };
  }

  if (/\b(message|respond|stream|output|final)\b/.test(lower)) {
    return {
      kind: "agent",
      label: "Composing response",
      hint: cleanLabel
    };
  }

  return {
    kind: "agent",
    label: cleanLabel,
    hint: "OpenClaw runtime activity"
  };
}
