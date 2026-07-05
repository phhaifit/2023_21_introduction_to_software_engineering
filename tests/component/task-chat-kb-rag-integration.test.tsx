import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskCompletedResult } from "@vcp/frontend/features/task-orchestration/components/task-completed-result.tsx";
import { TaskComposer } from "@vcp/frontend/features/task-orchestration/components/task-composer.tsx";
import { HttpTaskOrchestrationProvider } from "@vcp/frontend/features/task-orchestration/model/task-orchestration-provider.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Task chat KB/RAG integration", () => {
  it("sends Agent-mode chat through the backend and emits a cited answer", async () => {
    let resolveAsk!: (response: Response) => void;
    const askResponse = new Promise<Response>((resolve) => {
      resolveAsk = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/tasks")) {
        return jsonResponse({
          ok: true,
          data: {
            taskId: "task-1",
            workId: "work-1",
            status: "queued",
            createdAt: "2026-07-04T00:00:00.000Z"
          }
        }, 201);
      }
      if (url.endsWith("/tasks/agent-knowledge/ask")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          agentId: "agent-1",
          message: "What is the equipment policy?",
          topK: 5
        });
        return askResponse;
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new HttpTaskOrchestrationProvider({
      type: "http",
      baseUrl: "http://localhost"
    });
    const task = await provider.createTask({
      prompt: "What is the equipment policy?",
      routing: { mode: "specific-agent", agentId: "agent-1" as any }
    });
    const completed = new Promise<any>((resolve) => {
      provider.subscribeToTaskEvents(task.taskId as string, (event) => {
        if (event.kind === "task-completed") {
          resolve(event);
        }
      });
    });

    resolveAsk(jsonResponse({
      ok: true,
      data: {
        status: "answered",
        answer: "Equipment requests are reviewed within three business days.",
        citations: [
          {
            citationId: "E1",
            documentId: "document-policy",
            documentTitle: "sample-company-policy.txt",
            snippet: "Equipment requests are reviewed within three business days.",
            sourceType: "upload",
            sourceLocator: "text:0"
          }
        ],
        warnings: []
      }
    }));

    const event = await completed;
    expect(event.finalResult.text).toContain("three business days");
    expect(event.finalResult.citations).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/executions/start"),
      expect.anything()
    );
  });

  it("renders citations and the insufficient-evidence fallback safely", () => {
    const clipboard = { writeText: vi.fn(async () => undefined) };
    const { rerender } = render(
      <TaskCompletedResult
        clipboardWriter={clipboard}
        result={{
          text: "Equipment requests are reviewed within three business days.",
          finalizedAt: "2026-07-04T00:00:00.000Z",
          knowledgeStatus: "answered",
          citations: [
            {
              citationId: "E1",
              documentId: "document-policy" as any,
              documentTitle: "sample-company-policy.txt",
              snippet: "Equipment requests are reviewed within three business days.",
              sourceType: "upload"
            }
          ]
        }}
      />
    );
    expect(screen.getAllByText(/three business days/)).toHaveLength(2);
    expect(screen.getByText("E1: sample-company-policy.txt")).toBeVisible();

    rerender(
      <TaskCompletedResult
        clipboardWriter={clipboard}
        result={{
          text: "I could not find enough information in this agent's assigned knowledge documents to answer reliably.",
          finalizedAt: "2026-07-04T00:00:00.000Z",
          knowledgeStatus: "insufficient_evidence",
          citations: []
        }}
      />
    );
    expect(screen.getByText(/could not find enough information/i)).toBeVisible();
  });

  it("shows loading state and disables Send while submitting", () => {
    render(
      <TaskComposer
        prompt="Policy question"
        isSubmitting
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Sending request" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Request" })).toBeDisabled();
  });

  it("rejects unsafe response markers instead of rendering them", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/tasks")) {
        return jsonResponse({
          ok: true,
          data: {
            taskId: "task-unsafe",
            workId: "work-unsafe",
            status: "queued",
            createdAt: "2026-07-04T00:00:00.000Z"
          }
        }, 201);
      }
      return jsonResponse({
        ok: true,
        data: {
          status: "answered",
          answer: "storageKey=/private/a providerPayload rawPrompt",
          citations: [],
          warnings: []
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HttpTaskOrchestrationProvider({
      type: "http",
      baseUrl: "http://localhost"
    });
    const task = await provider.createTask({
      prompt: "Policy",
      routing: { mode: "specific-agent", agentId: "agent-1" as any }
    });
    const failed = new Promise<any>((resolve) => {
      provider.subscribeToTaskEvents(task.taskId as string, (event) => {
        if (event.kind === "task-failed") resolve(event);
      });
    });
    const event = await failed;
    expect(event.error.message).toBe(
      "Unable to answer from assigned knowledge right now."
    );
    expect(JSON.stringify(event)).not.toMatch(
      /storageKey|private\/a|providerPayload|rawPrompt/
    );
  });

  it("does not contain a runtime mock KB/RAG answer", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "apps/frontend/src/features/task-orchestration/model/task-orchestration-provider.ts"
      ),
      "utf8"
    );
    expect(source).toContain("/tasks/agent-knowledge/ask");
    expect(source).not.toContain("Equipment requests are reviewed within three business days.");
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
