export const DEFAULT_KNOWLEDGE_ANSWERABILITY_MIN_SCORE = 0.5;
const LOW_SCORE_STRONG_OVERLAP_MIN_SCORE = 0.4;

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
  "need",
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
  "can",
  "cho",
  "chinh",
  "co",
  "cua",
  "duoc",
  "hang",
  "hoi",
  "khach",
  "la",
  "lam",
  "lieu",
  "moi",
  "muc",
  "nay",
  "ngay",
  "nhan",
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
  "viec",
  "vien",
  "ve"
]);

export type KnowledgeAnswerabilityInput = {
  query: string;
  evidenceText: string;
  evidenceTitle?: string;
  score: number;
  minScore?: number;
};

export type KnowledgeAnswerabilityExplanation = {
  answerable: boolean;
  reason: string;
  minScore: number;
  score: number;
  questionTerms: string[];
  overlapTerms: string[];
  overlapCount: number;
  overlapRatio: number;
};

export function isKnowledgeEvidenceAnswerable(
  input: KnowledgeAnswerabilityInput
): boolean {
  return explainKnowledgeEvidenceAnswerability(input).answerable;
}

export function explainKnowledgeEvidenceAnswerability(
  input: KnowledgeAnswerabilityInput
): KnowledgeAnswerabilityExplanation {
  const minScore = input.minScore ?? DEFAULT_KNOWLEDGE_ANSWERABILITY_MIN_SCORE;
  const score = Number.isFinite(input.score) ? input.score : Number.NaN;
  const base = {
    minScore,
    score,
    questionTerms: [] as string[],
    overlapTerms: [] as string[],
    overlapCount: 0,
    overlapRatio: 0
  };
  if (!Number.isFinite(input.score)) {
    return {
      ...base,
      answerable: false,
      reason: "invalid_score"
    };
  }

  const questionTerms = meaningfulTerms(input.query);
  const normalizedQuery = normalizeForRelevance(input.query);
  const normalizedEvidence = normalizeForRelevance(
    `${input.evidenceTitle ?? ""} ${input.evidenceText}`
  );
  if (
    normalizedQuery.includes("onboarding") &&
    !normalizedEvidence.includes("onboarding")
  ) {
    return {
      ...base,
      questionTerms: [...new Set(questionTerms)],
      answerable: false,
      reason: "missing_onboarding_intent"
    };
  }
  const queryNumbers = extractNumericTokens(input.query);
  if (
    queryNumbers.size > 0 &&
    ![...queryNumbers].some((number) =>
      extractNumericTokens(`${input.evidenceTitle ?? ""} ${input.evidenceText}`).has(
        number
      )
    )
  ) {
    return {
      ...base,
      questionTerms: [...new Set(questionTerms)],
      answerable: false,
      reason: "missing_numeric_overlap"
    };
  }
  const evidenceTerms = new Set(
    meaningfulTerms(`${input.evidenceTitle ?? ""} ${input.evidenceText}`)
  );
  if (questionTerms.length === 0 || evidenceTerms.size === 0) {
    return {
      ...base,
      questionTerms: [...new Set(questionTerms)],
      answerable: false,
      reason: "missing_meaningful_terms"
    };
  }

  const uniqueQuestionTerms = [...new Set(questionTerms)];
  const overlapTerms = uniqueQuestionTerms.filter((term) =>
    evidenceTerms.has(term)
  );
  const overlapCount = overlapTerms.length;
  const overlapRatio = overlapCount / uniqueQuestionTerms.length;
  const explanation = {
    minScore,
    score: input.score,
    questionTerms: uniqueQuestionTerms,
    overlapTerms,
    overlapCount,
    overlapRatio
  };

  if (input.score < minScore) {
    if (
      input.score >= LOW_SCORE_STRONG_OVERLAP_MIN_SCORE &&
      hasStrongMeaningfulOverlap(overlapCount, overlapRatio)
    ) {
      return {
        ...explanation,
        answerable: true,
        reason: "strong_meaningful_overlap_low_score"
      };
    }
    return {
      ...explanation,
      answerable: false,
      reason: "score_below_threshold"
    };
  }

  if (overlapCount >= 2 && overlapRatio >= 0.3) {
    return {
      ...explanation,
      answerable: true,
      reason: "meaningful_overlap"
    };
  }
  if (overlapCount >= 1 && uniqueQuestionTerms.length <= 3 && input.score >= 0.75) {
    return {
      ...explanation,
      answerable: true,
      reason: "short_query_overlap"
    };
  }
  return {
    ...explanation,
    answerable: false,
    reason: "insufficient_meaningful_overlap"
  };
}

function hasStrongMeaningfulOverlap(
  overlapCount: number,
  overlapRatio: number
): boolean {
  return overlapCount >= 3 && overlapRatio >= 0.5;
}

export function selectMostRelevantEvidenceSentence(
  query: string,
  evidenceText: string
): string {
  const tabularAnswer = selectTabularPriceAnswer(query, evidenceText);
  if (tabularAnswer) {
    return tabularAnswer;
  }

  const questionTerms = new Set(meaningfulTerms(query));
  const sentences = splitSentences(evidenceText);
  if (questionTerms.size === 0 || sentences.length === 0) {
    return firstSentence(evidenceText);
  }

  let bestSentence = "";
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const sentence of sentences) {
    const score = scoreEvidenceSentence(query, sentence, questionTerms);
    if (score > bestScore) {
      bestSentence = sentence;
      bestScore = score;
    }
  }
  return bestSentence || firstSentence(evidenceText);
}

function scoreEvidenceSentence(
  query: string,
  sentence: string,
  questionTerms: Set<string>
): number {
  const sentenceTerms = new Set(meaningfulTerms(sentence));
  const overlap = [...questionTerms].filter((term) =>
    sentenceTerms.has(term)
  ).length;
  let score = overlap * 10;

  const queryNumbers = extractNumericTokens(query);
  if (queryNumbers.size > 0) {
    const sentenceNumbers = extractNumericTokens(sentence);
    const exactMatches = [...queryNumbers].filter((number) =>
      sentenceNumbers.has(number)
    ).length;
    const conflictingNumbers = [...sentenceNumbers].filter(
      (number) => !queryNumbers.has(number)
    ).length;
    score += exactMatches * 100;
    if (exactMatches === 0 && conflictingNumbers > 0) {
      score -= conflictingNumbers * 80;
    }
  }

  if (isChecklistQuestion(query)) {
    if (isChecklistLikeSentence(sentence)) {
      score += 80;
    }
    if (isTitleOrIntroSentence(sentence)) {
      score -= 25;
    }
  }
  if (isQuantityQuestion(query)) {
    if (extractNumericTokens(sentence).size > 0) {
      score += 35;
    }
    if (isTitleOrIntroSentence(sentence)) {
      score -= 15;
    }
  }

  return score;
}

function extractNumericTokens(value: string): Set<string> {
  const normalized = normalizeForRelevance(value);
  return new Set(
    normalized
      .match(/\d+(?:[.,]\d+)*(?:\s*%)?/g)
      ?.map((token) => token.replace(/[.,\s]+/g, ""))
      .filter(Boolean) ?? []
  );
}

function isChecklistQuestion(query: string): boolean {
  const normalized = normalizeForRelevance(query);
  return (
    normalized.includes("checklist") ||
    normalized.includes("gom nhung gi") ||
    normalized.includes("bao gom")
  );
}

function isQuantityQuestion(query: string): boolean {
  const normalized = normalizeForRelevance(query);
  return (
    normalized.includes("bao nhieu") ||
    normalized.includes("how many") ||
    normalized.includes("how much")
  );
}

function isChecklistLikeSentence(sentence: string): boolean {
  const normalized = normalizeForRelevance(sentence);
  return (
    normalized.includes("checklist") ||
    normalized.includes("bao gom") ||
    normalized.includes(" gom ") ||
    /[:;,-]/.test(sentence)
  );
}

function isTitleOrIntroSentence(sentence: string): boolean {
  const normalized = normalizeForRelevance(sentence);
  return (
    normalized.includes("manual") ||
    normalized.includes("tai lieu nay") ||
    normalized.includes("huong dan")
  );
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
  const sentenceText = value
    .replace(/\r?\n/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  return sentenceText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function firstSentence(value: string): string {
  return splitSentences(value)[0] ?? "";
}

function selectTabularPriceAnswer(query: string, evidenceText: string): string {
  const normalizedQuery = normalizeForRelevance(query);
  if (
    !normalizedQuery.includes("gia") &&
    !normalizedQuery.includes("price") &&
    !normalizedQuery.includes("monthly")
  ) {
    return "";
  }

  const rows = parseCsvLikeRows(evidenceText);
  if (rows.length === 0) {
    return "";
  }

  const bestRow = rows
    .map((row) => ({ row, score: scoreCsvRowAgainstQuery(row, query) }))
    .sort((left, right) => right.score - left.score)[0];
  if (!bestRow || bestRow.score <= 0) {
    return "";
  }

  const price = bestRow.row.monthlyPriceVnd;
  if (!price || !/^\d+$/.test(price)) {
    return "";
  }

  const productName = bestRow.row.productName || bestRow.row.productCode;
  if (!productName) {
    return "";
  }

  return `Gói ${productName} có giá ${formatVnd(price)} mỗi tháng.`;
}

type CsvLikeProductRow = {
  productCode: string;
  productName: string;
  monthlyPriceVnd: string;
};

function parseCsvLikeRows(value: string): CsvLikeProductRow[] {
  const compact = value.replace(/\s+/g, " ").trim();
  const header = "product_code,product_name,category,monthly_price_vnd,warranty_months,note";
  const headerIndex = compact.toLowerCase().indexOf(header);
  if (headerIndex < 0) {
    return [];
  }

  const table = compact.slice(headerIndex + header.length).trim();
  if (!table) {
    return [];
  }

  return table
    .split(/\s+(?=[A-Z0-9]+(?:-[A-Z0-9]+)+,)/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split(","))
    .filter((columns) => columns.length >= 5)
    .map((columns) => ({
      productCode: columns[0]?.trim() ?? "",
      productName: columns[1]?.trim() ?? "",
      monthlyPriceVnd: columns[3]?.trim() ?? ""
    }))
    .filter(
      (row) =>
        row.productCode.length > 0 &&
        row.productName.length > 0 &&
        row.monthlyPriceVnd.length > 0
    );
}

function scoreCsvRowAgainstQuery(
  row: CsvLikeProductRow,
  query: string
): number {
  const normalizedQuery = normalizeForRelevance(query);
  const productName = normalizeForRelevance(row.productName);
  const productCode = normalizeForRelevance(row.productCode);
  if (productName && normalizedQuery.includes(productName)) {
    return 100;
  }
  if (productCode && normalizedQuery.includes(productCode)) {
    return 90;
  }

  const queryTerms = new Set(meaningfulTerms(query));
  const rowTerms = new Set(
    meaningfulTerms(`${row.productCode} ${row.productName}`)
  );
  return [...queryTerms].filter((term) => rowTerms.has(term)).length;
}

function formatVnd(value: string): string {
  return `${Number(value).toLocaleString("vi-VN")} VND`;
}
