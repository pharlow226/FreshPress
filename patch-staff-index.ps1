# Run from: C:\Users\hp\Desktop\Laundry website\FreshPress
# Copies the 1762-line staff Index.tsx and patches just the import block.

$root = "C:\Users\hp\Desktop\Laundry website"

$content = Get-Content "$root\stafffreshpress-main\src\pages\Index.tsx" -Raw

$oldImports = @"
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut, Package, DollarSign, Truck, CheckCircle, Clock, User, Eye, EyeOff, Plus, X, Send, Trash2, Settings, ArrowLeft, AlertTriangle, CalendarX } from 'lucide-react';
import { LoadingMessage } from '@/components/LoadingMessage';

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pofiytkpduprbkmgunbg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvZml5dGtwZHVwcmJrbWd1bmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTUzMzEsImV4cCI6MjA4NjQ3MTMzMX0.z1ULHZ-AlolS-nInaiWZ6YWDqMtN3SYeRyYZ59y_cJE';
const N8N_INVOICE_WEBHOOK = 'https://your-n8n-instance.app.n8n.cloud/webhook/generate-invoice';
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
"@

$newImports = @"
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut, Package, DollarSign, Truck, CheckCircle, Clock, User, Eye, EyeOff, Plus, X, Send, Trash2, Settings, ArrowLeft, AlertTriangle, CalendarX } from 'lucide-react';
import { LoadingMessage } from '@/components/shared/LoadingMessage';
import { supabase, getStatusBadgeClass, getActivityColor, setStaffUser, getStaffUser } from '@/lib/supabase';
import { getStatusBadge, isOverdue, TIME_SLOT_LABELS } from '@/lib/status';
import { WEBHOOKS } from '@/lib/webhooks';
import { markDelayed, markDelivered, confirmPayment } from '@/lib/operations';

// Invoice generation stays in n8n (Phase 4: replace with Edge Function)
const N8N_INVOICE_WEBHOOK = WEBHOOKS.INVOICE;
"@

if ($content.Contains($oldImports.TrimEnd())) {
    $patched = $content.Replace($oldImports.TrimEnd(), $newImports.TrimEnd())
    $patched | Set-Content ".\src\routes\staff\Index.tsx" -Encoding UTF8
    Write-Host "✅ Staff Index patched. Lines: $((Get-Content '.\src\routes\staff\Index.tsx').Count)"
} else {
    Write-Host "⚠️  Pattern not found. Copying raw file — fix imports manually."
    Copy-Item "$root\stafffreshpress-main\src\pages\Index.tsx" ".\src\routes\staff\Index.tsx" -Force
}
