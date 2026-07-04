import type {
  AgentKnowledgeAskRequest,
  AgentKnowledgeAskResponse,
  EntityId
} from "@vcp/shared";

export type AgentKnowledgeAskPort = {
  ask(
    workspaceId: EntityId<"workspaceId">,
    agentId: EntityId<"agentId">,
    request: AgentKnowledgeAskRequest
  ): Promise<AgentKnowledgeAskResponse>;
};
