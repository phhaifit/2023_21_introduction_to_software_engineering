import type { PrismaClient } from "@vcp/database";
import type { EntityId, Conversation, ChatMessage, ConversationRepository } from "@vcp/shared";

export class PrismaConversationRepository implements ConversationRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    const associatedTarget = conversation.associatedTarget ? (conversation.associatedTarget as any) : null;

    await this.prisma.conversation.upsert({
      where: { conversationId: conversation.conversationId as string },
      create: {
        conversationId: conversation.conversationId as string,
        workspaceId: conversation.workspaceId as string,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        associatedTarget,
        messages: {
          create: conversation.messages.map((m) => ({
            messageId: m.messageId as string,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
          }))
        }
      },
      update: {
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        associatedTarget
      }
    });
  }

  async getConversation(conversationId: EntityId<"conversationId">): Promise<Conversation | null> {
    const record = await this.prisma.conversation.findUnique({
      where: { conversationId: conversationId as string },
      include: {
        messages: {
          orderBy: { timestamp: "asc" }
        }
      }
    });

    if (!record) {
      return null;
    }

    const messages: ChatMessage[] = record.messages.map((m) => ({
      messageId: m.messageId as EntityId<"messageId">,
      conversationId: m.conversationId as EntityId<"conversationId">,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      timestamp: m.timestamp
    }));

    let associatedTarget: { type: "agent" | "workflow" | "auto"; targetId?: string } | undefined = undefined;
    if (record.associatedTarget && typeof record.associatedTarget === "object") {
      const target = record.associatedTarget as any;
      if (target.type) {
        associatedTarget = { type: target.type, targetId: target.targetId };
      }
    }

    return {
      conversationId: record.conversationId as EntityId<"conversationId">,
      workspaceId: record.workspaceId as EntityId<"workspaceId">,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      associatedTarget,
      messages
    };
  }

  async listConversationsByWorkspace(workspaceId: EntityId<"workspaceId">): Promise<Conversation[]> {
    const records = await this.prisma.conversation.findMany({
      where: { workspaceId: workspaceId as string },
      include: {
        messages: {
          orderBy: { timestamp: "asc" }
        }
      },
      orderBy: { updatedAt: "desc" }
    });

    return records.map((record) => {
      const messages: ChatMessage[] = record.messages.map((m) => ({
        messageId: m.messageId as EntityId<"messageId">,
        conversationId: m.conversationId as EntityId<"conversationId">,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        timestamp: m.timestamp
      }));

      let associatedTarget: { type: "agent" | "workflow" | "auto"; targetId?: string } | undefined = undefined;
      if (record.associatedTarget && typeof record.associatedTarget === "object") {
        const target = record.associatedTarget as any;
        if (target.type) {
          associatedTarget = { type: target.type, targetId: target.targetId };
        }
      }

      return {
        conversationId: record.conversationId as EntityId<"conversationId">,
        workspaceId: record.workspaceId as EntityId<"workspaceId">,
        title: record.title,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        associatedTarget,
        messages
      };
    });
  }

  async appendMessage(conversationId: EntityId<"conversationId">, message: ChatMessage): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { conversationId: conversationId as string }
    });
    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const timestamp = message.timestamp || new Date().toISOString();

    await this.prisma.chatMessage.create({
      data: {
        messageId: message.messageId as string,
        conversationId: conversationId as string,
        role: message.role,
        content: message.content,
        timestamp
      }
    });

    await this.prisma.conversation.update({
      where: { conversationId: conversationId as string },
      data: { updatedAt: timestamp }
    });
  }

  async deleteConversation(conversationId: EntityId<"conversationId">): Promise<void> {
    await this.prisma.conversation.delete({
      where: { conversationId: conversationId as string }
    });
  }

  async deleteMessages(
    conversationId: EntityId<"conversationId">,
    messageIds: readonly EntityId<"messageId">[]
  ): Promise<void> {
    if (messageIds.length === 0) {
      return;
    }

    await this.prisma.chatMessage.deleteMany({
      where: {
        conversationId: conversationId as string,
        messageId: { in: messageIds.map((id) => id as string) }
      }
    });

    await this.prisma.conversation.update({
      where: { conversationId: conversationId as string },
      data: { updatedAt: new Date().toISOString() }
    });
  }

  async updateAssociatedTarget(
    conversationId: EntityId<"conversationId">,
    target: { type: "agent" | "workflow" | "auto"; targetId?: string }
  ): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { conversationId: conversationId as string }
    });
    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    await this.prisma.conversation.update({
      where: { conversationId: conversationId as string },
      data: {
        associatedTarget: target as any,
        updatedAt: new Date().toISOString()
      }
    });
  }
}
