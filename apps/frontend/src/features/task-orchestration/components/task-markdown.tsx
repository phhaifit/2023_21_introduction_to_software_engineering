import type { ReactNode } from "react";

interface TaskMarkdownProps {
  text: string;
  className?: string;
  "aria-label"?: string;
  "aria-live"?: "off" | "polite" | "assertive";
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code"; text: string };

const unorderedListPattern = /^\s*[-*]\s+(.+)$/;
const orderedListPattern = /^\s*\d+[.)]\s+(.+)$/;

export function TaskMarkdown({
  text,
  className,
  "aria-label": ariaLabel,
  "aria-live": ariaLive
}: TaskMarkdownProps) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <div className={className} aria-label={ariaLabel} aria-live={ariaLive}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

function parseMarkdownBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraph.join("\n").trim() });
    paragraph = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", text: code.join("\n") });
        code = null;
      } else {
        flushParagraph();
        code = [];
      }
      continue;
    }

    if (code) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim()
      });
      continue;
    }

    const unorderedMatch = unorderedListPattern.exec(line);
    if (unorderedMatch) {
      flushParagraph();
      const previous = blocks.at(-1);
      if (previous?.type === "unordered-list") {
        previous.items.push(unorderedMatch[1].trim());
      } else {
        blocks.push({ type: "unordered-list", items: [unorderedMatch[1].trim()] });
      }
      continue;
    }

    const orderedMatch = orderedListPattern.exec(line);
    if (orderedMatch) {
      flushParagraph();
      const previous = blocks.at(-1);
      if (previous?.type === "ordered-list") {
        previous.items.push(orderedMatch[1].trim());
      } else {
        blocks.push({ type: "ordered-list", items: [orderedMatch[1].trim()] });
      }
      continue;
    }

    paragraph.push(line);
  }

  if (code) {
    blocks.push({ type: "code", text: code.join("\n") });
  }
  flushParagraph();

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text: "" }];
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const children = renderInlineMarkdown(block.text);
      if (block.level === 1) return <h3 key={index}>{children}</h3>;
      if (block.level === 2) return <h4 key={index}>{children}</h4>;
      return <h5 key={index}>{children}</h5>;
    }
    case "unordered-list":
      return (
        <ul key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
    case "ordered-list":
      return (
        <ol key={index}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
    case "code":
      return (
        <pre key={index}>
          <code>{block.text}</code>
        </pre>
      );
    case "paragraph":
      return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
  }
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderTextWithBreaks(text.slice(lastIndex, match.index), nodes.length));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={nodes.length}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={nodes.length}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link?.[2] ?? "";
      if (isSafeHref(href)) {
        nodes.push(
          <a key={nodes.length} href={href} target="_blank" rel="noreferrer">
            {link?.[1]}
          </a>
        );
      } else {
        nodes.push(link?.[1] ?? token);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderTextWithBreaks(text.slice(lastIndex), nodes.length));
  }

  return nodes;
}

function renderTextWithBreaks(text: string, keyPrefix: number): ReactNode[] {
  return text.split("\n").flatMap((part, index, parts) => {
    const nodes: ReactNode[] = [part];
    if (index < parts.length - 1) {
      nodes.push(<br key={`${keyPrefix}-${index}`} />);
    }
    return nodes;
  });
}

function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|\/)/i.test(href);
}
