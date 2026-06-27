import type { EntityId } from "./ids.ts";

export interface ChatMessage {
  messageId: EntityId<"messageId">;
  conversationId: EntityId<"conversationId">;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface Conversation {
  conversationId: EntityId<"conversationId">;
  workspaceId: EntityId<"workspaceId">;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  associatedTarget?: {
    type: "agent" | "workflow" | "auto";
    targetId?: string;
  };
}

export interface ConversationRepository {
  saveConversation(conversation: Conversation): Promise<void>;
  getConversation(conversationId: EntityId<"conversationId">): Promise<Conversation | null>;
  listConversationsByWorkspace(workspaceId: EntityId<"workspaceId">): Promise<Conversation[]>;
  appendMessage(conversationId: EntityId<"conversationId">, message: ChatMessage): Promise<void>;
  updateAssociatedTarget(
    conversationId: EntityId<"conversationId">,
    target: { type: "agent" | "workflow" | "auto"; targetId?: string }
  ): Promise<void>;
}
