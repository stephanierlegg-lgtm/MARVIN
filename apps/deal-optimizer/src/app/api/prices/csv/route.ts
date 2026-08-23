import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getDb, normalize } from "@/lib/db";

/**
 * Expects a CSV with headers: store,item_name,price,unit,sale_price,valid_from,valid_to
 * `store` is matched/created by name.
 */
export async function POST(req: Request) {
  const { csv } = await req.json();
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "csv (string) is required" }, { status: 400 });
  }

  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: "CSV parse error", details: parsed.errors }, { status: 400 });
  }

  const db = getDb();
  const getStore = db.prepare("SELECT id FROM stores WHERE name = ?");
  const insertStore = db.prepare("INSERT INTO stores (name) VALUES (?)");
  const insertPrice = db.prepare(
    `INSERT INTO store_prices (store_id, item_name, normalized_name, price, unit, sale_price, valid_from, valid_to, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'csv')`
  );

  let inserted = 0;
  const skipped: string[] = [];

  const tx = db.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      const storeName = row.store?.trim();
      const itemName = row.item_name?.trim();
      const price = parseFloat(row.price);
      if (!storeName || !itemName || Number.isNaN(price)) {
        skipped.push(JSON.stringify(row));
        continue;
      }
      let store = getStore.get(storeName) as { id: number } | undefined;
      if (!store) {
        const info = insertStore.run(storeName);
        store = { id: info.lastInsertRowid as number };
      }
      const salePrice = row.sale_price ? parseFloat(row.sale_price) : null;
      insertPrice.run(
        store.id,
        itemName,
        normalize(itemName),
        price,
        row.unit?.trim() || null,
        Number.isNaN(salePrice as number) ? null : salePrice,
        row.valid_from?.trim() || null,
        row.valid_to?.trim() || null
      );
      inserted++;
    }
  });

  tx(parsed.data);

  return NextResponse.json({ inserted, skipped_count: skipped.length, skipped });
}
