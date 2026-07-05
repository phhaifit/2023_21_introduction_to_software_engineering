import type { KnowledgeDocumentSource } from "@vcp/shared/contracts/knowledge-base-rag.ts";

export type KnowledgeRagProviderEvidence = {
  citationId: string;
  evidenceId: string;
  documentTitle: string;
  snippet: string;
  rank: number;
  source: {
    type: KnowledgeDocumentSource;
    locator?: string;
  };
};

export type KnowledgeRagAnswerProviderInput = {
  query: string;
  evidence: readonly KnowledgeRagProviderEvidence[];
  maxAnswerLength: number;
};

export type KnowledgeRagAnswerProviderResult = {
  answer: string;
  citationIds: readonly string[];
};

export type KnowledgeRagAnswerProvider = {
  generateAnswer(
    input: KnowledgeRagAnswerProviderInput
  ): Promise<KnowledgeRagAnswerProviderResult>;
};
