export type AppTab = "today" | "schedule" | "callsheets" | "people" | "more";

export type ShootingDayStatus =
  | "TENTATIVE"
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

export interface ShootingDaySummary {
  id: string;
  projectId: string;
  date: string;
  dayNumber: number;
  unit: string;
  status: ShootingDayStatus;
  generalCall: string | null;
  shootingCall: string | null;
  estimatedWrap: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface CallSheetSummary {
  id: string;
  shootingDayId: string;
  version: number;
  publishedAt: string | null;
  nearestHospital: string | null;
  safetyNotes: string | null;
  parkingNotes: string | null;
  mealNotes: string | null;
  advanceNotes: string | null;
  updatedAt: string;
}

export interface SceneSummary {
  id: string;
  sceneNumber: string;
  synopsis: string | null;
  intExt: string;
  dayNight: string;
  pageCount: number;
  setName: string | null;
  locationName: string | null;
  locationAddress: string | null;
}

export interface CastCallSummary {
  id: string;
  castMemberId: string;
  characterName: string;
  actorName: string | null;
  castNumber: number | null;
  workStatus: string;
  pickupTime: string | null;
  muHairCall: string | null;
  onSetCall: string | null;
  remarks: string | null;
}

export interface DepartmentCallSummary {
  id: string;
  department: string;
  callTime: string;
  notes: string | null;
}

export interface CrewCallSummary {
  id: string;
  crewName: string;
  callTime: string;
  notes: string | null;
  sortOrder: number;
}

export interface DayOverview {
  day: ShootingDaySummary | null;
  callSheet: CallSheetSummary | null;
  scenes: SceneSummary[];
  castCalls: CastCallSummary[];
  departmentCalls: DepartmentCallSummary[];
  crewCalls: CrewCallSummary[];
}

export interface CallSheetListRow {
  id: string;
  shootingDayId: string;
  version: number;
  publishedAt: string | null;
  dayNumber: number;
  date: string;
  updatedAt: string;
}

export interface DataResult<T> {
  data: T | null;
  error: string | null;
}
