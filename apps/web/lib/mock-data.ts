// Type definitions and constants for production data

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "DEVELOPMENT" | "PRE_PRODUCTION" | "PRODUCTION" | "POST_PRODUCTION" | "COMPLETED" | "ON_HOLD";
  startDate: string;
  endDate: string;
  scenesCount: number;
  shootingDaysCount: number;
  castCount: number;
  locationsCount: number;
  director?: string;
  producer?: string;
  budget?: string;
}

export interface Scene {
  id: string;
  projectId: string;
  sceneNumber: string;
  synopsis: string;
  intExt: "INT" | "EXT" | "BOTH";
  dayNight: "DAY" | "NIGHT" | "DAWN" | "DUSK";
  location: string;
  locationId?: string; // Reference to Location
  pageCount: number;
  status: "NOT_SCHEDULED" | "SCHEDULED" | "PARTIALLY_SHOT" | "COMPLETED" | "CUT";
  castIds: string[];
  // Enhanced scene data for shot list
  scriptDay?: string;
  estimatedMinutes?: number;
  elements?: string[];
  vfxRequired?: boolean;
  stuntsRequired?: boolean;
  specialEquipment?: string[];
  notes?: string;
  // Storyboard images
  imageUrl?: string;
  images?: string[];
  // Sort order for drag-and-drop
  sortOrder?: number;
}

export interface CastMember {
  id: string;
  projectId: string;
  characterName: string;
  actorName: string;
  castNumber: number;
  status: "ON_HOLD" | "CONFIRMED" | "WORKING" | "WRAPPED";
  email?: string;
  phone?: string;
  // Enhanced cast data
  agentName?: string;
  agentPhone?: string;
  callTime?: string;
  pickupTime?: string;
  hmTime?: string; // Hair/Makeup time
  onSetTime?: string;
}

export interface Location {
  id: string;
  projectId: string;
  name: string;
  address: string;
  type: "PRACTICAL" | "STUDIO" | "BACKLOT";
  intExt: "INT" | "EXT" | "BOTH";
  permitStatus: "NOT_STARTED" | "APPLIED" | "APPROVED" | "DENIED";
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

export interface ShootingDay {
  id: string;
  projectId: string;
  date: string;
  dayNumber: number;
  unit: "MAIN" | "SECOND";
  status: "TENTATIVE" | "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  generalCall: string;
  wrapTime?: string; // Added for duration
  scenes: string[];
  notes?: string;
  // Enhanced shooting day data
  crewCall?: string;
  talentCall?: string;
  lunchTime?: string;
  expectedWrap?: string;
  weatherBackup?: string;
  locationId?: string;
}

// Crew/Department Types
export type DepartmentType =
  | "PRODUCTION"
  | "DIRECTION"
  | "CAMERA"
  | "SOUND"
  | "LIGHTING"
  | "ART"
  | "COSTUME"
  | "HAIR_MAKEUP"
  | "LOCATIONS"
  | "STUNTS"
  | "VFX"
  | "TRANSPORTATION"
  | "CATERING"
  | "ACCOUNTING"
  | "POST_PRODUCTION";

export interface CrewMember {
  id: string;
  projectId: string;
  name: string;
  role: string;
  department: DepartmentType;
  email?: string;
  phone?: string;
  rate?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  isHead?: boolean;
  profilePhotoUrl?: string;
}

// Gear/Equipment types
export interface GearItem {
  id: string;
  projectId: string;
  name: string;
  category: "CAMERA" | "LIGHTING" | "SOUND" | "ART" | "COSTUME" | "PROPS" | "VEHICLES" | "SPECIAL_EQUIPMENT" | "OTHER";
  department: DepartmentType;
  quantity: number;
  notes?: string;
  photoUrl?: string;
  assignedScenes?: string[];
}

export const GEAR_CATEGORIES = {
  CAMERA: "Camera",
  LIGHTING: "Lighting",
  SOUND: "Sound",
  ART: "Art Department",
  COSTUME: "Costume",
  PROPS: "Props",
  VEHICLES: "Vehicles",
  SPECIAL_EQUIPMENT: "Special Equipment",
  OTHER: "Other",
} as const;

// Script type
export interface Script {
  id: string;
  projectId: string;
  version: number;
  color: "WHITE" | "BLUE" | "PINK" | "YELLOW" | "GREEN" | "GOLDENROD" | "BUFF" | "SALMON" | "CHERRY";
  fileUrl: string;
  fileName: string;
  uploadedAt: string;
}

export const SCRIPT_COLORS = {
  WHITE: { label: "White (Original)", color: "#FFFFFF" },
  BLUE: { label: "Blue (1st Revision)", color: "#A4D4FF" },
  PINK: { label: "Pink (2nd Revision)", color: "#FFB6C1" },
  YELLOW: { label: "Yellow (3rd Revision)", color: "#FFFACD" },
  GREEN: { label: "Green (4th Revision)", color: "#90EE90" },
  GOLDENROD: { label: "Goldenrod (5th Revision)", color: "#DAA520" },
  BUFF: { label: "Buff (6th Revision)", color: "#F5DEB3" },
  SALMON: { label: "Salmon (7th Revision)", color: "#FA8072" },
  CHERRY: { label: "Cherry (8th Revision)", color: "#DE3163" },
} as const;

export const DEPARTMENT_LABELS: Record<DepartmentType, string> = {
  PRODUCTION: "Production",
  DIRECTION: "Direction",
  CAMERA: "Camera",
  SOUND: "Sound",
  LIGHTING: "Lighting / Grip",
  ART: "Art Department",
  COSTUME: "Costume",
  HAIR_MAKEUP: "Hair & Makeup",
  LOCATIONS: "Locations",
  STUNTS: "Stunts",
  VFX: "Visual Effects",
  TRANSPORTATION: "Transportation",
  CATERING: "Catering",
  ACCOUNTING: "Accounting",
  POST_PRODUCTION: "Post-Production",
};
