/**
 * Cart optimizer.
 *
 * Goal: given a shopping list and known store prices + offers, decide which
 * store (and which "transaction" at that store, since some cashback/rebate
 * offers cap out per-receipt and re-trigger on a separate checkout) each
 * item should be bought in, to minimize total out-of-pocket cost.
 *
 * Approach: this is a variant of bin-packing / set-partitioning, which is
 * NP-hard in general. For a real shopping list (tens of items, handful of
 * stores) an exact ILP is overkill to hand-roll from scratch, so we use a
 * greedy-with-local-search heuristic:
 *
 *   1. For each item, find its cheapest available price across all stores
 *      (before offers) -> "naive assignment".
 *   2. Group naive assignments by store into candidate single-transaction
 *      carts.
 *   3. For each store's cart, evaluate whether splitting it into multiple
 *      transactions reduces total cost, by checking each applicable offer's
 *      min_spend / max_uses / requires_separate_transaction rules and
 *      simulating 1..N transaction splits (N capped small — see MAX_SPLITS).
 *   4. Pick the split (including "no split") with the lowest total cost per
 *      store, then sum across stores.
 *   5. Compare against the naive single-cart-per-store total so the UI can
 *      show savings.
 *
 * This is NOT guaranteed globally optimal (a true ILP could occasionally
 * beat it, e.g. by moving a single item to a worse-priced store purely to
 * hit a rebate threshold elsewhere) but it captures the dominant, practical
 * cases: multi-store price shopping + per-transaction rebate stacking.
 */

import { normalize } from "./db";

export interface StorePriceRow {
  store_id: number;
  store_name: string;
  item_name: string;
  normalized_name: string;
  price: number;
  sale_price: number | null;
}

export interface OfferRow {
  id: number;
  provider: string;
  title: string;
  normalized_item: string | null;
  store_id: number | null;
  discount_type: "percent_off" | "amount_off" | "cashback_flat" | "cashback_percent";
  discount_value: number;
  min_spend: number;
  max_uses: number;
  requires_separate_transaction: number;
}

export interface ListItem {
  item_name: string;
  normalized_name: string;
  quantity: number;
}

export interface ItemAssignment {
  item_name: string;
  quantity: number;
  store_id: number;
  store_name: string;
  unit_price: number;
  line_total: number;
}

export interface TransactionPlan {
  store_id: number;
  store_name: string;
  transaction_index: number; // 1-based, for stores split into multiple checkouts
  items: ItemAssignment[];
  subtotal: number;
  offers_applied: { title: string; provider: string; savings: number }[];
  total_after_offers: number;
}

export interface OptimizerResult {
  transactions: TransactionPlan[];
  total_cost: number;
  naive_single_cart_cost: number;
  total_savings: number;
  unavailable_items: string[]; // items with no known price anywhere
}

const MAX_SPLITS = 3; // cap how many transactions we'll try splitting one store's cart into

function effectivePrice(row: StorePriceRow): number {
  return row.sale_price != null && row.sale_price < row.price ? row.sale_price : row.price;
}

/** Applies item-level and receipt-level offers to a transaction's item set, returns savings + which offers fired. */
function applyOffers(
  items: ItemAssignment[],
  subtotal: number,
  storeId: number,
  offers: OfferRow[],
  offerUseCounts: Map<number, number>
): { total: number; applied: { title: string; provider: string; savings: number }[] } {
  let total = subtotal;
  const applied: { title: string; provider: string; savings: number }[] = [];

  for (const offer of offers) {
    if (offer.store_id != null && offer.store_id !== storeId) continue;

    const usesSoFar = offerUseCounts.get(offer.id) ?? 0;
    if (usesSoFar >= offer.max_uses) continue;

    if (offer.normalized_item) {
      // Item-specific offer: only applies if that item is in this transaction.
      const match = items.find((i) => normalize(i.item_name) === offer.normalized_item);
      if (!match) continue;
      if (subtotal < offer.min_spend) continue;

      let savings = 0;
      if (offer.discount_type === "amount_off") savings = Math.min(offer.discount_value, match.line_total);
      else if (offer.discount_type === "percent_off") savings = match.line_total * (offer.discount_value / 100);
      else if (offer.discount_type === "cashback_flat") savings = offer.discount_value;
      else if (offer.discount_type === "cashback_percent") savings = match.line_total * (offer.discount_value / 100);

      if (savings > 0) {
        total -= savings;
        applied.push({ title: offer.title, provider: offer.provider, savings });
        offerUseCounts.set(offer.id, usesSoFar + 1);
      }
    } else {
      // Receipt-wide offer.
      if (subtotal < offer.min_spend) continue;

      let savings = 0;
      if (offer.discount_type === "amount_off") savings = offer.discount_value;
      else if (offer.discount_type === "percent_off") savings = subtotal * (offer.discount_value / 100);
      else if (offer.discount_type === "cashback_flat") savings = offer.discount_value;
      else if (offer.discount_type === "cashback_percent") savings = subtotal * (offer.discount_value / 100);

      if (savings > 0) {
        total -= savings;
        applied.push({ title: offer.title, provider: offer.provider, savings });
        offerUseCounts.set(offer.id, usesSoFar + 1);
      }
    }
  }

  return { total: Math.max(0, total), applied };
}

/** Splits a store's item list into N roughly-even transactions (by count), used to explore split options. */
function splitItems(items: ItemAssignment[], n: number): ItemAssignment[][] {
  if (n <= 1) return [items];
  const buckets: ItemAssignment[][] = Array.from({ length: n }, () => []);
  items.forEach((item, idx) => buckets[idx % n].push(item));
  return buckets.filter((b) => b.length > 0);
}

function evaluateStoreCart(
  storeId: number,
  storeName: string,
  items: ItemAssignment[],
  offers: OfferRow[]
): TransactionPlan[] {
  const storeOffers = offers.filter((o) => o.store_id == null || o.store_id === storeId);
  const hasSplitIncentive = storeOffers.some(
    (o) => o.requires_separate_transaction === 1 && o.max_uses > 1
  );

  const maxN = hasSplitIncentive ? Math.min(MAX_SPLITS, items.length) : 1;
  let best: TransactionPlan[] | null = null;
  let bestCost = Infinity;

  for (let n = 1; n <= maxN; n++) {
    const buckets = splitItems(items, n);
    const offerUseCounts = new Map<number, number>();
    const plans: TransactionPlan[] = buckets.map((bucketItems, idx) => {
      const subtotal = bucketItems.reduce((s, i) => s + i.line_total, 0);
      const { total, applied } = applyOffers(bucketItems, subtotal, storeId, storeOffers, offerUseCounts);
      return {
        store_id: storeId,
        store_name: storeName,
        transaction_index: idx + 1,
        items: bucketItems,
        subtotal,
        offers_applied: applied,
        total_after_offers: total,
      };
    });
    const cost = plans.reduce((s, p) => s + p.total_after_offers, 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = plans;
    }
  }

  return best!;
}

export function optimizeCart(
  listItems: ListItem[],
  prices: StorePriceRow[],
  offers: OfferRow[]
): OptimizerResult {
  const pricesByItem = new Map<string, StorePriceRow[]>();
  for (const p of prices) {
    const key = normalize(p.normalized_name);
    if (!pricesByItem.has(key)) pricesByItem.set(key, []);
    pricesByItem.get(key)!.push(p);
  }

  const unavailable: string[] = [];
  const naiveAssignments: ItemAssignment[] = [];

  for (const li of listItems) {
    const key = normalize(li.normalized_name);
    const candidates = pricesByItem.get(key);
    if (!candidates || candidates.length === 0) {
      unavailable.push(li.item_name);
      continue;
    }
    const cheapest = candidates.reduce((min, c) =>
      effectivePrice(c) < effectivePrice(min) ? c : min
    );
    naiveAssignments.push({
      item_name: li.item_name,
      quantity: li.quantity,
      store_id: cheapest.store_id,
      store_name: cheapest.store_name,
      unit_price: effectivePrice(cheapest),
      line_total: effectivePrice(cheapest) * li.quantity,
    });
  }

  const naiveSingleCartCost = naiveAssignments.reduce((s, i) => s + i.line_total, 0);

  const byStore = new Map<number, { name: string; items: ItemAssignment[] }>();
  for (const a of naiveAssignments) {
    if (!byStore.has(a.store_id)) byStore.set(a.store_id, { name: a.store_name, items: [] });
    byStore.get(a.store_id)!.items.push(a);
  }

  const allTransactions: TransactionPlan[] = [];
  for (const [storeId, { name, items }] of byStore) {
    const plans = evaluateStoreCart(storeId, name, items, offers);
    allTransactions.push(...plans);
  }

  const totalCost = allTransactions.reduce((s, t) => s + t.total_after_offers, 0);

  return {
    transactions: allTransactions,
    total_cost: totalCost,
    naive_single_cart_cost: naiveSingleCartCost,
    total_savings: naiveSingleCartCost - totalCost,
    unavailable_items: unavailable,
  };
}
