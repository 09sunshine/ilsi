import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { formatHumanErrorMessage } from "@/lib/humanError";

// Global interceptor: guarantees no raw HTML, stack trace or code snippet ever renders in error toasts
if (typeof window !== "undefined" && (sonnerToast as any).error && !(sonnerToast as any).__ilsi_sanitized) {
  const originalError = (sonnerToast as any).error.bind(sonnerToast);
  (sonnerToast as any).error = (message: any, data?: any) => {
    const cleanMessage = formatHumanErrorMessage(message);
    return originalError(cleanMessage, data);
  };
  (sonnerToast as any).__ilsi_sanitized = true;
}

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

