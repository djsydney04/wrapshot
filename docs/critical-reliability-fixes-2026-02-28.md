# Critical Reliability Fixes - 2026-02-28

## Scope

This update focuses on the highest-severity runtime issues called out in project dashboard and project detail loading flows.

## Fixed

1. Race condition and stale writes in project detail data loading
- File: `apps/web/app/(app)/projects/[projectId]/page.tsx`
- Added `AbortController` handling per `DataKey` load.
- Added abort-aware guards (`throwIfAborted`, abort error filtering).
- Prevented stale/in-flight requests from writing state after cancellation.
- Ensured forced reloads no longer get skipped after awaiting in-flight requests.

2. Memory leak risk on initial project load
- File: `apps/web/app/(app)/projects/[projectId]/page.tsx`
- Added cleanup cancellation in the initial load effect.
- Aborted pending key loads and initial load signal on cleanup/project switch.
- Prevented state updates when requests are aborted.

3. Section auto-load retry loop risk
- File: `apps/web/app/(app)/projects/[projectId]/page.tsx`
- Hardened section-loading effect to only load keys that are:
  - not loaded,
  - not currently in-flight,
  - and not already in an error state.
- This prevents repeated auto-retries after a failed key until explicit retry.

4. Dashboard error recovery and reload UX
- File: `apps/web/app/(app)/page.tsx`
- Refactored loading into shared `loadProjectsData` routine.
- Added retry button in error state.
- Added explicit `isReloading` state and UI indicator for `reloadProjects`.
- Added mount guard to avoid setState on unmounted component.

5. Wizard count logic bug
- File: `apps/web/app/(app)/projects/[projectId]/page.tsx`
- Corrected fallback totals:
  - scenes: use `storeScenes.length` when DB scenes are not loaded
  - cast: use `storeCast.length` when DB cast is not loaded

6. Dashboard email overflow
- File: `apps/web/app/(app)/page.tsx`
- Added truncation class to prevent long email prefixes from breaking dropdown layout.

## Validation

- `npm run typecheck --workspace=web` passed.
- `npx eslint app/(app)/page.tsx app/(app)/projects/[projectId]/page.tsx` passed.
- Full workspace lint still reports one pre-existing warning in `apps/web/components/forms/add-shooting-day-form.tsx` unrelated to this change.

## Not Included (Deferred)

- Section URL debounce for rapid navigation.
- Agent polling dependency optimization.
- Broader architectural consolidation of duplicate data sources.
- App-wide optimistic updates and offline handling.
