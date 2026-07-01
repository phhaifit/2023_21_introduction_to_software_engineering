/**
 * task-conversation-state.test.ts
 *
 * Comprehensive component tests for Task & Orchestration in-memory conversation
 * state architecture and session navigation (Review Unit 2B).
 */

import { describe, it, expect } from "vitest";
import type { Conversation, EntityId } from "@vcp/shared";

import {
  taskCreationReducer,
  initialTaskCreationState,
  deriveConversationTitle,
  getConversationById,
  getActiveConversation,
  getConversationTasks,
  getLatestConversationTask,
  getActiveTask,
  type TaskCreationState
} from "../../apps/frontend/src/features/task-orchestration/model/task-creation-state";

describe("In-Memory Conversation State Architecture (Review Unit 2B)", () => {
  const mockRequest1 = {
    prompt: "First conversation prompt",
    routing: { mode: "auto" as const }
  };
  const mockResponse1 = {
    taskId: "TASK-000001" as EntityId<"taskId">,
    workId: "WORK-000001" as EntityId<"workId">,
    status: "queued" as const,
    createdAt: "2026-06-26T10:00:00.000Z"
  };

  const mockRequest2 = {
    prompt: "Second prompt in conversation",
    routing: { mode: "auto" as const }
  };
  const mockResponse2 = {
    taskId: "TASK-000002" as EntityId<"taskId">,
    workId: "WORK-000002" as EntityId<"workId">,
    status: "queued" as const,
    createdAt: "2026-06-26T10:01:00.000Z"
  };

  const mockRequest3 = {
    prompt: "Explicit destination task prompt",
    routing: { mode: "auto" as const }
  };
  const mockResponse3 = {
    taskId: "TASK-000003" as EntityId<"taskId">,
    workId: "WORK-000003" as EntityId<"workId">,
    status: "queued" as const,
    createdAt: "2026-06-26T10:02:00.000Z"
  };

  describe("Initial state", () => {
    it("1. Initial conversation collection has the expected shape", () => {
      expect(initialTaskCreationState.conversations).toEqual([]);
    });

    it("2. Initial active conversation has the expected value", () => {
      expect(initialTaskCreationState.activeConversationId).toBeUndefined();
    });

    it("3. Initial active Task has the expected value", () => {
      expect(initialTaskCreationState.activeTaskId).toBeUndefined();
    });

    it("4. Initial sequence is deterministic", () => {
      expect(initialTaskCreationState.conversationSequence).toBe(1);
    });
  });

  describe("Conversation creation", () => {
    const stateWithTask = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: mockRequest1,
      response: mockResponse1
    });

    const stateWithNewConv = taskCreationReducer(stateWithTask, {
      type: "conversation-created",
      createdAt: "2026-06-26T10:05:00.000Z"
    });

    it("5. Creating a conversation preserves existing Tasks", () => {
      expect(stateWithNewConv.tasks).toEqual(stateWithTask.tasks);
      expect(stateWithNewConv.tasks.length).toBe(1);
    });

    it("6. Creating a conversation preserves existing conversations", () => {
      expect(stateWithNewConv.conversations.length).toBe(2);
      expect(stateWithNewConv.conversations[0]).toEqual(stateWithTask.conversations[0]);
    });

    it("7. The new conversation becomes active", () => {
      expect(stateWithNewConv.activeConversationId).toBe("CONV-000002");
    });

    it("8. An empty active conversation sets activeTaskId to null", () => {
      expect(stateWithNewConv.activeTaskId).toBeNull();
    });

    it("9. Conversation IDs increment deterministically", () => {
      expect(stateWithNewConv.conversations[0].conversationId).toBe("CONV-000001");
      expect(stateWithNewConv.conversations[1].conversationId).toBe("CONV-000002");
      expect(stateWithNewConv.conversationSequence).toBe(3);
    });

    it("10. Creating conversations does not mutate previous state objects", () => {
      const copyOfInitial = structuredClone(initialTaskCreationState);
      taskCreationReducer(initialTaskCreationState, {
        type: "conversation-created",
        createdAt: "2026-06-26T10:00:00.000Z"
      });
      expect(initialTaskCreationState).toEqual(copyOfInitial);
    });
  });

  describe("First Task without explicit conversation ID", () => {
    const state = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: mockRequest1,
      response: mockResponse1
    });

    it("11. A conversation is created automatically when none exists", () => {
      expect(state.conversations.length).toBe(1);
      expect(state.conversations[0].conversationId).toBe("CONV-000001");
    });

    it("12. The Task is appended to state.tasks", () => {
      expect(state.tasks.length).toBe(1);
      expect(state.tasks[0].taskId).toBe("TASK-000001");
    });

    it("13. The Task ID appears in exactly one conversation", () => {
      const appearances = state.conversations.filter((c) => c.taskIds.includes("TASK-000001"));
      expect(appearances.length).toBe(1);
    });

    it("14. The new conversation becomes active", () => {
      expect(state.activeConversationId).toBe("CONV-000001");
    });

    it("15. The Task becomes active", () => {
      expect(state.activeTaskId).toBe("TASK-000001");
    });

    it("16. The first prompt derives the conversation title", () => {
      expect(state.conversations[0].title).toBe("First conversation prompt");
    });

    it("17. No orphan Task is produced", () => {
      const allTaskIdsInConvs = new Set(state.conversations.flatMap((c) => c.taskIds));
      for (const task of state.tasks) {
        expect(allTaskIdsInConvs.has(task.taskId)).toBe(true);
      }
    });
  });

  describe("Later Task in the active conversation", () => {
    const state1 = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: mockRequest1,
      response: mockResponse1
    });

    const state2 = taskCreationReducer(state1, {
      type: "task-created",
      request: mockRequest2,
      response: mockResponse2
    });

    it("18. A second Task appends to the same conversation", () => {
      expect(state2.conversations.length).toBe(1);
      expect(state2.conversations[0].taskIds).toContain("TASK-000002");
    });

    it("19. The first Task ID remains present", () => {
      expect(state2.conversations[0].taskIds).toContain("TASK-000001");
    });

    it("20. Task order is preserved", () => {
      expect(state2.conversations[0].taskIds).toEqual(["TASK-000001", "TASK-000002"]);
    });

    it("21. The second Task becomes active", () => {
      expect(state2.activeTaskId).toBe("TASK-000002");
    });

    it("22. The title remains derived from the first prompt", () => {
      expect(state2.conversations[0].title).toBe("First conversation prompt");
    });

    it("23. updatedAt changes according to the defined input rule", () => {
      expect(state2.conversations[0].updatedAt).toBe(mockResponse2.createdAt);
    });
  });

  describe("Explicit destination conversation", () => {
    const state1 = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: mockRequest1,
      response: mockResponse1
    });

    // Create a second empty conversation (CONV-000002)
    const state2 = taskCreationReducer(state1, {
      type: "conversation-created",
      createdAt: "2026-06-26T10:01:00.000Z"
    });

    // Append task to CONV-000001 explicitly
    const state3 = taskCreationReducer(state2, {
      type: "task-created",
      request: mockRequest3,
      response: mockResponse3,
      conversationId: "CONV-000001"
    });

    it("24. A Task can be appended to a specified existing conversation", () => {
      const conv1 = state3.conversations.find((c) => c.conversationId === "CONV-000001")!;
      expect(conv1.taskIds).toContain("TASK-000003");
    });

    it("25. Other conversations remain unchanged", () => {
      const conv2 = state3.conversations.find((c) => c.conversationId === "CONV-000002")!;
      expect(conv2.taskIds).toEqual([]);
      expect(conv2.title).toBe("New conversation");
    });

    it("26. The destination conversation becomes active if that is the specified contract", () => {
      expect(state3.activeConversationId).toBe("CONV-000001");
      expect(state3.activeTaskId).toBe("TASK-000003");
    });

    it("27. The Task does not appear in another conversation", () => {
      const conv2 = state3.conversations.find((c) => c.conversationId === "CONV-000002")!;
      expect(conv2.taskIds).not.toContain("TASK-000003");
    });
  });

  describe("Conversation selection", () => {
    const state1 = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: mockRequest1,
      response: mockResponse1
    });

    const state2 = taskCreationReducer(state1, {
      type: "conversation-created",
      createdAt: "2026-06-26T10:05:00.000Z"
    });

    it("28. Selecting a populated conversation selects its latest Task", () => {
      const selectedState = taskCreationReducer(state2, {
        type: "conversation-selected",
        conversationId: "CONV-000001"
      });
      expect(selectedState.activeConversationId).toBe("CONV-000001");
      expect(selectedState.activeTaskId).toBe("TASK-000001");
    });

    it("29. Selecting an empty conversation sets activeTaskId to null", () => {
      const selectedState = taskCreationReducer(state2, {
        type: "conversation-selected",
        conversationId: "CONV-000002"
      });
      expect(selectedState.activeConversationId).toBe("CONV-000002");
      expect(selectedState.activeTaskId).toBeNull();
    });

    it("30. Selection does not alter Task statuses", () => {
      const selectedState = taskCreationReducer(state2, {
        type: "conversation-selected",
        conversationId: "CONV-000001"
      });
      expect(selectedState.tasks[0].status).toBe("queued");
    });

    it("31. Selection does not alter Task records", () => {
      const selectedState = taskCreationReducer(state2, {
        type: "conversation-selected",
        conversationId: "CONV-000001"
      });
      expect(selectedState.tasks).toEqual(state2.tasks);
    });

    it("32. Selecting an unknown conversation follows the documented no-op/error convention", () => {
      const selectedState = taskCreationReducer(state2, {
        type: "conversation-selected",
        conversationId: "CONV-999999"
      });
      expect(selectedState).toBe(state2); // Returns exact state unmodified
    });
  });

  describe("Selectors", () => {
    const state1 = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: mockRequest1,
      response: mockResponse1
    });

    const state2 = taskCreationReducer(state1, {
      type: "task-created",
      request: mockRequest2,
      response: mockResponse2
    });

    it("33. getConversationById returns the correct conversation", () => {
      const conv = getConversationById(state2, "CONV-000001");
      expect(conv).toBeDefined();
      expect(conv?.conversationId).toBe("CONV-000001");
    });

    it("34. getActiveConversation returns the selected conversation", () => {
      const activeConv = getActiveConversation(state2);
      expect(activeConv).toBeDefined();
      expect(activeConv?.conversationId).toBe("CONV-000001");
    });

    it("35. getConversationTasks preserves taskIds order", () => {
      const tasks = getConversationTasks(state2, "CONV-000001");
      expect(tasks.length).toBe(2);
      expect(tasks[0].taskId).toBe("TASK-000001");
      expect(tasks[1].taskId).toBe("TASK-000002");
    });

    it("36. getLatestConversationTask returns the final referenced Task", () => {
      const latestTask = getLatestConversationTask(state2, "CONV-000001");
      expect(latestTask).toBeDefined();
      expect(latestTask?.taskId).toBe("TASK-000002");
    });

    it("37. getActiveTask remains compatible", () => {
      const activeTask = getActiveTask(state2);
      expect(activeTask).toBeDefined();
      expect(activeTask?.taskId).toBe("TASK-000002");
    });

    it("38. Selectors do not mutate state", () => {
      const copy = structuredClone(state2);
      getConversationById(state2, "CONV-000001");
      getActiveConversation(state2);
      getConversationTasks(state2, "CONV-000001");
      getLatestConversationTask(state2, "CONV-000001");
      getActiveTask(state2);
      expect(state2).toEqual(copy);
    });

    it("39. Missing Task references are handled according to the documented contract", () => {
      // Create a state with a missing task reference
      const corruptedState: TaskCreationState = {
        ...state2,
        conversations: [
          {
            ...state2.conversations[0],
            taskIds: ["TASK-000001", "MISSING-TASK"]
          }
        ]
      };

      const tasks = getConversationTasks(corruptedState, "CONV-000001");
      expect(tasks.length).toBe(1); // Silently ignores missing task
      expect(tasks[0].taskId).toBe("TASK-000001");

      const latestTask = getLatestConversationTask(corruptedState, "CONV-000001");
      expect(latestTask).toBeUndefined(); // Latest task ID is MISSING-TASK, which is not in state.tasks
    });
  });

  describe("Title derivation", () => {
    it("40. Leading and trailing whitespace is trimmed", () => {
      expect(deriveConversationTitle("   Prompt with spaces   ")).toBe("Prompt with spaces");
    });

    it("41. Repeated whitespace is collapsed", () => {
      expect(deriveConversationTitle("Prompt   with   multiple   spaces")).toBe("Prompt with multiple spaces");
    });

    it("42. A prompt within the limit is unchanged", () => {
      expect(deriveConversationTitle("Short prompt")).toBe("Short prompt");
    });

    it("43. A long prompt is truncated using …", () => {
      const longPrompt = "This is a very long prompt that exceeds the maximum deterministic length of forty characters defined in the contract";
      const title = deriveConversationTitle(longPrompt);
      expect(title.length).toBeLessThanOrEqual(41);
      expect(title.endsWith("…")).toBe(true);
      expect(title).toBe("This is a very long prompt that exceeds…");
    });

    it("44. Empty input uses New conversation", () => {
      expect(deriveConversationTitle("   ")).toBe("New conversation");
    });

    it("45. Later Task prompts do not rename the conversation", () => {
      const state1 = taskCreationReducer(initialTaskCreationState, {
        type: "task-created",
        request: { prompt: "First prompt title", routing: { mode: "auto" } },
        response: mockResponse1
      });

      const state2 = taskCreationReducer(state1, {
        type: "task-created",
        request: { prompt: "Second prompt title", routing: { mode: "auto" } },
        response: mockResponse2
      });

      expect(state2.conversations[0].title).toBe("First prompt title");
    });
  });

  describe("Reset", () => {
    const baseState = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: mockRequest1,
      response: mockResponse1
    });

    const resetState = taskCreationReducer(baseState, {
      type: "reset"
    });

    it("46. Reset clears Tasks", () => {
      expect(resetState.tasks).toEqual([]);
    });

    it("47. Reset clears conversations", () => {
      expect(resetState.conversations).toEqual([]);
    });

    it("48. Reset clears active conversation", () => {
      expect(resetState.activeConversationId).toBeUndefined();
    });

    it("49. Reset clears active Task", () => {
      expect(resetState.activeTaskId).toBeUndefined();
    });

    it("50. Reset restores the deterministic sequence", () => {
      expect(resetState.conversationSequence).toBe(1);
    });

    it("51. No orphan reference remains after reset", () => {
      expect(resetState.tasks.length).toBe(0);
      expect(resetState.conversations.length).toBe(0);
    });
  });

  describe("Duplicate protection", () => {
    it("52. A Task ID is not appended twice to the same conversation", () => {
      const state1 = taskCreationReducer(initialTaskCreationState, {
        type: "task-created",
        request: mockRequest1,
        response: mockResponse1
      });

      // Attempt to dispatch task-created with the same response (e.g. duplicate event)
      const state2 = taskCreationReducer(state1, {
        type: "task-created",
        request: mockRequest1,
        response: mockResponse1
      });

      expect(state2.conversations[0].taskIds).toEqual(["TASK-000001"]);
      expect(state2.tasks.length).toBe(1);
    });

    it("53. A Task ID is not associated with multiple conversations", () => {
      const state1 = taskCreationReducer(initialTaskCreationState, {
        type: "task-created",
        request: mockRequest1,
        response: mockResponse1
      });

      const state2 = taskCreationReducer(state1, {
        type: "conversation-created",
        createdAt: "2026-06-26T10:05:00.000Z"
      });

      // Dispatch task-created with TASK-000001 to CONV-000002
      const state3 = taskCreationReducer(state2, {
        type: "task-created",
        request: mockRequest1,
        response: mockResponse1,
        conversationId: "CONV-000002"
      });

      const conv1 = state3.conversations.find((c) => c.conversationId === "CONV-000001")!;
      const conv2 = state3.conversations.find((c) => c.conversationId === "CONV-000002")!;

      expect(conv1.taskIds).not.toContain("TASK-000001");
      expect(conv2.taskIds).toContain("TASK-000001");
      expect(state3.tasks.length).toBe(1);
    });

    it("54. Reducer transitions preserve immutability", () => {
      const copy = structuredClone(initialTaskCreationState);
      taskCreationReducer(initialTaskCreationState, {
        type: "task-created",
        request: mockRequest1,
        response: mockResponse1
      });
      expect(initialTaskCreationState).toEqual(copy);
    });
  });

  describe("Restored conversations", () => {
    const restoredConversation: Conversation = {
      conversationId: "CONV-000001" as any,
      workspaceId: "workspace-demo" as any,
      title: "Restored running conversation",
      createdAt: "2026-06-26T10:00:00.000Z",
      updatedAt: "2026-06-26T10:02:00.000Z",
      messages: [
        {
          messageId: "TASK-RESTORED-001" as any,
          conversationId: "CONV-000001" as any,
          role: "user",
          content: "Still waiting for answer",
          timestamp: "2026-06-26T10:00:00.000Z"
        }
      ]
    };

    it("55. Restoring a conversation without an assistant answer keeps the task non-terminal", () => {
      const state = taskCreationReducer(initialTaskCreationState, {
        type: "conversations-restored",
        conversations: [restoredConversation]
      });

      expect(state.tasks).toHaveLength(1);
      expect(state.tasks[0].status).toBe("queued");
      expect(state.tasks[0].finalizedResult).toBeUndefined();
      expect(state.conversations[0].taskIds).toEqual(["TASK-RESTORED-001"]);
    });

    it("56. Restoring a conversation with an assistant answer keeps the completed result", () => {
      const state = taskCreationReducer(initialTaskCreationState, {
        type: "conversations-restored",
        conversations: [
          {
            ...restoredConversation,
            messages: [
              ...restoredConversation.messages,
              {
                messageId: "TASK-RESTORED-001-assistant" as any,
                conversationId: "CONV-000001" as any,
                role: "assistant",
                content: "Restored final answer",
                timestamp: "2026-06-26T10:03:00.000Z"
              }
            ]
          }
        ]
      });

      expect(state.tasks[0].status).toBe("succeeded");
      expect(state.tasks[0].finalizedResult?.text).toBe("Restored final answer");
    });

    it("57. Restoring conversations advances the New chat sequence past restored IDs", () => {
      const restoredState = taskCreationReducer(initialTaskCreationState, {
        type: "conversations-restored",
        conversations: [restoredConversation]
      });

      const newChatState = taskCreationReducer(restoredState, {
        type: "conversation-created",
        createdAt: "2026-06-26T10:05:00.000Z"
      });

      expect(newChatState.conversations.map((c) => c.conversationId)).toEqual([
        "CONV-000001",
        "CONV-000002"
      ]);
      expect(newChatState.activeConversationId).toBe("CONV-000002");
    });
  });
});
