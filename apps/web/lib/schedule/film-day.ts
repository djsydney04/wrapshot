import type { ShootingDay } from "@/lib/types";

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_GENERAL_CALL = "07:00";

export interface FilmScheduleItem {
  id: string;
  label: string;
  time: string;
  detail: string;
  tone?: "default" | "accent" | "break" | "wrap";
}

function normalizeMinutes(minutes: number): number {
  return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
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

function deriveDailyFilmScheduleTimes(shootingDay?: Partial<ShootingDay> | null) {
  const generalCall =
    parseTimeToMinutes(shootingDay?.generalCall) ??
    parseTimeToMinutes(DEFAULT_GENERAL_CALL)!;
  const crewCall = parseTimeToMinutes(shootingDay?.crewCall) ?? generalCall - 30;
  const talentCall = parseTimeToMinutes(shootingDay?.talentCall) ?? generalCall + 30;
  const firstShot = generalCall + 60;

  const lunch =
    parseTimeToMinutes(shootingDay?.lunchTime) ??
    parseTimeToMinutes(deriveLunchTime(shootingDay?.crewCall, shootingDay?.generalCall))!;

  const resumeAfterMeal = lunch + 30;
  const expectedWrap =
    parseTimeToMinutes(shootingDay?.wrapTime || shootingDay?.expectedWrap) ??
    generalCall + 12 * 60;

  return {
    crewCall,
    generalCall,
    talentCall,
    firstShot,
    lunch,
    resumeAfterMeal,
    expectedWrap,
  };
}

function minutesFromStart(start: number, end: number): number {
  return normalizeMinutes(end - start);
}

export function buildDailyFilmSchedule(
  shootingDay?: Partial<ShootingDay> | null,
  sceneCount = 0
): { items: FilmScheduleItem[]; mealWithinSixHours: boolean } {
  const times = deriveDailyFilmScheduleTimes(shootingDay);

  const items: FilmScheduleItem[] = [
    {
      id: "crew-call",
      label: "Crew Call",
      time: formatMinutesToTime(times.crewCall),
      detail: "Load-in, safety briefing, and department prep.",
    },
    {
      id: "blocking",
      label: "Blocking + Tech Setup",
      time: formatMinutesToTime(times.generalCall),
      detail: "Director, AD, camera, and key departments walk the first setup.",
    },
    {
      id: "talent-call",
      label: "Talent to Set",
      time: formatMinutesToTime(times.talentCall),
      detail: "Hair/makeup/wardrobe final checks and move to set.",
      tone: "accent",
    },
    {
      id: "first-shot",
      label: "First Shot",
      time: formatMinutesToTime(times.firstShot),
      detail: "Target first setup rolling on camera.",
      tone: "accent",
    },
    {
      id: "meal-break",
      label: "Meal Break",
      time: formatMinutesToTime(times.lunch),
      detail: "Planned meal checkpoint for cast and crew.",
      tone: "break",
    },
    {
      id: "resume",
      label: "Back In / Resume Shooting",
      time: formatMinutesToTime(times.resumeAfterMeal),
      detail: "Reset departments and continue principal photography.",
    },
  ];

  if (sceneCount >= 4) {
    items.push({
      id: "company-move",
      label: "Company Move",
      time: formatMinutesToTime(times.resumeAfterMeal + 90),
      detail: "Travel and reset for secondary location or setup.",
    });
  }

  items.push({
    id: "wrap",
    label: "Estimated Wrap",
    time: formatMinutesToTime(times.expectedWrap),
    detail: "Final shot, camera wrap, and production reports.",
    tone: "wrap",
  });

  return {
    items,
    mealWithinSixHours: minutesFromStart(times.crewCall, times.lunch) <= 6 * 60,
  };
}
