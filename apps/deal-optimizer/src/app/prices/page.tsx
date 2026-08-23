"use client";

import { useEffect, useState } from "react";

const STORES = ["Smiths", "Walmart", "Target", "Costco", "Sam's Club", "WinCo"];

type Store = { id: number; name: string };
type Price = {
  id: number;
  store_id: number;
  store_name: string;
  item_name: string;
  price: number;
  sale_price: number | null;
  unit: string | null;
};

export default function PricesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [form, setForm] = useState({ store_name: STORES[0], item_name: "", price: "", sale_price: "", unit: "" });
  const [csv, setCsv] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function loadAll() {
    const [s, p] = await Promise.all([
      fetch("/api/stores").then((r) => r.json()),
      fetch("/api/prices").then((r) => r.json()),
    ]);
    setStores(s);
    setPrices(p);
  }

  useEffect(() => {
    // ensure the 6 default stores exist
    (async () => {
      for (const name of STORES) {
        await fetch("/api/stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      }
      loadAll();
    })();
  }, []);

  async function addPrice(e: React.FormEvent) {
    e.preventDefault();
    const store = stores.find((s) => s.name === form.store_name);
    if (!store) return;
    await fetch("/api/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_id: store.id,
        item_name: form.item_name,
        price: parseFloat(form.price),
        sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
        unit: form.unit || null,
      }),
    });
    setForm({ ...form, item_name: "", price: "", sale_price: "", unit: "" });
    loadAll();
  }

  async function importCsv() {
    setStatus("Importing...");
    const res = await fetch("/api/prices/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = await res.json();
    setStatus(`Imported ${data.inserted}, skipped ${data.skipped_count}`);
    setCsv("");
    loadAll();
  }

  async function deletePrice(id: number) {
    await fetch(`/api/prices?id=${id}`, { method: "DELETE" });
    loadAll();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Store Prices</h1>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold mb-3">Add a price manually</h2>
        <form onSubmit={addPrice} className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <label className="flex flex-col text-sm gap-1">
            Store
            <select
              className="border rounded px-2 py-1"
              value={form.store_name}
              onChange={(e) => setForm({ ...form, store_name: e.target.value })}
            >
              {STORES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm gap-1 col-span-2">
            Item name
            <input
              className="border rounded px-2 py-1"
              required
              value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
              placeholder="e.g. Eggs, dozen"
            />
          </label>
          <label className="flex flex-col text-sm gap-1">
            Price
            <input
              className="border rounded px-2 py-1"
              required
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
          <label className="flex flex-col text-sm gap-1">
            Sale price
            <input
              className="border rounded px-2 py-1"
              type="number"
              step="0.01"
              value={form.sale_price}
              onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
            />
          </label>
          <label className="flex flex-col text-sm gap-1">
            Unit
            <input
              className="border rounded px-2 py-1"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="each"
            />
          </label>
          <button className="bg-zinc-900 text-white rounded px-4 py-1.5 h-fit">Add</button>
        </form>
      </section>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold mb-2">Import CSV</h2>
        <p className="text-sm text-zinc-600 mb-3">
          Headers: <code>store,item_name,price,unit,sale_price,valid_from,valid_to</code>
        </p>
        <textarea
          className="w-full border rounded px-2 py-1 font-mono text-sm h-32"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="store,item_name,price,unit,sale_price,valid_from,valid_to&#10;Walmart,Eggs dozen,3.49,each,2.99,,"
        />
        <div className="flex items-center gap-3 mt-2">
          <button onClick={importCsv} className="bg-zinc-900 text-white rounded px-4 py-1.5 text-sm">Import</button>
          {status && <span className="text-sm text-zinc-600">{status}</span>}
        </div>
      </section>

      <section className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold mb-3">All prices ({prices.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-1 pr-4">Store</th>
                <th className="py-1 pr-4">Item</th>
                <th className="py-1 pr-4">Price</th>
                <th className="py-1 pr-4">Sale</th>
                <th className="py-1 pr-4">Unit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-1 pr-4">{p.store_name}</td>
                  <td className="py-1 pr-4">{p.item_name}</td>
                  <td className="py-1 pr-4">${p.price.toFixed(2)}</td>
                  <td className="py-1 pr-4">{p.sale_price ? `$${p.sale_price.toFixed(2)}` : "—"}</td>
                  <td className="py-1 pr-4">{p.unit ?? "—"}</td>
                  <td className="py-1">
                    <button onClick={() => deletePrice(p.id)} className="text-red-600 text-xs">delete</button>
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
