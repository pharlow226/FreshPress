/**
 * PricingManagementPage — Full pricing CRUD for admin.
 * Features: grouped by category, inline price editing, active toggle, Add New Item modal.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Plus, Pencil, Loader2, AlertCircle, Package } from 'lucide-react';
import { supabase, formatCurrency } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

const CATEGORIES = ['Clothing', 'Bedding', 'Heavy Items', 'Others'];
const UNITS       = ['item', 'kg', 'piece', 'pair', 'set', 'bag'];

// ── Add/Edit Item Modal ───────────────────────────────────────────────────────

function ItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: any | null;   // null = new item
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    service_name: item?.service_name ?? '',
    category:     item?.category     ?? 'Clothing',
    price:        item?.price        ?? '',
    unit:         item?.unit         ?? 'item',
    description:  item?.description  ?? '',
  });
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const price = parseFloat(String(form.price));
    if (!form.service_name.trim())  { setError('Service name is required.'); return; }
    if (isNaN(price) || price < 0) { setError('Enter a valid price.'); return; }
    if (!confirmSave) { setConfirmSave(true); return; }  // first submit → show confirm

    setSaving(true);
    try {
      let dbError: any;
      if (isEdit) {
        const { error } = await supabase.from('pricing').update({
          service_name: form.service_name.trim(),
          category:     form.category,
          price,
          unit:         form.unit,
          description:  form.description.trim() || null,
        }).eq('id', item.id);
        dbError = error;
      } else {
        const { error } = await supabase.from('pricing').insert({
          service_name:  form.service_name.trim(),
          category:      form.category,
          price,
          unit:          form.unit,
          description:   form.description.trim() || null,
          active:        true,
          display_order: 999,
        });
        dbError = error;
      }

      if (dbError) throw new Error(dbError.message);
      toast({ title: isEdit ? 'Item updated' : 'Item added', description: `${form.service_name} saved successfully.` });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            {isEdit ? <Pencil className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Item' : 'Add New Item'}</h2>
          </div>
          <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Service Name</label>
            <input type="text" required value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} placeholder="e.g. Shirt — Regular Wash"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {UNITS.map(u => <option key={u} value={u}>per {u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Price (₦)</label>
            <input type="number" min="0" step="50" required value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 1500"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description (optional)</label>
            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
          {confirmSave && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              {isEdit ? 'Save changes to' : 'Add'} <strong>{form.service_name}</strong> at <strong>₦{Number(form.price).toLocaleString()}</strong> per {form.unit}?
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => confirmSave ? setConfirmSave(false) : onClose()} disabled={saving} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              {confirmSave ? 'Back' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : confirmSave ? 'Confirm Save' : <><Check className="w-4 h-4" /> Save Item</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PricingManagementPage() {
  const [pricing, setPricing]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const [toggleConfirm, setToggleConfirm] = useState<{ item: any } | null>(null);

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('pricing').select('*').order('display_order');
    if (error) console.error('[Pricing] fetch error:', error.message);
    if (data) setPricing(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPricing(); }, [fetchPricing]);

  useEffect(() => {
    const ch = supabase.channel('admin-pricing-mgmt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pricing' }, () => fetchPricing())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPricing]);

  const toggleActive = async (item: any) => {
    setToggleConfirm(null);
    const { error } = await supabase.from('pricing').update({ active: !item.active }).eq('id', item.id);
    if (error) toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    else { toast({ title: 'Updated', description: `Service ${!item.active ? 'activated' : 'deactivated'}` }); fetchPricing(); }
  };

  if (loading) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}</div>;
  }

  // Group by category — use CATEGORIES order as canonical, plus any extras
  const allCats = [...new Set([...CATEGORIES, ...pricing.map(p => p.category)])].filter(Boolean);

  return (
    <>
      {modal.open && <ItemModal item={modal.item} onClose={() => setModal({ open: false, item: null })} onSaved={fetchPricing} />}

      {/* Toggle active confirmation */}
      {toggleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-2">{toggleConfirm.item.active ? 'Deactivate' : 'Activate'} Item?</h3>
            <p className="text-sm text-gray-600 mb-5">
              {toggleConfirm.item.active
                ? <>Hide <strong>{toggleConfirm.item.service_name}</strong> from the pricing list?</>
                : <>Show <strong>{toggleConfirm.item.service_name}</strong> on the pricing list?</>}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setToggleConfirm(null)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">Cancel</button>
              <button onClick={() => toggleActive(toggleConfirm.item)} className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Pricing Management</h2>
            <p className="text-sm text-muted-foreground mt-1">{pricing.length} service item{pricing.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setModal({ open: true, item: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <Plus className="w-4 h-4" /> Add New Item
          </button>
        </div>

        {pricing.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No pricing items found</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first pricing item using the button above.</p>
            </CardContent>
          </Card>
        ) : (
          allCats.map(cat => {
            const items = pricing.filter(p => p.category === cat);
            if (items.length === 0) return null;
            return (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold text-foreground">{cat}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">({items.length} items)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{p.service_name}</p>
                              {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-sm">{formatCurrency(p.price)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">per {p.unit}</TableCell>
                          <TableCell>
                            <Switch checked={p.active} onCheckedChange={() => setToggleConfirm({ item: p })} />
                          </TableCell>
                          <TableCell>
                            <button onClick={() => setModal({ open: true, item: p })}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit item">
                              <Pencil className="w-4 h-4" />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
