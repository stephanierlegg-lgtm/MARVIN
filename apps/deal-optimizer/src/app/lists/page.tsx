"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ShoppingList = { id: number; name: string; created_at: string };

export default function ListsPage() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [name, setName] = useState("");

  async function load() {
    setLists(await fetch("/api/lists").then((r) => r.json()));
  }

  useEffect(() => {
    load();
  }, []);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const list = await res.json();
    setName("");
    load();
    window.location.href = `/lists/${list.id}`;
  }

  async function deleteList(id: number) {
    await fetch(`/api/lists?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Shopping Lists</h1>

      <form onSubmit={createList} className="flex gap-3">
        <input
          className="border rounded px-3 py-1.5 flex-1"
          placeholder="e.g. Weekly groceries"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="bg-zinc-900 text-white rounded px-4 py-1.5">Create</button>
      </form>

      <div className="flex flex-col gap-2">
        {lists.map((l) => (
          <div key={l.id} className="bg-white border rounded-lg p-4 flex items-center justify-between">
            <Link href={`/lists/${l.id}`} className="font-medium hover:underline">{l.name}</Link>
            <button onClick={() => deleteList(l.id)} className="text-red-600 text-xs">delete</button>
          </div>
        ))}
        {lists.length === 0 && <p className="text-zinc-500 text-sm">No lists yet — create one above.</p>}
      </div>
    </div>
  );
}
