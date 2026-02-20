I think # Art, Camera, G&E, and Post Department Expansion Plan

## Goal

Ship department-native workflows that plug into existing `Script -> Scenes -> Schedule -> Call Sheets -> Budget`
without introducing a separate planning system.

## Scope and constraints

- Reuse existing project model (`Project`, `Scene`, `ShootingDay`, `CrewMember`, `GearItem`, `CallSheet`).
- Add department features as incremental vertical slices.
- Keep each feature in its own branch for parallel implementation.
- Prefer server actions + Supabase RLS-aligned tables.

## Cross-cutting implementation (required before/with first feature)

1. Department workspace shell
- Add department-specific pages under project routes for: Art, Camera, G&E, Post.
- Reuse current section navigation patterns and permission checks.

2. Shared attachments and comments
- Add reusable attachment records for reference photos, PDFs, diagrams.
- Add comment threads for notes tied to scene/day/asset records.

3. Schedule + call sheet hooks
- Every department feature should expose:
  - scene-level readiness (`NOT_READY | IN_PROGRESS | READY`)
  - shooting-day dependencies and alerts
- Feed blockers into call sheet notes and schedule detail panel.

4. Budget linkage
- Optional one-click sync from department items to budget line items.
- Track planned vs actual per department item.

## Department feature plan

### Art Department

#### Feature A1: Continuity Bible
- Purpose: Track character/set continuity by scene and script day.
- Data model:
  - `ArtContinuityBook` (project-level)
  - `ArtContinuityEntry` (sceneId, scriptDay, notes, tags)
  - `ArtContinuityPhoto` (entryId, fileUrl, angle, lookType)
- UI:
  - Continuity board filtered by character, set, script day.
  - Scene sidebar card showing prior/next continuity references.
- Integrations:
  - Scene breakdown links (`SceneElement` props/set dressing context).
  - Call sheet "Art Notes" autofill from unresolved continuity risks.
- Acceptance:
  - User can create continuity entries, attach photos, and mark resolved.

#### Feature A2: Set Dressing & Props Pull Lists
- Purpose: Turn scene elements into actionable prep/pull lists.
- Data model:
  - `ArtPullList` (projectId, sceneId, status, ownerCrewId)
  - `ArtPullItem` (listId, sourceElementId, qty, source, dueDayId, status)
- UI:
  - Auto-generated pull list from tagged art elements.
  - Prep-day board: `TO_SOURCE -> PULLED -> ON_TRUCK -> ON_SET -> WRAPPED`.
- Integrations:
  - Link items to `GearItem` when reusable.
  - Create/update budget request when sourcing external rentals/purchases.
- Acceptance:
  - Pull list is generated from scene elements and drives day-level readiness.

#### Feature A3: Build/Strike Schedule
- Purpose: Plan construction, paint, set dec, strike windows.
- Data model:
  - `ArtWorkOrder` (locationId, sceneIds, type, startDayId, endDayId, status)
  - `ArtCrewAssignment` (workOrderId, crewMemberId, hours)
- UI:
  - Gantt-like timeline aligned to `ShootingDay`.
  - Conflict flags for overlapping location access.
- Integrations:
  - Writes location hold windows and warns schedule/callsheet on conflicts.
- Acceptance:
  - Art team can plan build/strike windows with conflict detection.

### Camera Department

#### Feature C1: Shot List + Lens/Camera Package Planner
- Purpose: Plan coverage and package requirements by scene/day.
- Data model:
  - `CameraShot` (sceneId, shotCode, framing, movement, fps, notes, priority)
  - `CameraPackageNeed` (shotId, itemType, spec, qty)
- UI:
  - Shot list editor grouped by scene and shooting day.
  - Package recommendation panel from shot requirements.
- Integrations:
  - Surfaces unmet package needs to production and budget.
  - Optional export to call sheet camera notes.
- Acceptance:
  - Team can create shot lists and derive camera package requirements.

#### Feature C2: Camera Package + Rental Tracker
- Purpose: Track owned/rented camera assets, bookings, and returns.
- Data model:
  - `CameraAsset` (projectId, category, serial, ownerType, vendorId, status)
  - `CameraBooking` (assetId, startDayId, endDayId, rate, poNumber)
- UI:
  - Asset inventory with availability timeline.
  - Rental booking view with return reminders.
- Integrations:
  - Push rental commitments to budget actual/committed values.
  - Warn if required shot package is unavailable on assigned day.
- Acceptance:
  - Camera assets and rentals are visible with schedule-safe availability.

#### Feature C3: Daily Camera Reports
- Purpose: Capture camera report per day and handoff metadata to post.
- Data model:
  - `CameraReport` (shootingDayId, cameraUnit, operatorId, summary)
  - `CameraCardLog` (reportId, roll, codec, tcStart, tcEnd, notes, offloadedAt)
- UI:
  - Day form for camera team with card logs and issues.
  - Export to CSV/PDF for post ingest.
- Integrations:
  - Creates post ingest queue items automatically.
- Acceptance:
  - End-of-day camera logs are complete and available to post workflow.

### G&E (Grip and Electric)

#### Feature G1: Lighting Plan
- Purpose: Scene/day lighting plans with required fixtures and modifiers.
- Data model:
  - `LightingPlan` (sceneId, shootingDayId, gafferId, status, notes)
  - `LightingNeed` (planId, fixtureType, qty, powerDraw, source)
- UI:
  - Lighting breakdown per scene with setup notes.
  - Readiness dashboard by shoot day.
- Integrations:
  - Converts needs into gear reservations and budget impact.
- Acceptance:
  - Gaffer can publish per-day lighting plans with readiness status.

#### Feature G2: Rigging + Grip Schedule
- Purpose: Plan rigging days, labor, and prelight requirements.
- Data model:
  - `RiggingTask` (locationId, sceneIds, startDayId, endDayId, status)
  - `GripCrewAssignment` (taskId, crewMemberId, role, callTime)
- UI:
  - Task board by location/day with staffing gaps.
  - Dependency graph between rigging and main unit shooting days.
- Integrations:
  - Blocks schedule lock when rigging dependencies are incomplete.
- Acceptance:
  - Rigging workflow supports staffing and day dependency management.

#### Feature G3: Power + Distro Safety
- Purpose: Validate power plans and safety checklists before shoot.
- Data model:
  - `PowerPlan` (shootingDayId, locationId, generator, distroNotes)
  - `PowerCircuit` (powerPlanId, runLabel, loadAmps, breaker, status)
  - `SafetyChecklist` (shootingDayId, department, item, status, completedBy)
- UI:
  - Power load calculator and pass/fail warnings.
  - Required safety checklist with sign-off.
- Integrations:
  - Writes safety status into call sheet notes and production alerts.
- Acceptance:
  - Shoot day cannot be marked ready if required power/safety checks fail.

### Post-Production

#### Feature P1: Dailies Ingest + QC
- Purpose: Intake daily media and verify completeness/quality.
- Data model:
  - `PostIngestBatch` (shootingDayId, sourceReportId, status)
  - `PostIngestItem` (batchId, roll, checksum, qcStatus, issue)
- UI:
  - Ingest queue dashboard with missing-roll and QC alerts.
  - Reconcile view against camera card logs.
- Integrations:
  - Auto-creates issues back to camera team for missing/corrupt media.
- Acceptance:
  - Post can confirm ingest completeness per shooting day.

#### Feature P2: Cut Versions + Review Approvals
- Purpose: Track editor cuts, review notes, and sign-off states.
- Data model:
  - `EditVersion` (projectId, name, sourceRange, exportedAt, status)
  - `EditReviewNote` (versionId, timecode, note, authorId, status)
- UI:
  - Version list with status (`ASSEMBLY | DIRECTOR_CUT | LOCKED`).
  - Timecode note board with resolved/unresolved filters.
- Integrations:
  - Post status visible to production dashboard.
- Acceptance:
  - Review feedback is centralized and traceable to versions/timecodes.

#### Feature P3: VFX Turnover + Deliverables Tracker
- Purpose: Manage VFX shot lifecycle and final delivery checklist.
- Data model:
  - `VfxShot` (sceneId, shotId, vendor, bid, status, dueDate)
  - `VfxTurnover` (vfxShotId, plateRefs, notes, sentAt, approvedAt)
  - `DeliveryChecklistItem` (projectId, type, dueDate, status, ownerId)
- UI:
  - VFX board (`NOT_SENT -> IN_VENDOR -> CLIENT_REVIEW -> FINAL`).
  - Delivery checklist for masters, captions, stems, QC.
- Integrations:
  - Budget variance on VFX bids vs actuals.
- Acceptance:
  - VFX and final delivery progress are trackable with owner accountability.

## Department branch strategy

- `department/art`
  - A1 Continuity Bible
  - A2 Set Dressing and Props Pull Lists
  - A3 Build/Strike Schedule
- `department/camera`
  - C1 Shot List + Lens/Camera Package Planner
  - C2 Camera Package + Rental Tracker
  - C3 Daily Camera Reports
- `department/grip-electric`
  - G1 Lighting Plan
  - G2 Rigging + Grip Schedule
  - G3 Power + Distro Safety
- `department/post`
  - P1 Dailies Ingest + QC
  - P2 Cut Versions + Review Approvals
  - P3 VFX Turnover + Deliverables Tracker

## Suggested rollout by department branch

1. Week 1-2: Build core data model and CRUD flows for each department branch.
2. Week 3-4: Add schedule, call sheet, and budget integrations.
3. Week 5-6: Add automation, readiness alerts, and export/reporting.
4. Week 7: QA, permissions hardening, performance validation, and docs.

## Common Definition of Done (each branch)

- Schema migration + RLS policies + typed action layer.
- UI flow with loading, empty, and error states.
- Role checks for `ADMIN`, `COORDINATOR`, `DEPARTMENT_HEAD`.
- Unit/integration tests for core action logic.
- Basic telemetry events for creation, status updates, and blockers.
