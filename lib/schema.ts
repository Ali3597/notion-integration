import { pgTable, uuid, text, timestamp, numeric, integer, boolean, primaryKey, date, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status"),
  type: text("type"),
  issue_counter: integer("issue_counter").default(0),
  created_at: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status"),
  project_id: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  issue_number: integer("issue_number"),
  created_at: timestamp("created_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  project_id: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
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

export const authors = pgTable("authors", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  photo_url: text("photo_url"),
  created_at: timestamp("created_at").defaultNow(),
});

export const genres = pgTable("genres", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  icon: text("icon"),
  created_at: timestamp("created_at").defaultNow(),
});

export const series = pgTable("series", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  author_id: uuid("author_id").references(() => authors.id, { onDelete: "set null" }),
  status: text("status"),
  created_at: timestamp("created_at").defaultNow(),
});

export const books = pgTable("books", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  author_id: uuid("author_id").references(() => authors.id, { onDelete: "set null" }),
  genre_id: uuid("genre_id").references(() => genres.id, { onDelete: "set null" }),
  serie_id: uuid("serie_id").references(() => series.id, { onDelete: "set null" }),
  status: text("status").default("Pas Lu"),
  rating: integer("rating"),
  image_url: text("image_url"),
  started_at: date("started_at"),
  finished_at: date("finished_at"),
  created_at: timestamp("created_at").defaultNow(),
});

export const book_notes = pgTable("book_notes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  book_id: uuid("book_id").references(() => books.id, { onDelete: "cascade" }).notNull(),
  content: text("content"),
  created_at: timestamp("created_at").defaultNow(),
});

export const project_relations = pgTable("project_relations", {
  parent_id: uuid("parent_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  child_id: uuid("child_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.parent_id, t.child_id] }),
}));

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  frequency_type: text("frequency_type").notNull().default("daily"),
  frequency_days: text("frequency_days"),
  target_per_period: integer("target_per_period").default(1),
  active: boolean("active").default(true),
  created_at: timestamp("created_at").defaultNow(),
  archived_at: timestamp("archived_at"),
});

export const habit_logs = pgTable("habit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  habit_id: uuid("habit_id").references(() => habits.id, { onDelete: "cascade" }).notNull(),
  completed_date: date("completed_date").notNull(),
  note: text("note"),
  created_at: timestamp("created_at").defaultNow(),
}, (t) => ({
  habit_date_unique: unique().on(t.habit_id, t.completed_date),
}));
