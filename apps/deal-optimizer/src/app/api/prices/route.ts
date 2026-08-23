import { NextResponse } from "next/server";
import { getDb, normalize } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT store_prices.*, stores.name as store_name
       FROM store_prices JOIN stores ON stores.id = store_prices.store_id
       ORDER BY store_prices.created_at DESC`
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { store_id, item_name, price, unit, sale_price, valid_from, valid_to } = body;
  if (!store_id || !item_name || price == null) {
    return NextResponse.json({ error: "store_id, item_name, price are required" }, { status: 400 });
  }
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO store_prices (store_id, item_name, normalized_name, price, unit, sale_price, valid_from, valid_to, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')`
  );
  const info = stmt.run(
    store_id,
    item_name,
    normalize(item_name),
    price,
    unit ?? null,
    sale_price ?? null,
    valid_from ?? null,
    valid_to ?? null
  );
  const row = db.prepare("SELECT * FROM store_prices WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM store_prices WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
