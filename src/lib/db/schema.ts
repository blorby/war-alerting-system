import {
  pgTable,
  uuid,
  timestamp,
  text,
  doublePrecision,
  jsonb,
  boolean,
  serial,
  integer,
  bigint,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    type: text("type").notNull(),
    severity: text("severity").notNull().default("info"),
    title: text("title").notNull(),
    description: text("description"),
    locationName: text("location_name"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    source: text("source").notNull(),
    sourceId: text("source_id"),
    metadata: jsonb("metadata").default({}),
    country: text("country"),
    isActive: boolean("is_active").notNull().default(true),
    dedupHash: text("dedup_hash"),
  },
  (table) => [
    index("events_timestamp_idx").on(table.timestamp),
    index("events_type_idx").on(table.type),
    index("events_severity_idx").on(table.severity),
    index("events_source_idx").on(table.source),
    index("events_country_idx").on(table.country),
    index("events_is_active_idx")
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
    index("events_location_idx")
      .on(table.lat, table.lng)
      .where(sql`${table.lat} IS NOT NULL`),
    uniqueIndex("events_dedup_hash_unique").on(table.dedupHash),
  ]
);

export const threatAssessments = pgTable(
  "threat_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    overallScore: numeric("overall_score", {
      precision: 3,
      scale: 1,
    }).notNull(),
    overallTrend: text("overall_trend").notNull(),
    situationText: text("situation_text").notNull(),
    trendText: text("trend_text").notNull(),
    overallText: text("overall_text").notNull(),
    modelUsed: text("model_used").notNull(),
    eventWindow: text("event_window").notNull().default("24 hours"),
  },
  (table) => [index("threat_assessments_created_at_idx").on(table.createdAt)]
);

export const countryThreats = pgTable(
  "country_threats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => threatAssessments.id, { onDelete: "cascade" }),
    countryCode: text("country_code").notNull(),
    countryName: text("country_name").notNull(),
    score: numeric("score", { precision: 3, scale: 1 }).notNull(),
    trend: text("trend").notNull(),
    summary: text("summary"),
  },
  (table) => [
    index("country_threats_assessment_id_idx").on(table.assessmentId),
  ]
);

export const telegramChannels = pgTable("telegram_channels", {
  id: serial("id").primaryKey(),
  channelName: text("channel_name").notNull().unique(),
  channelId: bigint("channel_id", { mode: "number" }),
  priority: integer("priority").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  language: text("language").default("he"),
  lastMessageId: bigint("last_message_id", { mode: "number" }).default(0),
});
