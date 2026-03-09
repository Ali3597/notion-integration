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

export type NotionProject = {
  id: string;
  name: string;
  status: string | null;
  type: string | null;
};

export type NotionTask = {
  id: string;
  name: string;
  status: string | null;
  priority: string | null;
};

export type NotionSession = {
  id: string;
  name: string;
  startTime: string | null;
  endTime: string | null;
  duration: number | null;
  task: string | null;
};
