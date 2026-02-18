/**
 * Robust JSON Parser for LLM responses
 *
 * Implements multiple extraction strategies and JSON repair capabilities
 * to handle inconsistent LLM output formats.
 */

export class JsonParser {
  /**
   * Extract and parse JSON from an LLM response string
   * Tries multiple strategies in order of reliability
   */
  static parse<T = unknown>(text: string): T | null {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const cleanedText = text.trim();

    // Strategy 1: Direct parse (response is pure JSON)
    const direct = this.tryDirectParse<T>(cleanedText);
    if (direct !== null) return direct;

    // Strategy 2: Extract from markdown code block
    const codeBlock = this.tryCodeBlockExtract<T>(cleanedText);
    if (codeBlock !== null) return codeBlock;

    // Strategy 3: Find JSON with bracket balancing
    const balanced = this.tryBalancedExtract<T>(cleanedText);
    if (balanced !== null) return balanced;

    // Strategy 4: Repair common issues and retry
    const repaired = this.tryRepair<T>(cleanedText);
    if (repaired !== null) return repaired;

    // Strategy 5: Last resort - aggressive extraction
    const aggressive = this.tryAggressiveExtract<T>(cleanedText);
    if (aggressive !== null) return aggressive;

    return null;
  }

  /**
   * Parse with validation - returns result with success indicator
   */
  static parseWithValidation<T>(
    text: string,
    validator?: (data: unknown) => boolean
  ): { success: true; data: T } | { success: false; error: string } {
    const result = this.parse(text);

    if (result === null) {
      return { success: false, error: 'Failed to extract valid JSON from response' };
    }

    if (validator && !validator(result)) {
      return { success: false, error: 'JSON structure does not match expected format' };
    }

    return { success: true, data: result as T };
  }

  /**
   * Strategy 1: Try direct JSON parse
   */
  private static tryDirectParse<T>(text: string): T | null {
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  /**
   * Strategy 2: Extract JSON from markdown code blocks
   */
  private static tryCodeBlockExtract<T>(text: string): T | null {
    // Match ```json ... ``` or ``` ... ```
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/i,
      /```\s*([\s\S]*?)\s*```/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const result = this.tryDirectParse<T>(match[1].trim());
        if (result !== null) return result;
      }
    }

    return null;
  }

  /**
   * Strategy 3: Find JSON by bracket balancing
   * Finds the largest balanced JSON object or array
   */
  private static tryBalancedExtract<T>(text: string): T | null {
    // Try to find object first, then array
    const objectResult = this.extractBalanced<T>(text, '{', '}');
    if (objectResult !== null) return objectResult;

    const arrayResult = this.extractBalanced<T>(text, '[', ']');
    if (arrayResult !== null) return arrayResult;

    return null;
  }

  /**
   * Extract balanced brackets from text
   */
  private static extractBalanced<T>(
    text: string,
    openChar: string,
    closeChar: string
  ): T | null {
    let depth = 0;
    let start = -1;
    let inString = false;
    let escapeNext = false;
    let bestJson: string | null = null;
    let bestLength = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === openChar) {
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0 && start !== -1) {
          const candidate = text.substring(start, i + 1);
          if (candidate.length > bestLength) {
            const parsed = this.tryDirectParse<T>(candidate);
            if (parsed !== null) {
              bestJson = candidate;
              bestLength = candidate.length;
            }
          }
          start = -1;
        }
      }
    }

    if (bestJson) {
      return this.tryDirectParse<T>(bestJson);
    }

    return null;
  }

  /**
   * Strategy 4: Repair common JSON issues
   */
  private static tryRepair<T>(text: string): T | null {
    // Extract potential JSON first
    let jsonText = text;

    // Try to find JSON-like content
    const jsonStart = text.search(/[\[{]/);
    const jsonEnd = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      jsonText = text.substring(jsonStart, jsonEnd + 1);
    }

    // Apply repairs
    let repaired = jsonText;

    // Fix trailing commas before closing brackets
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');

    // Fix single quotes to double quotes (careful with apostrophes)
    repaired = this.fixQuotes(repaired);

    // Fix unquoted keys (only match keys that aren't already quoted)
    repaired = repaired.replace(/([{,]\s*)(?!")(\w+)(\s*:)/g, '$1"$2"$3');

    // Fix missing commas between adjacent objects/arrays
    repaired = repaired.replace(/}\s*{/g, '},{');
    repaired = repaired.replace(/]\s*\[/g, '],[');

    // Remove comments (only outside of strings — simplified heuristic)
    repaired = repaired.replace(/\/\/[^\n"]*$/gm, '');
    repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');

    const result = this.tryDirectParse<T>(repaired);
    if (result !== null) return result;

    // Try with whitespace normalization (collapse runs of whitespace, preserving single spaces)
    const normalized = repaired.replace(/[\t\r]+/g, ' ').replace(/\n\s*/g, ' ').replace(/\s{2,}/g, ' ');
    return this.tryDirectParse<T>(normalized);
  }

  /**
   * Fix single quotes to double quotes while preserving apostrophes
   */
  private static fixQuotes(text: string): string {
    let result = '';
    let inDoubleQuote = false;
    let inSingleQuote = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const prevChar = i > 0 ? text[i - 1] : '';
      const nextChar = i < text.length - 1 ? text[i + 1] : '';

      if (char === '"' && prevChar !== '\\') {
        inDoubleQuote = !inDoubleQuote;
        result += char;
      } else if (char === "'" && !inDoubleQuote) {
        // Check if this looks like a string delimiter or an apostrophe
        const isStringDelimiter =
          prevChar === ':' ||
          prevChar === '[' ||
          prevChar === ',' ||
          prevChar === '{' ||
          nextChar === ':' ||
          nextChar === ',' ||
          nextChar === ']' ||
          nextChar === '}' ||
          /\s/.test(prevChar);

        if (isStringDelimiter && !inSingleQuote) {
          result += '"';
          inSingleQuote = true;
        } else if (inSingleQuote && isStringDelimiter) {
          result += '"';
          inSingleQuote = false;
        } else {
          result += char; // Keep as apostrophe
        }
      } else {
        result += char;
      }
    }

    return result;
  }

  /**
   * Strategy 5: Aggressive extraction - try to salvage partial JSON
   */
  private static tryAggressiveExtract<T>(text: string): T | null {
    // Look for array-like patterns
    const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      const result = this.tryRepair<T>(arrayMatch[0]);
      if (result !== null) return result;
    }

    // Look for object patterns
    const objectMatch = text.match(/\{\s*"[\s\S]*"\s*:\s*[\s\S]*\}/);
    if (objectMatch) {
      const result = this.tryRepair<T>(objectMatch[0]);
      if (result !== null) return result;
    }

    return null;
  }

  /**
   * Validate that a value is an array
   */
  static isArray<T>(value: unknown): value is T[] {
    return Array.isArray(value);
  }

  /**
   * Validate that a value is an object (not null, not array)
   */
  static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Safely get a property from an object
   */
  static get<T>(obj: unknown, path: string, defaultValue: T): T {
    if (!this.isObject(obj)) return defaultValue;

    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (!this.isObject(current)) return defaultValue;
      current = (current as Record<string, unknown>)[key];
      if (current === undefined) return defaultValue;
    }

    return current as T;
  }
}
