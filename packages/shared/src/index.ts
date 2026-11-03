import { z } from "zod";

export const APP_NAME = "AnantaOne";

/** Tenant roles (3) + platform SUPER_ADMIN — codes match RoleLookup. */
export const RoleCodeSchema = z.enum([
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "EMPLOYEE",
]);

export type RoleCode = z.infer<typeof RoleCodeSchema>;

export const LocaleSchema = z.enum(["en", "bn"]);
export type Locale = z.infer<typeof LocaleSchema>;
