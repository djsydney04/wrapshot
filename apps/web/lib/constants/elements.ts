export type ElementCategory =
  | "NAME"
  | "PROP"
  | "WARDROBE"
  | "VEHICLE"
  | "ANIMAL"
  | "SPECIAL_EQUIPMENT"
  | "VFX"
  | "SFX"
  | "STUNT"
  | "MAKEUP"
  | "HAIR"
  | "GREENERY"
  | "ART_DEPARTMENT"
  | "SOUND"
  | "MUSIC"
  | "BACKGROUND"
  | "OTHER"
  | "CAMERA"
  | "GRIP"
  | "ELECTRIC"
  | "SET_DRESSING"
  | "ADDITIONAL_LABOR"
  | "ANIMAL_WRANGLER"
  | "MECHANICAL_EFFECTS"
  | "VIDEO_PLAYBACK"
  | "LOCATION_NOTES"
  | "SAFETY_NOTES"
  | "SECURITY"
  | "QUESTIONS"
  | "COMMENTS"
  | "MISCELLANEOUS";

export const DB_COMPATIBLE_ELEMENT_CATEGORIES = [
  "PROP",
  "WARDROBE",
  "VEHICLE",
  "ANIMAL",
  "SPECIAL_EQUIPMENT",
  "VFX",
  "SFX",
  "STUNT",
  "MAKEUP",
  "HAIR",
  "GREENERY",
  "ART_DEPARTMENT",
  "SOUND",
  "MUSIC",
  "BACKGROUND",
  "OTHER",
] as const;

export type DbElementCategory = (typeof DB_COMPATIBLE_ELEMENT_CATEGORIES)[number];

const EXTENDED_TO_DB_CATEGORY_MAP: Partial<Record<ElementCategory, DbElementCategory>> = {
  NAME: "OTHER",
  CAMERA: "SPECIAL_EQUIPMENT",
  GRIP: "SPECIAL_EQUIPMENT",
  ELECTRIC: "SPECIAL_EQUIPMENT",
  SET_DRESSING: "ART_DEPARTMENT",
  ADDITIONAL_LABOR: "OTHER",
  ANIMAL_WRANGLER: "ANIMAL",
  MECHANICAL_EFFECTS: "SFX",
  VIDEO_PLAYBACK: "SPECIAL_EQUIPMENT",
  LOCATION_NOTES: "OTHER",
  SAFETY_NOTES: "OTHER",
  SECURITY: "OTHER",
  QUESTIONS: "OTHER",
  COMMENTS: "OTHER",
  MISCELLANEOUS: "OTHER",
};

/**
 * Some deployments still use a narrower DB enum for Element.category.
 * Normalize richer AI/UI categories into DB-safe categories on writes.
 */
export function normalizeElementCategoryForStorage(
  category: ElementCategory | string
): DbElementCategory {
  const upper = String(category || "").toUpperCase().trim() as ElementCategory;

  if (
    (DB_COMPATIBLE_ELEMENT_CATEGORIES as readonly string[]).includes(upper)
  ) {
    return upper as DbElementCategory;
  }

  return EXTENDED_TO_DB_CATEGORY_MAP[upper] || "OTHER";
}

export const ELEMENT_CATEGORY_LABELS: Record<ElementCategory, string> = {
  NAME: "Names",
  PROP: "Props",
  WARDROBE: "Wardrobe",
  VEHICLE: "Vehicles",
  ANIMAL: "Animals",
  SPECIAL_EQUIPMENT: "Special Equipment",
  VFX: "Visual Effects",
  SFX: "Special Effects",
  STUNT: "Stunts",
  MAKEUP: "Makeup/Hair",
  HAIR: "Hair",
  GREENERY: "Greenery",
  ART_DEPARTMENT: "Art Department",
  SOUND: "Sound",
  MUSIC: "Music",
  BACKGROUND: "Background",
  OTHER: "Other",
  CAMERA: "Camera",
  GRIP: "Grip",
  ELECTRIC: "Electric",
  SET_DRESSING: "Set Dressing",
  ADDITIONAL_LABOR: "Additional Labor",
  ANIMAL_WRANGLER: "Animal Wrangler",
  MECHANICAL_EFFECTS: "Mechanical Effects",
  VIDEO_PLAYBACK: "Video Playback",
  LOCATION_NOTES: "Location Notes",
  SAFETY_NOTES: "Safety Notes",
  SECURITY: "Security",
  QUESTIONS: "Questions",
  COMMENTS: "Comments",
  MISCELLANEOUS: "Miscellaneous",
};
