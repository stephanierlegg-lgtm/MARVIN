import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const stores = db.prepare("SELECT * FROM stores ORDER BY name").all();
  return NextResponse.json(stores);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, min_transaction_amount, member_fee_amortized } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO stores (name, min_transaction_amount, member_fee_amortized) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET min_transaction_amount=excluded.min_transaction_amount, member_fee_amortized=excluded.member_fee_amortized"
  );
  stmt.run(name, min_transaction_amount ?? null, member_fee_amortized ?? 0);
  const store = db.prepare("SELECT * FROM stores WHERE name = ?").get(name);
  return NextResponse.json(store, { status: 201 });
}
