/** Quick-pick catalog rows — selecting one fills EN/BN name, size, unit, category. */
export type ProductPreset = {
  id: string;
  name: string;
  nameBn: string;
  /** Hint only — live create uses auto SKU (MW/DW/BW + seq). */
  sku: string;
  category: "DRINKING" | "DISTILLED" | "BATTERY" | "OTHER";
  size: number;
  unitCode: string;
};

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: "dw-5l",
    name: "5L Distilled Water",
    nameBn: "ডিস্টিলড ওয়াটার ৫ লিটার",
    sku: "DW001",
    category: "DISTILLED",
    size: 5,
    unitCode: "LITER",
  },
  {
    id: "mw-1l",
    name: "1L Mineral Water",
    nameBn: "মিনারেল ওয়াটার ১ লিটার",
    sku: "MW001",
    category: "DRINKING",
    size: 1,
    unitCode: "LITER",
  },
  {
    id: "mw-20l",
    name: "20L Mineral Water",
    nameBn: "মিনারেল ওয়াটার ২০ লিটার",
    sku: "MW002",
    category: "DRINKING",
    size: 20,
    unitCode: "LITER",
  },
  {
    id: "mw-500",
    name: "500ml Mineral Water",
    nameBn: "মিনারেল ওয়াটার ৫০০ মি.লি.",
    sku: "MW003",
    category: "DRINKING",
    size: 500,
    unitCode: "MILLILITER",
  },
  {
    id: "bw-1l",
    name: "1L Battery Water",
    nameBn: "ব্যাটারি ওয়াটার ১ লিটার",
    sku: "BW001",
    category: "BATTERY",
    size: 1,
    unitCode: "LITER",
  },
  {
    id: "bw-5l",
    name: "5L Battery Water",
    nameBn: "ব্যাটারি ওয়াটার ৫ লিটার",
    sku: "BW002",
    category: "BATTERY",
    size: 5,
    unitCode: "LITER",
  },
];
