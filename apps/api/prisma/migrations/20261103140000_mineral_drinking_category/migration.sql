-- Legacy: DRINKING category label meant mineral water; split MINERAL vs DRINKING.
UPDATE "Product"
SET category = 'MINERAL'
WHERE category = 'DRINKING'
  AND sku ~ '^MW[0-9A-Z]{3}$';
