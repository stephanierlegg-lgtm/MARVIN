import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const lists = db.prepare("SELECT * FROM shopping_lists ORDER BY created_at DESC").all();
  return NextResponse.json(lists);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const db = getDb();
  const info = db.prepare("INSERT INTO shopping_lists (name) VALUES (?)").run(name);
  const row = db.prepare("SELECT * FROM shopping_lists WHERE id = ?").get(info.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const db = getDb();
  db.prepare("DELETE FROM shopping_lists WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
