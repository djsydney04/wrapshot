"use client";

import * as React from "react";
import { Calendar, ListTodo, Plus, Trash2, UserCircle2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createProjectTask,
  deleteProjectTask,
  moveProjectTask,
  type ProjectTask,
  type ProjectTaskPriority,
  type ProjectTaskStatus,
  type ProjectTaskType,
} from "@/lib/actions/project-tasks";
import type { CrewMemberWithInviteStatus } from "@/lib/actions/crew";
import type { CastMemberWithInviteStatus } from "@/lib/actions/cast";

interface TasksSectionProps {
  projectId: string;
  tasks: ProjectTask[];
  crew: CrewMemberWithInviteStatus[];
  cast: CastMemberWithInviteStatus[];
  currentUserId?: string;
}

type TaskView = "board" | "list" | "my" | "unassigned";
type AssigneeType = "CREW" | "CAST" | "";

interface CreateTaskFormState {
  title: string;
  description: string;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  taskType: ProjectTaskType;
  dueDate: string;
  assigneeType: AssigneeType;
  assigneeId: string;
}

const TASK_STATUSES: Array<{ value: ProjectTaskStatus; label: string }> = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "TODO", label: "Todo" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DONE", label: "Done" },
];

const TASK_PRIORITIES: Array<{ value: ProjectTaskPriority; label: string }> = [
  { value: "NONE", label: "No Priority" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const TASK_TYPES: Array<{ value: ProjectTaskType; label: string }> = [
  { value: "GENERAL", label: "General" },
  { value: "ELEMENT", label: "Element" },
  { value: "RIGGING", label: "Rigging" },
  { value: "BUDGET", label: "Budget" },
  { value: "SCENE", label: "Scene" },
  { value: "CALLSHEET", label: "Call Sheet" },
];

const INITIAL_FORM_STATE: CreateTaskFormState = {
  title: "",
  description: "",
  status: "TODO",
  priority: "NONE",
  taskType: "GENERAL",
  dueDate: "",
  assigneeType: "",
  assigneeId: "",
};

function formatTaskDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function priorityClass(priority: ProjectTaskPriority): string {
  if (priority === "URGENT") return "border-red-600 text-red-600";
  if (priority === "HIGH") return "border-orange-600 text-orange-600";
  if (priority === "MEDIUM") return "border-blue-600 text-blue-600";
  if (priority === "LOW") return "border-emerald-600 text-emerald-600";
  return "border-muted-foreground/40 text-muted-foreground";
}

export function TasksSection({
  projectId,
  tasks,
  crew,
  cast,
  currentUserId,
}: TasksSectionProps) {
  const [activeView, setActiveView] = React.useState<TaskView>("board");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [localTasks, setLocalTasks] = React.useState<ProjectTask[]>(tasks);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [formState, setFormState] = React.useState<CreateTaskFormState>(INITIAL_FORM_STATE);
  const [creating, setCreating] = React.useState(false);
  const [statusUpdatingTaskId, setStatusUpdatingTaskId] = React.useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "c" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTypingTarget =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        Boolean(target?.isContentEditable);

      if (isTypingTarget) return;

      event.preventDefault();
      setShowCreateDialog(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const assigneeOptions = React.useMemo(() => {
    if (formState.assigneeType === "CREW") {
      return crew.map((member) => ({
        value: member.id,
        label: `${member.name}${member.role ? ` (${member.role})` : ""}`,
      }));
    }

    if (formState.assigneeType === "CAST") {
      return cast.map((member) => ({
        value: member.id,
        label: `${member.characterName}${member.actorName ? ` (${member.actorName})` : ""}`,
      }));
    }

    return [];
  }, [cast, crew, formState.assigneeType]);

  const filteredTasks = React.useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return localTasks;

    return localTasks.filter((task) => {
      const assignmentSearch = task.assignments
        .map((assignment) => `${assignment.assigneeName} ${assignment.assigneeSubtitle || ""}`)
        .join(" ")
        .toLowerCase();
      return (
        task.title.toLowerCase().includes(normalized) ||
        (task.description || "").toLowerCase().includes(normalized) ||
        assignmentSearch.includes(normalized)
      );
    });
  }, [localTasks, searchQuery]);

  const visibleTasks = React.useMemo(() => {
    if (activeView === "unassigned") {
      return filteredTasks.filter((task) => task.assignments.length === 0);
    }

    if (activeView === "my") {
      if (!currentUserId) return [];
      return filteredTasks.filter((task) =>
        task.assignments.some((assignee) => assignee.assigneeUserId === currentUserId)
      );
    }

    return filteredTasks;
  }, [activeView, currentUserId, filteredTasks]);

  const tasksByStatus = React.useMemo(() => {
    return TASK_STATUSES.reduce<Record<ProjectTaskStatus, ProjectTask[]>>(
      (acc, status) => {
        acc[status.value] = visibleTasks.filter((task) => task.status === status.value);
        return acc;
      },
      {
        BACKLOG: [],
        TODO: [],
        IN_PROGRESS: [],
        BLOCKED: [],
        DONE: [],
      }
    );
  }, [visibleTasks]);

  const resetCreateForm = React.useCallback(() => {
    setFormState(INITIAL_FORM_STATE);
    setFormError(null);
  }, []);

  const handleCreateTask = async () => {
    const title = formState.title.trim();
    if (!title) {
      setFormError("Task title is required.");
      return;
    }

    setCreating(true);
    setFormError(null);

    const assignees =
      formState.assigneeType && formState.assigneeId
        ? [{ type: formState.assigneeType, memberId: formState.assigneeId }]
        : undefined;

    const result = await createProjectTask({
      projectId,
      title,
      description: formState.description.trim() || null,
      status: formState.status,
      priority: formState.priority,
      taskType: formState.taskType,
      dueDate: formState.dueDate || null,
      assignees,
    });

    if (result.error || !result.data) {
      setFormError(result.error || "Failed to create task.");
      setCreating(false);
      return;
    }

    setLocalTasks((previous) => [result.data!, ...previous]);
    setShowCreateDialog(false);
    setCreating(false);
    resetCreateForm();
  };

  const handleMoveTask = async (taskId: string, status: ProjectTaskStatus) => {
    setStatusUpdatingTaskId(taskId);
    const result = await moveProjectTask(taskId, status);
    setStatusUpdatingTaskId(null);

    if (result.error || !result.data) return;

    setLocalTasks((previous) =>
      previous.map((task) => (task.id === taskId ? result.data! : task))
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;

    setDeletingTaskId(taskId);
    const result = await deleteProjectTask(taskId);
    setDeletingTaskId(null);
    if (!result.success) return;

    setLocalTasks((previous) => previous.filter((task) => task.id !== taskId));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Project Tasks</h3>
          <p className="text-xs text-muted-foreground">
            Press <kbd className="rounded border px-1 py-0.5 text-[10px]">C</kbd> to create.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Button variant="skeuo" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      <Tabs
        value={activeView}
        defaultValue="board"
        onValueChange={(value) => setActiveView(value as TaskView)}
      >
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="my">My Tasks</TabsTrigger>
          <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          {visibleTasks.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-5">
              {TASK_STATUSES.map((status) => (
                <div key={status.value} className="rounded-lg border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em]">
                      {status.label}
                    </p>
                    <Badge variant="secondary">{tasksByStatus[status.value].length}</Badge>
                  </div>

                  <div className="space-y-2 p-2">
                    {tasksByStatus[status.value].length > 0 ? (
                      tasksByStatus[status.value].map((task) => (
                        <div key={task.id} className="rounded-md border border-border p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">{task.title}</p>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              disabled={deletingTaskId === task.id}
                              onClick={() => void handleDeleteTask(task.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {task.description && (
                            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge variant="outline" className={priorityClass(task.priority)}>
                              {task.priority}
                            </Badge>
                            <Badge variant="outline">{task.taskType}</Badge>
                          </div>

                          {task.assignments.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {task.assignments.slice(0, 2).map((assignee) => (
                                <Badge key={assignee.id} variant="secondary">
                                  {assignee.assigneeName}
                                </Badge>
                              ))}
                              {task.assignments.length > 2 && (
                                <Badge variant="secondary">
                                  +{task.assignments.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">Unassigned</p>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatTaskDate(task.dueDate)}
                            </div>
                            <div className="w-36">
                              <Select
                                value={task.status}
                                onChange={(event) =>
                                  void handleMoveTask(
                                    task.id,
                                    event.target.value as ProjectTaskStatus
                                  )
                                }
                                disabled={statusUpdatingTaskId === task.id}
                                options={TASK_STATUSES.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                }))}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyTaskState
              title="No tasks found"
              description="Create your first task to start assigning work."
            />
          )}
        </TabsContent>

        <TabsContent value="list">
          <TaskListTable
            tasks={visibleTasks}
            statusUpdatingTaskId={statusUpdatingTaskId}
            deletingTaskId={deletingTaskId}
            onMoveTask={handleMoveTask}
            onDeleteTask={handleDeleteTask}
          />
        </TabsContent>

        <TabsContent value="my">
          {!currentUserId ? (
            <EmptyTaskState
              title="No account linked"
              description="Link this profile to your account to see My Tasks."
            />
          ) : (
            <TaskListTable
              tasks={visibleTasks}
              statusUpdatingTaskId={statusUpdatingTaskId}
              deletingTaskId={deletingTaskId}
              onMoveTask={handleMoveTask}
              onDeleteTask={handleDeleteTask}
            />
          )}
        </TabsContent>

        <TabsContent value="unassigned">
          <TaskListTable
            tasks={visibleTasks}
            statusUpdatingTaskId={statusUpdatingTaskId}
            deletingTaskId={deletingTaskId}
            onMoveTask={handleMoveTask}
            onDeleteTask={handleDeleteTask}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent onClose={() => setShowCreateDialog(false)} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Add a ticket and assign an owner in one flow.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title *</label>
              <Input
                value={formState.title}
                onChange={(event) =>
                  setFormState((previous) => ({ ...previous, title: event.target.value }))
                }
                placeholder="What needs to be done?"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Description</label>
              <Textarea
                value={formState.description}
                onChange={(event) =>
                  setFormState((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Optional context"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Type</label>
                <Select
                  value={formState.taskType}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      taskType: event.target.value as ProjectTaskType,
                    }))
                  }
                  options={TASK_TYPES}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Priority</label>
                <Select
                  value={formState.priority}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      priority: event.target.value as ProjectTaskPriority,
                    }))
                  }
                  options={TASK_PRIORITIES}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Status</label>
                <Select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      status: event.target.value as ProjectTaskStatus,
                    }))
                  }
                  options={TASK_STATUSES}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={formState.dueDate}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      dueDate: event.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Assignee Type</label>
                <Select
                  value={formState.assigneeType}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      assigneeType: event.target.value as AssigneeType,
                      assigneeId: "",
                    }))
                  }
                  options={[
                    { value: "", label: "Unassigned" },
                    { value: "CREW", label: "Crew" },
                    { value: "CAST", label: "Cast" },
                  ]}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Assignee</label>
                <Select
                  value={formState.assigneeId}
                  disabled={!formState.assigneeType}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      assigneeId: event.target.value,
                    }))
                  }
                  options={[
                    {
                      value: "",
                      label: formState.assigneeType ? "Select a person" : "Pick type first",
                    },
                    ...assigneeOptions,
                  ]}
                />
              </div>
            </div>

            {formError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="skeuo"
              disabled={creating}
              onClick={() => void handleCreateTask()}
            >
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TaskListTableProps {
  tasks: ProjectTask[];
  statusUpdatingTaskId: string | null;
  deletingTaskId: string | null;
  onMoveTask: (taskId: string, status: ProjectTaskStatus) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

function TaskListTable({
  tasks,
  statusUpdatingTaskId,
  deletingTaskId,
  onMoveTask,
  onDeleteTask,
}: TaskListTableProps) {
  if (tasks.length === 0) {
    return (
      <EmptyTaskState
        title="No tasks in this view"
        description="Create tasks or change filters to see more."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Priority</th>
            <th className="w-10 px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="px-3 py-2 align-top">
                <p className="font-medium">{task.title}</p>
                {task.description && (
                  <p className="mt-0.5 max-w-[320px] text-xs text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
              </td>
              <td className="px-3 py-2 align-top">
                <Badge variant="outline">{task.taskType}</Badge>
              </td>
              <td className="px-3 py-2 align-top">
                <div className="w-36">
                  <Select
                    value={task.status}
                    disabled={statusUpdatingTaskId === task.id}
                    onChange={(event) =>
                      void onMoveTask(task.id, event.target.value as ProjectTaskStatus)
                    }
                    options={TASK_STATUSES}
                  />
                </div>
              </td>
              <td className="px-3 py-2 align-top">
                {task.assignments.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.assignments.map((assignee) => (
                      <Badge key={assignee.id} variant="secondary">
                        {assignee.assigneeName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserCircle2 className="h-3.5 w-3.5" />
                    Unassigned
                  </div>
                )}
              </td>
              <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                {formatTaskDate(task.dueDate)}
              </td>
              <td className="px-3 py-2 align-top">
                <Badge variant="outline" className={priorityClass(task.priority)}>
                  {task.priority}
                </Badge>
              </td>
              <td className="px-3 py-2 align-top">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={deletingTaskId === task.id}
                  onClick={() => void onDeleteTask(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface EmptyTaskStateProps {
  title: string;
  description: string;
}

function EmptyTaskState({ title, description }: EmptyTaskStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
      <ListTodo className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
      <h3 className="mb-1 font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
