/**
 * Tool system type definitions for the agentic assistant.
 */

export type ToolTier = "read" | "mutate" | "destructive";

export interface ToolContext {
  projectId: string;
  userId: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface VerificationResult {
  verified: boolean;
  expected: string;
  actual: string;
  discrepancies: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  tier: ToolTier;
  parameters: Record<string, unknown>; // JSON Schema
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
  verify?: (
    args: Record<string, unknown>,
    result: ToolResult,
    ctx: ToolContext
  ) => Promise<VerificationResult>;
}

export interface PlannedAction {
  toolName: string;
  args: Record<string, unknown>;
  tier: ToolTier;
  description: string;
}

export interface ConfirmationRequest {
  confirmationId: string;
  actions: PlannedAction[];
}

export interface ExecutionResultItem {
  toolName: string;
  args: Record<string, unknown>;
  result: ToolResult;
  verification?: VerificationResult;
}

export interface AgentMessageMetadata {
  type:
    | "tool_calls_auto"
    | "tool_confirmation_request"
    | "tool_execution_result"
    | "confirmation_declined";
  confirmationId?: string;
  actions?: PlannedAction[];
  results?: ExecutionResultItem[];
  toolCallsRaw?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
}
