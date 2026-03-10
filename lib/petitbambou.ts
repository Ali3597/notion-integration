import type { PBSession, PBMetrics } from "@/types";

const BASE_URL = "https://api.petitbambou.com";
const USER_UUID = process.env.PB_USER_UUID!;

const pbHeaders = () => ({
  "accept": "*/*",
  "http-auth-pw": process.env.PB_AUTH_TOKEN!,
  "http-auth-user": process.env.PB_USER_UUID!,
  "pb-build-version": "710",
  "pb-device-type": "apple",
  "pb-user-timezone": "Europe/Paris",
  "user-agent": "PetitBambou/710 CFNetwork/3860.400.51 Darwin/25.3.0",
  "accept-language": "fr-FR,fr;q=0.9",
  "accept-encoding": "gzip, deflate, br",
});

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function getMetrics(): Promise<PBMetrics> {
  const url = `${BASE_URL}/v2/metrics/${USER_UUID}?fields=community,user_metrics`;
  const res = await fetch(url, { headers: pbHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PB metrics error: ${res.status} — ${body}`);
  }
  const json = await res.json();
  return json.data.data.user_metrics as PBMetrics;
}

export async function getSessionsForPeriod(
  start: Date,
  end: Date
): Promise<PBSession[]> {
  const startStr = formatDate(start);
  const endStr = formatDate(end);
  const url = `${BASE_URL}/v2/metrics/${USER_UUID}?created%5Bbetween%5D=${startStr}..${endStr}&fields=community,user_metrics,history3`;
  const res = await fetch(url, { headers: pbHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PB sessions error: ${res.status} — ${body}`);
  }
  const json = await res.json();
  const values = json.data?.data?.history?.values ?? {};
  const sessions: PBSession[] = Object.values(values).map((v: any) => ({
    uuid: v.uuid,
    object_uuid: v.object_uuid,
    object_type: v.object_type,
    object_name: v.object_name,
    object_color: v.object_color,
    lesson_name: v.lesson_name,
    duration: v.duration,
    activity_date: v.activity_date,
    activity_time: v.activity_time,
    lesson_uuid: v.lesson_uuid,
  }));
  // Dédoublonnage par uuid
  const seen = new Set<string>();
  return sessions.filter((s) => {
    if (seen.has(s.uuid)) return false;
    seen.add(s.uuid);
    return true;
  });
}

export async function getSessionsLastWeek(): Promise<PBSession[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return getSessionsForPeriod(start, end);
}

export async function getSessionsLast3Months(): Promise<PBSession[]> {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  return getSessionsForPeriod(start, end);
}

export async function getAllSessions(): Promise<PBSession[]> {
  const allSessions: PBSession[] = [];
  const seen = new Set<string>();
  const now = new Date();

  // Depuis mars 2021 par tranches de 3 mois (5 ans d'historique)
  let cursor = new Date("2021-03-01");
  while (cursor < now) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setMonth(chunkEnd.getMonth() + 3);
    if (chunkEnd > now) chunkEnd.setTime(now.getTime());

    try {
      const sessions = await getSessionsForPeriod(cursor, chunkEnd);
      for (const s of sessions) {
        if (!seen.has(s.uuid)) {
          seen.add(s.uuid);
          allSessions.push(s);
        }
      }
    } catch {
      // Continuer même si une tranche échoue
    }

    cursor = new Date(chunkEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return allSessions;
}

export async function getTodaySessions(): Promise<PBSession[]> {
  const today = new Date();
  return getSessionsForPeriod(today, today);
}

export function computeStreaks(
  sessions: Array<{ uuid: string; activity_date: string }>
): Map<string, number> {
  const streakMap = new Map<string, number>();
  if (sessions.length === 0) return streakMap;

  // Extraire les dates uniques YYYY-MM-DD
  const dateSet = new Set<string>();
  for (const s of sessions) {
    dateSet.add(s.activity_date.substring(0, 10));
  }

  // Trier chronologiquement
  const sortedDates = Array.from(dateSet).sort();

  // Calculer la streak pour chaque date
  const dateStreakMap = new Map<string, number>();

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      dateStreakMap.set(sortedDates[i], 1);
      continue;
    }

    const currentDate = new Date(sortedDates[i]);
    const prevDate = new Date(sortedDates[i - 1]);

    const gapDays = Math.round(
      (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (gapDays <= 2) {
      // 0, 1 ou 2 jours d'écart (0 ou 1 jour manqué) → streak continue
      dateStreakMap.set(sortedDates[i], (dateStreakMap.get(sortedDates[i - 1]) ?? 1) + 1);
    } else {
      // 3 jours d'écart ou plus (2 jours manqués) → RESET
      dateStreakMap.set(sortedDates[i], 1);
    }
  }

  // Assigner la streak à chaque session selon sa date
  for (const s of sessions) {
    const date = s.activity_date.substring(0, 10);
    streakMap.set(s.uuid, dateStreakMap.get(date) ?? 1);
  }

  return streakMap;
}
