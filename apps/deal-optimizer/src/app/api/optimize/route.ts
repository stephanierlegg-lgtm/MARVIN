import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { optimizeCart, type StorePriceRow, type OfferRow, type ListItem } from "@/lib/optimizer";

export async function POST(req: Request) {
  const { list_id } = await req.json();
  if (!list_id) return NextResponse.json({ error: "list_id is required" }, { status: 400 });

  const db = getDb();

  const listItems = db
    .prepare("SELECT item_name, normalized_name, quantity FROM shopping_list_items WHERE list_id = ?")
    .all(list_id) as ListItem[];

  if (listItems.length === 0) {
    return NextResponse.json({ error: "shopping list is empty" }, { status: 400 });
  }

  const prices = db
    .prepare(
      `SELECT store_prices.store_id, stores.name as store_name, store_prices.item_name,
              store_prices.normalized_name, store_prices.price, store_prices.sale_price
       FROM store_prices JOIN stores ON stores.id = store_prices.store_id`
    )
    .all() as StorePriceRow[];

  const offers = db
    .prepare(
      `SELECT id, provider, title, normalized_item, store_id, discount_type, discount_value,
              min_spend, max_uses, requires_separate_transaction
       FROM offers`
    )
    .all() as OfferRow[];

  const result = optimizeCart(listItems, prices, offers);
  return NextResponse.json(result);
}
