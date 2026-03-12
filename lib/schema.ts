import { pgTable, uuid, text, timestamp, numeric, integer, boolean, primaryKey, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status"),
  type: text("type"),
  created_at: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status"),
  priority: text("priority"),
  project_id: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  created_at: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  task_id: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  start_time: timestamp("start_time"),
  end_time: timestamp("end_time"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
});

export const meditations = pgTable("meditations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  lesson: text("lesson"),
  date: timestamp("date"),
  duration_min: numeric("duration_min"),
  pb_uuid: text("pb_uuid").unique(),
  streak: integer("streak").default(0),
  created_at: timestamp("created_at").defaultNow(),
});

export const shopping_items = pgTable("shopping_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category"),
  estimated_price: numeric("estimated_price"),
  purchased: boolean("purchased").default(false),
  store_link: text("store_link"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
});

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  due_date: date("due_date"),
  done: boolean("done").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

export const project_relations = pgTable("project_relations", {
  parent_id: uuid("parent_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  child_id: uuid("child_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.parent_id, t.child_id] }),
}));
