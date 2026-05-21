import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <p className="text-8xl font-black text-brand/20 mb-4">404</p>
        <h1 className="text-2xl font-black text-foreground mb-3">Page not found</h1>
        <p className="text-muted-foreground mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(var(--brand-gradient-via))] to-[hsl(var(--brand-gradient-to))] text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
        >
          <Home className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
