import os
import re

filepath = r'supabase\functions\create-order\index.ts'
with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# 1. Outer catch
content = content.replace(
    '  } catch (err) {\n    return new Response',
    '  } catch (err) {\n    console.error(\'[create-order] Unhandled error:\', err);\n    return new Response'
)

# 2. Admin alerts
content = content.replace(
    'html: adminAlertEmail(\'DB Insert Failure\', Order ID: \\nError: ),',
    'html: adminAlertEmail(\'DB Insert Failure\', Order ID: \\nCustomer: \\nPhone: \\nAddress: \\nError: ),'
)
content = content.replace(
    'html: adminAlertEmail(\'No Pickup Staff Available\', Order ID: \\nPlease assign a staff member manually.),',
    'html: adminAlertEmail(\'No Pickup Staff Available\', Order ID: \\nCustomer: \\nPhone: \\nAddress: \\nPickup Date: \\nPlease assign a staff member manually.),'
)

# 3. CRM Name
content = content.replace(
    'FIRSTNAME: body.customer_name, SMS: body.phone',
    'FIRSTNAME: body.customer_name.split(\' \')[0], LASTNAME: body.customer_name.split(\' \').slice(1).join(\' \') || \'\', SMS: body.phone'
)

# 4. Resend from address
content = content.replace(
    'from: \'FreshPress <onboarding@resend.dev>\'',
    'from: FreshPress <>'
)

# 5. Customer Email Template Footer
old_footer = '''      </table>
    </td></tr>
  </table>
  </td></tr>
  </table>
  </body>
  </html>;'''

new_footer = '''      </table>
      <div style="text-align:center;">
        <a href="https://fresh-press-chi.vercel.app/track"
           style="display:inline-block;background:linear-gradient(135deg,#3b5bdb,#4c3d9e);color:#fff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:10px;text-decoration:none;">
          Track My Order
        </a>
      </div>
    </td></tr>
    <tr><td style="background:#f8faff;border-top:1px solid #e0e7ff;padding:18px 40px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Call or WhatsApp: <strong style="color:#3b5bdb;">+234 811 314 3272</strong></p>
      <p style="margin:0;font-size:11px;color:#cbd5e1;">FreshPress Laundry Services - Lagos, Nigeria</p>
    </td></tr>
  </table>
  </td></tr>
  </table>
  </body>
  </html>;'''

content = content.replace(old_footer, new_footer)

# 6. Replace  with hyphen
content = content.replace('', '-')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

with open(r'supabase\functions\create-order-standalone.ts', 'w', encoding='utf-8') as f:
    f.write(content)
