# Crew/Cast Assignment Redesign (Linear-Style Workflows)

## Problem Summary

Current experience is person-first and fragmented:

- `Cast` and `Crew` are managed in separate screens.
- Assignment happens inside feature silos (`Element`, `BudgetTask`, `RiggingTask`) instead of one task system.
- Invites/access are managed in different steps from actual work ownership.
- There is no single "what needs to be done, by whom, by when" surface.

This creates overhead when the real user intent is usually:

1. Create a task/ticket.
2. Assign the right person.
3. Track status to completion.

## Product Direction

Make project coordination task-first, with people as assignable resources.

- Introduce a dedicated **Tasks** workspace (Linear-style list/board).
- Keep **Cast** and **Crew** as profile directories, but use them as assignee sources.
- Allow assigning during creation of work (and creating a person inline if missing).
- Add one unified "inbox" for unassigned work to avoid dropped items.

## UX Redo

## 1) New Navigation Model

Add `Tasks` as a first-class project section between `Scenes` and `Schedule`.

- Views:
  - `Board` (Backlog, Todo, In Progress, Blocked, Done)
  - `List` (filterable table)
  - `My Tasks` (current user)
  - `Unassigned` (triage queue)

## 2) Primary Flow (Linear)

### Create Task Flow

1. Quick-add (`C` or "New Task" button).
2. Enter title.
3. Choose task type (`General`, `Element`, `Rigging`, `Budget`, `Scene`, `Callsheet`).
4. Assign owner (cast/crew picker with inline search).
5. Optional due date + priority.
6. Save to `Todo` (or `Backlog` if no due date).

### Assign Person from Task

If person does not exist:

- `+ Add New Crew/Cast` in assignee picker.
- Side panel opens with minimal fields: `name`, `type`, `role/character`, `email`.
- On save, return to task with assignee preselected.
- Optional toggle: `Send invite now`.

### Add Crew/Cast Flow (Redo)

Current modals become a step-based side panel:

1. **Identity**: Name, Cast/Crew type, role/character.
2. **Access**: account status + invite/role (optional).
3. **Assignments**: attach starter tasks (new or existing).

Outcome: every newly added person can immediately own concrete work.

## 3) People Screen Refresh

Replace separate Cast/Crew mindset with a unified People directory and filters:

- Filter chips: `All`, `Crew`, `Cast`, `Unassigned`, `No Access`, `Invited`, `Active`.
- Each person row shows:
  - Role/character
  - Invite/access state
  - Open tasks count
  - Overdue tasks count
- Row action: `View Work` (opens task list scoped to that person).

Keep optional Cast/Crew tabs for familiarity during transition.

## Data Model (MVP)

Do not replace existing `CastMember`/`CrewMember` immediately. Add a shared task layer.

## New Tables

### `ProjectTask`

- `id` (uuid)
- `projectId` (fk)
- `title`
- `description`
- `status` enum: `BACKLOG | TODO | IN_PROGRESS | BLOCKED | DONE`
- `priority` enum: `NONE | LOW | MEDIUM | HIGH | URGENT`
- `taskType` enum: `GENERAL | ELEMENT | RIGGING | BUDGET | SCENE | CALLSHEET`
- `sourceId` (nullable, for linked entity ids)
- `dueDate` (nullable)
- `createdBy`
- `createdAt`, `updatedAt`

Indexes:

- `(projectId, status)`
- `(projectId, dueDate)`
- `(projectId, priority)`

### `ProjectTaskAssignee`

- `id` (uuid)
- `taskId` (fk -> `ProjectTask`)
- `crewMemberId` (nullable fk -> `CrewMember`)
- `castMemberId` (nullable fk -> `CastMember`)
- `assignmentRole` enum: `OWNER | COLLABORATOR`
- `createdAt`

Constraint:

- Exactly one of `crewMemberId` or `castMemberId` is non-null.

Why this MVP structure:

- Avoids a risky cast/crew unification migration now.
- Supports immediate cross-domain assignment without rewriting existing entities.

## API / Server Actions

Add new actions:

- `createProjectTask`
- `updateProjectTask`
- `moveProjectTask`
- `deleteProjectTask`
- `assignTaskToCrewMember`
- `assignTaskToCastMember`
- `unassignTask`
- `getProjectTasks`
- `getTasksForPerson`
- `getUnassignedTasks`

Permission baseline:

- Read: any `project:read`
- Create/update/assign: `project:write` (or stricter `crew:write`/`cast:write` by task type later)
- Delete: `project:manage-team` or `project:write` (team decision)

## Integration Plan (Incremental)

## Phase 1 (MVP, 1 sprint)

- Create DB tables + RLS + indexes.
- Build `Tasks` section with board + list.
- Add assignee picker supporting both crew and cast.
- Add quick task create.

## Phase 2 (1 sprint)

- Inline "add person" from task assignment.
- Add starter-task step in add cast/add crew flows.
- Add person workload chips (open/overdue) in People screens.

## Phase 3 (1-2 sprints)

- Link existing siloed tasks:
  - `Element.taskType/assignedToCrewId` -> mirrored `ProjectTask`
  - `BudgetTask` -> migrate or mirror into `ProjectTask`
  - `RiggingTask` -> mirror into `ProjectTask` for unified tracking
- Add cross-link cards (`Open source item`).

## Phase 4 (optional polish)

- Notifications: assignment, due soon, overdue.
- Keyboard-heavy workflow (Linear-like):
  - `C` create task
  - `A` assign
  - `M` move status
- Saved views per department.

## Overarching Todo Backlog (Prioritized)

## P0

1. Define `ProjectTask` + `ProjectTaskAssignee` schema and RLS.
2. Implement server actions + types.
3. Add `Tasks` project section and sidebar item.
4. Implement board/list with status updates and assignee chips.
5. Add unified assignee picker (Crew + Cast).

## P1

1. Refactor add crew/cast into step panel with final "Assignments" step.
2. Inline "create person while assigning task".
3. Add person workload indicators to People/Cast/Crew rows.
4. Add `Unassigned` and `My Tasks` saved views.

## P2

1. Backfill/mirror `Element` task metadata into `ProjectTask`.
2. Backfill/mirror `BudgetTask` into `ProjectTask`.
3. Backfill/mirror `RiggingTask` into `ProjectTask`.
4. Add migration scripts and idempotent sync jobs.

## P3

1. Assignment notifications.
2. SLA/overdue automation.
3. Analytics dashboard for task throughput and completion lead time.

## Success Criteria

- Time from "need work done" to "task assigned" < 20 seconds.
- % of tasks unassigned for >24h drops week-over-week.
- % of tasks completed by due date increases.
- Cast/crew onboarding includes at least one assignment in majority of new entries.

## Non-Goals (for MVP)

- Full replacement of cast/crew data model.
- Department-specific custom workflows per task type.
- Complex dependency graphs between tasks.
