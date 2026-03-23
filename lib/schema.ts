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

export const journal_entries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  pinned: boolean("pinned").default(false),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const journal_logs = pgTable("journal_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  entry_id: uuid("entry_id").references(() => journal_entries.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  review_date: date("review_date"),
  created_at: timestamp("created_at").defaultNow(),
});

export const birthdays = pgTable("birthdays", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  birth_date: date("birth_date").notNull(),
  year_known: boolean("year_known").default(true),
  note: text("note"),
  created_at: timestamp("created_at").defaultNow(),
});

export const weight_entries = pgTable("weight_entries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  measured_at: timestamp("measured_at").notNull().unique(),
  weight: numeric("weight").notNull(),
  source: text("source").default("apple_health"),
  created_at: timestamp("created_at").defaultNow(),
});

// ── D&D ──────────────────────────────────────────────────────────────────────

export const dnd_character = pgTable("dnd_character", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  class: text("class"),
  subclass: text("subclass"),
  race: text("race"),
  level: integer("level").default(1),
  background: text("background"),
  alignment: text("alignment"),
  avatar_url: text("avatar_url"),
  backstory: text("backstory"),
  personality: text("personality"),
  ideals: text("ideals"),
  bonds: text("bonds"),
  flaws: text("flaws"),
  hp_max: integer("hp_max"),
  hp_current: integer("hp_current"),
  ac: integer("ac"),
  speed: integer("speed"),
  proficiency_bonus: integer("proficiency_bonus"),
  force: integer("force"),
  dexterite: integer("dexterite"),
  constitution: integer("constitution"),
  intelligence: integer("intelligence"),
  sagesse: integer("sagesse"),
  charisme: integer("charisme"),
  spell_save_dc: integer("spell_save_dc"),
  spell_attack_bonus: integer("spell_attack_bonus"),
  spells_prepared_per_day: integer("spells_prepared_per_day"),
  skill_proficiencies: text("skill_proficiencies"), // JSON string[]
  save_proficiencies: text("save_proficiencies"), // JSON string[]
  special_abilities: text("special_abilities"), // JSON {id,name,description}[]
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const dnd_spells = pgTable("dnd_spells", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  level: integer("level").notNull(),
  school: text("school"),
  casting_time: text("casting_time"),
  range: text("range"),
  components: text("components"),
  duration: text("duration"),
  description: text("description"),
  url: text("url"),
  prepared: boolean("prepared").default(true),
  created_at: timestamp("created_at").defaultNow(),
});

export const dnd_equipment = pgTable("dnd_equipment", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type"),
  description: text("description"),
  magical: boolean("magical").default(false),
  equipped: boolean("equipped").default(false),
  quantity: integer("quantity").default(1),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
});

export const dnd_objectives = pgTable("dnd_objectives", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  status: text("status").default("En cours"),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
});

export const dnd_sessions = pgTable("dnd_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  session_date: date("session_date").notNull(),
  session_time: text("session_time"),
  status: text("status").default("Planifiée"),
  summary: text("summary"),
  notes: text("notes"),
  level_at_session: integer("level_at_session"),
  journal: text("journal"),
  created_at: timestamp("created_at").defaultNow(),
});

export const dnd_companions = pgTable("dnd_companions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  class: text("class"),
  race: text("race"),
  level: integer("level"),
  player_name: text("player_name"),
  description: text("description"),
  personality: text("personality"),
  backstory: text("backstory"),
  relationship: text("relationship"),
  notes: text("notes"),
  avatar_url: text("avatar_url"),
  is_companion: boolean("is_companion").default(false),
  created_at: timestamp("created_at").defaultNow(),
});
