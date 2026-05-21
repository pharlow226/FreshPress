/**
 * ErrorBanner.tsx — shared inline error/warning/success alert banner
 * Used inside modals, forms, and page sections across the app.
 */

import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type BannerVariant = 'error' | 'success' | 'warning' | 'info';

interface ErrorBannerProps {
  message:   string;
  variant?:  BannerVariant;
  onDismiss?: () => void;
  className?: string;
}

const CONFIG: Record<BannerVariant, {
  bg: string; border: string; text: string; icon: React.ElementType;
}> = {
  error:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    icon: AlertCircle   },
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: CheckCircle2  },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  icon: AlertTriangle },
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   icon: Info          },
};

export function ErrorBanner({ message, variant = 'error', onDismiss, className = '' }: ErrorBannerProps) {
  const { bg, border, text, icon: Icon } = CONFIG[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${bg} ${border} ${text} ${className}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="flex-1 leading-snug">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
