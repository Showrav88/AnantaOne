/** Quick-pick rows — fills name, category, pack, size, unit. SKU stays auto on save. */
export type ProductPreset = {
  id: string;
  name: string;
  nameBn: string;
  category:
    | "DRINKING"
    | "DISTILLED"
    | "BATTERY"
    | "HANDWASH"
    | "DISHWASH"
    | "CLEANER"
    | "OTHER";
  packType: "BOTTLE" | "SACHET" | "JAR" | "BOX" | "OTHER";
  size: number;
  unitCode: string;
};

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: "mw-1l",
    name: "1L Mineral Water",
    nameBn: "মিনারেল ওয়াটার ১ লিটার",
    category: "DRINKING",
    packType: "BOTTLE",
    size: 1,
    unitCode: "LITER",
  },
  {
    id: "dw-5l",
    name: "5L Distilled Water",
    nameBn: "ডিস্টিলড ওয়াটার ৫ লিটার",
    category: "DISTILLED",
    packType: "BOTTLE",
    size: 5,
    unitCode: "LITER",
  },
  {
    id: "bw-1l",
    name: "1L Battery Water",
    nameBn: "ব্যাটারি ওয়াটার ১ লিটার",
    category: "BATTERY",
    packType: "BOTTLE",
    size: 1,
    unitCode: "LITER",
  },
  {
    id: "hw-500",
    name: "500ml Hand Wash",
    nameBn: "হ্যান্ড ওয়াশ ৫০০ মি.লি.",
    category: "HANDWASH",
    packType: "BOTTLE",
    size: 500,
    unitCode: "MILLILITER",
  },
  {
    id: "hw-sachet",
    name: "100ml Hand Wash Sachet",
    nameBn: "হ্যান্ড ওয়াশ ১০০ মি.লি. প্যাক",
    category: "HANDWASH",
    packType: "SACHET",
    size: 100,
    unitCode: "MILLILITER",
  },
  {
    id: "hw-sachet-250",
    name: "250ml Hand Wash Sachet",
    nameBn: "হ্যান্ড ওয়াশ ২৫০ মি.লি. স্যাচেট",
    category: "HANDWASH",
    packType: "SACHET",
    size: 250,
    unitCode: "MILLILITER",
  },
  {
    id: "ds-1l",
    name: "1L Dish Wash",
    nameBn: "ডিশ ওয়াশ ১ লিটার",
    category: "DISHWASH",
    packType: "BOTTLE",
    size: 1,
    unitCode: "LITER",
  },
  {
    id: "cl-1l",
    name: "1L Floor / Toilet Cleaner",
    nameBn: "ফ্লোর / টয়লেট ক্লিনার ১ লিটার",
    category: "CLEANER",
    packType: "BOTTLE",
    size: 1,
    unitCode: "LITER",
  },
];
