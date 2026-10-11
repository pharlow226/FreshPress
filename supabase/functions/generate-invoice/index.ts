/**
 * generate-invoice/index.ts
 * Supabase Edge Function to generate invoices, upload private PDF, and dispatch notifications.
 *
 * Secrets needed:
 *   SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 *   SUPABASE_URL
 *   BREVO_API_KEY
 *   BREVO_SENDER_EMAIL
 *   HTML2PDF_API_KEY
 */

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')!;
const BREVO_KEY        = Deno.env.get('BREVO_API_KEY')        ?? '';
const BREVO_SENDER     = Deno.env.get('BREVO_SENDER_EMAIL')   ?? 'noreply@freshpress.ng';
const EVO_URL          = Deno.env.get('EVOLUTION_API_URL')    ?? '';
const EVO_KEY          = Deno.env.get('EVOLUTION_API_KEY')    ?? '';
const EVO_INSTANCE     = Deno.env.get('EVOLUTION_INSTANCE_NAME') ?? '';
const ADMIN_EMAIL_FALLBACK = 'faloyesamuel400@gmail.com';
const HTML2PDF_KEY     = Deno.env.get('HTML2PDF_API_KEY')     ?? '';
const DEFAULT_TAX_RATE = 0.075;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function dbHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Prefer':        'return=representation',
  };
}

async function getAdminEmail(): Promise<string> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/staff_members?role=eq.admin&active=eq.true&select=email&limit=1`,
      { headers: dbHeaders(), signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return ADMIN_EMAIL_FALLBACK;
    const rows: any[] = await res.json();
    return rows[0]?.email ?? ADMIN_EMAIL_FALLBACK;
  } catch { return ADMIN_EMAIL_FALLBACK; }
}

function round2(n: number) { return Math.round(n * 100) / 100; }

function fmt(n: number) {
  return `N${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizePhone(phone: string): string {
  phone = phone.replace(/\s+/g, '');
  if (phone.startsWith('+'))   phone = phone.slice(1);
  if (phone.startsWith('00'))  phone = phone.slice(2);
  else if (phone.startsWith('0')) phone = '234' + phone.slice(1);
  return phone;
}

async function sendWhatsApp(phone: string, text: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) return;
  try {
    await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method:  'POST',
      headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ number: normalizePhone(phone), text }),
      signal:  AbortSignal.timeout(6000),
    });
  } catch (e) { console.warn('[generate-invoice] WhatsApp failed:', e); }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  pdfAttachment?: { bytes: Uint8Array; filename: string } | null,
) {
  if (!BREVO_KEY || !to) return;
  try {
    const body: Record<string, unknown> = {
      sender:      { name: 'FreshPress Laundry', email: BREVO_SENDER },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    };
    if (pdfAttachment) {
      body.attachment = [{
        name:    pdfAttachment.filename,
        content: toBase64(pdfAttachment.bytes),
      }];
    }
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method:  'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(8000),
    });
  } catch (e) { console.warn('[generate-invoice] email error:', e); }
}

async function generatePdf(html: string, invoiceNumber: string): Promise<Uint8Array | null> {
  if (!HTML2PDF_KEY) return null;
  try {
    const res = await fetch('https://api.html2pdf.app/v1/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        apiKey:          HTML2PDF_KEY,
        filename:        `${invoiceNumber}.pdf`,
        landscape:       false,
        printBackground: true,
        format:          'A4',
        marginTop:       10,
        marginBottom:    10,
        marginLeft:      10,
        marginRight:     10,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`html2pdf.app ${res.status}: ${await res.text()}`);
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.warn('[generate-invoice] PDF failed:', e);
    return null;
  }
}

function buildInvoiceHtml(p: {
  order: any; company: any; invoiceNumber: string; items: any[];
  subtotal: number; discount: number; tax: number; total: number;
  taxRate: number; notes?: string; downloadUrl?: string | null;
}): string {
  const { order, company, invoiceNumber, items, subtotal, discount, tax, total, taxRate, notes, downloadUrl } = p;
  const date = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6">${it.service_name}</td>
      <td style="padding:10px 12px;font-size:13px;text-align:center;border-bottom:1px solid #f3f4f6">${it.quantity} ${it.unit || ''}</td>
      <td style="padding:10px 12px;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6">${fmt(it.price_per_unit)}</td>
      <td style="padding:10px 12px;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6">${fmt(it.amount)}</td>
    </tr>`).join('');

  const discountRow = discount > 0 ? `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#6b7280">Discount</td>
      <td style="padding:4px 0;font-size:13px;color:#dc2626;text-align:right">-${fmt(discount)}</td>
    </tr>` : '';

  const pdfBtn = downloadUrl
    ? `<tr><td style="padding:0 40px 16px;text-align:center">
        <a href="${downloadUrl}" style="background:#2563eb;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Download PDF Invoice</a>
       </td></tr>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f4f4f5;color:#111}</style>
</head><body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5">
<tr><td align="center" style="padding:32px 16px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07)">
  <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px">
    <table width="100%"><tr>
      <td><p style="font-size:22px;font-weight:800;color:#fff;margin:0">FreshPress Laundry</p>
          <p style="color:rgba(255,255,255,.7);font-size:13px;margin:4px 0 0">Fresh clothes, fresh you.</p></td>
      <td align="right"><p style="color:#fff;font-size:18px;font-weight:800;margin:0">INVOICE</p>
          <p style="color:rgba(255,255,255,.7);font-size:12px;margin:4px 0 0">${invoiceNumber}</p>
          <p style="color:rgba(255,255,255,.6);font-size:12px;margin:2px 0 0">${date}</p></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 40px 0">
    <table width="100%"><tr>
      <td style="width:50%;vertical-align:top">
        <p style="font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;margin-bottom:6px">Bill To</p>
        <p style="font-size:14px;font-weight:700;color:#111">${order.customer_name}</p>
        <p style="font-size:13px;color:#6b7280;margin-top:2px">${order.phone || ''}</p>
        <p style="font-size:13px;color:#6b7280;margin-top:2px">${order.address || ''}</p>
      </td>
      <td style="width:50%;vertical-align:top;text-align:right">
        <p style="font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;margin-bottom:6px">Order Details</p>
        <p style="font-size:13px;color:#374151">Order: <strong>${order.order_id}</strong></p>
        <p style="font-size:13px;color:#374151;margin-top:2px">Invoice: <strong>${invoiceNumber}</strong></p>
        <p style="font-size:13px;color:#374151;margin-top:2px">Date: ${date}</p>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:20px 40px">
    <table width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <tr style="background:#f9fafb">
        <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:left;font-weight:700;text-transform:uppercase">Service</th>
        <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:center;font-weight:700;text-transform:uppercase">Qty</th>
        <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;font-weight:700;text-transform:uppercase">Unit Price</th>
        <th style="padding:10px 12px;font-size:11px;color:#6b7280;text-align:right;font-weight:700;text-transform:uppercase">Amount</th>
      </tr>
      ${itemRows}
    </table>
  </td></tr>
  <tr><td style="padding:0 40px 20px">
    <table style="margin-left:auto;width:260px">
      <tr><td style="padding:4px 0;font-size:13px;color:#6b7280">Subtotal</td>
          <td style="padding:4px 0;font-size:13px;text-align:right">${fmt(subtotal)}</td></tr>
      ${discountRow}
      <tr><td style="padding:4px 0;font-size:13px;color:#6b7280">VAT (${parseFloat((taxRate * 100).toFixed(1))}%)</td>
          <td style="padding:4px 0;font-size:13px;text-align:right">${fmt(tax)}</td></tr>
      <tr><td colspan="2" style="border-top:2px solid #e5e7eb;padding-top:8px"></td></tr>
      <tr><td style="font-size:16px;font-weight:800;color:#111">Total Due</td>
          <td style="font-size:16px;font-weight:800;color:#2563eb;text-align:right">${fmt(total)}</td></tr>
    </table>
  </td></tr>
  ${notes ? `<tr><td style="padding:0 40px 20px">
    <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:12px 16px">
      <p style="font-size:12px;font-weight:700;color:#854d0e;margin-bottom:4px">Notes</p>
      <p style="font-size:13px;color:#713f12">${notes}</p>
    </div></td></tr>` : ''}
  <tr><td style="padding:0 40px 32px">
    <div style="background:#eff6ff;border-radius:8px;padding:16px 20px">
      <p style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:8px">Payment Instructions</p>
      <p style="font-size:13px;color:#1e40af">
        Transfer <strong>${fmt(total)}</strong> to:<br>
        Account: <strong>${company?.account_name || 'FreshPress Laundry Services'}</strong><br>
        Number: <strong>${company?.account_number || ''}</strong><br>
        Bank: <strong>${company?.bank_name || ''}</strong>
      </p>
      <p style="font-size:13px;color:#1e40af;margin-top:8px">
        Send receipt to WhatsApp: <strong>${company?.company_whatsapp || '+234 811 314 3272'}</strong>
      </p>
    </div>
  </td></tr>
  ${pdfBtn}
  <tr><td style="padding:16px 40px;background:#f9fafb;text-align:center;border-top:1px solid #f3f4f6">
    <p style="font-size:12px;color:#9ca3af">FreshPress Laundry Services · Lagos, Nigeria · +234 811 314 3272</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const warnings: string[] = [];

  try {
    const body = await req.json();

    const orderId   = body.orderId   ?? body.order_id;
    const staffId   = body.staffId   ?? body.staff_id;
    const staffName = body.staffName ?? body.staff_name;
    const items: any[] = body.items ?? [];
    const discount  = parseFloat(body.discount ?? '0') || 0;
    const notes     = body.notes ?? '';

    if (!orderId) {
      return Response.json({ success: false, hasError: true, message: 'orderId is required' }, { status: 400, headers: CORS });
    }
    if (!items.length) {
      return Response.json({ success: false, hasError: true, message: 'At least one item is required' }, { status: 400, headers: CORS });
    }

    const [orderRes, companyRes, staffRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}&select=*`, { headers: dbHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/company_info?select=*&limit=1`, { headers: dbHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/staff_members?role=eq.accountant&active=eq.true&select=email&limit=1`, { headers: dbHeaders() }),
    ]);

    if (!orderRes.ok) throw new Error('Failed to fetch order');
    const orderRows: any[] = await orderRes.json();
    if (!orderRows.length) {
      return Response.json({ success: false, hasError: true, message: `Order ${orderId} not found` }, { status: 404, headers: CORS });
    }
    const order = orderRows[0];

    const companyRows: any[] = companyRes.ok ? await companyRes.json() : [];
    const company = companyRows[0] ?? null;

    const accountantRows: any[] = staffRes.ok ? await staffRes.json() : [];
    const accountant = accountantRows[0] ?? null;

    const taxRate = company?.tax_rate ? parseFloat(company.tax_rate) : DEFAULT_TAX_RATE;

    const subtotal = round2(items.reduce((acc, it) => acc + (parseFloat(it.amount ?? '0') || 0), 0));
    const discountAmount = round2(Math.min(discount, subtotal));
    const taxable = round2(subtotal - discountAmount);
    const tax = round2(taxable * taxRate);
    const total = round2(taxable + tax);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${rand}`;
    const invoiceDate   = now.toISOString().slice(0, 10);
    const nowIso        = now.toISOString();

    const invoiceItems = items.map(it => ({
      service_name:   it.service_name ?? it.serviceName,
      quantity:       parseInt(it.quantity ?? '1', 10),
      unit:           it.unit ?? 'item',
      price_per_unit: parseFloat(it.price_per_unit ?? it.pricePerUnit ?? '0'),
      amount:         parseFloat(it.amount ?? '0'),
    }));

    await fetch(`${SUPABASE_URL}/rest/v1/invoice_items`, {
      method:  'POST',
      headers: { ...dbHeaders(), 'Prefer': 'return=minimal' },
      body:    JSON.stringify(invoiceItems.map(it => ({ order_id: orderId, invoice_number: invoiceNumber, ...it }))),
    });

    // Private storage PDF generation and signed link
    const fileName = `${invoiceNumber}.pdf`;
    let storedFileName: string | null = null;
    let emailDownloadUrl: string | null = `https://fresh-press-chi.vercel.app/track`;

    const invoiceHtml = buildInvoiceHtml({ order, company, invoiceNumber, items: invoiceItems, subtotal, discount: discountAmount, tax, total, taxRate, notes });
    const pdfBytes = await generatePdf(invoiceHtml, invoiceNumber);

    if (pdfBytes) {
      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/invoices/${fileName}`,
        {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type':  'application/pdf',
            'x-upsert':      'true',
          },
          body: pdfBytes,
        }
      );
      if (uploadRes.ok) {
        // Store ONLY the object path / file name in DB
        storedFileName = fileName;

        // Create a 7-day signed URL for the email
        try {
          const signRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/invoices/${fileName}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ expiresIn: 604800 }), // 7 days
          });
          if (signRes.ok) {
            const signData = await signRes.json();
            if (signData?.signedURL) {
              emailDownloadUrl = `${SUPABASE_URL}/storage/v1${signData.signedURL}`;
            }
          }
        } catch (_e) {}
      } else {
        warnings.push('PDF storage upload failed.');
      }
    }

    // Step 9 — Update order with stored file name
    const updatedHtml = buildInvoiceHtml({ order, company, invoiceNumber, items: invoiceItems, subtotal, discount: discountAmount, tax, total, taxRate, notes, downloadUrl: emailDownloadUrl });
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`,
      {
        method:  'PATCH',
        headers: dbHeaders(),
        body:    JSON.stringify({
          status:            'invoiced',
          invoice_generated: true,
          invoice_number:    invoiceNumber,
          invoice_date:      invoiceDate,
          invoice_pdf_url:   storedFileName, // File name only
          subtotal,
          tax,
          total_amount:      total,
          payment_status:    'unpaid',
          processing_at:     nowIso,
          invoiced_at:       nowIso,
          updated_at:        nowIso,
        }),
      }
    );

    if (!updateRes.ok) {
      return Response.json({ success: false, hasError: true, message: `Failed to update order` }, { status: 500, headers: CORS });
    }

    // Notifications with PDF attachment & signed link
    const pdfAttach = pdfBytes ? { bytes: pdfBytes, filename: `${invoiceNumber}.pdf` } : null;
    if (order.email)       sendEmail(order.email, `Your Invoice - ${invoiceNumber} | FreshPress Laundry`, updatedHtml, pdfAttach);
    if (accountant?.email) sendEmail(accountant.email, `New Invoice - ${invoiceNumber} | ${orderId}`, updatedHtml, pdfAttach);

    const adminEmail = await getAdminEmail();
    const fmtTotal = `N${total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    sendEmail(
      adminEmail,
      `[FreshPress] Invoice Generated — ${invoiceNumber}`,
      `<p><strong>${staffName}</strong> generated invoice <strong>${invoiceNumber}</strong> for order <strong>${orderId}</strong>.</p><p>Customer: ${order.customer_name} | Total: ${fmtTotal} | Items: ${invoiceItems.length} | VAT: ${parseFloat((taxRate*100).toFixed(1))}% | PDF: ${storedFileName ? 'Yes' : 'No'}</p>`
    );

    return Response.json(
      {
        success: true,
        message: 'Invoice generated and sent successfully',
        invoice: {
          invoice_number: invoiceNumber,
          order_id:       orderId,
          total,
          subtotal,
          tax,
          discount:       discountAmount,
          items_count:    invoiceItems.length,
          pdf_url:        storedFileName,
          pdf_available:  !!storedFileName,
        },
        warnings,
      },
      { status: 200, headers: CORS }
    );

  } catch (err: any) {
    console.error('[generate-invoice] unhandled error:', err);
    return Response.json({ success: false, hasError: true, message: err.message ?? 'Internal server error' }, { status: 500, headers: CORS });
  }
});
