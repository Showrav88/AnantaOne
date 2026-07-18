export type CartLine = {
  productId: string;
  name: string;
  nameBn: string | null;
  sku: string;
  category: string;
  unit: string;
  priceBdt: number;
  imageUrl: string | null;
  qty: number;
};

function key(slug: string) {
  return `anantaone.cart.${slug}`;
}

export function loadCart(slug: string): CartLine[] {
  try {
    const raw = sessionStorage.getItem(key(slug));
    if (!raw) return [];
    return JSON.parse(raw) as CartLine[];
  } catch {
    return [];
  }
}

export function saveCart(slug: string, lines: CartLine[]) {
  sessionStorage.setItem(key(slug), JSON.stringify(lines));
}

export function clearCart(slug: string) {
  sessionStorage.removeItem(key(slug));
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((s, l) => s + l.qty, 0);
}

export function upsertCartLine(
  lines: CartLine[],
  line: Omit<CartLine, "qty"> & { qty?: number },
  qty = 1,
): CartLine[] {
  const next = [...lines];
  const idx = next.findIndex((l) => l.productId === line.productId);
  if (idx >= 0) {
    const existing = next[idx]!;
    next[idx] = { ...existing, qty: existing.qty + qty };
  } else {
    next.push({
      productId: line.productId,
      name: line.name,
      nameBn: line.nameBn,
      sku: line.sku,
      category: line.category,
      unit: line.unit,
      priceBdt: line.priceBdt,
      imageUrl: line.imageUrl,
      qty,
    });
  }
  return next.filter((l) => l.qty > 0);
}
