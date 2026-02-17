/**
 * Parser Step
 *
 * Parses the script PDF and extracts raw text content.
 */

import { parsePdfScript, normalizeScriptText } from '@/lib/scripts/parser';
import { createClient } from '@/lib/supabase/server';
import type { AgentContext, AgentStepResult } from '../types';
import type { ProgressTracker } from '../orchestrator/progress-tracker';

export async function executeParserStep(
  context: AgentContext,
  tracker: ProgressTracker
): Promise<AgentStepResult> {
  try {
    await tracker.updateProgress(0, 3, 'Fetching script file');

    // Get script URL from database
    const supabase = await createClient();
    const { data: script, error: scriptError } = await supabase
      .from('Script')
      .select('id, fileUrl, projectId')
      .eq('id', context.scriptId)
      .single();

    if (scriptError || !script?.fileUrl) {
      return {
        success: false,
        error: 'Script not found or missing file URL',
        errorDetails: { scriptId: context.scriptId, dbError: scriptError?.message },
      };
    }

    context.scriptUrl = script.fileUrl;

    await tracker.updateProgress(1, 3, 'Downloading PDF');

    // Fetch the PDF
    const pdfResponse = await fetch(script.fileUrl);
    if (!pdfResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`,
        errorDetails: { url: script.fileUrl, status: pdfResponse.status },
      };
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    await tracker.updateProgress(2, 3, 'Parsing PDF content');

    // Parse the PDF
    const parsed = await parsePdfScript(pdfBuffer);
    const normalizedText = normalizeScriptText(parsed.text);

    if (!normalizedText || normalizedText.length < 100) {
      return {
        success: false,
        error: 'Script appears to be empty or too short',
        errorDetails: { extractedLength: normalizedText.length },
      };
    }

    // Store in context
    context.scriptText = normalizedText;
    context.totalPages = parsed.pageCount;

    await tracker.updateProgress(3, 3, 'Parsing complete');

    console.log(`[ParserStep] Parsed ${parsed.pageCount} pages, ${normalizedText.length} characters`);

    return {
      success: true,
      data: {
        pageCount: parsed.pageCount,
        characterCount: normalizedText.length,
        metadata: parsed.metadata,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ParserStep] Error:', errorMessage);

    return {
      success: false,
      error: `Failed to parse script: ${errorMessage}`,
      errorDetails: {
        scriptId: context.scriptId,
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}
