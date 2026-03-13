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
  created_at?: string | null;
  task_count?: number;
  session_count?: number;
  own_minutes?: number;
  total_minutes?: number;
  parents: { id: string; name: string }[];
  children: { id: string; name: string; own_minutes: number }[];
};

export type DBTask = {
  id: string;
  name: string;
  status: string | null;
  project_id?: string | null;
  project_name?: string | null;
  issue_number?: number | null;
};

export type DBSession = {
  id: string;
  name: string | null;
  project_id: string | null;
  project_name: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
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

// ── Library ──────────────────────────────────────────────────────────────────

export type DBAuthor = {
  id: string;
  name: string;
  photo_url: string | null;
  book_count?: number;
  created_at?: string | null;
};

export type DBGenre = {
  id: string;
  name: string;
  icon: string | null;
  book_count?: number;
  created_at?: string | null;
};

export type DBSerie = {
  id: string;
  name: string;
  author_id: string | null;
  author_name?: string | null;
  status: string | null;
  book_count?: number;
  created_at?: string | null;
};

export type DBBook = {
  id: string;
  title: string;
  author_id: string | null;
  author_name?: string | null;
  genre_id: string | null;
  genre_name?: string | null;
  serie_id: string | null;
  serie_name?: string | null;
  status: string | null;
  rating: number | null;
  image_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  note_count?: number;
  created_at?: string | null;
};

export type DBBookNote = {
  id: string;
  title: string;
  book_id: string;
  book_title?: string | null;
  content: string | null;
  created_at?: string | null;
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

// ── Habits ───────────────────────────────────────────────────────────────────

export type DBHabit = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  frequency_type: string; // "daily" | "weekly" | "specific_days" | "monthly"
  frequency_days: string | null; // JSON string
  target_per_period: number | null;
  active: boolean | null;
  created_at?: string | null;
  archived_at?: string | null;
};

export type DBHabitWithStats = DBHabit & {
  completed_today: boolean;
  current_streak: number;
  best_streak: number;
  completion_rate_30d: number;
  logs_this_week: number;
};

export type DBHabitLog = {
  id: string;
  habit_id: string;
  completed_date: string;
  note: string | null;
  created_at?: string | null;
};
