export type ProjectStatus =
  | "DEVELOPMENT"
  | "PRE_PRODUCTION"
  | "PRODUCTION"
  | "POST_PRODUCTION"
  | "COMPLETED"
  | "ON_HOLD";

export interface CrewInvite {
  email: string;
  role: "ADMIN" | "COORDINATOR" | "DEPARTMENT_HEAD" | "CREW" | "CAST" | "VIEWER";
}

export interface CreateProjectData {
  name: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  crewInvites?: CrewInvite[];
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed counts
  scenesCount: number;
  shootingDaysCount: number;
  castCount: number;
  locationsCount: number;
}
