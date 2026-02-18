/**
 * Script parser utilities for extracting text from PDF and Fountain files
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
  // Simple page count estimation (55 lines per page for screenplays)
  const lines = text.split("\n");
  const pageCount = Math.ceil(lines.length / 55);

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

/**
 * Detect script format and parse accordingly
 */
export async function parseScript(
  buffer: Buffer,
  filename: string
): Promise<ParsedScriptResult> {
  const ext = filename.toLowerCase().split(".").pop();

  switch (ext) {
    case "pdf":
      return parsePdfScript(buffer);
    case "fountain":
    case "txt":
      return parseFountainScript(buffer.toString("utf-8"));
    default:
      throw new Error(`Unsupported script format: ${ext}`);
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
