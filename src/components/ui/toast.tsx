import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

// ── Viewport — top-center, full-width on mobile, capped at 480px on desktop ──

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // Position: below the sticky header (header ~60px), centred horizontally
      "fixed top-[72px] left-1/2 -translate-x-1/2 z-[200]",
      // Layout: column stack, newest on top
      "flex flex-col gap-2",
      // Width: full on mobile, max 500px on desktop
      "w-[calc(100vw-32px)] max-w-[500px]",
      "pointer-events-none",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

// ── Toast variants ────────────────────────────────────────────────────────────

const toastVariants = cva(
  [
    "group pointer-events-auto relative w-full",
    "flex items-start gap-3",
    "rounded-xl border px-4 py-3.5 shadow-xl",
    "transition-all duration-300",
    // Enter from top
    "data-[state=open]:animate-in data-[state=open]:slide-in-from-top-3 data-[state=open]:fade-in-0",
    // Exit to top
    "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top-3 data-[state=closed]:fade-out-0",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default:     "bg-white border-gray-200 text-gray-900",
        success:     "bg-emerald-50 border-emerald-300 text-emerald-900",
        destructive: "bg-red-50 border-red-300 text-red-900",
        warning:     "bg-amber-50 border-amber-300 text-amber-900",
        info:        "bg-blue-50 border-blue-300 text-blue-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitives.Root.displayName;

// ── Icon map ──────────────────────────────────────────────────────────────────

export function ToastIcon({ variant }: { variant?: string | null }) {
  const cls = "w-5 h-5 shrink-0 mt-0.5";
  switch (variant) {
    case "success":     return <CheckCircle2  className={cn(cls, "text-emerald-600")} />;
    case "destructive": return <AlertCircle   className={cn(cls, "text-red-600")} />;
    case "warning":     return <AlertTriangle className={cn(cls, "text-amber-600")} />;
    case "info":        return <Info          className={cn(cls, "text-blue-600")} />;
    default:            return <Info          className={cn(cls, "text-gray-500")} />;
  }
}

// ── Action ────────────────────────────────────────────────────────────────────

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium",
      "transition-colors hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

// ── Close ─────────────────────────────────────────────────────────────────────

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "ml-auto shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100",
      "focus:outline-none focus:ring-2 focus:ring-ring",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

// ── Title / Description ───────────────────────────────────────────────────────

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-bold leading-tight", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-80 leading-snug mt-0.5", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

// ── Exports ───────────────────────────────────────────────────────────────────

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
