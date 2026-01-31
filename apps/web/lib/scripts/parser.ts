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
  const parser = await getPdfParser();

  try {
    const data = await parser(buffer, {
      // Options for better screenplay extraction
      max: 0, // No limit on pages
    });

    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
      },
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to parse PDF script");
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
