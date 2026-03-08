import { Client } from "@notionhq/client";

export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export const PROJECTS_DB = process.env.NOTION_PROJECTS_DB!;
export const TASKS_DB = process.env.NOTION_TASKS_DB!;
export const SESSIONS_DB = process.env.NOTION_SESSIONS_DB!;
