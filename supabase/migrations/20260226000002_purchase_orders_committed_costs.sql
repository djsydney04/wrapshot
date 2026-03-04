-- Purchase orders + committed cost tracking for enhanced finance flow

DO $$ BEGIN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM (
    'DRAFT',
    'APPROVED',
    'SENT',
    'PARTIAL',
    'CLOSED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "budgetId" UUID NOT NULL REFERENCES "Budget"("id") ON DELETE CASCADE,
  "poNumber" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "vendor" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "issueDate" DATE NOT NULL DEFAULT CURRENT_DATE,
  "expectedDate" DATE,
  "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "committedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdBy" UUID NOT NULL REFERENCES auth.users("id"),
  "approvedBy" UUID REFERENCES auth.users("id"),
  "approvedAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  "cancelledAt" TIMESTAMPTZ,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("budgetId", "poNumber")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrderLine" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchaseOrderId" UUID NOT NULL REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE,
  "lineItemId" UUID REFERENCES "BudgetLineItem"("id") ON DELETE SET NULL,
  "categoryId" UUID REFERENCES "BudgetCategory"("id") ON DELETE SET NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1 CHECK ("quantity" >= 0),
  "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK ("unitCost" >= 0),
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "PurchaseOrder_budgetId_idx"
  ON "PurchaseOrder" ("budgetId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_status_idx"
  ON "PurchaseOrder" ("status");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_createdBy_idx"
  ON "PurchaseOrder" ("createdBy");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_issueDate_idx"
  ON "PurchaseOrder" ("issueDate");

CREATE INDEX IF NOT EXISTS "PurchaseOrderLine_purchaseOrderId_idx"
  ON "PurchaseOrderLine" ("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "PurchaseOrderLine_lineItemId_idx"
  ON "PurchaseOrderLine" ("lineItemId");
CREATE INDEX IF NOT EXISTS "PurchaseOrderLine_categoryId_idx"
  ON "PurchaseOrderLine" ("categoryId");

DROP TRIGGER IF EXISTS update_purchase_order_updated_at ON "PurchaseOrder";
CREATE TRIGGER update_purchase_order_updated_at
  BEFORE UPDATE ON "PurchaseOrder"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_order_line_updated_at ON "PurchaseOrderLine";
CREATE TRIGGER update_purchase_order_line_updated_at
  BEFORE UPDATE ON "PurchaseOrderLine"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION calculate_purchase_order_line_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW."amount" = ROUND(NEW."quantity" * NEW."unitCost", 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_purchase_order_line_amount_trigger ON "PurchaseOrderLine";
CREATE TRIGGER calculate_purchase_order_line_amount_trigger
  BEFORE INSERT OR UPDATE OF "quantity", "unitCost" ON "PurchaseOrderLine"
  FOR EACH ROW EXECUTE FUNCTION calculate_purchase_order_line_amount();

CREATE OR REPLACE FUNCTION validate_purchase_order_line_budget()
RETURNS TRIGGER AS $$
DECLARE
  v_po_budget_id UUID;
  v_line_item_budget_id UUID;
  v_category_budget_id UUID;
BEGIN
  SELECT "budgetId"
  INTO v_po_budget_id
  FROM "PurchaseOrder"
  WHERE "id" = NEW."purchaseOrderId";

  IF v_po_budget_id IS NULL THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  IF NEW."lineItemId" IS NOT NULL THEN
    SELECT bc."budgetId"
    INTO v_line_item_budget_id
    FROM "BudgetLineItem" li
    JOIN "BudgetCategory" bc ON bc."id" = li."categoryId"
    WHERE li."id" = NEW."lineItemId";

    IF v_line_item_budget_id IS NULL OR v_line_item_budget_id <> v_po_budget_id THEN
      RAISE EXCEPTION 'Line item must belong to the same budget as the purchase order';
    END IF;
  END IF;

  IF NEW."categoryId" IS NOT NULL THEN
    SELECT "budgetId"
    INTO v_category_budget_id
    FROM "BudgetCategory"
    WHERE "id" = NEW."categoryId";

    IF v_category_budget_id IS NULL OR v_category_budget_id <> v_po_budget_id THEN
      RAISE EXCEPTION 'Category must belong to the same budget as the purchase order';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_purchase_order_line_budget_trigger ON "PurchaseOrderLine";
CREATE TRIGGER validate_purchase_order_line_budget_trigger
  BEFORE INSERT OR UPDATE OF "purchaseOrderId", "lineItemId", "categoryId" ON "PurchaseOrderLine"
  FOR EACH ROW EXECUTE FUNCTION validate_purchase_order_line_budget();

CREATE OR REPLACE FUNCTION recalculate_budget_committed_total(p_budget_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_budget_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "Budget"
  SET "totalCommitted" = COALESCE((
    SELECT SUM(po."committedAmount")
    FROM "PurchaseOrder" po
    WHERE po."budgetId" = p_budget_id
  ), 0)
  WHERE "id" = p_budget_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_purchase_order_totals(p_purchase_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_amount DECIMAL(12,2);
  v_budget_id UUID;
  v_status "PurchaseOrderStatus";
BEGIN
  IF p_purchase_order_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(pol."amount"), 0)
  INTO v_total_amount
  FROM "PurchaseOrderLine" pol
  WHERE pol."purchaseOrderId" = p_purchase_order_id;

  SELECT po."budgetId", po."status"
  INTO v_budget_id, v_status
  FROM "PurchaseOrder" po
  WHERE po."id" = p_purchase_order_id;

  IF v_budget_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "PurchaseOrder"
  SET
    "totalAmount" = v_total_amount,
    "committedAmount" = CASE
      WHEN v_status IN ('APPROVED', 'SENT', 'PARTIAL') THEN v_total_amount
      ELSE 0
    END
  WHERE "id" = p_purchase_order_id;

  PERFORM recalculate_budget_committed_total(v_budget_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_line_item_committed_cost(p_line_item_id UUID)
RETURNS VOID AS $$
DECLARE
  v_budget_id UUID;
BEGIN
  IF p_line_item_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE "BudgetLineItem"
  SET
    "committedCost" = COALESCE((
      SELECT SUM(pol."amount")
      FROM "PurchaseOrderLine" pol
      JOIN "PurchaseOrder" po ON po."id" = pol."purchaseOrderId"
      WHERE pol."lineItemId" = p_line_item_id
        AND po."status" IN ('APPROVED', 'SENT', 'PARTIAL')
    ), 0)
  WHERE "id" = p_line_item_id;

  SELECT bc."budgetId"
  INTO v_budget_id
  FROM "BudgetLineItem" li
  JOIN "BudgetCategory" bc ON bc."id" = li."categoryId"
  WHERE li."id" = p_line_item_id;

  PERFORM recalculate_budget_committed_total(v_budget_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_purchase_order_totals_from_lines()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM recalculate_purchase_order_totals(NEW."purchaseOrderId");
    PERFORM recalculate_line_item_committed_cost(NEW."lineItemId");
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM recalculate_purchase_order_totals(NEW."purchaseOrderId");

    IF OLD."purchaseOrderId" <> NEW."purchaseOrderId" THEN
      PERFORM recalculate_purchase_order_totals(OLD."purchaseOrderId");
    END IF;

    IF OLD."lineItemId" IS DISTINCT FROM NEW."lineItemId" THEN
      PERFORM recalculate_line_item_committed_cost(OLD."lineItemId");
      PERFORM recalculate_line_item_committed_cost(NEW."lineItemId");
    ELSE
      PERFORM recalculate_line_item_committed_cost(NEW."lineItemId");
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_purchase_order_totals(OLD."purchaseOrderId");
    PERFORM recalculate_line_item_committed_cost(OLD."lineItemId");
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_purchase_order_totals_from_lines_trigger ON "PurchaseOrderLine";
CREATE TRIGGER refresh_purchase_order_totals_from_lines_trigger
  AFTER INSERT OR UPDATE OR DELETE ON "PurchaseOrderLine"
  FOR EACH ROW EXECUTE FUNCTION refresh_purchase_order_totals_from_lines();

CREATE OR REPLACE FUNCTION refresh_purchase_order_totals_from_status()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
BEGIN
  PERFORM recalculate_purchase_order_totals(NEW."id");

  FOR rec IN
    SELECT DISTINCT pol."lineItemId"
    FROM "PurchaseOrderLine" pol
    WHERE pol."purchaseOrderId" = NEW."id"
      AND pol."lineItemId" IS NOT NULL
  LOOP
    PERFORM recalculate_line_item_committed_cost(rec."lineItemId");
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_purchase_order_totals_from_status_trigger ON "PurchaseOrder";
CREATE TRIGGER refresh_purchase_order_totals_from_status_trigger
  AFTER INSERT OR UPDATE OF "status" ON "PurchaseOrder"
  FOR EACH ROW EXECUTE FUNCTION refresh_purchase_order_totals_from_status();

ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrderLine" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view purchase orders" ON "PurchaseOrder";
CREATE POLICY "Project members can view purchase orders"
  ON "PurchaseOrder" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "Budget" b
      WHERE b."id" = "PurchaseOrder"."budgetId"
        AND check_project_membership(b."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "Finance team can insert purchase orders" ON "PurchaseOrder";
CREATE POLICY "Finance team can insert purchase orders"
  ON "PurchaseOrder" FOR INSERT
  WITH CHECK (
    "createdBy" = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM "Budget" b
      WHERE b."id" = "PurchaseOrder"."budgetId"
        AND (
          check_project_finance_manager(b."projectId", auth.uid()::TEXT)
          OR check_project_role(b."projectId", auth.uid()::TEXT, ARRAY['DEPARTMENT_HEAD'])
        )
    )
  );

DROP POLICY IF EXISTS "Finance team can update purchase orders" ON "PurchaseOrder";
CREATE POLICY "Finance team can update purchase orders"
  ON "PurchaseOrder" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM "Budget" b
      WHERE b."id" = "PurchaseOrder"."budgetId"
        AND (
          check_project_finance_manager(b."projectId", auth.uid()::TEXT)
          OR "PurchaseOrder"."createdBy" = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "Budget" b
      WHERE b."id" = "PurchaseOrder"."budgetId"
        AND (
          check_project_finance_manager(b."projectId", auth.uid()::TEXT)
          OR "PurchaseOrder"."createdBy" = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Finance team can delete purchase orders" ON "PurchaseOrder";
CREATE POLICY "Finance team can delete purchase orders"
  ON "PurchaseOrder" FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM "Budget" b
      WHERE b."id" = "PurchaseOrder"."budgetId"
        AND (
          check_project_finance_manager(b."projectId", auth.uid()::TEXT)
          OR "PurchaseOrder"."createdBy" = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Project members can view purchase order lines" ON "PurchaseOrderLine";
CREATE POLICY "Project members can view purchase order lines"
  ON "PurchaseOrderLine" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "PurchaseOrder" po
      JOIN "Budget" b ON b."id" = po."budgetId"
      WHERE po."id" = "PurchaseOrderLine"."purchaseOrderId"
        AND check_project_membership(b."projectId", auth.uid()::TEXT)
    )
  );

DROP POLICY IF EXISTS "Finance team can insert purchase order lines" ON "PurchaseOrderLine";
CREATE POLICY "Finance team can insert purchase order lines"
  ON "PurchaseOrderLine" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "PurchaseOrder" po
      JOIN "Budget" b ON b."id" = po."budgetId"
      WHERE po."id" = "PurchaseOrderLine"."purchaseOrderId"
        AND (
          check_project_finance_manager(b."projectId", auth.uid()::TEXT)
          OR po."createdBy" = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Finance team can update purchase order lines" ON "PurchaseOrderLine";
CREATE POLICY "Finance team can update purchase order lines"
  ON "PurchaseOrderLine" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM "PurchaseOrder" po
      JOIN "Budget" b ON b."id" = po."budgetId"
      WHERE po."id" = "PurchaseOrderLine"."purchaseOrderId"
        AND (
          check_project_finance_manager(b."projectId", auth.uid()::TEXT)
          OR po."createdBy" = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "PurchaseOrder" po
      JOIN "Budget" b ON b."id" = po."budgetId"
      WHERE po."id" = "PurchaseOrderLine"."purchaseOrderId"
        AND (
          check_project_finance_manager(b."projectId", auth.uid()::TEXT)
          OR po."createdBy" = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Finance team can delete purchase order lines" ON "PurchaseOrderLine";
CREATE POLICY "Finance team can delete purchase order lines"
  ON "PurchaseOrderLine" FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM "PurchaseOrder" po
      JOIN "Budget" b ON b."id" = po."budgetId"
      WHERE po."id" = "PurchaseOrderLine"."purchaseOrderId"
        AND (
          check_project_finance_manager(b."projectId", auth.uid()::TEXT)
          OR po."createdBy" = auth.uid()
        )
    )
  );

COMMENT ON TABLE "PurchaseOrder" IS 'Committed cost records (PO lifecycle) tied to a budget';
COMMENT ON TABLE "PurchaseOrderLine" IS 'Detailed PO lines optionally linked to budget categories and line items';
COMMENT ON COLUMN "PurchaseOrder"."committedAmount" IS 'Amount currently counted as committed based on PO status';
