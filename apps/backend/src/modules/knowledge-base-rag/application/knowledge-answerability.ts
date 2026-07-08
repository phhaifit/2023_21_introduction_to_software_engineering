export const DEFAULT_KNOWLEDGE_ANSWERABILITY_MIN_SCORE = 0.5;

const GENERIC_TERMS = new Set([
  "a",
  "an",
  "and",
  "answer",
  "are",
  "base",
  "be",
  "company",
  "demo",
  "document",
  "documents",
  "for",
  "from",
  "how",
  "in",
  "internal",
  "is",
  "knowledge",
  "much",
  "of",
  "or",
  "policy",
  "reliable",
  "standard",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "workspace",
  "bao",
  "cac",
  "cho",
  "chinh",
  "co",
  "cua",
  "duoc",
  "hang",
  "hoi",
  "khach",
  "la",
  "lieu",
  "muc",
  "nay",
  "nhieu",
  "noi",
  "phai",
  "sach",
  "tai",
  "theo",
  "tieu",
  "tin",
  "tra",
  "trong",
  "chuan",
  "ve"
]);

export type KnowledgeAnswerabilityInput = {
  query: string;
  evidenceText: string;
  evidenceTitle?: string;
  score: number;
  minScore?: number;
};

export function isKnowledgeEvidenceAnswerable(
  input: KnowledgeAnswerabilityInput
): boolean {
  const minScore = input.minScore ?? DEFAULT_KNOWLEDGE_ANSWERABILITY_MIN_SCORE;
  if (!Number.isFinite(input.score) || input.score < minScore) {
    return false;
  }

  const questionTerms = meaningfulTerms(input.query);
  const evidenceTerms = new Set(
    meaningfulTerms(`${input.evidenceTitle ?? ""} ${input.evidenceText}`)
  );
  if (questionTerms.length === 0 || evidenceTerms.size === 0) {
    return false;
  }

  const uniqueQuestionTerms = [...new Set(questionTerms)];
  const overlapCount = uniqueQuestionTerms.filter((term) =>
    evidenceTerms.has(term)
  ).length;
  const overlapRatio = overlapCount / uniqueQuestionTerms.length;

  if (overlapCount >= 2 && overlapRatio >= 0.3) {
    return true;
  }
  return overlapCount >= 1 && uniqueQuestionTerms.length <= 3 && input.score >= 0.75;
}

export function selectMostRelevantEvidenceSentence(
  query: string,
  evidenceText: string
): string {
  const questionTerms = new Set(meaningfulTerms(query));
  const sentences = splitSentences(evidenceText);
  if (questionTerms.size === 0 || sentences.length === 0) {
    return firstSentence(evidenceText);
  }

  let bestSentence = "";
  let bestOverlap = 0;
  for (const sentence of sentences) {
    const sentenceTerms = new Set(meaningfulTerms(sentence));
    const overlap = [...questionTerms].filter((term) =>
      sentenceTerms.has(term)
    ).length;
    if (overlap > bestOverlap) {
      bestSentence = sentence;
      bestOverlap = overlap;
    }
  }
  return bestSentence || firstSentence(evidenceText);
}

function meaningfulTerms(value: string): string[] {
  return normalizeForRelevance(value)
    .split(" ")
    .map(stemTerm)
    .filter((term) => term.length >= 3 && !GENERIC_TERMS.has(term));
}

function normalizeForRelevance(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemTerm(term: string): string {
  if (term.endsWith("ies") && term.length > 5) {
    return `${term.slice(0, -3)}y`;
  }
  if (term.endsWith("es") && term.length > 5) {
    return term.slice(0, -2);
  }
  if (term.endsWith("s") && term.length > 4) {
    return term.slice(0, -1);
  }
  return term;
}

function splitSentences(value: string): string[] {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function firstSentence(value: string): string {
  return splitSentences(value)[0] ?? "";
}
