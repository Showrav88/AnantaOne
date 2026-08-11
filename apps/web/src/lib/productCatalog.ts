/** Product catalog categories — SKU prefix comes from shortCodes.categorySkuPrefix */
export const PRODUCT_CATEGORIES = [
  "DRINKING",
  "DISTILLED",
  "BATTERY",
  "HANDWASH",
  "DISHWASH",
  "CLEANER",
  "OTHER",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PACK_TYPES = ["BOTTLE", "SACHET", "JAR", "BOX", "OTHER"] as const;

export type PackType = (typeof PACK_TYPES)[number];

export function categoryLabel(
  code: string,
  t: {
    catDrinking: string;
    catDistilled: string;
    catBattery: string;
    catHandwash: string;
    catDishwash: string;
    catCleaner: string;
    catOther: string;
  },
): string {
  switch (code) {
    case "DRINKING":
      return t.catDrinking;
    case "DISTILLED":
      return t.catDistilled;
    case "BATTERY":
      return t.catBattery;
    case "HANDWASH":
      return t.catHandwash;
    case "DISHWASH":
      return t.catDishwash;
    case "CLEANER":
      return t.catCleaner;
    default:
      return t.catOther;
  }
}

export function packTypeLabel(
  code: string,
  t: {
    packBottle: string;
    packSachet: string;
    packJar: string;
    packBox: string;
    packOther: string;
  },
): string {
  switch (code) {
    case "BOTTLE":
      return t.packBottle;
    case "SACHET":
      return t.packSachet;
    case "JAR":
      return t.packJar;
    case "BOX":
      return t.packBox;
    default:
      return t.packOther;
  }
}
