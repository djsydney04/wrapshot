# FinanceOps Implementation Guide

## Overview

This guide documents the FinanceOps feature implementation for Wrapshoot. The feature brings modern spend management to film production with real-time tracking, schedule integration, and automated financial operations.

## ✅ Completed Implementation

### 1. Database Schema (Migration: `20260128000001_finance_ops.sql`)

**Tables Created:**
- `Budget` - Project budgets with version control
- `BudgetCategory` - Hierarchical budget categories (chart of accounts)
- `BudgetLineItem` - Individual line items with calculations
- `Transaction` - Expense tracking with receipt management
- `BudgetTemplate` - Reusable budget templates
- `BudgetAlert` - Budget warnings and alerts

**Key Features:**
- Automatic calculation triggers for totals and subtotals
- Row Level Security (RLS) policies based on project membership
- Cascading updates when line items or categories change
- Built-in system templates (Indie Feature, Commercial, Music Video)

**Helper Functions:**
- `get_budget_health()` - Calculate budget status
- `get_burn_rate()` - Calculate daily spending rate

### 2. TypeScript Types (`lib/types.ts`)

**Interfaces Added:**
- `Budget`, `BudgetCategory`, `BudgetLineItem`
- `Transaction`, `BudgetTemplate`, `BudgetAlert`
- `BudgetSummary`, `BurnRate`, `DepartmentHealth`, `DashboardData`

**Type Definitions:**
- `BudgetStatus`, `ReceiptStatus`, `BudgetUnits`, `AlertType`, `BudgetHealthStatus`

**Constants:**
- `BUDGET_CHART_OF_ACCOUNTS` - Standard film budget categories
- `BUDGET_UNITS_LABELS`, `BUDGET_STATUS_LABELS`, `RECEIPT_STATUS_LABELS`

### 3. Navigation & Routing

**Sidebar Update** (`components/layout/sidebar.tsx`):
- Added Finance navigation item with DollarSign icon
- Positioned between Schedule and Projects sections

**Routes Created:**
- `/finance` - Budget list page (completed)
- `/finance/new` - Budget creation with template selector (completed)
- `/finance/[budgetId]` - Budget detail page (structure created, needs implementation)

### 4. Page Components

**Finance Home (`/finance/page.tsx`):**
- Budget cards grid view with health indicators
- Empty state with feature highlights
- Quick actions to dashboard and detail views
- Currency formatting and progress bars

**New Budget (`/finance/new/page.tsx`):**
- Two-step wizard (template selection → customization)
- System template cards (Indie Feature, Commercial, Music Video)
- "Start from Scratch" option
- Budget name and description inputs

## 🚧 Next Steps: Detailed Implementation Guide

### Phase 1: Budget Detail Views (Priority 1)

#### 1.1 Budget Top Sheet View

**File:** `/app/(app)/finance/[budgetId]/page.tsx`

```typescript
// Main budget detail page with tabs
export default function BudgetDetailPage({ params }: { params: { budgetId: string } })

Tabs:
- Dashboard (default)
- Top Sheet
- Detail
- Transactions
- Reports
```

**Features:**
- Tab navigation
- Budget header with status badge
- Summary metrics (total estimated, actual, variance)
- Quick actions (export, lock, new version)

**Components Needed:**
- `BudgetHeader` - Shows budget info and actions
- `BudgetTabs` - Tab navigation component

#### 1.2 Top Sheet Summary Component

**File:** `/components/finance/budget-top-sheet.tsx`

```typescript
interface BudgetTopSheetProps {
  budget: Budget;
  categories: BudgetCategory[];
  onCategoryClick?: (categoryId: string) => void;
}
```

**Features:**
- Collapsible category rows
- Three columns: Category, Estimated, Actual, Variance %
- Color-coded variance (green < 0%, yellow 80-100%, red > 100%)
- Drill-down to detail view on click
- Subtotals for parent categories

**UI Pattern:**
```
▼ Above-the-line        $450K    $448K   -0.4% ✓
  Story & Rights        $50K     $50K     0%
  Producers            $150K    $150K    0%
  Director             $200K    $198K   -1%
  Cast                  $50K     $50K     0%
```

#### 1.3 Budget Detail View (Spreadsheet)

**File:** `/components/finance/budget-detail-table.tsx`

```typescript
interface BudgetDetailTableProps {
  categoryId: string;
  lineItems: BudgetLineItem[];
  onLineItemUpdate?: (lineItem: BudgetLineItem) => Promise<void>;
  onLineItemDelete?: (lineItemId: string) => Promise<void>;
  onLineItemAdd?: () => void;
}
```

**Features:**
- Inline editing for all fields
- Auto-calculation of totals as you type
- Drag-to-reorder rows
- Add/delete line items
- Link to schedule button per row
- Variance highlighting

**Columns:**
| Code | Description | Units | Qty | Rate | Subtotal | Fringe % | Fringe $ | Total | Actual | Variance |
|------|-------------|-------|-----|------|----------|----------|----------|-------|--------|----------|
| 2201 | Prod Des.   | weeks | 12  | $2.5K| $30K     | 25%      | $7.5K    | $37.5K| $35K   | -$2.5K   |

**Inline Edit Pattern:**
- Click cell → edit mode
- Tab to next cell
- Debounced auto-save (500ms)
- Toast on successful save
- Error handling with revert

**Component Structure:**
```typescript
<BudgetDetailTable>
  {lineItems.map(item => (
    <BudgetLineItemRow
      key={item.id}
      lineItem={item}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  ))}
  <AddLineItemButton onClick={handleAdd} />
</BudgetDetailTable>
```

### Phase 2: Dashboard & Analytics (Priority 1)

#### 2.1 Dashboard Page

**File:** `/app/(app)/finance/[budgetId]/dashboard/page.tsx`

**Widgets:**
1. Budget Health Card - Current status summary
2. Burn Rate Chart - Line chart of daily spending
3. Department Breakdown - Horizontal bar chart
4. Recent Transactions - Live feed
5. Alerts Panel - Warnings and errors

#### 2.2 Dashboard Components

**Budget Health Card** (`components/finance/budget-health-card.tsx`):
```typescript
- Total Estimated: $2,450,000
- Total Spent: $1,823,450 (74%)
- Remaining: $626,550
- Projected Final: $2,510,000 (+2.4% over)
- Days until exhausted: 28 days
```

**Burn Rate Chart** (`components/finance/burn-rate-chart.tsx`):
- Use recharts or similar library
- Cumulative spend line
- Planned spend comparison line
- Projection trend line
- "Today" vertical marker

**Department Breakdown** (`components/finance/department-breakdown.tsx`):
```
Art Dept     [========90%========]  $198K / $220K
Camera       [======75%======]      $135K / $180K
G&E          [====68%====]          $82K / $120K
```

**Recent Transactions** (`components/finance/recent-transactions.tsx`):
- Last 10 transactions
- Date, vendor, amount, category
- Click to view details
- Receipt status indicator

**Alerts Panel** (`components/finance/budget-alerts.tsx`):
- Warning/Error/Info icons
- Dismissable alerts
- Action buttons (e.g., "Review Category")

### Phase 3: Expense Tracking (Priority 2)

#### 3.1 Transaction Entry Form

**File:** `/components/finance/transaction-form.tsx`

```typescript
interface TransactionFormProps {
  budgetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLineItemId?: string;
  onSuccess?: () => void;
}
```

**Form Fields:**
- Date (date picker)
- Vendor (autocomplete from past vendors)
- Amount (currency input)
- Category (dropdown from budget categories)
- Line Item (dropdown filtered by category)
- Description (text area)
- Receipt Upload (drag-drop or file picker)
- Notes (optional)

**Validation:**
- Required: date, vendor, amount, category, description
- Amount must be > 0
- Receipt required for amounts > $500 (configurable)

**Receipt Upload:**
- Support: JPG, PNG, PDF
- Max size: 10MB
- Store in Supabase Storage
- Show preview after upload

#### 3.2 Transactions List

**File:** `/components/finance/transactions-list.tsx`

**Features:**
- Table view with sorting
- Filters: date range, vendor, category, receipt status
- Bulk actions: approve receipts, delete multiple
- Export to CSV
- Pagination or infinite scroll

**Columns:**
| Date | Vendor | Amount | Category | Line Item | Receipt | Actions |
|------|--------|--------|----------|-----------|---------|---------|
| 01/15| Home Depot | $342 | Art | Set Dressing | ✓ | Edit, Delete |

### Phase 4: API Routes (Priority 2)

#### 4.1 Budget API

**Create Budget** - `POST /api/budgets`
```typescript
Body: {
  projectId: string;
  versionName: string;
  templateId?: string;
  description?: string;
}

Returns: Budget

Flow:
1. Validate user has project access (ADMIN or COORDINATOR)
2. If templateId provided, load template
3. Create budget record
4. Create categories from template
5. Create line items from template
6. Return budget with categories and line items
```

**Get Budget** - `GET /api/budgets/[id]`
```typescript
Returns: Budget with nested categories and line items

Flow:
1. Validate user has project access
2. Fetch budget with all related data
3. Calculate dashboard metrics
4. Return full budget object
```

**Update Budget** - `PUT /api/budgets/[id]`
```typescript
Body: {
  versionName?: string;
  status?: BudgetStatus;
  contingencyPercent?: number;
}

Returns: Budget
```

**Delete Budget** - `DELETE /api/budgets/[id]`
```typescript
Returns: { success: boolean }

Note: Only ADMIN can delete budgets
```

#### 4.2 Line Item API

**Create Line Item** - `POST /api/budgets/[id]/line-items`
```typescript
Body: {
  categoryId: string;
  accountCode: string;
  description: string;
  units: BudgetUnits;
  quantity: number;
  rate: number;
  fringePercent?: number;
  notes?: string;
}

Returns: BudgetLineItem

Note: Triggers auto-calculation of totals
```

**Update Line Item** - `PUT /api/line-items/[id]`
```typescript
Body: Partial<BudgetLineItem>

Returns: BudgetLineItem

Note: Triggers recalculation cascade
```

**Link to Schedule** - `POST /api/line-items/[id]/link-schedule`
```typescript
Body: {
  castMemberId?: string;
  crewMemberId?: string;
}

Returns: BudgetLineItem with updated linkedScheduleItems

Flow:
1. Get crew/cast member from project store
2. Calculate total days from schedule
3. Update line item quantity
4. Set isScheduleSynced = true
5. Return updated line item
```

#### 4.3 Transaction API

**Create Transaction** - `POST /api/budgets/[id]/transactions`
```typescript
Body: {
  date: string;
  vendor: string;
  amount: number;
  description: string;
  category: string;
  lineItemId?: string;
  receiptUrl?: string;
  notes?: string;
}

Returns: Transaction

Flow:
1. Create transaction record
2. If lineItemId provided, update line item actualCost
3. Trigger category/budget recalculation
4. Return transaction
```

**Upload Receipt** - `POST /api/transactions/[id]/receipt`
```typescript
Body: FormData with file

Returns: { receiptUrl: string }

Flow:
1. Validate file type and size
2. Upload to Supabase Storage (bucket: 'receipts')
3. Generate public URL
4. Update transaction with receiptUrl
5. Set receiptStatus = 'PENDING'
6. Return URL
```

#### 4.4 Dashboard API

**Get Dashboard Data** - `GET /api/budgets/[id]/dashboard`
```typescript
Returns: DashboardData

Calculations:
- budgetSummary: from budget totals
- burnRate: dailyAverage = totalActual / daysElapsed
- departmentHealth: group by category, calculate %spent
- alerts: check for overspending, missing receipts, etc.
```

### Phase 5: Schedule Integration (Priority 2)

#### 5.1 Link Line Item to Crew

**Component:** `LinkToScheduleDialog.tsx`

```typescript
interface LinkToScheduleDialogProps {
  lineItem: BudgetLineItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLink: (crewMemberId: string) => Promise<void>;
}
```

**UI:**
```
Link to Schedule
────────────────
This will automatically calculate days from the schedule.

Select Crew Member:
[Dropdown of crew members filtered by department]

Preview:
Name: John Smith (DP)
Schedule: 22 shoot days
Current Qty: 20 days
New Qty: 22 days
Impact: +$1,600

[Cancel] [Link & Update]
```

#### 5.2 Schedule Sync Logic

**File:** `/lib/finance/schedule-sync.ts`

```typescript
export function calculateCrewDays(
  crewMemberId: string,
  shootingDays: ShootingDay[]
): number {
  // Count days where crew member is assigned
  // Return total day count
}

export function syncLineItemWithSchedule(
  lineItem: BudgetLineItem,
  shootingDays: ShootingDay[]
): BudgetLineItem {
  // Recalculate quantity from schedule
  // Update line item
  // Return updated line item
}

export function detectScheduleChanges(
  budget: Budget,
  shootingDays: ShootingDay[]
): BudgetAlert[] {
  // Compare current line items with schedule
  // Generate alerts for discrepancies
  // Return list of alerts
}
```

#### 5.3 Auto-Update on Schedule Change

Use Supabase real-time subscriptions to listen for ShootingDay changes:

```typescript
useEffect(() => {
  const subscription = supabase
    .channel('shooting-days-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ShootingDay',
    }, (payload) => {
      // Recalculate linked line items
      syncBudgetWithSchedule(budgetId);
    })
    .subscribe();

  return () => subscription.unsubscribe();
}, [budgetId]);
```

### Phase 6: Permissions & Access Control (Priority 3)

#### 6.1 Permission Rules

**Budget Management:**
- VIEW: All project members
- CREATE: ADMIN, COORDINATOR
- EDIT: ADMIN, COORDINATOR (if budget not locked)
- DELETE: ADMIN only
- APPROVE: ADMIN only
- LOCK: ADMIN only

**Transactions:**
- VIEW: All project members
- CREATE: ADMIN, COORDINATOR, DEPARTMENT_HEAD
- EDIT: Creator or ADMIN/COORDINATOR
- DELETE: Creator or ADMIN
- APPROVE RECEIPTS: ADMIN, COORDINATOR

**Department Filtering:**
- DEPARTMENT_HEAD can only edit line items for their department
- Implement in UI by filtering categories

#### 6.2 Permission Component Usage

```typescript
import { PermissionGate } from "@/components/ui/permission-gate";

<PermissionGate
  projectId={projectId}
  permission="project:manage-budget"
  fallback={<div>You don't have access to edit budgets</div>}
>
  <BudgetEditor />
</PermissionGate>
```

### Phase 7: Real-time Updates (Priority 3)

#### 7.1 Supabase Subscriptions

**Budget Changes:**
```typescript
// Subscribe to budget updates
const budgetChannel = supabase
  .channel(`budget:${budgetId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'Budget',
    filter: `id=eq.${budgetId}`,
  }, (payload) => {
    // Update local state
    setBudget(payload.new);
  })
  .subscribe();
```

**Transaction Updates:**
```typescript
// Subscribe to new transactions
const transactionChannel = supabase
  .channel(`transactions:${budgetId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'Transaction',
    filter: `budgetId=eq.${budgetId}`,
  }, (payload) => {
    // Add to transaction list
    // Show toast notification
    toast.success(`New expense: ${payload.new.vendor} - ${formatCurrency(payload.new.amount)}`);
  })
  .subscribe();
```

### Phase 8: Export & Reports (Priority 4)

#### 8.1 CSV Export

**File:** `/lib/finance/export.ts`

```typescript
export function exportBudgetToCSV(budget: Budget, categories: BudgetCategory[], lineItems: BudgetLineItem[]): string {
  // Generate CSV with all line items
  // Include columns: Code, Description, Units, Qty, Rate, Total, Actual, Variance
  // Return CSV string
}

export function downloadCSV(csvContent: string, filename: string) {
  // Create blob and download
}
```

**Usage:**
```typescript
<Button onClick={() => {
  const csv = exportBudgetToCSV(budget, categories, lineItems);
  downloadCSV(csv, `budget-${budget.versionName}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
}}>
  Export to CSV
</Button>
```

#### 8.2 PDF Report

Use library like `react-pdf` or `jsPDF`:

```typescript
export function generateCostReport(budget: Budget): PDFDocument {
  // Create PDF with:
  // - Budget summary
  // - Top sheet
  // - Variance analysis
  // - Department breakdowns
  // Return PDF document
}
```

### Phase 9: Additional Features (Future)

#### 9.1 Budget Alerts System

Auto-generate alerts based on rules:
- Category over 80% spent with >30% shoot remaining
- Missing receipts older than 7 days
- Line item variance > 20%
- Daily burn rate exceeds plan by >15%

**Cron job or trigger:**
```typescript
export async function generateBudgetAlerts(budgetId: string) {
  const budget = await getBudget(budgetId);
  const alerts: BudgetAlert[] = [];

  // Check each category
  for (const category of categories) {
    const percentSpent = category.subtotalActual / category.subtotalEstimated;
    if (percentSpent > 0.8) {
      alerts.push({
        type: 'WARNING',
        message: `${category.name} at ${(percentSpent * 100).toFixed(0)}% of budget`,
        categoryId: category.id,
        actionRequired: true,
      });
    }
  }

  // Save alerts to database
  await saveAlerts(alerts);
}
```

#### 9.2 Budget Version Comparison

**Component:** `BudgetVersionCompare.tsx`

Side-by-side comparison of two budget versions:
- Highlight changes in line items
- Show variance between versions
- Export diff report

#### 9.3 Vendor Management

Track vendor information:
- Vendor name, contact info
- Payment terms
- Historical spend
- W9/insurance documents

#### 9.4 Purchase Orders

Create and track POs:
- Link to line items
- Approval workflow
- Update committed costs
- Mark as paid when transaction created

## 🗂️ File Structure Summary

```
/app/(app)/finance/
├── page.tsx (✓ completed)
├── new/
│   └── page.tsx (✓ completed)
├── [budgetId]/
│   ├── page.tsx (TODO: main detail page with tabs)
│   ├── dashboard/
│   │   └── page.tsx (TODO: dashboard view)
│   ├── detail/
│   │   └── page.tsx (TODO: spreadsheet view)
│   ├── transactions/
│   │   └── page.tsx (TODO: transaction list)
│   └── reports/
│       └── page.tsx (TODO: reports & export)

/components/finance/
├── budget-health-card.tsx (TODO)
├── budget-top-sheet.tsx (TODO)
├── budget-detail-table.tsx (TODO)
├── budget-line-item-row.tsx (TODO)
├── burn-rate-chart.tsx (TODO)
├── department-breakdown.tsx (TODO)
├── budget-alerts.tsx (TODO)
├── transaction-form.tsx (TODO)
├── transactions-list.tsx (TODO)
└── link-to-schedule-dialog.tsx (TODO)

/app/api/
├── budgets/
│   ├── route.ts (POST - create budget)
│   └── [id]/
│       ├── route.ts (GET, PUT, DELETE)
│       ├── dashboard/
│       │   └── route.ts (GET dashboard data)
│       ├── line-items/
│       │   └── route.ts (POST line item)
│       └── transactions/
│           └── route.ts (GET, POST transactions)
├── line-items/
│   └── [id]/
│       ├── route.ts (PUT, DELETE)
│       └── link-schedule/
│           └── route.ts (POST link to schedule)
└── transactions/
    └── [id]/
        ├── route.ts (GET, PUT, DELETE)
        ├── receipt/
        │   └── route.ts (POST upload)
        └── approve/
            └── route.ts (POST approve)

/lib/finance/
├── calculations.ts (budget calculation helpers)
├── schedule-sync.ts (schedule integration logic)
├── export.ts (CSV/PDF export functions)
└── alerts.ts (alert generation logic)

/supabase/migrations/
└── 20260128000001_finance_ops.sql (✓ completed)
```

## 🎯 Recommended Build Order

### Week 1: Core Budget Management
1. ✅ Database migration
2. ✅ TypeScript types
3. ✅ Navigation & routing structure
4. Budget API routes (create, read, update, delete)
5. Budget detail page with tabs
6. Top sheet view component
7. Basic dashboard

### Week 2: Spreadsheet & Line Items
1. Line item API routes
2. Budget detail spreadsheet component
3. Inline editing functionality
4. Add/delete line items
5. Category management

### Week 3: Transactions & Expenses
1. Transaction API routes
2. Transaction form component
3. Receipt upload functionality
4. Transactions list view
5. Link transactions to line items

### Week 4: Schedule Integration
1. Link line item to crew member
2. Auto-calculate days from schedule
3. Real-time sync on schedule changes
4. Schedule change alerts

### Week 5: Dashboard & Analytics
1. Dashboard components (charts, widgets)
2. Burn rate calculation
3. Department breakdown
4. Budget health indicators
5. Alerts system

### Week 6: Polish & Features
1. Permissions and access control
2. Real-time updates via Supabase
3. Export functionality (CSV, PDF)
4. Mobile responsive design
5. Performance optimization

## 📚 Key Patterns & Best Practices

### State Management
- Use Zustand for client-side budget state
- Create `useBudgetStore` similar to `useProjectStore`
- Sync with Supabase for persistence
- Real-time subscriptions for live updates

### Form Handling
- React Hook Form for complex forms
- Zod schemas for validation
- Inline editing with debounced auto-save
- Optimistic UI updates

### Data Fetching
- Server components for initial data load
- Client components for interactivity
- SWR or React Query for caching
- Parallel requests where possible

### Error Handling
- Toast notifications for user feedback
- Error boundaries for graceful failures
- Validation errors shown inline
- Retry logic for failed requests

### Performance
- Virtual scrolling for large line item lists
- Debounce inline edits (500ms)
- Cache dashboard calculations
- Lazy load chart libraries
- Optimize Supabase queries with indexes

## 🔧 Utility Functions to Create

### Currency Formatting
```typescript
export function formatCurrency(amount: number, showCents = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(amount);
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
}
```

### Percentage Formatting
```typescript
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function calculateVariancePercent(actual: number, estimated: number): number {
  if (estimated === 0) return 0;
  return ((actual - estimated) / estimated) * 100;
}
```

### Health Status
```typescript
export function getBudgetHealthStatus(percentSpent: number): BudgetHealthStatus {
  if (percentSpent >= 100) return 'OVER_BUDGET';
  if (percentSpent >= 80) return 'WARNING';
  return 'ON_TRACK';
}

export function getHealthColor(status: BudgetHealthStatus): string {
  const colors = {
    ON_TRACK: 'text-emerald-600 dark:text-emerald-400',
    WARNING: 'text-amber-600 dark:text-amber-400',
    OVER_BUDGET: 'text-red-600 dark:text-red-400',
  };
  return colors[status];
}
```

## 🧪 Testing Strategy

### Unit Tests
- Budget calculation functions
- Currency formatting
- Variance calculations
- Schedule sync logic

### Integration Tests
- API route handlers
- Database triggers
- Real-time subscriptions

### E2E Tests
- Create budget flow
- Add expense flow
- Link to schedule flow
- Export report flow

## 📖 Documentation Needs

1. User Guide - How to use FinanceOps
2. API Documentation - All endpoints and schemas
3. Migration Guide - Moving from Excel/Movie Magic
4. Admin Guide - Setting up templates and permissions

## 🚀 Deployment Checklist

Before deploying to production:
- [ ] Run database migration on production
- [ ] Test all API routes with production data
- [ ] Verify RLS policies are working
- [ ] Test real-time subscriptions at scale
- [ ] Load test with large budgets (1000+ line items)
- [ ] Verify receipt upload to production storage
- [ ] Test permissions for all roles
- [ ] Mobile responsiveness check
- [ ] Cross-browser testing
- [ ] Performance audit with Lighthouse
- [ ] Security audit for SQL injection, XSS
- [ ] Backup strategy for budget data

---

This comprehensive guide provides the blueprint for completing the FinanceOps implementation. Each section includes detailed specifications, code patterns, and implementation notes to ensure consistency with the existing Wrapshoot codebase.
