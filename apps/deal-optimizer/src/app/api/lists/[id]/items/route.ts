import { NextResponse } from "next/server";
import { getDb, normalize } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const items = db
    .prepare("SELECT * FROM shopping_list_items WHERE list_id = ? ORDER BY id")
    .all(id);
  return NextResponse.json(items);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item_name, quantity } = await req.json();
  if (!item_name) return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO shopping_list_items (list_id, item_name, normalized_name, quantity) VALUES (?, ?, ?, ?)"
    )
    .run(id, item_name, normalize(item_name), quantity ?? 1);
  const row = db.prepare("SELECT * FROM shopping_list_items WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM shopping_list_items WHERE id = ?").run(itemId);
  return NextResponse.json({ ok: true });
}
