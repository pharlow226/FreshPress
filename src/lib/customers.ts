/**
 * @/lib/customers.ts
 *
 * Shared customer-grouping logic used by both OverviewPage and CustomersPage.
 *
 * GROUPING: Union-Find on email OR phone.
 *   - Same email → same customer
 *   - Same phone → same customer
 *   - Transitive: A↔B (phone), B↔C (email) → A, B, C are one customer
 *
 * THRESHOLDS:
 *   new       = 1 order
 *   returning = 2–4 orders and < ₦50k spent
 *   vip       = 5+ orders OR ₦50,000+ total spent
 */

export interface DerivedCustomer {
  key:              string;
  name:             string;
  email:            string;
  phone:            string;
  total_orders:     number;
  total_spent:      number;
  first_order_date: string | null;  // earliest order (used for trend charts)
  last_order_date:  string | null;  // most recent order
  customer_type:    'new' | 'returning' | 'vip';
  orders:           any[];
}

export function deriveType(orders: number, spent: number): 'new' | 'returning' | 'vip' {
  if (orders >= 5 || spent >= 50000) return 'vip';
  if (orders >= 2)                   return 'returning';
  return 'new';
}

/**
 * Groups raw order rows into unique customers using union-find on email + phone.
 * Returns one DerivedCustomer per unique customer.
 */
export function groupByUnionFind(orders: any[]): DerivedCustomer[] {
  const n = orders.length;
  if (n === 0) return [];

  // Path-compressed union-find
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function unite(x: number, y: number) {
    const rx = find(x), ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  }

  // Normalise identifiers
  const norm = orders.map(o => ({
    email: (o.email ?? '').toLowerCase().replace(/\s/g, ''),
    phone: (o.phone ?? '').replace(/[\s\-\(\)\+]/g, ''),
  }));

  // Build index: first occurrence of each email / phone
  const emailIdx = new Map<string, number>();
  const phoneIdx = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const { email, phone } = norm[i];
    if (email) {
      if (emailIdx.has(email)) unite(i, emailIdx.get(email)!);
      else emailIdx.set(email, i);
    }
    if (phone) {
      if (phoneIdx.has(phone)) unite(i, phoneIdx.get(phone)!);
      else phoneIdx.set(phone, i);
    }
  }

  // Collect groups by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  // Build one DerivedCustomer per group
  const result: DerivedCustomer[] = [];

  for (const [, idxList] of groups) {
    // Sort group by created_at desc — most recent first
    const grouped = idxList
      .map(i => orders[i])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const recent      = grouped[0];
    const oldest      = grouped[grouped.length - 1];
    const total_spent = grouped.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const count       = grouped.length;

    result.push({
      key:              String(idxList[0]),
      name:             recent.customer_name ?? '—',
      email:            recent.email ?? '',
      phone:            recent.phone ?? '',
      total_orders:     count,
      total_spent,
      first_order_date: oldest.created_at ?? null,
      last_order_date:  recent.created_at ?? null,
      customer_type:    deriveType(count, total_spent),
      orders:           grouped,
    });
  }

  return result;
}
