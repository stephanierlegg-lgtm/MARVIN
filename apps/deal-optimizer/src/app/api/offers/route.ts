import { NextResponse } from "next/server";
import { getDb, normalize } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT offers.*, stores.name as store_name
       FROM offers LEFT JOIN stores ON stores.id = offers.store_id
       ORDER BY offers.created_at DESC`
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    provider,
    title,
    item_name, // optional; will be normalized
    store_id,
    discount_type,
    discount_value,
    min_spend,
    max_uses,
    requires_separate_transaction,
    valid_from,
    valid_to,
    notes,
  } = body;

  if (!provider || !title || !discount_type || discount_value == null) {
    return NextResponse.json(
      { error: "provider, title, discount_type, discount_value are required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO offers (provider, title, normalized_item, store_id, discount_type, discount_value, min_spend, max_uses, requires_separate_transaction, valid_from, valid_to, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const info = stmt.run(
    provider,
    title,
    item_name ? normalize(item_name) : null,
    store_id ?? null,
    discount_type,
    discount_value,
    min_spend ?? 0,
    max_uses ?? 1,
    requires_separate_transaction ? 1 : 0,
    valid_from ?? null,
    valid_to ?? null,
    notes ?? null
  );
  const row = db.prepare("SELECT * FROM offers WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM offers WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
