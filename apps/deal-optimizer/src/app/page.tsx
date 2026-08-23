import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Deal Optimizer</h1>
      <p className="text-zinc-600 max-w-xl">
        Track store ad prices and coupon/cashback offers (Fetch, Ibotta, KrazyCouponLady, etc.),
        build a shopping list, and get an optimized multi-store, multi-transaction cart plan that
        minimizes your total out-of-pocket cost.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card href="/prices" title="1. Enter Prices" desc="Add store ad prices manually or import a CSV." />
        <Card href="/offers" title="2. Enter Offers" desc="Add Fetch/Ibotta/KCL coupons and cashback rules." />
        <Card href="/lists" title="3. Build a List & Optimize" desc="Create a shopping list and get the cheapest cart plan." />
      </div>
    </div>
  );
}

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block rounded-lg border bg-white p-5 hover:shadow-sm transition-shadow">
      <h2 className="font-semibold mb-1">{title}</h2>
      <p className="text-sm text-zinc-600">{desc}</p>
    </Link>
  );
}
