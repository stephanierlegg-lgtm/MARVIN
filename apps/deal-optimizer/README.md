# Deal Optimizer

A local-first web app that tracks grocery store ad prices and coupon/cashback
offers, then computes the cheapest way to buy a shopping list — including
splitting the list across multiple stores or multiple transactions at the
same store when that reduces total out-of-pocket cost.

## Why manual/CSV entry instead of live scraping

Fetch, Ibotta, and KrazyCouponLady have no public APIs, and scraping their
apps/sites would violate their Terms of Service and break constantly (login
walls, bot detection). This app is built so entering offers you see in those
apps takes seconds, and store price data can come from CSV exports or manual
entry. If you later get affiliate/API access to a specific store (Walmart,
Target, and Costco all have some form of product/affiliate API), a scraper or
importer for that source can be added without touching the data model or the
optimizer.

## Stores in scope

Smiths, Walmart, Target, Costco, Sam's Club, WinCo — plus any others you add
(the store list isn't hardcoded, just seeded with these six on first load of
the Prices page).

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Data is stored in `data/deal-optimizer.db`
(SQLite, gitignored — it's your personal price/offer data).

## Workflow

1. **Prices** — add store ad prices manually, or import a CSV
   (`store,item_name,price,unit,sale_price,valid_from,valid_to`).
2. **Offers** — add Fetch/Ibotta/KrazyCouponLady/store coupons: percent off,
   amount off, flat cashback, or percent cashback, with an optional minimum
   spend, max uses, store restriction, and item restriction. Check "only
   triggers once per separate checkout" for offers that cap out per receipt
   and need multiple transactions to use up (this is what lets the optimizer
   decide to split a store's cart into two checkouts).
3. **Shopping Lists** — create a list, add items, then click **Optimize
   cart**. You'll get a per-store (and per-transaction, where splitting
   helps) breakdown of what to buy where, with offers applied and the total
   savings vs. a naive single-cart approach.

## How the optimizer works

See `src/lib/optimizer.ts` for the full algorithm and its documented
limitations. Summary: it assigns each item to its cheapest available store,
then for each store's cart evaluates whether splitting into up to 3
transactions reduces total cost (checking each offer's min-spend and
max-uses/per-transaction rules), and takes the best split. It's a greedy
heuristic, not an exact solver — for typical shopping-list sizes (tens of
items, a handful of stores) it captures the practical cases (cheapest-store
shopping + per-transaction rebate stacking) without needing a full ILP
solver.

## Data model

SQLite tables: `stores`, `store_prices`, `offers`, `shopping_lists`,
`shopping_list_items`. See `src/lib/db.ts` for the schema.
