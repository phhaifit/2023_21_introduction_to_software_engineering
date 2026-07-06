import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryConversationRepository } from "./in-memory-conversation-repository.ts";
import type { Conversation, ChatMessage } from "@vcp/shared";

describe("InMemoryConversationRepository", () => {
  let repository: InMemoryConversationRepository;

  beforeEach(() => {
    repository = new InMemoryConversationRepository();
  });

  it("should save and retrieve a conversation by ID", async () => {
    const conv: Conversation = {
      conversationId: "conv_1" as any,
      workspaceId: "ws_1" as any,
      title: "Test Conversation",
      messages: [],
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z"
    };

    await repository.saveConversation(conv);

    const retrieved = await repository.getConversation("conv_1" as any);
    expect(retrieved).toEqual(conv);
    expect(retrieved).not.toBe(conv); // ensure cloned copy
  });

  it("should list conversations by workspace ID sorted by updatedAt descending", async () => {
    const conv1: Conversation = {
      conversationId: "conv_1" as any,
      workspaceId: "ws_1" as any,
      title: "Conv 1",
      messages: [],
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z"
    };

    const conv2: Conversation = {
      conversationId: "conv_2" as any,
      workspaceId: "ws_1" as any,
      title: "Conv 2",
      messages: [],
      createdAt: "2026-06-27T11:00:00.000Z",
      updatedAt: "2026-06-27T11:00:00.000Z"
    };

    const conv3: Conversation = {
      conversationId: "conv_3" as any,
      workspaceId: "ws_2" as any,
      title: "Conv 3",
      messages: [],
      createdAt: "2026-06-27T12:00:00.000Z",
      updatedAt: "2026-06-27T12:00:00.000Z"
    };

    await repository.saveConversation(conv1);
    await repository.saveConversation(conv2);
    await repository.saveConversation(conv3);

    const list = await repository.listConversationsByWorkspace("ws_1" as any);
    expect(list).toHaveLength(2);
    expect(list[0].conversationId).toBe("conv_2"); // latest updatedAt first
    expect(list[1].conversationId).toBe("conv_1");
  });

  it("should append a message and update updatedAt", async () => {
    const conv: Conversation = {
      conversationId: "conv_1" as any,
      workspaceId: "ws_1" as any,
      title: "Test Conv",
      messages: [],
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z"
    };

    await repository.saveConversation(conv);

    const msg: ChatMessage = {
      messageId: "msg_1" as any,
      conversationId: "conv_1" as any,
      role: "user",
      content: "Hello AI",
      timestamp: "2026-06-27T10:05:00.000Z"
    };

    await repository.appendMessage("conv_1" as any, msg);

    const updated = await repository.getConversation("conv_1" as any);
    expect(updated?.messages).toHaveLength(1);
    expect(updated?.messages[0]).toEqual(msg);
    expect(updated?.updatedAt).toBe("2026-06-27T10:05:00.000Z");
  });

  it("should replace an existing message with the same ID", async () => {
    const conv: Conversation = {
      conversationId: "conv_1" as any,
      workspaceId: "ws_1" as any,
      title: "Idempotent Conv",
      messages: [],
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z"
    };

    await repository.saveConversation(conv);
    await repository.appendMessage("conv_1" as any, {
      messageId: "msg_1" as any,
      conversationId: "conv_1" as any,
      role: "user",
      content: "First write",
      timestamp: "2026-06-27T10:05:00.000Z"
    });
    await repository.appendMessage("conv_1" as any, {
      messageId: "msg_1" as any,
      conversationId: "conv_1" as any,
      role: "user",
      content: "Replay write",
      timestamp: "2026-06-27T10:06:00.000Z"
    });

    const updated = await repository.getConversation("conv_1" as any);
    expect(updated?.messages).toHaveLength(1);
    expect(updated?.messages[0].content).toBe("Replay write");
    expect(updated?.updatedAt).toBe("2026-06-27T10:06:00.000Z");
  });

  it("should update associated target", async () => {
    const conv: Conversation = {
      conversationId: "conv_1" as any,
      workspaceId: "ws_1" as any,
      title: "Test Conv",
      messages: [],
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z"
    };

    await repository.saveConversation(conv);

    await repository.updateAssociatedTarget("conv_1" as any, {
      type: "agent",
      targetId: "agent-research"
    });

    const updated = await repository.getConversation("conv_1" as any);
    expect(updated?.associatedTarget).toEqual({
      type: "agent",
      targetId: "agent-research"
    });
  });

  it("should delete a conversation", async () => {
    const conv: Conversation = {
      conversationId: "conv_1" as any,
      workspaceId: "ws_1" as any,
      title: "Delete me",
      messages: [],
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z"
    };

    await repository.saveConversation(conv);
    await repository.deleteConversation("conv_1" as any);

    expect(await repository.getConversation("conv_1" as any)).toBeNull();
  });

  it("should delete selected query and response messages", async () => {
    const conv: Conversation = {
      conversationId: "conv_1" as any,
      workspaceId: "ws_1" as any,
      title: "Turn delete",
      messages: [
        {
          messageId: "TASK-000001" as any,
          conversationId: "conv_1" as any,
          role: "user",
          content: "Query",
          timestamp: "2026-06-27T10:05:00.000Z"
        },
        {
          messageId: "TASK-000001-assistant" as any,
          conversationId: "conv_1" as any,
          role: "assistant",
          content: "Response",
          timestamp: "2026-06-27T10:06:00.000Z"
        },
        {
          messageId: "TASK-000002" as any,
          conversationId: "conv_1" as any,
          role: "user",
          content: "Keep",
          timestamp: "2026-06-27T10:07:00.000Z"
        }
      ],
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:07:00.000Z"
    };

    await repository.saveConversation(conv);
    await repository.deleteMessages("conv_1" as any, [
      "TASK-000001" as any,
      "TASK-000001-assistant" as any
    ]);

    const updated = await repository.getConversation("conv_1" as any);
    expect(updated?.messages.map((message) => message.content)).toEqual(["Keep"]);
  });
});
