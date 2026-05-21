/**
 * CompanySettingsPage.tsx
 * Admin page for editing company_info — bank details, VAT, WhatsApp, contact info.
 * These values are used by generate-invoice edge function for PDF and notifications.
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Building2, Save, Loader2, RefreshCw, Globe, Upload, ImageIcon } from 'lucide-react';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

interface CompanyInfo {
  id?:               number;
  company_name?:     string;
  company_email?:    string;
  company_phone?:    string;
  company_address?:  string;
  company_whatsapp?: string;
  account_name?:     string;
  account_number?:   string;
  bank_name?:        string;
  tax_rate?:         number | string;
  currency?:         string;
  minimum_order?:    number | string;
  // SEO / Social
  og_image_url?:   string;
  latitude?:       string | number;
  longitude?:      string | number;
  service_areas?:  string; // comma-separated, e.g. "Abule Egba, Meiran, Kola"
}

const FIELD_CONFIG: { key: keyof CompanyInfo; label: string; placeholder: string; type?: string; hint?: string }[] = [
  { key: 'company_name',     label: 'Company Name',      placeholder: 'FreshPress Laundry Services' },
  { key: 'company_email',    label: 'Company Email',     placeholder: 'hello@freshpress.ng',  type: 'email' },
  { key: 'company_phone',    label: 'Company Phone',     placeholder: '+234 811 314 3272' },
  { key: 'company_whatsapp', label: 'WhatsApp Number',   placeholder: '+234 811 314 3272', hint: 'Customers send payment receipts to this number' },
  { key: 'company_address',  label: 'Company Address',   placeholder: 'Lagos, Nigeria' },
  { key: 'account_name',     label: 'Bank Account Name', placeholder: 'FreshPress Laundry Services', hint: 'Appears on invoice payment instructions' },
  { key: 'account_number',   label: 'Account Number',    placeholder: '1234567890',  hint: 'Appears on invoice payment instructions' },
  { key: 'bank_name',        label: 'Bank Name',         placeholder: 'First Bank Nigeria', hint: 'Appears on invoice payment instructions' },
  { key: 'tax_rate',         label: 'VAT Rate',          placeholder: '0.075', type: 'number', hint: 'e.g. 0.075 = 7.5% VAT. Fetched by generate-invoice edge function.' },
  { key: 'currency',         label: 'Currency Code',     placeholder: 'NGN' },
  { key: 'minimum_order',    label: 'Minimum Order Value', placeholder: '3000', type: 'number', hint: 'Orders below this amount incur a delivery surcharge.' },
];

export function CompanySettingsPage() {
  const [form,         setForm]         = useState<CompanyInfo>({});
  const [savedForm,    setSavedForm]    = useState<CompanyInfo>({});   // last saved snapshot
  const [dirtyFields,  setDirtyFields]  = useState<Set<string>>(new Set());
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [success,        setSuccess]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    const { data, error: dbErr } = await supabase
      .from('company_info')
      .select('*')
      .limit(1)
      .single();
    if (dbErr && dbErr.code !== 'PGRST116') {
      setError('Failed to load settings. ' + dbErr.message);
    } else if (data) {
      setForm(data);
      setSavedForm(data);
      setDirtyFields(new Set());
    }
    setLoading(false);
  };

  // Upload OG image directly to Supabase Storage
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const ext      = file.name.split('.').pop() ?? 'png';
      const path     = `og-image.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('public-assets')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data: urlData } = supabase.storage
        .from('public-assets')
        .getPublicUrl(uploadData.path);
      handleChange('og_image_url', urlData.publicUrl);
    } catch (err: any) {
      setError('Image upload failed: ' + (err.message ?? 'Unknown error'));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleChange = (key: keyof CompanyInfo, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Mark field dirty only if it differs from the last saved value
    setDirtyFields(prev => {
      const next = new Set(prev);
      const savedVal = String((savedForm as any)[key] ?? '');
      if (value !== savedVal) {
        next.add(key);
      } else {
        next.delete(key); // reverted back to original — no longer dirty
      }
      return next;
    });
    setSuccess(false);
    setError(null);
  };

  // Discard unsaved changes — revert to last saved snapshot
  const handleDiscard = () => {
    setForm(savedForm);
    setDirtyFields(new Set());
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (dirtyFields.size === 0) return; // nothing changed

    setSaving(true);
    setError(null);
    setSuccess(false);

    // Build payload — only fields the user actually changed
    const payload: Record<string, unknown> = {};
    for (const key of dirtyFields) {
      payload[key] = (form as any)[key];
    }

    // Validate tax_rate if it was changed
    if (payload.tax_rate !== undefined) {
      const taxVal = parseFloat(String(payload.tax_rate));
      if (isNaN(taxVal) || taxVal < 0 || taxVal > 1) {
        setError('VAT Rate must be a decimal between 0 and 1 (e.g. 0.075 for 7.5%)');
        setSaving(false);
        return;
      }
      payload.tax_rate = taxVal;
    }

    try {
      const url     = import.meta.env.VITE_SAVE_COMPANY_SETTINGS_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      if (!url) throw new Error('VITE_SAVE_COMPANY_SETTINGS_URL is not set in .env');

      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Save failed');

      // Update saved snapshot so dirty tracking resets
      setSavedForm(prev => ({ ...prev, ...payload }));
      setDirtyFields(new Set());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Company Settings</h2>
            <p className="text-sm text-gray-500">Bank details, VAT rate, and contact info used on invoices</p>
          </div>
        </div>
        <button
          onClick={fetchSettings}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <strong>These values appear on every invoice PDF and WhatsApp notification.</strong>
        {' '}Changes take effect on the next invoice generated.
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {/* Bank Details section */}
        <div className="px-6 py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Bank &amp; Payment Details</p>
          <div className="space-y-4">
            {FIELD_CONFIG.filter(f => ['account_name', 'account_number', 'bank_name'].includes(f.key)).map(field => (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {field.label}
                  {field.hint && <span className="ml-1 text-xs font-normal text-gray-400">— {field.hint}</span>}
                </label>
                <input
                  type={field.type ?? 'text'}
                  value={String(form[field.key] ?? '')}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Contact Details section */}
        <div className="px-6 py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Contact Details</p>
          <div className="space-y-4">
            {FIELD_CONFIG.filter(f => ['company_name', 'company_email', 'company_phone', 'company_whatsapp', 'company_address'].includes(f.key)).map(field => (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {field.label}
                  {field.hint && <span className="ml-1 text-xs font-normal text-gray-400">— {field.hint}</span>}
                </label>
                <input
                  type={field.type ?? 'text'}
                  value={String(form[field.key] ?? '')}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tax / Currency section */}
        <div className="px-6 py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Tax &amp; Currency</p>
          <div className="space-y-4">
            {FIELD_CONFIG.filter(f => ['tax_rate', 'currency', 'minimum_order'].includes(f.key)).map(field => (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {field.label}
                  {field.hint && <span className="ml-1 text-xs font-normal text-gray-400">— {field.hint}</span>}
                </label>
                <input
                  type={field.type ?? 'text'}
                  step={field.type === 'number' ? '0.001' : undefined}
                  value={String(form[field.key] ?? '')}
                  onChange={e => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                {field.key === 'tax_rate' && form.tax_rate !== undefined && form.tax_rate !== '' && (
                  <p className="text-xs text-gray-400 mt-1">
                    = {(parseFloat(String(form.tax_rate)) * 100).toFixed(1)}% VAT
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SEO & Social Media section */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-indigo-500" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">SEO &amp; Social Media</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-700 mb-4">
            These fields power your website's Google AI Overview citations, WhatsApp/Facebook share previews, and local search rankings.
          </div>
          <div className="space-y-4">
            {/* OG Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Social Share Image
                <span className="ml-1 text-xs font-normal text-gray-400">— shown when your site is shared on WhatsApp, Facebook, Twitter</span>
              </label>

              {/* Upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
                id="og-image-upload"
              />
              <label
                htmlFor="og-image-upload"
                className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition
                  ${uploadingImage
                    ? 'border-indigo-300 bg-indigo-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'}`}
              >
                {uploadingImage
                  ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin flex-shrink-0" />
                  : <Upload className="w-5 h-5 text-indigo-500 flex-shrink-0" />}
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    {uploadingImage ? 'Uploading...' : 'Click to upload image'}
                  </p>
                  <p className="text-xs text-gray-400">PNG, JPG or WebP · Recommended: 1200 × 630 px</p>
                </div>
              </label>

              {/* Live preview */}
              {form.og_image_url && (
                <div className="mt-3 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                  <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-1.5 border-b border-gray-100">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400">Preview</span>
                  </div>
                  <img
                    src={form.og_image_url}
                    alt="OG image preview"
                    className="w-full h-auto max-h-48 object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Manual URL fallback */}
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">Or paste a URL directly:</p>
                <input
                  type="url"
                  value={String(form.og_image_url ?? '')}
                  onChange={e => handleChange('og_image_url', e.target.value)}
                  placeholder="https://your-cdn.com/og-image.png"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            {/* Business Address for schema */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Business Address
                <span className="ml-1 text-xs font-normal text-gray-400">— exact street address for Google Maps &amp; local SEO schema</span>
              </label>
              <input
                type="text"
                value={String(form.company_address ?? '')}
                onChange={e => handleChange('company_address', e.target.value)}
                placeholder="5 Admiralty Way, Abule Egba, Lagos, Nigeria"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <p className="text-xs text-gray-400 mt-1">
                This updates the address in your Google AI citation and WhatsApp share preview automatically.
              </p>
            </div>

            {/* Service Areas */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Service Areas
                <span className="ml-1 text-xs font-normal text-gray-400">— neighbourhoods you serve (updates SEO keywords automatically)</span>
              </label>
              <input
                type="text"
                value={String(form.service_areas ?? '')}
                onChange={e => handleChange('service_areas', e.target.value)}
                placeholder="Abule Egba, Meiran, Ijaiye, Kola, Command, Iyana-Ipaja"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <p className="text-xs text-gray-400 mt-1">
                Comma-separated. When someone searches "laundry in Meiran" your site will rank for those areas.
              </p>
            </div>

            {/* Latitude / Longitude */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Latitude</label>
                <input
                  type="number" step="0.000001"
                  value={String(form.latitude ?? '')}
                  onChange={e => handleChange('latitude', e.target.value)}
                  placeholder="6.524379"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Longitude</label>
                <input
                  type="number" step="0.000001"
                  value={String(form.longitude ?? '')}
                  onChange={e => handleChange('longitude', e.target.value)}
                  placeholder="3.379206"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              Find exact coordinates at{' '}
              <a href="https://www.latlong.net" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline">latlong.net</a>
              {' '}— paste your full street address there.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}
      {success && (
        <ErrorBanner
          variant="success"
          message="Settings saved. Next invoice will use the updated values."
          onDismiss={() => setSuccess(false)}
        />
      )}

      {/* Save / Discard row */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={saving || dirtyFields.size === 0}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 rounded-xl font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            : dirtyFields.size === 0
              ? <><Save className="w-4 h-4" /> No Changes to Save</>
              : <><Save className="w-4 h-4" /> Save {dirtyFields.size} Change{dirtyFields.size !== 1 ? 's' : ''}</>
          }
        </button>

        {/* Discard link — only visible when there are unsaved changes */}
        {dirtyFields.size > 0 && !saving && (
          <button
            onClick={handleDiscard}
            className="text-sm text-gray-400 hover:text-gray-600 text-center py-1 transition"
          >
            Discard changes
          </button>
        )}
      </div>
    </div>
  );
}
