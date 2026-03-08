// Shared Notion entity types used across integrations

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
