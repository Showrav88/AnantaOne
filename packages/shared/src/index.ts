import { z } from "zod";

export const APP_NAME = "AnantaOne";

export const RoleSchema = z.enum([
  "OWNER",
  "MANAGER",
  "COUNTER",
  "PRODUCTION",
  "DELIVERY",
  "BUYER",
]);

export type Role = z.infer<typeof RoleSchema>;

export const LocaleSchema = z.enum(["en", "bn"]);
export type Locale = z.infer<typeof LocaleSchema>;
