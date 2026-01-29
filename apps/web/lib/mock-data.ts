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

// =============================================
// FinanceOps Types
// =============================================

export type BudgetStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "LOCKED";
export type ReceiptStatus = "MISSING" | "PENDING" | "APPROVED" | "REJECTED";
export type BudgetUnits = "DAYS" | "WEEKS" | "FLAT" | "HOURS" | "EACH";
export type AlertType = "WARNING" | "ERROR" | "INFO";
export type BudgetHealthStatus = "ON_TRACK" | "WARNING" | "OVER_BUDGET";

export interface Budget {
  id: string;
  projectId: string;
  version: number;
  versionName: string;
  status: BudgetStatus;

  // Totals (calculated from line items)
  totalEstimated: number;
  totalActual: number;
  totalCommitted: number;

  // Contingency
  contingencyPercent: number;
  contingencyAmount: number;

  // Metadata
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategory {
  id: string;
  budgetId: string;
  code: string; // e.g., "2000", "2300"
  name: string; // e.g., "Production", "Camera"
  parentCategoryId?: string;

  // Subtotals (calculated from line items)
  subtotalEstimated: number;
  subtotalActual: number;

  // Display order
  sortOrder: number;

  createdAt: string;
  updatedAt: string;
}

export interface BudgetLineItem {
  id: string;
  categoryId: string;
  accountCode: string; // e.g., "2301" for Camera Crew
  description: string; // e.g., "Director of Photography"

  // Calculation fields
  units: BudgetUnits;
  quantity: number;
  rate: number;
  subtotal: number; // quantity × rate

  // Fringe benefits (for labor)
  fringePercent: number;
  fringeAmount: number; // subtotal × fringePercent

  // Totals
  estimatedTotal: number; // subtotal + fringeAmount
  actualCost: number; // sum of transactions
  committedCost: number; // POs issued but not paid
  variance: number; // actualCost - estimatedTotal

  // Schedule integration
  linkedScheduleItems: string[]; // array of castMember/crew IDs
  isScheduleSynced: boolean;

  // Metadata
  notes?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  budgetId: string;
  lineItemId?: string;

  // Transaction details
  date: string;
  vendor: string;
  amount: number;
  description: string;
  category: string; // from budget categories for quick filtering

  // Receipt tracking
  receiptUrl?: string; // uploaded receipt image/PDF
  receiptStatus: ReceiptStatus;

  // Metadata
  enteredBy: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTemplate {
  id: string;
  name: string;
  description?: string;
  budgetRange?: string; // e.g., "$500K - $2M"
  templateData: {
    categories: {
      code: string;
      name: string;
      subcategories?: { code: string; name: string }[];
    }[];
    lineItems: {
      accountCode: string;
      category: string;
      description: string;
      units: BudgetUnits;
      quantity: number;
      rate: number;
      fringePercent: number;
    }[];
  };
  isSystemTemplate: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAlert {
  id: string;
  budgetId: string;
  type: AlertType;
  message: string;
  department?: string;
  categoryId?: string;
  actionRequired: boolean;
  isDismissed: boolean;
  createdAt: string;
  dismissedAt?: string;
  dismissedBy?: string;
}

// Dashboard data interfaces
export interface BudgetSummary {
  estimated: number;
  actual: number;
  committed: number;
  remaining: number;
  percentSpent: number;
}

export interface BurnRate {
  dailyAverage: number;
  weeklyTrend: number[];
  projectedFinal: number;
}

export interface DepartmentHealth {
  department: string;
  percentSpent: number;
  percentScheduleComplete: number;
  status: BudgetHealthStatus;
}

export interface DashboardData {
  budgetSummary: BudgetSummary;
  burnRate: BurnRate;
  departmentHealth: DepartmentHealth[];
  alerts: BudgetAlert[];
}

// Budget constants
export const BUDGET_UNITS_LABELS: Record<BudgetUnits, string> = {
  DAYS: "Days",
  WEEKS: "Weeks",
  FLAT: "Flat",
  HOURS: "Hours",
  EACH: "Each",
};

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  LOCKED: "Locked",
};

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  MISSING: "Missing",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

// Standard film budget chart of accounts
export const BUDGET_CHART_OF_ACCOUNTS = {
  "1000": { name: "Above-the-Line", subcategories: {
    "1100": "Story & Rights",
    "1200": "Producers",
    "1300": "Director",
    "1400": "Cast",
  }},
  "2000": { name: "Production", subcategories: {
    "2100": "Production Staff",
    "2200": "Art Department",
    "2300": "Camera",
    "2400": "Sound",
    "2500": "Grip & Electric",
    "2600": "Wardrobe",
    "2700": "Hair & Makeup",
    "2800": "Locations",
    "2900": "Transportation",
  }},
  "3000": { name: "Post-Production", subcategories: {
    "3100": "Editing",
    "3200": "Sound Post",
    "3300": "Visual Effects",
    "3400": "Music",
  }},
  "4000": { name: "Other", subcategories: {
    "4100": "Insurance",
    "4200": "Legal",
    "4300": "Contingency",
  }},
} as const;
