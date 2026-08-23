"use client";

import { useEffect, useState } from "react";

type Store = { id: number; name: string };
type Offer = {
  id: number;
  provider: string;
  title: string;
  normalized_item: string | null;
  store_id: number | null;
  store_name: string | null;
  discount_type: string;
  discount_value: number;
  min_spend: number;
  max_uses: number;
  requires_separate_transaction: number;
};

const PROVIDERS = ["fetch", "ibotta", "krazycouponlady", "store", "other"];
const DISCOUNT_TYPES = [
  { value: "percent_off", label: "% off item/receipt" },
  { value: "amount_off", label: "$ off item/receipt" },
  { value: "cashback_flat", label: "$ cashback (flat)" },
  { value: "cashback_percent", label: "% cashback" },
];

export default function OffersPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState({
    provider: "fetch",
    title: "",
    item_name: "",
    store_name: "",
    discount_type: "cashback_flat",
    discount_value: "",
    min_spend: "0",
    max_uses: "1",
    requires_separate_transaction: false,
    notes: "",
  });

  async function loadAll() {
    const [s, o] = await Promise.all([
      fetch("/api/stores").then((r) => r.json()),
      fetch("/api/offers").then((r) => r.json()),
    ]);
    setStores(s);
    setOffers(o);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function addOffer(e: React.FormEvent) {
    e.preventDefault();
    const store = stores.find((s) => s.name === form.store_name);
    await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: form.provider,
        title: form.title,
        item_name: form.item_name || null,
        store_id: store?.id ?? null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_spend: parseFloat(form.min_spend || "0"),
        max_uses: parseInt(form.max_uses || "1", 10),
        requires_separate_transaction: form.requires_separate_transaction,
        notes: form.notes || null,
      }),
    });
    setForm({ ...form, title: "", item_name: "", discount_value: "", notes: "" });
    loadAll();
  }

  async function deleteOffer(id: number) {
    await fetch(`/api/offers?id=${id}`, { method: "DELETE" });
    loadAll();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Coupons &amp; Cashback Offers</h1>
      <p className="text-sm text-zinc-600 -mt-4">
        Enter offers you see in the Fetch, Ibotta, or KrazyCouponLady apps here manually — these
        services don&apos;t have public APIs, so there&apos;s no live sync, but entering the ones
        relevant to your list takes seconds and lets the optimizer use them.
      </p>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold mb-3">Add an offer</h2>
        <form onSubmit={addOffer} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <label className="flex flex-col text-sm gap-1">
            Provider
            <select className="border rounded px-2 py-1" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-sm gap-1 col-span-2">
            Title
            <input className="border rounded px-2 py-1" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. $2 back on any eggs" />
          </label>
          <label className="flex flex-col text-sm gap-1">
            Store (optional)
            <select className="border rounded px-2 py-1" value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })}>
              <option value="">Any store</option>
              {stores.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-sm gap-1 col-span-2">
            Applies to item (optional, blank = whole receipt)
            <input className="border rounded px-2 py-1" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="e.g. Eggs dozen" />
          </label>
          <label className="flex flex-col text-sm gap-1">
            Discount type
            <select className="border rounded px-2 py-1" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
              {DISCOUNT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-sm gap-1">
            Value
            <input className="border rounded px-2 py-1" required type="number" step="0.01" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
          </label>
          <label className="flex flex-col text-sm gap-1">
            Min spend
            <input className="border rounded px-2 py-1" type="number" step="0.01" value={form.min_spend} onChange={(e) => setForm({ ...form, min_spend: e.target.value })} />
          </label>
          <label className="flex flex-col text-sm gap-1">
            Max uses
            <input className="border rounded px-2 py-1" type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm col-span-2">
            <input type="checkbox" checked={form.requires_separate_transaction} onChange={(e) => setForm({ ...form, requires_separate_transaction: e.target.checked })} />
            Only triggers once per separate checkout (needed to use max uses &gt; 1)
          </label>
          <button className="bg-zinc-900 text-white rounded px-4 py-1.5 h-fit">Add offer</button>
        </form>
      </section>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold mb-3">All offers ({offers.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-4">Provider</th>
                <th className="py-1 pr-4">Title</th>
                <th className="py-1 pr-4">Store</th>
                <th className="py-1 pr-4">Item</th>
                <th className="py-1 pr-4">Discount</th>
                <th className="py-1 pr-4">Min spend</th>
                <th className="py-1 pr-4">Max uses</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-1 pr-4">{o.provider}</td>
                  <td className="py-1 pr-4">{o.title}</td>
                  <td className="py-1 pr-4">{o.store_name ?? "Any"}</td>
                  <td className="py-1 pr-4">{o.normalized_item ?? "Whole receipt"}</td>
                  <td className="py-1 pr-4">{o.discount_type} {o.discount_value}</td>
                  <td className="py-1 pr-4">${o.min_spend}</td>
                  <td className="py-1 pr-4">{o.max_uses}{o.requires_separate_transaction ? " (per txn)" : ""}</td>
                  <td className="py-1">
                    <button onClick={() => deleteOffer(o.id)} className="text-red-600 text-xs">delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
