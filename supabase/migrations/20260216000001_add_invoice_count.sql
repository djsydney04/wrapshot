-- Migration: Add invoice count tracking
-- Tracks the number of successful payments/invoices for display in billing UI

-- Add invoiceCount column to Subscription table
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "invoiceCount" INTEGER NOT NULL DEFAULT 0;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_subscription_invoice_count ON "Subscription"("invoiceCount");

-- Comment for documentation
COMMENT ON COLUMN "Subscription"."invoiceCount" IS 'Number of successful invoice payments from Stripe';
