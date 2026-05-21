import { useToast } from "@/hooks/use-toast";
import {
  Toast, ToastClose, ToastDescription, ToastIcon,
  ToastProvider, ToastTitle, ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, variant, ...props }) => (
        <Toast key={id} variant={variant as any} {...props}>
          {/* Left icon */}
          <ToastIcon variant={variant} />

          {/* Text content */}
          <div className="flex-1 min-w-0">
            {title       && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>

          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
