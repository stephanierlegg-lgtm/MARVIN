"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";

type ListItem = { id: number; item_name: string; quantity: number };

type OptimizerResult = {
  transactions: {
    store_id: number;
    store_name: string;
    transaction_index: number;
    items: { item_name: string; quantity: number; unit_price: number; line_total: number }[];
    subtotal: number;
    offers_applied: { title: string; provider: string; savings: number }[];
    total_after_offers: number;
  }[];
  total_cost: number;
  naive_single_cart_cost: number;
  total_savings: number;
  unavailable_items: string[];
};

export default function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [items, setItems] = useState<ListItem[]>([]);
  const [form, setForm] = useState({ item_name: "", quantity: "1" });
  const [result, setResult] = useState<OptimizerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadItems() {
    setItems(await fetch(`/api/lists/${id}/items`).then((r) => r.json()));
  }

  useEffect(() => {
    loadItems();
  }, [id]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item_name.trim()) return;
    await fetch(`/api/lists/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_name: form.item_name, quantity: parseFloat(form.quantity || "1") }),
    });
    setForm({ item_name: "", quantity: "1" });
    loadItems();
  }

  async function deleteItem(itemId: number) {
    await fetch(`/api/lists/${id}/items?itemId=${itemId}`, { method: "DELETE" });
    loadItems();
  }

  async function runOptimizer() {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id: Number(id) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to optimize");
      return;
    }
    setResult(data);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/lists" className="text-sm text-zinc-500 hover:underline">&larr; Shopping Lists</Link>
        <h1 className="text-2xl font-semibold mt-1">Shopping List</h1>
      </div>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold mb-3">Items</h2>
        <form onSubmit={addItem} className="flex gap-3 mb-4">
          <input
            className="border rounded px-3 py-1.5 flex-1"
            placeholder="Item name (e.g. Eggs dozen)"
            value={form.item_name}
            onChange={(e) => setForm({ ...form, item_name: e.target.value })}
          />
          <input
            className="border rounded px-3 py-1.5 w-24"
            type="number"
            step="0.01"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
          <button className="bg-zinc-900 text-white rounded px-4 py-1.5">Add</button>
        </form>
        <ul className="flex flex-col gap-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
              <span>{i.item_name} &times; {i.quantity}</span>
              <button onClick={() => deleteItem(i.id)} className="text-red-600 text-xs">remove</button>
            </li>
          ))}
          {items.length === 0 && <p className="text-zinc-500 text-sm">No items yet.</p>}
        </ul>
      </section>

      <button
        onClick={runOptimizer}
        disabled={items.length === 0 || loading}
        className="bg-emerald-700 disabled:bg-zinc-300 text-white rounded px-5 py-2 self-start"
      >
        {loading ? "Optimizing..." : "Optimize cart"}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {result && (
        <section className="flex flex-col gap-4">
          <div className="bg-white border rounded-lg p-5 flex flex-wrap gap-8">
            <Stat label="Naive single-cart cost" value={`$${result.naive_single_cart_cost.toFixed(2)}`} />
            <Stat label="Optimized total cost" value={`$${result.total_cost.toFixed(2)}`} highlight />
            <Stat label="Total savings" value={`$${result.total_savings.toFixed(2)}`} good={result.total_savings > 0} />
          </div>

          {result.unavailable_items.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
              No known price for: {result.unavailable_items.join(", ")}. Add prices for these items to include them.
            </div>
          )}

          {result.transactions.map((t, idx) => (
            <div key={idx} className="bg-white border rounded-lg p-5">
              <h3 className="font-semibold mb-2">
                {t.store_name}
                {t.transaction_index > 1 || result.transactions.some((x) => x.store_id === t.store_id && x.transaction_index > 1)
                  ? ` — Transaction ${t.transaction_index}`
                  : ""}
              </h3>
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1 pr-4">Item</th>
                    <th className="py-1 pr-4">Qty</th>
                    <th className="py-1 pr-4">Unit price</th>
                    <th className="py-1 pr-4">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {t.items.map((i, j) => (
                    <tr key={j} className="border-b last:border-0">
                      <td className="py-1 pr-4">{i.item_name}</td>
                      <td className="py-1 pr-4">{i.quantity}</td>
                      <td className="py-1 pr-4">${i.unit_price.toFixed(2)}</td>
                      <td className="py-1 pr-4">${i.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-sm text-zinc-600">Subtotal: ${t.subtotal.toFixed(2)}</div>
              {t.offers_applied.map((o, j) => (
                <div key={j} className="text-sm text-emerald-700">
                  − ${o.savings.toFixed(2)} ({o.provider}: {o.title})
                </div>
              ))}
              <div className="font-semibold mt-1">Total: ${t.total_after_offers.toFixed(2)}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, highlight, good }: { label: string; value: string; highlight?: boolean; good?: boolean }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-xl font-semibold ${highlight ? "text-zinc-900" : ""} ${good ? "text-emerald-700" : ""}`}>{value}</div>
    </div>
  );
}
