import type { EntityId, Conversation, ChatMessage, ConversationRepository } from "@vcp/shared";

export class InMemoryConversationRepository implements ConversationRepository {
  private conversations = new Map<string, Conversation>();

  async saveConversation(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.conversationId as string, { ...conversation });
  }

  async getConversation(conversationId: EntityId<"conversationId">): Promise<Conversation | null> {
    const found = this.conversations.get(conversationId as string);
    return found ? { ...found } : null;
  }

  async listConversationsByWorkspace(workspaceId: EntityId<"workspaceId">): Promise<Conversation[]> {
    const result: Conversation[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.workspaceId === workspaceId) {
        result.push({ ...conv });
      }
    }
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async appendMessage(conversationId: EntityId<"conversationId">, message: ChatMessage): Promise<void> {
    const conv = this.conversations.get(conversationId as string);
    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    const existingIndex = conv.messages.findIndex(
      (existing) => existing.messageId === message.messageId
    );
    if (existingIndex >= 0) {
      conv.messages[existingIndex] = { ...message };
    } else {
      conv.messages.push({ ...message });
    }
    conv.updatedAt = message.timestamp || new Date().toISOString();
  }

  async deleteConversation(conversationId: EntityId<"conversationId">): Promise<void> {
    this.conversations.delete(conversationId as string);
  }

  async deleteMessages(
    conversationId: EntityId<"conversationId">,
    messageIds: readonly EntityId<"messageId">[]
  ): Promise<void> {
    const conv = this.conversations.get(conversationId as string);
    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    const ids = new Set(messageIds.map((id) => id as string));
    conv.messages = conv.messages.filter((message) => !ids.has(message.messageId as string));
    conv.updatedAt = new Date().toISOString();
  }

  async updateAssociatedTarget(
    conversationId: EntityId<"conversationId">,
    target: { type: "agent" | "workflow" | "auto"; targetId?: string }
  ): Promise<void> {
    const conv = this.conversations.get(conversationId as string);
    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    conv.associatedTarget = target;
    conv.updatedAt = new Date().toISOString();
  }
}
