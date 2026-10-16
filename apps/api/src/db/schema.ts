import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  province: text("province").notNull(),
  locality: text("locality").notNull(),
  address: text("address").notNull(),
  role: text("role", { enum: ["CLIENT", "TECH", "ADMIN"] })
    .notNull()
    .default("CLIENT"),
  avatar: text("avatar"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type RefreshRow = typeof refreshTokens.$inferSelect;

export const serviceRequests = pgTable("service_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category", {
    enum: ["PLUMBING", "ELECTRICAL", "CLIMATE", "MASONRY", "PAINTING", "CARPENTRY", "OTHER"],
  }).notNull(),
  description: text("description").notNull(),
  province: text("province").notNull(),
  locality: text("locality").notNull(),
  address: text("address").notNull(),
  availability: text("availability"),
  status: text("status", { enum: ["OPEN", "ACCEPTED", "DONE", "CANCELLED"] })
    .notNull()
    .default("OPEN"),
  acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ServiceRequestRow = typeof serviceRequests.$inferSelect;

export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .unique()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  techId: uuid("tech_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RatingRow = typeof ratings.$inferSelect;

export const requestPhotos = pgTable("request_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RequestPhotoRow = typeof requestPhotos.$inferSelect;

export const requestApplications = pgTable("request_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  techId: uuid("tech_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RequestApplicationRow = typeof requestApplications.$inferSelect;

export const pushTokens = pgTable("push_tokens", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PushTokenRow = typeof pushTokens.$inferSelect;

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => serviceRequests.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MessageRow = typeof messages.$inferSelect;
