import type { FilmScheduleTone, ShootingDay, ShootingDayScheduleItem } from "@/lib/types";

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_GENERAL_CALL = "07:00";

export interface FilmScheduleItem {
  id: string;
  label: string;
  time: string;
  detail: string;
  tone?: FilmScheduleTone;
}

interface FilmScheduleTemplateItem {
  id: string;
  label: string;
  offsetMinutes: number;
  detail: string;
  tone?: FilmScheduleTone;
  minSceneCount?: number;
}

export type FilmDayTemplateId =
  | "STANDARD_12_HOUR"
  | "COMMERCIAL_10_HOUR"
  | "NIGHT_SHOOT_12_HOUR";

interface FilmDayTemplate {
  id: FilmDayTemplateId;
  label: string;
  description: string;
  defaultGeneralCall: string;
  items: FilmScheduleTemplateItem[];
}

const FILM_DAY_TEMPLATES: FilmDayTemplate[] = [
  {
    id: "STANDARD_12_HOUR",
    label: "Single-Cam 12 Hour",
    description: "Classic scripted day with meal and optional company move.",
    defaultGeneralCall: "07:00",
    items: [
      {
        id: "crew-call",
        label: "Crew Call",
        offsetMinutes: -30,
        detail: "Load-in, safety briefing, and department prep.",
      },
      {
        id: "blocking",
        label: "Blocking + Tech Setup",
        offsetMinutes: 0,
        detail: "Director, AD, camera, and key departments walk the first setup.",
      },
      {
        id: "talent-call",
        label: "Talent to Set",
        offsetMinutes: 30,
        detail: "Hair/makeup/wardrobe final checks and move to set.",
        tone: "accent",
      },
      {
        id: "first-shot",
        label: "First Shot",
        offsetMinutes: 60,
        detail: "Target first setup rolling on camera.",
        tone: "accent",
      },
      {
        id: "meal-break",
        label: "Meal Break",
        offsetMinutes: 330,
        detail: "Planned meal checkpoint for cast and crew.",
        tone: "break",
      },
      {
        id: "resume",
        label: "Back In / Resume Shooting",
        offsetMinutes: 360,
        detail: "Reset departments and continue principal photography.",
      },
      {
        id: "company-move",
        label: "Company Move",
        offsetMinutes: 450,
        detail: "Travel and reset for secondary location or setup.",
        minSceneCount: 4,
      },
      {
        id: "wrap",
        label: "Estimated Wrap",
        offsetMinutes: 720,
        detail: "Final shot, camera wrap, and production reports.",
        tone: "wrap",
      },
    ],
  },
  {
    id: "COMMERCIAL_10_HOUR",
    label: "Commercial 10 Hour",
    description: "Short-form day with faster turnover and tighter wrap.",
    defaultGeneralCall: "07:00",
    items: [
      {
        id: "crew-call",
        label: "Crew Call",
        offsetMinutes: -45,
        detail: "Expedited load-in and pre-light.",
      },
      {
        id: "blocking",
        label: "Blocking + Camera Rehearsal",
        offsetMinutes: 0,
        detail: "Walk-through with key talent and camera.",
      },
      {
        id: "first-shot",
        label: "First Shot",
        offsetMinutes: 45,
        detail: "Roll quickly after rehearsal.",
        tone: "accent",
      },
      {
        id: "meal-break",
        label: "Meal Break",
        offsetMinutes: 300,
        detail: "Meal checkpoint before overtime exposure.",
        tone: "break",
      },
      {
        id: "resume",
        label: "Back In / Pickups",
        offsetMinutes: 330,
        detail: "Pickups, alt takes, and product inserts.",
      },
      {
        id: "wrap",
        label: "Estimated Wrap",
        offsetMinutes: 600,
        detail: "Vendor lockout and final paperwork.",
        tone: "wrap",
      },
    ],
  },
  {
    id: "NIGHT_SHOOT_12_HOUR",
    label: "Night Shoot 12 Hour",
    description: "Night exterior rhythm with longer prelight and late meal.",
    defaultGeneralCall: "18:00",
    items: [
      {
        id: "crew-call",
        label: "Crew Call",
        offsetMinutes: -60,
        detail: "Night prelight, safety checks, and transport lockups.",
      },
      {
        id: "blocking",
        label: "Blocking + Night Balance",
        offsetMinutes: 0,
        detail: "Dial exposure and practicals before cast on set.",
      },
      {
        id: "talent-call",
        label: "Talent to Set",
        offsetMinutes: 45,
        detail: "Final wardrobe/hair checks for night continuity.",
        tone: "accent",
      },
      {
        id: "first-shot",
        label: "First Shot",
        offsetMinutes: 75,
        detail: "Roll first setup once neighborhood lockup is clear.",
        tone: "accent",
      },
      {
        id: "meal-break",
        label: "Meal Break",
        offsetMinutes: 360,
        detail: "Meal checkpoint to protect turnaround.",
        tone: "break",
      },
      {
        id: "resume",
        label: "Back In / Night Pickups",
        offsetMinutes: 390,
        detail: "Resume with inserts and transition coverage.",
      },
      {
        id: "wrap",
        label: "Estimated Wrap",
        offsetMinutes: 720,
        detail: "Strike, lockup release, and return load-out.",
        tone: "wrap",
      },
    ],
  },
];

export const DEFAULT_FILM_DAY_TEMPLATE_ID: FilmDayTemplateId = "STANDARD_12_HOUR";

function normalizeMinutes(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function normalizeTemplateId(templateId?: string | null): FilmDayTemplateId {
  const match = FILM_DAY_TEMPLATES.find((template) => template.id === templateId);
  return match?.id || DEFAULT_FILM_DAY_TEMPLATE_ID;
}

function getTemplateById(templateId?: string | null): FilmDayTemplate {
  const normalized = normalizeTemplateId(templateId);
  return (
    FILM_DAY_TEMPLATES.find((template) => template.id === normalized) ||
    FILM_DAY_TEMPLATES[0]
  );
}

export function getFilmDayTemplateOptions(): Array<{
  value: FilmDayTemplateId;
  label: string;
  description: string;
}> {
  return FILM_DAY_TEMPLATES.map((template) => ({
    value: template.id,
    label: template.label,
    description: template.description,
  }));
}

export function parseTimeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = normalizeMinutes(totalMinutes);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function deriveLunchTime(
  crewCall?: string | null,
  generalCall?: string | null
): string {
  const anchor =
    parseTimeToMinutes(crewCall) ??
    parseTimeToMinutes(generalCall) ??
    parseTimeToMinutes(DEFAULT_GENERAL_CALL)!;

  // Standard production planning rule-of-thumb: schedule meal at 6 hours.
  return formatMinutesToTime(anchor + 6 * 60);
}

function deriveDailyFilmScheduleTimes(
  shootingDay?: Partial<ShootingDay> | null,
  template?: FilmDayTemplate
) {
  const templateDefaultCall = template?.defaultGeneralCall || DEFAULT_GENERAL_CALL;
  const generalCall =
    parseTimeToMinutes(shootingDay?.generalCall) ??
    parseTimeToMinutes(templateDefaultCall)!;
  const crewCall = parseTimeToMinutes(shootingDay?.crewCall) ?? generalCall - 30;

  const lunch =
    parseTimeToMinutes(shootingDay?.lunchTime) ??
    parseTimeToMinutes(deriveLunchTime(shootingDay?.crewCall, shootingDay?.generalCall))!;

  return {
    crewCall,
    generalCall,
    lunch,
  };
}

function minutesFromStart(start: number, end: number): number {
  return normalizeMinutes(end - start);
}

function isValidTone(value: string | undefined): value is FilmScheduleTone {
  return value === "default" || value === "accent" || value === "break" || value === "wrap";
}

function normalizeCustomFilmScheduleItems(
  items: ShootingDayScheduleItem[] | null | undefined
): FilmScheduleItem[] {
  if (!Array.isArray(items)) return [];

  const normalizedItems: FilmScheduleItem[] = [];

  items.forEach((item, index) => {
    const time = typeof item.time === "string" ? item.time.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const detail = typeof item.detail === "string" ? item.detail.trim() : "";
    const tone = isValidTone(item.tone) ? item.tone : undefined;

    if (!time || !label || parseTimeToMinutes(time) === null) {
      return;
    }

    normalizedItems.push({
      id: item.id?.trim() || `custom-${index + 1}`,
      time,
      label,
      detail,
      ...(tone ? { tone } : {}),
    });
  });

  return normalizedItems;
}

function buildTemplateFilmScheduleItems(
  template: FilmDayTemplate,
  generalCallMinutes: number,
  sceneCount: number,
  expectedWrapTime?: string | null
): FilmScheduleItem[] {
  return template.items
    .filter((item) => {
      if (!item.minSceneCount) return true;
      return sceneCount >= item.minSceneCount;
    })
    .map((item) => {
      const time =
        item.id === "wrap" && expectedWrapTime
          ? expectedWrapTime
          : formatMinutesToTime(generalCallMinutes + item.offsetMinutes);

      return {
        id: item.id,
        label: item.label,
        time,
        detail: item.detail,
        tone: item.tone,
      } satisfies FilmScheduleItem;
    });
}

export function buildDailyFilmSchedule(
  shootingDay?: Partial<ShootingDay> | null,
  sceneCount = 0
): { items: FilmScheduleItem[]; mealWithinSixHours: boolean } {
  const template = getTemplateById(shootingDay?.filmScheduleTemplate);
  const times = deriveDailyFilmScheduleTimes(shootingDay, template);
  const customItems = normalizeCustomFilmScheduleItems(shootingDay?.filmScheduleItems);
  const templateItems = buildTemplateFilmScheduleItems(
    template,
    times.generalCall,
    sceneCount,
    shootingDay?.wrapTime || shootingDay?.expectedWrap || null
  );

  const mergedItems = [...templateItems, ...customItems]
    .filter((item) => parseTimeToMinutes(item.time) !== null)
    .sort((a, b) => {
      const aMinutes = parseTimeToMinutes(a.time) ?? 0;
      const bMinutes = parseTimeToMinutes(b.time) ?? 0;
      return aMinutes - bMinutes;
    });

  const lunchItem =
    mergedItems.find((item) => item.id === "meal-break") ||
    mergedItems.find((item) => /meal|lunch/i.test(item.label));
  const lunchMinutes = parseTimeToMinutes(lunchItem?.time) ?? times.lunch;

  return {
    items: mergedItems,
    mealWithinSixHours: minutesFromStart(times.crewCall, lunchMinutes) <= 6 * 60,
  };
}
