import { useState, useEffect } from 'react';

interface LoadingMessageProps {
  messages: string[];
  intervalMs?: number;
  /** staff/Index.tsx uses a `visible` prop — supported here for compatibility */
  visible?: boolean;
}

/**
 * Cycles through an array of loading messages with a fade transition.
 * Merged from both apps — supports both the customer API (no `visible` prop)
 * and the staff API (with `visible` prop).
 */
const LoadingMessage = ({ messages, intervalMs = 2000, visible = true }: LoadingMessageProps) => {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        setFade(true);
      }, 300);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [messages.length, intervalMs, visible]);

  if (!visible) return null;

  return (
    <p
      className={`text-center text-sm italic text-muted-foreground mt-3 transition-opacity duration-300 ${
        fade ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {messages[index]}
    </p>
  );
};

// Named export for staff dashboard compatibility (uses `import { LoadingMessage }`)
export { LoadingMessage };
// Default export for customer app compatibility (uses `import LoadingMessage`)
export default LoadingMessage;
