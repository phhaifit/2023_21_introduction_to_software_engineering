export type KnowledgeDocumentTextChunk = {
  chunkIndex: number;
  contentText: string;
  characterCount: number;
  tokenCount: number;
};

export type KnowledgeDocumentTextChunkerOptions = {
  maxCharactersPerChunk?: number;
};

const DEFAULT_MAX_CHARACTERS_PER_CHUNK = 1_200;
const MIN_MAX_CHARACTERS_PER_CHUNK = 20;

export function chunkKnowledgeDocumentText(
  text: string,
  options: KnowledgeDocumentTextChunkerOptions = {}
): KnowledgeDocumentTextChunk[] {
  const maxCharactersPerChunk = normalizeMaxCharacters(
    options.maxCharactersPerChunk
  );
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxCharactersPerChunk) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongParagraph(paragraph, maxCharactersPerChunk));
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxCharactersPerChunk) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((contentText, chunkIndex) => ({
    chunkIndex,
    contentText,
    characterCount: contentText.length,
    tokenCount: estimateTokenCount(contentText)
  }));
}

function splitLongParagraph(
  paragraph: string,
  maxCharactersPerChunk: number
): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxCharactersPerChunk) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongWord(word, maxCharactersPerChunk));
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharactersPerChunk) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = word;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function splitLongWord(word: string, maxCharactersPerChunk: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < word.length; index += maxCharactersPerChunk) {
    chunks.push(word.slice(index, index + maxCharactersPerChunk));
  }
  return chunks;
}

function normalizeMaxCharacters(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_MAX_CHARACTERS_PER_CHUNK;
  }

  return Math.max(MIN_MAX_CHARACTERS_PER_CHUNK, Math.floor(value));
}

function estimateTokenCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
