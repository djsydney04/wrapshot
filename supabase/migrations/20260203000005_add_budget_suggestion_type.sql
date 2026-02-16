-- Expand AISuggestion type enum to include budget_item
ALTER TABLE "AISuggestion" DROP CONSTRAINT IF EXISTS "AISuggestion_type_check";
ALTER TABLE "AISuggestion" ADD CONSTRAINT "AISuggestion_type_check" CHECK (
  type IN ('element', 'synopsis', 'time_estimate', 'script_change', 'budget_item')
);
