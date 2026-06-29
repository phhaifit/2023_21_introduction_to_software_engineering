import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaConversationRepository } from "./prisma-conversation-repository.ts";
import type { Conversation, ChatMessage } from "@vcp/shared";

describe("PrismaConversationRepository", () => {
  let repository: PrismaConversationRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      conversation: {
        upsert: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({})
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    };
    repository = new PrismaConversationRepository(mockPrisma as any);
  });

  it("should save a conversation via upsert", async () => {
    const conv: Conversation = {
      conversationId: "conv_1" as any,
      workspaceId: "ws_1" as any,
      title: "Test Conversation",
      messages: [],
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z"
    };

    await repository.saveConversation(conv);

    expect(mockPrisma.conversation.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.conversation.upsert.mock.calls[0][0].where).toEqual({ conversationId: "conv_1" });
  });

  it("should retrieve a conversation by ID", async () => {
    const record = {
      conversationId: "conv_1",
      workspaceId: "ws_1",
      title: "Test Conversation",
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z",
      associatedTarget: { type: "agent", targetId: "agent-research" },
      messages: [
        {
          messageId: "msg_1",
          conversationId: "conv_1",
          role: "user",
          content: "Hello AI",
          timestamp: "2026-06-27T10:05:00.000Z"
        }
      ]
    };

    mockPrisma.conversation.findUnique.mockResolvedValue(record);

    const retrieved = await repository.getConversation("conv_1" as any);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.conversationId).toBe("conv_1");
    expect(retrieved?.messages).toHaveLength(1);
    expect(retrieved?.associatedTarget).toEqual({ type: "agent", targetId: "agent-research" });
  });

  it("should list conversations by workspace ID", async () => {
    const record = {
      conversationId: "conv_1",
      workspaceId: "ws_1",
      title: "Test Conversation",
      createdAt: "2026-06-27T10:00:00.000Z",
      updatedAt: "2026-06-27T10:00:00.000Z",
      associatedTarget: null,
      messages: []
    };

    mockPrisma.conversation.findMany.mockResolvedValue([record]);

    const list = await repository.listConversationsByWorkspace("ws_1" as any);
    expect(list).toHaveLength(1);
    expect(list[0].conversationId).toBe("conv_1");
  });

  it("should append a message and update updatedAt", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      conversationId: "conv_1",
      workspaceId: "ws_1"
    });

    const msg: ChatMessage = {
      messageId: "msg_1" as any,
      conversationId: "conv_1" as any,
      role: "user",
      content: "Hello AI",
      timestamp: "2026-06-27T10:05:00.000Z"
    };

    await repository.appendMessage("conv_1" as any, msg);

    expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.conversation.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.conversation.update.mock.calls[0][0].data).toEqual({ updatedAt: "2026-06-27T10:05:00.000Z" });
  });

  it("should update associated target", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      conversationId: "conv_1",
      workspaceId: "ws_1"
    });

    await repository.updateAssociatedTarget("conv_1" as any, {
      type: "agent",
      targetId: "agent-research"
    });

    expect(mockPrisma.conversation.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.conversation.update.mock.calls[0][0].data.associatedTarget).toEqual({
      type: "agent",
      targetId: "agent-research"
    });
  });

  it("should delete a conversation by ID", async () => {
    await repository.deleteConversation("conv_1" as any);

    expect(mockPrisma.conversation.delete).toHaveBeenCalledWith({
      where: { conversationId: "conv_1" }
    });
  });

  it("should delete selected messages and touch conversation updatedAt", async () => {
    await repository.deleteMessages("conv_1" as any, ["TASK-000001" as any, "TASK-000001-assistant" as any]);

    expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
      where: {
        conversationId: "conv_1",
        messageId: { in: ["TASK-000001", "TASK-000001-assistant"] }
      }
    });
    expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
      where: { conversationId: "conv_1" },
      data: { updatedAt: expect.any(String) }
    });
  });
});
