-- =============================================
-- FinanceOps: Budget & Expense Management
-- =============================================

-- Budget Status Enum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED');

-- Transaction/Expense Receipt Status Enum
CREATE TYPE "ReceiptStatus" AS ENUM ('MISSING', 'PENDING', 'APPROVED', 'REJECTED');

-- Budget Units Enum (for line item calculations)
CREATE TYPE "BudgetUnits" AS ENUM ('DAYS', 'WEEKS', 'FLAT', 'HOURS', 'EACH');

-- =============================================
-- Budgets Table
-- =============================================
CREATE TABLE "Budget" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "versionName" TEXT NOT NULL DEFAULT 'Initial',
  "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',

  -- Totals (calculated from line items)
  "totalEstimated" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalActual" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalCommitted" DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Contingency
  "contingencyPercent" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  "contingencyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Metadata
  "createdBy" UUID NOT NULL REFERENCES auth.users("id"),
  "approvedBy" UUID REFERENCES auth.users("id"),
  "approvedAt" TIMESTAMPTZ,
  "lockedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique version numbers per project
  UNIQUE("projectId", "version")
);

-- =============================================
-- Budget Categories Table
-- =============================================
CREATE TABLE "BudgetCategory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "budgetId" UUID NOT NULL REFERENCES "Budget"("id") ON DELETE CASCADE,
  "code" TEXT NOT NULL, -- e.g., "2000", "2300"
  "name" TEXT NOT NULL, -- e.g., "Production", "Camera"
  "parentCategoryId" UUID REFERENCES "BudgetCategory"("id") ON DELETE CASCADE,

  -- Subtotals (calculated from line items)
  "subtotalEstimated" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "subtotalActual" DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Display order
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Budget Line Items Table
-- =============================================
CREATE TABLE "BudgetLineItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "categoryId" UUID NOT NULL REFERENCES "BudgetCategory"("id") ON DELETE CASCADE,
  "accountCode" TEXT NOT NULL, -- e.g., "2301" for Camera Crew
  "description" TEXT NOT NULL, -- e.g., "Director of Photography"

  -- Calculation fields
  "units" "BudgetUnits" NOT NULL DEFAULT 'DAYS',
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0, -- quantity × rate

  -- Fringe benefits (for labor)
  "fringePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "fringeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, -- subtotal × fringePercent

  -- Totals
  "estimatedTotal" DECIMAL(12,2) NOT NULL DEFAULT 0, -- subtotal + fringeAmount
  "actualCost" DECIMAL(12,2) NOT NULL DEFAULT 0, -- sum of transactions
  "committedCost" DECIMAL(12,2) NOT NULL DEFAULT 0, -- POs issued but not paid
  "variance" DECIMAL(12,2) NOT NULL DEFAULT 0, -- actualCost - estimatedTotal

  -- Schedule integration
  "linkedScheduleItems" JSONB DEFAULT '[]', -- array of castMember/crew IDs
  "isScheduleSynced" BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Transactions (Expenses) Table
-- =============================================
CREATE TABLE "Transaction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "budgetId" UUID NOT NULL REFERENCES "Budget"("id") ON DELETE CASCADE,
  "lineItemId" UUID REFERENCES "BudgetLineItem"("id") ON DELETE SET NULL,

  -- Transaction details
  "date" DATE NOT NULL,
  "vendor" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL, -- from budget categories for quick filtering

  -- Receipt tracking
  "receiptUrl" TEXT, -- uploaded receipt image/PDF
  "receiptStatus" "ReceiptStatus" NOT NULL DEFAULT 'MISSING',

  -- Metadata
  "enteredBy" UUID NOT NULL REFERENCES auth.users("id"),
  "approvedBy" UUID REFERENCES auth.users("id"),
  "approvedAt" TIMESTAMPTZ,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Budget Templates Table
-- =============================================
CREATE TABLE "BudgetTemplate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "budgetRange" TEXT, -- e.g., "$500K - $2M"
  "templateData" JSONB NOT NULL, -- full budget structure (categories + line items)
  "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" UUID REFERENCES auth.users("id"),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- Budget Alerts Table (for tracking warnings)
-- =============================================
CREATE TABLE "BudgetAlert" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "budgetId" UUID NOT NULL REFERENCES "Budget"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL, -- 'WARNING', 'ERROR', 'INFO'
  "message" TEXT NOT NULL,
  "department" TEXT,
  "categoryId" UUID REFERENCES "BudgetCategory"("id") ON DELETE CASCADE,
  "actionRequired" BOOLEAN NOT NULL DEFAULT false,
  "isDismissed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "dismissedAt" TIMESTAMPTZ,
  "dismissedBy" UUID REFERENCES auth.users("id")
);

-- =============================================
-- Indexes for Performance
-- =============================================
CREATE INDEX "Budget_projectId_idx" ON "Budget"("projectId");
CREATE INDEX "Budget_status_idx" ON "Budget"("status");
CREATE INDEX "Budget_createdBy_idx" ON "Budget"("createdBy");

CREATE INDEX "BudgetCategory_budgetId_idx" ON "BudgetCategory"("budgetId");
CREATE INDEX "BudgetCategory_parentCategoryId_idx" ON "BudgetCategory"("parentCategoryId");
CREATE INDEX "BudgetCategory_sortOrder_idx" ON "BudgetCategory"("budgetId", "sortOrder");

CREATE INDEX "BudgetLineItem_categoryId_idx" ON "BudgetLineItem"("categoryId");
CREATE INDEX "BudgetLineItem_sortOrder_idx" ON "BudgetLineItem"("categoryId", "sortOrder");

CREATE INDEX "Transaction_budgetId_idx" ON "Transaction"("budgetId");
CREATE INDEX "Transaction_lineItemId_idx" ON "Transaction"("lineItemId");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_vendor_idx" ON "Transaction"("vendor");
CREATE INDEX "Transaction_receiptStatus_idx" ON "Transaction"("receiptStatus");
CREATE INDEX "Transaction_enteredBy_idx" ON "Transaction"("enteredBy");

CREATE INDEX "BudgetTemplate_isSystemTemplate_idx" ON "BudgetTemplate"("isSystemTemplate");
CREATE INDEX "BudgetTemplate_createdBy_idx" ON "BudgetTemplate"("createdBy");

CREATE INDEX "BudgetAlert_budgetId_idx" ON "BudgetAlert"("budgetId");
CREATE INDEX "BudgetAlert_isDismissed_idx" ON "BudgetAlert"("budgetId", "isDismissed");

-- =============================================
-- Auto-update Timestamp Triggers
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_budget_updated_at BEFORE UPDATE ON "Budget"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_category_updated_at BEFORE UPDATE ON "BudgetCategory"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_line_item_updated_at BEFORE UPDATE ON "BudgetLineItem"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_updated_at BEFORE UPDATE ON "Transaction"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_template_updated_at BEFORE UPDATE ON "BudgetTemplate"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Auto-calculate Line Item Totals
-- =============================================
CREATE OR REPLACE FUNCTION calculate_line_item_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate subtotal
  NEW."subtotal" = NEW."quantity" * NEW."rate";

  -- Calculate fringe amount
  NEW."fringeAmount" = NEW."subtotal" * (NEW."fringePercent" / 100);

  -- Calculate estimated total
  NEW."estimatedTotal" = NEW."subtotal" + NEW."fringeAmount";

  -- Calculate variance
  NEW."variance" = NEW."actualCost" - NEW."estimatedTotal";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_line_item_totals_trigger
  BEFORE INSERT OR UPDATE ON "BudgetLineItem"
  FOR EACH ROW EXECUTE FUNCTION calculate_line_item_totals();

-- =============================================
-- Update Category Subtotals When Line Items Change
-- =============================================
CREATE OR REPLACE FUNCTION update_category_subtotals()
RETURNS TRIGGER AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Get the category ID (handle both INSERT/UPDATE and DELETE)
  IF TG_OP = 'DELETE' THEN
    v_category_id := OLD."categoryId";
  ELSE
    v_category_id := NEW."categoryId";
  END IF;

  -- Update category subtotals
  UPDATE "BudgetCategory"
  SET
    "subtotalEstimated" = (
      SELECT COALESCE(SUM("estimatedTotal"), 0)
      FROM "BudgetLineItem"
      WHERE "categoryId" = v_category_id
    ),
    "subtotalActual" = (
      SELECT COALESCE(SUM("actualCost"), 0)
      FROM "BudgetLineItem"
      WHERE "categoryId" = v_category_id
    )
  WHERE "id" = v_category_id;

  -- Also update parent category if exists
  UPDATE "BudgetCategory" parent
  SET
    "subtotalEstimated" = (
      SELECT COALESCE(SUM("subtotalEstimated"), 0)
      FROM "BudgetCategory"
      WHERE "parentCategoryId" = parent."id"
    ),
    "subtotalActual" = (
      SELECT COALESCE(SUM("subtotalActual"), 0)
      FROM "BudgetCategory"
      WHERE "parentCategoryId" = parent."id"
    )
  WHERE parent."id" = (
    SELECT "parentCategoryId"
    FROM "BudgetCategory"
    WHERE "id" = v_category_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_category_subtotals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "BudgetLineItem"
  FOR EACH ROW EXECUTE FUNCTION update_category_subtotals();

-- =============================================
-- Update Budget Totals When Categories Change
-- =============================================
CREATE OR REPLACE FUNCTION update_budget_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_budget_id UUID;
BEGIN
  -- Get the budget ID (handle both INSERT/UPDATE and DELETE)
  IF TG_OP = 'DELETE' THEN
    v_budget_id := OLD."budgetId";
  ELSE
    v_budget_id := NEW."budgetId";
  END IF;

  -- Update budget totals (only from top-level categories)
  UPDATE "Budget"
  SET
    "totalEstimated" = (
      SELECT COALESCE(SUM("subtotalEstimated"), 0)
      FROM "BudgetCategory"
      WHERE "budgetId" = v_budget_id AND "parentCategoryId" IS NULL
    ),
    "totalActual" = (
      SELECT COALESCE(SUM("subtotalActual"), 0)
      FROM "BudgetCategory"
      WHERE "budgetId" = v_budget_id AND "parentCategoryId" IS NULL
    ),
    "contingencyAmount" = "totalEstimated" * ("contingencyPercent" / 100)
  WHERE "id" = v_budget_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_budget_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "BudgetCategory"
  FOR EACH ROW EXECUTE FUNCTION update_budget_totals();

-- =============================================
-- Update Line Item Actual Cost When Transactions Change
-- =============================================
CREATE OR REPLACE FUNCTION update_line_item_actual_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_line_item_id UUID;
BEGIN
  -- Get the line item ID (handle both INSERT/UPDATE and DELETE)
  IF TG_OP = 'DELETE' THEN
    v_line_item_id := OLD."lineItemId";
  ELSE
    v_line_item_id := NEW."lineItemId";
  END IF;

  -- Only update if line item is linked
  IF v_line_item_id IS NOT NULL THEN
    UPDATE "BudgetLineItem"
    SET "actualCost" = (
      SELECT COALESCE(SUM("amount"), 0)
      FROM "Transaction"
      WHERE "lineItemId" = v_line_item_id
    )
    WHERE "id" = v_line_item_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_line_item_actual_cost_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "Transaction"
  FOR EACH ROW EXECUTE FUNCTION update_line_item_actual_cost();

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS
ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetAlert" ENABLE ROW LEVEL SECURITY;

-- Budget Policies (must be project member)
CREATE POLICY "Users can view budgets for their projects"
  ON "Budget" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "ProjectMember"."projectId" = "Budget"."projectId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project admins can insert budgets"
  ON "Budget" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "ProjectMember"."projectId" = "Budget"."projectId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" IN ('ADMIN', 'COORDINATOR')
    )
  );

CREATE POLICY "Project admins can update budgets"
  ON "Budget" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "ProjectMember"."projectId" = "Budget"."projectId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" IN ('ADMIN', 'COORDINATOR')
    )
  );

CREATE POLICY "Project admins can delete budgets"
  ON "Budget" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "ProjectMember"
      WHERE "ProjectMember"."projectId" = "Budget"."projectId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" = 'ADMIN'
    )
  );

-- Budget Category Policies (inherit from budget)
CREATE POLICY "Users can view categories for their budgets"
  ON "BudgetCategory" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Budget"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "Budget"."id" = "BudgetCategory"."budgetId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project admins can manage categories"
  ON "BudgetCategory" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Budget"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "Budget"."id" = "BudgetCategory"."budgetId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Budget Line Item Policies (inherit from budget)
CREATE POLICY "Users can view line items for their budgets"
  ON "BudgetLineItem" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "BudgetCategory"
      JOIN "Budget" ON "Budget"."id" = "BudgetCategory"."budgetId"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "BudgetCategory"."id" = "BudgetLineItem"."categoryId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project admins can manage line items"
  ON "BudgetLineItem" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "BudgetCategory"
      JOIN "Budget" ON "Budget"."id" = "BudgetCategory"."budgetId"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "BudgetCategory"."id" = "BudgetLineItem"."categoryId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" IN ('ADMIN', 'COORDINATOR')
    )
  );

-- Transaction Policies (inherit from budget)
CREATE POLICY "Users can view transactions for their budgets"
  ON "Transaction" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Budget"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "Budget"."id" = "Transaction"."budgetId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project members can insert transactions"
  ON "Transaction" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Budget"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "Budget"."id" = "Transaction"."budgetId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" IN ('ADMIN', 'COORDINATOR', 'DEPARTMENT_HEAD')
    )
  );

CREATE POLICY "Transaction creators and admins can update transactions"
  ON "Transaction" FOR UPDATE
  USING (
    "enteredBy" = auth.uid() OR
    EXISTS (
      SELECT 1 FROM "Budget"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "Budget"."id" = "Transaction"."budgetId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" IN ('ADMIN', 'COORDINATOR')
    )
  );

CREATE POLICY "Transaction creators and admins can delete transactions"
  ON "Transaction" FOR DELETE
  USING (
    "enteredBy" = auth.uid() OR
    EXISTS (
      SELECT 1 FROM "Budget"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "Budget"."id" = "Transaction"."budgetId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" = 'ADMIN'
    )
  );

-- Budget Template Policies
CREATE POLICY "Users can view all templates"
  ON "BudgetTemplate" FOR SELECT
  USING (true); -- Anyone can view templates

CREATE POLICY "Users can create their own templates"
  ON "BudgetTemplate" FOR INSERT
  WITH CHECK (
    "createdBy" = auth.uid() AND "isSystemTemplate" = false
  );

CREATE POLICY "Users can update their own templates"
  ON "BudgetTemplate" FOR UPDATE
  USING ("createdBy" = auth.uid() AND "isSystemTemplate" = false);

CREATE POLICY "Users can delete their own templates"
  ON "BudgetTemplate" FOR DELETE
  USING ("createdBy" = auth.uid() AND "isSystemTemplate" = false);

-- Budget Alert Policies (inherit from budget)
CREATE POLICY "Users can view alerts for their budgets"
  ON "BudgetAlert" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Budget"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "Budget"."id" = "BudgetAlert"."budgetId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
    )
  );

CREATE POLICY "Project admins can manage alerts"
  ON "BudgetAlert" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Budget"
      JOIN "ProjectMember" ON "ProjectMember"."projectId" = "Budget"."projectId"
      WHERE "Budget"."id" = "BudgetAlert"."budgetId"
      AND "ProjectMember"."userId" = auth.uid()::TEXT
      AND "ProjectMember"."role" IN ('ADMIN', 'COORDINATOR')
    )
  );

-- =============================================
-- Helper Functions
-- =============================================

-- Get budget health summary
CREATE OR REPLACE FUNCTION get_budget_health(p_budget_id UUID)
RETURNS TABLE (
  total_estimated DECIMAL,
  total_actual DECIMAL,
  total_committed DECIMAL,
  remaining DECIMAL,
  percent_spent DECIMAL,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b."totalEstimated",
    b."totalActual",
    b."totalCommitted",
    b."totalEstimated" - b."totalActual" as remaining,
    CASE
      WHEN b."totalEstimated" > 0 THEN (b."totalActual" / b."totalEstimated" * 100)
      ELSE 0
    END as percent_spent,
    CASE
      WHEN b."totalActual" > b."totalEstimated" THEN 'OVER_BUDGET'
      WHEN b."totalActual" >= b."totalEstimated" * 0.8 THEN 'WARNING'
      ELSE 'ON_TRACK'
    END as status
  FROM "Budget" b
  WHERE b."id" = p_budget_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate burn rate (average daily spend)
CREATE OR REPLACE FUNCTION get_burn_rate(p_budget_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_burn_rate DECIMAL;
  v_start_date DATE;
  v_days_elapsed INTEGER;
  v_total_actual DECIMAL;
BEGIN
  -- Get project start date and total actual spend
  SELECT p."startDate", b."totalActual"
  INTO v_start_date, v_total_actual
  FROM "Budget" b
  JOIN "Project" p ON p."id" = b."projectId"
  WHERE b."id" = p_budget_id;

  -- Calculate days elapsed
  v_days_elapsed := EXTRACT(DAY FROM (NOW() - v_start_date));

  -- Avoid division by zero
  IF v_days_elapsed <= 0 THEN
    RETURN 0;
  END IF;

  -- Calculate burn rate
  v_burn_rate := v_total_actual / v_days_elapsed;

  RETURN v_burn_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Insert System Templates
-- =============================================

-- Indie Feature Template ($1M - $5M)
INSERT INTO "BudgetTemplate" ("id", "name", "description", "budgetRange", "isSystemTemplate", "templateData")
VALUES (
  gen_random_uuid(),
  'Indie Feature',
  'Template for independent feature films with typical crew sizes and rates',
  '$1M - $5M',
  true,
  '{
    "categories": [
      {
        "code": "1000",
        "name": "Above-the-Line",
        "subcategories": [
          {"code": "1100", "name": "Story & Rights"},
          {"code": "1200", "name": "Producers"},
          {"code": "1300", "name": "Director"},
          {"code": "1400", "name": "Cast"}
        ]
      },
      {
        "code": "2000",
        "name": "Production",
        "subcategories": [
          {"code": "2100", "name": "Production Staff"},
          {"code": "2200", "name": "Art Department"},
          {"code": "2300", "name": "Camera"},
          {"code": "2400", "name": "Sound"},
          {"code": "2500", "name": "Grip & Electric"},
          {"code": "2600", "name": "Wardrobe"},
          {"code": "2700", "name": "Hair & Makeup"},
          {"code": "2800", "name": "Locations"},
          {"code": "2900", "name": "Transportation"}
        ]
      },
      {
        "code": "3000",
        "name": "Post-Production",
        "subcategories": [
          {"code": "3100", "name": "Editing"},
          {"code": "3200", "name": "Sound Post"},
          {"code": "3300", "name": "Visual Effects"},
          {"code": "3400", "name": "Music"}
        ]
      },
      {
        "code": "4000",
        "name": "Other",
        "subcategories": [
          {"code": "4100", "name": "Insurance"},
          {"code": "4200", "name": "Legal"},
          {"code": "4300", "name": "Contingency"}
        ]
      }
    ],
    "lineItems": [
      {"accountCode": "2101", "category": "2100", "description": "Line Producer", "units": "WEEKS", "quantity": 12, "rate": 3500, "fringePercent": 25},
      {"accountCode": "2102", "category": "2100", "description": "Unit Production Manager", "units": "WEEKS", "quantity": 10, "rate": 2800, "fringePercent": 25},
      {"accountCode": "2103", "category": "2100", "description": "Production Coordinator", "units": "WEEKS", "quantity": 12, "rate": 1800, "fringePercent": 25},
      {"accountCode": "2301", "category": "2300", "description": "Director of Photography", "units": "DAYS", "quantity": 20, "rate": 800, "fringePercent": 0},
      {"accountCode": "2302", "category": "2300", "description": "Camera Operator", "units": "DAYS", "quantity": 20, "rate": 550, "fringePercent": 0},
      {"accountCode": "2303", "category": "2300", "description": "1st AC", "units": "DAYS", "quantity": 20, "rate": 450, "fringePercent": 0},
      {"accountCode": "2304", "category": "2300", "description": "2nd AC", "units": "DAYS", "quantity": 20, "rate": 350, "fringePercent": 0}
    ]
  }'::jsonb
);

-- Commercial Template ($50K - $500K)
INSERT INTO "BudgetTemplate" ("id", "name", "description", "budgetRange", "isSystemTemplate", "templateData")
VALUES (
  gen_random_uuid(),
  'Commercial',
  'Template for commercial productions with shorter schedules and higher day rates',
  '$50K - $500K',
  true,
  '{
    "categories": [
      {
        "code": "1000",
        "name": "Creative",
        "subcategories": [
          {"code": "1100", "name": "Director"},
          {"code": "1200", "name": "Producer"}
        ]
      },
      {
        "code": "2000",
        "name": "Production",
        "subcategories": [
          {"code": "2100", "name": "Production Staff"},
          {"code": "2200", "name": "Art Department"},
          {"code": "2300", "name": "Camera"},
          {"code": "2500", "name": "Grip & Electric"}
        ]
      },
      {
        "code": "3000",
        "name": "Post-Production",
        "subcategories": [
          {"code": "3100", "name": "Editing"},
          {"code": "3200", "name": "Color"},
          {"code": "3300", "name": "VFX"}
        ]
      }
    ],
    "lineItems": [
      {"accountCode": "2301", "category": "2300", "description": "Director of Photography", "units": "DAYS", "quantity": 2, "rate": 2000, "fringePercent": 0},
      {"accountCode": "2302", "category": "2300", "description": "Camera Operator", "units": "DAYS", "quantity": 2, "rate": 800, "fringePercent": 0},
      {"accountCode": "2303", "category": "2300", "description": "1st AC", "units": "DAYS", "quantity": 2, "rate": 600, "fringePercent": 0}
    ]
  }'::jsonb
);

-- Music Video Template ($20K - $100K)
INSERT INTO "BudgetTemplate" ("id", "name", "description", "budgetRange", "isSystemTemplate", "templateData")
VALUES (
  gen_random_uuid(),
  'Music Video',
  'Template for music video productions with 1-3 day shoots',
  '$20K - $100K',
  true,
  '{
    "categories": [
      {
        "code": "1000",
        "name": "Creative",
        "subcategories": [
          {"code": "1100", "name": "Director"}
        ]
      },
      {
        "code": "2000",
        "name": "Production",
        "subcategories": [
          {"code": "2200", "name": "Art Department"},
          {"code": "2300", "name": "Camera"},
          {"code": "2500", "name": "Grip & Electric"}
        ]
      },
      {
        "code": "3000",
        "name": "Post-Production",
        "subcategories": [
          {"code": "3100", "name": "Editing"},
          {"code": "3200", "name": "Color"}
        ]
      }
    ],
    "lineItems": [
      {"accountCode": "2301", "category": "2300", "description": "Director of Photography", "units": "DAYS", "quantity": 1, "rate": 1500, "fringePercent": 0},
      {"accountCode": "2302", "category": "2300", "description": "Camera Operator", "units": "DAYS", "quantity": 1, "rate": 650, "fringePercent": 0}
    ]
  }'::jsonb
);

-- =============================================
-- Comments
-- =============================================
COMMENT ON TABLE "Budget" IS 'Project budgets with version control and approval workflow';
COMMENT ON TABLE "BudgetCategory" IS 'Budget categories following film industry chart of accounts (1000s, 2000s, 3000s, 4000s)';
COMMENT ON TABLE "BudgetLineItem" IS 'Individual budget line items with cost calculations and schedule integration';
COMMENT ON TABLE "Transaction" IS 'Expense transactions with receipt tracking and approval workflow';
COMMENT ON TABLE "BudgetTemplate" IS 'Reusable budget templates for different production types';
COMMENT ON TABLE "BudgetAlert" IS 'Budget warnings and alerts for overspending or other financial issues';
