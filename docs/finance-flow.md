# Finance Flow

This describes how finance workflows should feel in the context of production management.

## Core User Journey

1. **Create a budget**
   - Select a template (feature, commercial, music video) or start from scratch.
   - Templates bootstrap categories + line items so teams can begin tracking immediately.

2. **Build the budget**
   - Organize categories and line items in the Budget Builder.
   - Adjust units, quantities, rates, and fringe to match the schedule.
   - Use category totals to sanity-check department allocations.

3. **Track spend**
   - Enter expenses and attach receipts.
   - Actuals roll up to line items, then categories, then the overall budget.

4. **Monitor health**
   - Review totals, remaining budget, and receipt status.
   - Identify departments trending over before production wraps.

## Design Intent

- **Plan first, then spend**: budgets are created before expenses are logged.
- **Schedule-aware**: line items reflect days/weeks aligned with shooting days.
- **Fast iteration**: templates give a working baseline; adjust as you learn.
- **Clear accountability**: totals roll up so owners can see impact quickly.

## When to Use Templates

- **New productions** with typical staffing and rates.
- **Repeatable formats** (commercials, music videos).
- **Teams without a dedicated production accountant**.

If the project is highly specialized, start from scratch and add categories manually.

## Interaction Principles

- Keep the builder visible alongside totals.
- Make line-item edits immediate and reversible.
- Summaries should always reflect the current budget state.
