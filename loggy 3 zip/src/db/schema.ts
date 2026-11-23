import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Code Studio projects: index.html, styles.css and script.js, plus the other languages in `extra`.
 */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  prompt: text("prompt").notNull().default(""),
  html: text("html").notNull().default(""),
  css: text("css").notNull().default(""),
  js: text("js").notNull().default(""),
  /** Other languages: { ts, json, md, py }. */
  extra: jsonb("extra").$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Spreadsheets: sparse cell map, e.g. { "A1": "10", "B1": "=A1*2" }.
 */
export const sheets = pgTable("sheets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
  rowCount: integer("row_count").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type Sheet = typeof sheets.$inferSelect;
