/**
 * Script parser utilities for extracting text from PDF, Fountain, and FDX files
 */

// Type for pdf-parse since it may not have types installed
interface PdfParseResult {
  text: string;
  numpages: number;
  info?: {
    Title?: string;
    Author?: string;
  };
}

type PdfParser = (buffer: Buffer, options?: { max?: number }) => Promise<PdfParseResult>;

// Dynamic require for pdf-parse (only available server-side)
async function getPdfParser(): Promise<PdfParser> {
  // Use dynamic require to avoid bundling issues
  const pdfParse = require("pdf-parse") as PdfParser;
  return pdfParse;
}

export interface ParsedScriptResult {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
  };
}

const SCREENPLAY_LINES_PER_PAGE = 55;

/**
 * Parse a PDF file and extract text content
 */
export async function parsePdfScript(buffer: Buffer): Promise<ParsedScriptResult> {
  let parser: PdfParser;
  try {
    parser = await getPdfParser();
  } catch (error) {
    throw new Error(
      `PDF parser module not available: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Suppress noisy "font private use area" warnings from pdf-parse's bundled PDF.js
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("font private use area")) return;
    originalWarn.apply(console, args);
  };

  try {
    const data = await parser(buffer, {
      // Options for better screenplay extraction
      max: 0, // No limit on pages
    });

    return {
      text: data.text || "",
      pageCount: data.numpages || 0,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
      },
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse PDF script: ${detail}`);
  } finally {
    console.warn = originalWarn;
  }
}

/**
 * Parse a Fountain-format script
 * Fountain is a plain text markup language for screenplays
 */
export function parseFountainScript(text: string): ParsedScriptResult {
  const pageCount = estimateScriptPageCount(text);

  // Extract title from Fountain title page if present
  let title: string | undefined;
  let author: string | undefined;

  const titleMatch = text.match(/^Title:\s*(.+)$/m);
  if (titleMatch) title = titleMatch[1].trim();

  const authorMatch = text.match(/^(?:Author|Credit):\s*(.+)$/m);
  if (authorMatch) author = authorMatch[1].trim();

  return {
    text,
    pageCount,
    metadata: { title, author },
  };
}

function decodeXmlEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " ",
  };

  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entity, token: string) => {
    const isValidCodePoint = (value: number) =>
      Number.isInteger(value) && value >= 0 && value <= 0x10ffff;

    if (token.startsWith("#x")) {
      const codePoint = parseInt(token.slice(2), 16);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    if (token.startsWith("#")) {
      const codePoint = parseInt(token.slice(1), 10);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    return namedEntities[token] ?? entity;
  });
}

function extractFdxParagraphText(paragraphXml: string): string {
  const textMatches = [...paragraphXml.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/gi)];
  if (textMatches.length === 0) {
    return "";
  }

  const concatenated = textMatches.map((match) => decodeXmlEntities(match[1])).join("");
  return concatenated.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function extractFdxMetadata(xml: string): { title?: string; author?: string } {
  const titleMatch = xml.match(/<Paragraph\b[^>]*Type="Title"[^>]*>([\s\S]*?)<\/Paragraph>/i);
  const authorMatch = xml.match(
    /<Paragraph\b[^>]*Type="(?:Author|Credit)"[^>]*>([\s\S]*?)<\/Paragraph>/i
  );

  const title = titleMatch ? extractFdxParagraphText(titleMatch[1]) : undefined;
  const author = authorMatch ? extractFdxParagraphText(authorMatch[1]) : undefined;
  return { title: title || undefined, author: author || undefined };
}

function estimateScriptPageCount(text: string): number {
  const lines = text.split("\n");
  return Math.max(1, Math.ceil(lines.length / SCREENPLAY_LINES_PER_PAGE));
}

/**
 * Parse a Final Draft (.fdx) script file.
 * FDX is XML where script lines are stored in Paragraph/Text nodes.
 */
export function parseFdxScript(xml: string): ParsedScriptResult {
  const paragraphMatches = [...xml.matchAll(/<Paragraph\b[^>]*>([\s\S]*?)<\/Paragraph>/gi)];
  const lines = paragraphMatches
    .map((match) => extractFdxParagraphText(match[1]))
    .filter((line) => line.length > 0);

  const text =
    lines.length > 0
      ? lines.join("\n")
      : decodeXmlEntities(xml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

  return {
    text,
    pageCount: estimateScriptPageCount(text),
    metadata: extractFdxMetadata(xml),
  };
}

function resolveScriptExtension(filenameOrUrl: string): string | null {
  const source = filenameOrUrl.trim();
  if (!source) {
    return null;
  }

  let normalizedPath = source;
  try {
    normalizedPath = new URL(source).pathname;
  } catch {
    // Non-URL input: keep original value.
  }

  const withoutQueryOrHash = normalizedPath.split("?")[0].split("#")[0];
  const basename = withoutQueryOrHash.split("/").pop() || withoutQueryOrHash;
  const extension = basename.includes(".") ? basename.split(".").pop() : null;
  return extension ? extension.toLowerCase() : null;
}

/**
 * Detect script format and parse accordingly
 */
export async function parseScript(
  buffer: Buffer,
  filenameOrUrl: string
): Promise<ParsedScriptResult> {
  const ext = resolveScriptExtension(filenameOrUrl);

  switch (ext) {
    case "pdf":
      return parsePdfScript(buffer);
    case "fdx":
      return parseFdxScript(buffer.toString("utf-8"));
    case "fountain":
    case "txt":
      return parseFountainScript(buffer.toString("utf-8"));
    default:
      throw new Error(`Unsupported script format: ${ext ?? "unknown"}`);
  }
}

/**
 * Clean and normalize script text for AI processing
 */
export function normalizeScriptText(text: string): string {
  return text
    // Remove null bytes and problematic control characters (breaks PostgreSQL JSONB)
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, "")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove excessive whitespace
    .replace(/\n{4,}/g, "\n\n\n")
    // Trim each line
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Sanitize any value for safe JSONB storage in PostgreSQL.
 * Removes \u0000 null bytes which PostgreSQL rejects.
 */
export function sanitizeForJsonb<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/\u0000/g, "") as T;
  }
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map(sanitizeForJsonb) as T;
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeForJsonb(v)])
    ) as T;
  }
  return value;
}

/**
 * Estimate page eighths from text length
 * Based on standard screenplay formatting
 */
export function estimatePageEighths(text: string): number {
  // Average screenplay has ~55 lines per page, ~60 chars per line
  const charsPerPage = 55 * 60; // ~3300 chars
  const charsPerEighth = charsPerPage / 8;

  const eighths = Math.ceil(text.length / charsPerEighth);
  return Math.min(Math.max(eighths, 1), 64); // Cap at 8 pages (64 eighths)
}
