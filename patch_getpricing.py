import re
filepath = r"supabase\functions\vapi-webhook\index.ts"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace getPricing to also fetch company_info minimum order
old_getPricing = """async function getPricing(args: any) {
    let url = `${SUPABASE_URL}/rest/v1/pricing?active=eq.true&select=service_name,category,price,unit&order=display_order.asc`;
    const res = await fetch(url, { headers: dbH() });
    if (!res.ok) return "Pricing data is temporarily unavailable.";
    const rows = await res.json();
    if (rows.length === 0) return "No pricing data found.";
    
    // Format nicely for the AI to read
    const cats: Record<string, string[]> = {};
    for (const r of rows) {
      const cat = r.category || 'Other';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(`${r.service_name}: ${r.price} Naira${r.unit ? ' per ' + r.unit : ''}`);
    }
    
    let resultStr = "Live Pricing Data:\\n";
    for (const [cat, items] of Object.entries(cats)) {
      resultStr += `${cat}:\\n- ${items.join('\\n- ')}\\n\\n`;
    }
    return resultStr;
  }"""

new_getPricing = """async function getPricing(args: any) {
    const [priceRes, compRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/pricing?active=eq.true&select=service_name,category,price,unit&order=display_order.asc`, { headers: dbH() }),
      fetch(`${SUPABASE_URL}/rest/v1/company_info?select=minimum_order&limit=1`, { headers: dbH() })
    ]);
    
    if (!priceRes.ok) return "Pricing data is temporarily unavailable.";
    const rows = await priceRes.json();
    if (rows.length === 0) return "No pricing data found.";
    
    let minOrder = "2000";
    if (compRes.ok) {
        const cRows = await compRes.json();
        if (cRows.length > 0 && cRows[0].minimum_order) minOrder = cRows[0].minimum_order;
    }
    
    const cats: Record<string, string[]> = {};
    for (const r of rows) {
      const cat = r.category || 'Other';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(`${r.service_name}: ${r.price} Naira${r.unit ? ' per ' + r.unit : ''}`);
    }
    
    let resultStr = "Live Pricing Data:\\n";
    for (const [cat, items] of Object.entries(cats)) {
      resultStr += `${cat}:\\n- ${items.join('\\n- ')}\\n\\n`;
    }
    resultStr += `\\nCRITICAL RULE: The minimum order is ${minOrder} Naira. Always mention this when quoting prices.`;
    return resultStr;
  }"""

if "async function getPricing(args: any)" in content:
    # use literal replacement because regex with all these characters is brittle
    content = content.replace(old_getPricing, new_getPricing)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("Patched getPricing in vapi-webhook")
else:
    print("Could not find getPricing")
