/**
 * Tool executor -- dispatches tool calls to the correct server action.
 */

import { TOOL_MAP } from "./tool-definitions";
import type { ToolContext, ToolResult, VerificationResult } from "./types";

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const tool = TOOL_MAP.get(name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  try {
    return await tool.execute(args, ctx);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Tool execution failed",
    };
  }
}

export async function verifyTool(
  name: string,
  args: Record<string, unknown>,
  result: ToolResult,
  ctx: ToolContext
): Promise<VerificationResult | null> {
  const tool = TOOL_MAP.get(name);
  if (!tool?.verify) return null;

  try {
    return await tool.verify(args, result, ctx);
  } catch (err) {
    return {
      verified: false,
      expected: "Verification to succeed",
      actual: err instanceof Error ? err.message : "Verification error",
      discrepancies: ["Verification threw an exception"],
    };
  }
}
