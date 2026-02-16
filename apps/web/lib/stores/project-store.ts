import { create } from "zustand";
import {
  type Project,
  type Scene,
  type CastMember,
  type Location,
  type ShootingDay,
  type CrewMember,
  type DepartmentType,
  type GearItem,
  type Script,
} from "@/lib/types";

interface ProjectStore {
  // Data
  projects: Project[];
  scenes: Scene[];
  cast: CastMember[];
  locations: Location[];
  shootingDays: ShootingDay[];
  crew: CrewMember[];
  gear: GearItem[];
  scripts: Script[];

  // Project actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Omit<Project, "id">) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Scene actions
  addScene: (scene: Omit<Scene, "id">) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  deleteScene: (id: string) => void;
  reorderScenes: (projectId: string, sceneIds: string[]) => void;

  // Cast actions
  addCastMember: (member: Omit<CastMember, "id">) => void;
  updateCastMember: (id: string, updates: Partial<CastMember>) => void;
  deleteCastMember: (id: string) => void;

  // Location actions
  addLocation: (location: Omit<Location, "id">) => void;
  updateLocation: (id: string, updates: Partial<Location>) => void;
  deleteLocation: (id: string) => void;

  // Shooting day actions
  addShootingDay: (day: Omit<ShootingDay, "id">) => void;
  updateShootingDay: (id: string, updates: Partial<ShootingDay>) => void;
  deleteShootingDay: (id: string) => void;

  // Crew actions
  addCrewMember: (member: Omit<CrewMember, "id">) => void;
  updateCrewMember: (id: string, updates: Partial<CrewMember>) => void;
  deleteCrewMember: (id: string) => void;

  // Gear actions
  addGearItem: (item: Omit<GearItem, "id">) => void;
  updateGearItem: (id: string, updates: Partial<GearItem>) => void;
  deleteGearItem: (id: string) => void;

  // Script actions
  addScript: (script: Omit<Script, "id">) => void;
  deleteScript: (id: string) => void;

  // Helpers
  getProjectById: (id: string) => Project | undefined;
  getScenesForProject: (projectId: string) => Scene[];
  getCastForProject: (projectId: string) => CastMember[];
  getLocationsForProject: (projectId: string) => Location[];
  getShootingDaysForProject: (projectId: string) => ShootingDay[];
  getCrewForProject: (projectId: string) => CrewMember[];
  getCrewByDepartment: (projectId: string, department: DepartmentType) => CrewMember[];
  getGearForProject: (projectId: string) => GearItem[];
  getGearByDepartment: (projectId: string, department: DepartmentType) => GearItem[];
  getScriptsForProject: (projectId: string) => Script[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initialize with empty data - users will add their own
  projects: [],
  scenes: [],
  cast: [],
  locations: [],
  shootingDays: [],
  crew: [],
  gear: [],
  scripts: [],

  // Project actions
  setProjects: (projects) => set({ projects }),
  addProject: (project) => {
    const newProject = { ...project, id: `proj-${generateId()}` } as Project;
    set((state) => ({
      projects: [...state.projects, newProject],
    }));
    return newProject;
  },
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),
  deleteProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    })),

  // Scene actions
  addScene: (scene) =>
    set((state) => {
      const projectScenes = state.scenes.filter((s) => s.projectId === scene.projectId);
      const maxSortOrder = Math.max(0, ...projectScenes.map((s) => s.sortOrder || 0));
      return {
        scenes: [...state.scenes, { ...scene, id: `scene-${generateId()}`, sortOrder: maxSortOrder + 1 }],
      };
    }),
  updateScene: (id, updates) =>
    set((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),
  deleteScene: (id) =>
    set((state) => ({
      scenes: state.scenes.filter((s) => s.id !== id),
    })),
  reorderScenes: (projectId, sceneIds) =>
    set((state) => ({
      scenes: state.scenes.map((scene) => {
        if (scene.projectId !== projectId) return scene;
        const newOrder = sceneIds.indexOf(scene.id);
        return newOrder >= 0 ? { ...scene, sortOrder: newOrder } : scene;
      }),
    })),

  // Cast actions
  addCastMember: (member) =>
    set((state) => ({
      cast: [...state.cast, { ...member, id: `cast-${generateId()}` }],
    })),
  updateCastMember: (id, updates) =>
    set((state) => ({
      cast: state.cast.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  deleteCastMember: (id) =>
    set((state) => ({
      cast: state.cast.filter((c) => c.id !== id),
    })),

  // Location actions
  addLocation: (location) =>
    set((state) => ({
      locations: [...state.locations, { ...location, id: `loc-${generateId()}` }],
    })),
  updateLocation: (id, updates) =>
    set((state) => ({
      locations: state.locations.map((l) =>
        l.id === id ? { ...l, ...updates } : l
      ),
    })),
  deleteLocation: (id) =>
    set((state) => ({
      locations: state.locations.filter((l) => l.id !== id),
    })),

  // Shooting day actions
  addShootingDay: (day) =>
    set((state) => ({
      shootingDays: [...state.shootingDays, { ...day, id: `day-${generateId()}` }],
    })),
  updateShootingDay: (id, updates) =>
    set((state) => ({
      shootingDays: state.shootingDays.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),
  deleteShootingDay: (id) =>
    set((state) => ({
      shootingDays: state.shootingDays.filter((d) => d.id !== id),
    })),

  // Crew actions
  addCrewMember: (member) =>
    set((state) => ({
      crew: [...state.crew, { ...member, id: `crew-${generateId()}` }],
    })),
  updateCrewMember: (id, updates) =>
    set((state) => ({
      crew: state.crew.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  deleteCrewMember: (id) =>
    set((state) => ({
      crew: state.crew.filter((c) => c.id !== id),
    })),

  // Gear actions
  addGearItem: (item) =>
    set((state) => ({
      gear: [...state.gear, { ...item, id: `gear-${generateId()}` }],
    })),
  updateGearItem: (id, updates) =>
    set((state) => ({
      gear: state.gear.map((g) =>
        g.id === id ? { ...g, ...updates } : g
      ),
    })),
  deleteGearItem: (id) =>
    set((state) => ({
      gear: state.gear.filter((g) => g.id !== id),
    })),

  // Script actions
  addScript: (script) =>
    set((state) => ({
      scripts: [...state.scripts, { ...script, id: `script-${generateId()}` }],
    })),
  deleteScript: (id) =>
    set((state) => ({
      scripts: state.scripts.filter((s) => s.id !== id),
    })),

  // Helpers
  getProjectById: (id) => get().projects.find((p) => p.id === id),
  getScenesForProject: (projectId) =>
    get().scenes.filter((s) => s.projectId === projectId),
  getCastForProject: (projectId) =>
    get().cast.filter((c) => c.projectId === projectId),
  getLocationsForProject: (projectId) =>
    get().locations.filter((l) => l.projectId === projectId),
  getShootingDaysForProject: (projectId) =>
    get().shootingDays.filter((d) => d.projectId === projectId),
  getCrewForProject: (projectId) =>
    get().crew.filter((c) => c.projectId === projectId),
  getCrewByDepartment: (projectId, department) =>
    get().crew.filter((c) => c.projectId === projectId && c.department === department),
  getGearForProject: (projectId) =>
    get().gear.filter((g) => g.projectId === projectId),
  getGearByDepartment: (projectId, department) =>
    get().gear.filter((g) => g.projectId === projectId && g.department === department),
  getScriptsForProject: (projectId) =>
    get().scripts.filter((s) => s.projectId === projectId).sort((a, b) => b.version - a.version),
}));
