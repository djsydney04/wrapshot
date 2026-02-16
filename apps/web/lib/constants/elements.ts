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
