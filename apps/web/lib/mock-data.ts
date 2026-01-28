// Mock data for development - will be replaced with Supabase queries

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

// Sample Projects
export const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "Midnight in Paris",
    description: "A romantic comedy about a screenwriter who finds himself mysteriously traveling back to 1920s Paris each night.",
    status: "PRODUCTION",
    startDate: "2025-02-01",
    endDate: "2025-04-30",
    scenesCount: 84,
    shootingDaysCount: 32,
    castCount: 12,
    locationsCount: 8,
    director: "Sofia Laurent",
    producer: "David Chen",
    budget: "$28M",
  },
  {
    id: "proj-2",
    name: "The Last Frontier",
    description: "An epic western following a group of settlers pushing into the American frontier.",
    status: "PRE_PRODUCTION",
    startDate: "2025-05-15",
    endDate: "2025-08-20",
    scenesCount: 112,
    shootingDaysCount: 45,
    castCount: 24,
    locationsCount: 15,
    director: "Marcus Reid",
    producer: "Jennifer Walsh",
    budget: "$45M",
  },
  {
    id: "proj-3",
    name: "Code Red",
    description: "A thriller about a cybersecurity expert who uncovers a global conspiracy.",
    status: "DEVELOPMENT",
    startDate: "2025-09-01",
    endDate: "2025-12-15",
    scenesCount: 0,
    shootingDaysCount: 0,
    castCount: 0,
    locationsCount: 0,
    director: "TBD",
    producer: "Amanda Liu",
  },
];

// Sample Scenes for Project 1
export const mockScenes: Scene[] = [
  {
    id: "scene-1",
    projectId: "proj-1",
    sceneNumber: "1",
    synopsis: "Gil arrives in Paris with his fiancée Inez and her parents.",
    intExt: "EXT",
    dayNight: "DAY",
    location: "Charles de Gaulle Airport",
    locationId: "loc-1",
    pageCount: 2.5,
    status: "COMPLETED",
    castIds: ["cast-1", "cast-2"],
    scriptDay: "1",
    estimatedMinutes: 3,
    elements: ["Luggage", "Passport props", "Airport signage"],
    vfxRequired: false,
    stuntsRequired: false,
    notes: "Need airport permits, shooting window 6AM-9AM only",
  },
  {
    id: "scene-2",
    projectId: "proj-1",
    sceneNumber: "2",
    synopsis: "The group checks into their hotel overlooking the Seine.",
    intExt: "INT",
    dayNight: "DAY",
    location: "Hotel Le Meurice - Lobby",
    locationId: "loc-2",
    pageCount: 1.25,
    status: "COMPLETED",
    castIds: ["cast-1", "cast-2", "cast-3", "cast-4"],
    scriptDay: "1",
    estimatedMinutes: 2,
    elements: ["Vintage luggage", "Hotel key props", "Period bellhop costume"],
    vfxRequired: false,
    stuntsRequired: false,
  },
  {
    id: "scene-3",
    projectId: "proj-1",
    sceneNumber: "3",
    synopsis: "Gil wanders the streets of Paris at midnight, searching for inspiration.",
    intExt: "EXT",
    dayNight: "NIGHT",
    location: "Montmartre Streets",
    locationId: "loc-3",
    pageCount: 3,
    status: "SCHEDULED",
    castIds: ["cast-1"],
    scriptDay: "2",
    estimatedMinutes: 4,
    elements: ["Wine bottle prop", "Notebook"],
    vfxRequired: false,
    stuntsRequired: false,
    specialEquipment: ["Steadicam", "Lighting truck"],
    notes: "Night exterior - need police escort for street closure",
  },
  {
    id: "scene-4",
    projectId: "proj-1",
    sceneNumber: "4",
    synopsis: "A vintage car pulls up and Gil is invited inside by strangers in period dress.",
    intExt: "EXT",
    dayNight: "NIGHT",
    location: "Place de la Contrescarpe",
    locationId: "loc-4", // Applied permit status
    pageCount: 2,
    status: "SCHEDULED",
    castIds: ["cast-1", "cast-5", "cast-6"],
    scriptDay: "2",
    estimatedMinutes: 3,
    elements: ["1920s Peugeot vintage car", "Period costumes", "Champagne glasses"],
    vfxRequired: true,
    stuntsRequired: false,
    specialEquipment: ["Car mount", "Low loader"],
    notes: "VFX needed to remove modern street elements",
  },
  {
    id: "scene-5",
    projectId: "proj-1",
    sceneNumber: "5",
    synopsis: "Gil finds himself at a 1920s party where he meets F. Scott Fitzgerald.",
    intExt: "INT",
    dayNight: "NIGHT",
    location: "1920s Salon Set",
    locationId: "loc-5", // NOT_STARTED permit - will trigger alert
    pageCount: 4,
    status: "NOT_SCHEDULED",
    castIds: ["cast-1", "cast-7", "cast-8"],
    scriptDay: "2",
    estimatedMinutes: 5,
    elements: ["Art deco furniture", "Champagne fountain", "Period paintings", "Jazz band instruments"],
    vfxRequired: false,
    stuntsRequired: false,
    specialEquipment: ["Dolly track"],
    notes: "40 background actors needed in period costume",
  },
  {
    id: "scene-6",
    projectId: "proj-1",
    sceneNumber: "6",
    synopsis: "Inez confronts Gil about his late-night disappearances.",
    intExt: "INT",
    dayNight: "DAY",
    location: "Hotel Le Meurice - Suite",
    locationId: "loc-2",
    pageCount: 2.5,
    status: "NOT_SCHEDULED",
    castIds: ["cast-1", "cast-2"],
    scriptDay: "3",
    estimatedMinutes: 3,
    elements: ["Room service tray", "Newspaper prop"],
    vfxRequired: false,
    stuntsRequired: false,
  },
];

// Sample Cast for Project 1
export const mockCast: CastMember[] = [
  {
    id: "cast-1",
    projectId: "proj-1",
    characterName: "Gil Pender",
    actorName: "Michael Chen",
    castNumber: 1,
    status: "WORKING",
    email: "michael.chen@agency.com",
  },
  {
    id: "cast-2",
    projectId: "proj-1",
    characterName: "Inez",
    actorName: "Sarah Mitchell",
    castNumber: 2,
    status: "WORKING",
    email: "sarah.m@talent.com",
  },
  {
    id: "cast-3",
    projectId: "proj-1",
    characterName: "John (Inez's Father)",
    actorName: "Robert Williams",
    castNumber: 3,
    status: "CONFIRMED",
  },
  {
    id: "cast-4",
    projectId: "proj-1",
    characterName: "Helen (Inez's Mother)",
    actorName: "Patricia Adams",
    castNumber: 4,
    status: "CONFIRMED",
  },
  {
    id: "cast-5",
    projectId: "proj-1",
    characterName: "Adriana",
    actorName: "Isabella Romano",
    castNumber: 5,
    status: "CONFIRMED",
  },
  {
    id: "cast-6",
    projectId: "proj-1",
    characterName: "Pablo Picasso",
    actorName: "Diego Fernandez",
    castNumber: 6,
    status: "ON_HOLD",
  },
  {
    id: "cast-7",
    projectId: "proj-1",
    characterName: "F. Scott Fitzgerald",
    actorName: "James Harper",
    castNumber: 7,
    status: "CONFIRMED",
  },
  {
    id: "cast-8",
    projectId: "proj-1",
    characterName: "Zelda Fitzgerald",
    actorName: "Emma Clarke",
    castNumber: 8,
    status: "CONFIRMED",
  },
];

// Sample Locations for Project 1
export const mockLocations: Location[] = [
  {
    id: "loc-1",
    projectId: "proj-1",
    name: "Charles de Gaulle Airport",
    address: "95700 Roissy-en-France, France",
    type: "PRACTICAL",
    intExt: "BOTH",
    permitStatus: "APPROVED",
  },
  {
    id: "loc-2",
    projectId: "proj-1",
    name: "Hotel Le Meurice",
    address: "228 Rue de Rivoli, 75001 Paris",
    type: "PRACTICAL",
    intExt: "INT",
    permitStatus: "APPROVED",
  },
  {
    id: "loc-3",
    projectId: "proj-1",
    name: "Montmartre Streets",
    address: "Montmartre, 75018 Paris",
    type: "PRACTICAL",
    intExt: "EXT",
    permitStatus: "APPROVED",
  },
  {
    id: "loc-4",
    projectId: "proj-1",
    name: "Place de la Contrescarpe",
    address: "Place de la Contrescarpe, 75005 Paris",
    type: "PRACTICAL",
    intExt: "EXT",
    permitStatus: "APPLIED",
  },
  {
    id: "loc-5",
    projectId: "proj-1",
    name: "1920s Salon Set",
    address: "Studio Babelsberg, Stage 4",
    type: "STUDIO",
    intExt: "INT",
    permitStatus: "NOT_STARTED",
  },
];

// Helper to generate dates relative to today
function getRelativeDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}

// Sample Shooting Days for Project 1 (dates are relative to today)
export const mockShootingDays: ShootingDay[] = [
  {
    id: "day-1",
    projectId: "proj-1",
    date: getRelativeDate(-5), // 5 days ago
    dayNumber: 1,
    unit: "MAIN",
    status: "COMPLETED",
    generalCall: "06:00",
    wrapTime: "18:00",
    scenes: ["scene-1"],
    notes: "First day of principal photography",
    crewCall: "05:30",
    talentCall: "07:00",
    lunchTime: "12:00",
    locationId: "loc-1",
  },
  {
    id: "day-2",
    projectId: "proj-1",
    date: getRelativeDate(-3), // 3 days ago
    dayNumber: 2,
    unit: "MAIN",
    status: "COMPLETED",
    generalCall: "07:00",
    wrapTime: "19:00",
    scenes: ["scene-2"],
    crewCall: "06:30",
    talentCall: "08:00",
    lunchTime: "12:30",
    locationId: "loc-2",
  },
  {
    id: "day-3",
    projectId: "proj-1",
    date: getRelativeDate(1), // Tomorrow
    dayNumber: 3,
    unit: "MAIN",
    status: "CONFIRMED",
    generalCall: "14:00",
    wrapTime: "02:00",
    scenes: ["scene-3", "scene-4"],
    notes: "Night shoot - late call",
    crewCall: "13:30",
    talentCall: "15:00",
    lunchTime: "19:00",
    locationId: "loc-3",
    weatherBackup: "Cover set at Stage 4",
  },
  {
    id: "day-4",
    projectId: "proj-1",
    date: getRelativeDate(3), // 3 days from now
    dayNumber: 4,
    unit: "MAIN",
    status: "SCHEDULED",
    generalCall: "07:00",
    wrapTime: "20:00",
    scenes: ["scene-5"],
    crewCall: "06:30",
    talentCall: "08:00",
    lunchTime: "13:00",
    locationId: "loc-5",
  },
  {
    id: "day-5",
    projectId: "proj-1",
    date: getRelativeDate(5), // 5 days from now
    dayNumber: 5,
    unit: "MAIN",
    status: "TENTATIVE",
    generalCall: "07:00",
    wrapTime: "17:00",
    scenes: ["scene-6"],
    crewCall: "06:30",
    talentCall: "08:30",
    lunchTime: "12:00",
    locationId: "loc-2",
  },
  {
    id: "day-6",
    projectId: "proj-1",
    date: getRelativeDate(8), // 8 days from now
    dayNumber: 6,
    unit: "MAIN",
    status: "TENTATIVE",
    generalCall: "07:00",
    wrapTime: "19:00",
    scenes: [],
  },
  {
    id: "day-7",
    projectId: "proj-1",
    date: getRelativeDate(10), // 10 days from now
    dayNumber: 7,
    unit: "SECOND",
    status: "TENTATIVE",
    generalCall: "08:00",
    wrapTime: "16:00",
    scenes: [],
    notes: "Second unit B-roll",
  },
];

// Sample Crew for Project 1
export const mockCrew: CrewMember[] = [
  // Direction
  {
    id: "crew-1",
    projectId: "proj-1",
    name: "Sofia Laurent",
    role: "Director",
    department: "DIRECTION",
    email: "sofia@production.com",
    phone: "+33 6 12 34 56 78",
    isHead: true,
  },
  {
    id: "crew-2",
    projectId: "proj-1",
    name: "Marcus Webb",
    role: "1st Assistant Director",
    department: "DIRECTION",
    email: "marcus.webb@production.com",
    phone: "+33 6 22 33 44 55",
    isHead: false,
  },
  {
    id: "crew-3",
    projectId: "proj-1",
    name: "Claire Dubois",
    role: "2nd Assistant Director",
    department: "DIRECTION",
    email: "claire.d@production.com",
    isHead: false,
  },
  // Production
  {
    id: "crew-4",
    projectId: "proj-1",
    name: "David Chen",
    role: "Producer",
    department: "PRODUCTION",
    email: "david.chen@studioexec.com",
    phone: "+1 310 555 0100",
    isHead: true,
  },
  {
    id: "crew-5",
    projectId: "proj-1",
    name: "Sarah Miller",
    role: "Line Producer",
    department: "PRODUCTION",
    email: "sarah.m@production.com",
    isHead: false,
  },
  {
    id: "crew-6",
    projectId: "proj-1",
    name: "Tom Richards",
    role: "Production Manager",
    department: "PRODUCTION",
    email: "tom.r@production.com",
    isHead: false,
  },
  // Camera
  {
    id: "crew-7",
    projectId: "proj-1",
    name: "Jean-Pierre Martin",
    role: "Director of Photography",
    department: "CAMERA",
    email: "jp.martin@cinematography.fr",
    phone: "+33 6 77 88 99 00",
    isHead: true,
  },
  {
    id: "crew-8",
    projectId: "proj-1",
    name: "Alex Turner",
    role: "Camera Operator",
    department: "CAMERA",
    email: "alex.t@crew.com",
    isHead: false,
  },
  {
    id: "crew-9",
    projectId: "proj-1",
    name: "Mike Santos",
    role: "1st AC / Focus Puller",
    department: "CAMERA",
    isHead: false,
  },
  // Sound
  {
    id: "crew-10",
    projectId: "proj-1",
    name: "Robert Blanc",
    role: "Production Sound Mixer",
    department: "SOUND",
    email: "r.blanc@soundcrew.com",
    isHead: true,
  },
  {
    id: "crew-11",
    projectId: "proj-1",
    name: "Emily Ross",
    role: "Boom Operator",
    department: "SOUND",
    isHead: false,
  },
  // Lighting
  {
    id: "crew-12",
    projectId: "proj-1",
    name: "Henri Lefebvre",
    role: "Gaffer",
    department: "LIGHTING",
    email: "henri.l@lighting.fr",
    isHead: true,
  },
  {
    id: "crew-13",
    projectId: "proj-1",
    name: "Paul Mason",
    role: "Best Boy Electric",
    department: "LIGHTING",
    isHead: false,
  },
  // Art Department
  {
    id: "crew-14",
    projectId: "proj-1",
    name: "Isabelle Moreau",
    role: "Production Designer",
    department: "ART",
    email: "i.moreau@artdept.fr",
    isHead: true,
  },
  {
    id: "crew-15",
    projectId: "proj-1",
    name: "Chris Evans",
    role: "Art Director",
    department: "ART",
    isHead: false,
  },
  {
    id: "crew-16",
    projectId: "proj-1",
    name: "Lisa Park",
    role: "Set Decorator",
    department: "ART",
    isHead: false,
  },
  // Costume
  {
    id: "crew-17",
    projectId: "proj-1",
    name: "Marie Fontaine",
    role: "Costume Designer",
    department: "COSTUME",
    email: "marie.f@costume.fr",
    isHead: true,
  },
  // Hair/Makeup
  {
    id: "crew-18",
    projectId: "proj-1",
    name: "Julie Bernard",
    role: "Hair & Makeup Designer",
    department: "HAIR_MAKEUP",
    email: "julie.b@hmu.fr",
    isHead: true,
  },
  {
    id: "crew-19",
    projectId: "proj-1",
    name: "Anna Schmidt",
    role: "Key Makeup Artist",
    department: "HAIR_MAKEUP",
    isHead: false,
  },
  // Locations
  {
    id: "crew-20",
    projectId: "proj-1",
    name: "Pierre Girard",
    role: "Location Manager",
    department: "LOCATIONS",
    email: "pierre.g@locations.fr",
    phone: "+33 6 55 66 77 88",
    isHead: true,
  },
];

// Helper functions
export function getProjectById(id: string): Project | undefined {
  return mockProjects.find((p) => p.id === id);
}

export function getScenesForProject(projectId: string): Scene[] {
  return mockScenes.filter((s) => s.projectId === projectId);
}

export function getCastForProject(projectId: string): CastMember[] {
  return mockCast.filter((c) => c.projectId === projectId);
}

export function getLocationsForProject(projectId: string): Location[] {
  return mockLocations.filter((l) => l.projectId === projectId);
}

export function getShootingDaysForProject(projectId: string): ShootingDay[] {
  return mockShootingDays.filter((d) => d.projectId === projectId);
}

export function getCrewForProject(projectId: string): CrewMember[] {
  return mockCrew.filter((c) => c.projectId === projectId);
}

export function getCrewByDepartment(projectId: string, department: DepartmentType): CrewMember[] {
  return mockCrew.filter((c) => c.projectId === projectId && c.department === department);
}

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
