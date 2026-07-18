/** Quick-pick catalog rows — selecting one fills EN/BN name, SKU, size, unit, category. */
export type ProductPreset = {
  id: string;
  name: string;
  nameBn: string;
  sku: string;
  category: "DRINKING" | "DISTILLED" | "BATTERY" | "OTHER";
  size: number;
  unitCode: string;
};

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: "di-5l",
    name: "5L Distilled Water",
    nameBn: "ডিস্টিলড ওয়াটার ৫ লিটার",
    sku: "DI-5L",
    category: "DISTILLED",
    size: 5,
    unitCode: "LITER",
  },
  {
    id: "dw-1l",
    name: "1L Drinking Water",
    nameBn: "পানীয় জল ১ লিটার",
    sku: "DW-1L",
    category: "DRINKING",
    size: 1,
    unitCode: "LITER",
  },
  {
    id: "dw-20l",
    name: "20L Drinking Water",
    nameBn: "পানীয় জল ২০ লিটার",
    sku: "DW-20L",
    category: "DRINKING",
    size: 20,
    unitCode: "LITER",
  },
  {
    id: "bw-1l",
    name: "1L Battery Water",
    nameBn: "ব্যাটারি ওয়াটার ১ লিটার",
    sku: "BW-1L",
    category: "BATTERY",
    size: 1,
    unitCode: "LITER",
  },
  {
    id: "dw-500",
    name: "500ml Drinking Water",
    nameBn: "পানীয় জল ৫০০ মি.লি.",
    sku: "DW-500",
    category: "DRINKING",
    size: 500,
    unitCode: "MILLILITER",
  },
];
