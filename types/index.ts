// Shared Notion entity types used across integrations

export interface PBSession {
  uuid: string;
  object_uuid: string;
  object_type: string;
  object_name: string;
  object_color: string;
  lesson_name: string;
  duration: number; // en secondes
  activity_date: string; // format "YYYY-MM-DD HH:MM:SS"
  activity_time: string; // timestamp unix en string
  lesson_uuid: string;
}

export interface PBMetrics {
  nb_lessons: number;
  meditation_time: number; // en secondes
  actual_serie: number;
  best_serie: number;
  nb_free_meditation: number;
  nb_breathing_lessons: number;
}

export type DBProject = {
  id: string;
  name: string;
  status: string | null;
  type: string | null;
  task_count?: number;
  session_count?: number;
  total_minutes?: number;
};

export type DBTask = {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
  project_id?: string | null;
  project_name?: string | null;
  session_count?: number;
  total_minutes?: number;
};

export type DBSession = {
  id: string;
  name: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  task_name: string | null;
  project_name: string | null;
  duration_min: number | null;
};

// Legacy aliases kept for existing references
export type NotionProject = DBProject;
export type NotionTask = DBTask;
export type NotionSession = {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  task: string | null;
};

// ── Chess ────────────────────────────────────────────────────────────────────

export interface ParsedGame {
  eco: string;
  opening: string;
  white: string;
  black: string;
  whiteElo: number;
  blackElo: number;
  date: string; // "YYYY.MM.DD"
  result: "1-0" | "0-1" | "1/2-1/2" | string;
  timeControl: string;
  pgn: string;
  url?: string;
  endTime?: number; // unix timestamp (from Chess.com JSON)
}

export interface ChessFormatStats {
  last?: { rating: number; date: number };
  best?: { rating: number; date: number; game?: string };
  record?: { win: number; loss: number; draw: number };
}

export interface ChessStats {
  chess_blitz?: ChessFormatStats;
  chess_rapid?: ChessFormatStats;
  chess_daily?: ChessFormatStats;
  tactics?: { highest: { rating: number; date: number }; lowest: { rating: number; date: number } };
  puzzle_rush?: { best?: { total_attempts: number; score: number }; daily?: { total_attempts: number; score: number } };
}

export interface ChessSyncResult {
  synced: boolean;
  gamesProcessed: number;
  modules: string[];
  durationMs: number;
}
