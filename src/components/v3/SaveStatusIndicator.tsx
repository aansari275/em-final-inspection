import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle, Save } from 'lucide-react';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';

interface Props {
  // 'compact' is for inline use (e.g., in a tab bar); 'banner' for above the form
  variant?: 'banner' | 'compact';
}

// Live-updating "Saved Xs ago" badge. Re-renders every 5s to keep the text fresh.
export default function SaveStatusIndicator({ variant = 'banner' }: Props) {
  const { state } = useInspectionFormV3();
  const { lastTouchedAt, lastSavedAt, saving, error } = state.saveStatus;
  const [, force] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => force((x) => x + 1), 5000);
    return () => window.clearInterval(t);
  }, []);

  if (lastTouchedAt === 0) return null;

  const dirty = lastSavedAt < lastTouchedAt;
  const ago = lastSavedAt ? formatAgo(Date.now() - lastSavedAt) : null;

  let body: React.ReactNode;
  let cls = '';

  if (error) {
    body = (
      <>
        <AlertCircle size={14} />
        <span>Save error: {error}</span>
      </>
    );
    cls = 'text-rose-700 bg-rose-50 border-rose-200';
  } else if (saving) {
    body = (
      <>
        <Loader2 size={14} className="animate-spin" />
        <span>Saving…</span>
      </>
    );
    cls = 'text-amber-700 bg-amber-50 border-amber-200';
  } else if (dirty) {
    body = (
      <>
        <Save size={14} />
        <span>Unsaved changes</span>
      </>
    );
    cls = 'text-amber-700 bg-amber-50 border-amber-200';
  } else {
    body = (
      <>
        <CheckCircle2 size={14} />
        <span>All size details saved{ago ? ` · ${ago}` : ''}</span>
      </>
    );
    cls = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  }

  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${error ? 'text-rose-600' : saving || dirty ? 'text-amber-600' : 'text-emerald-600'}`}>
        {body}
      </span>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border ${cls}`}
    >
      {body}
    </div>
  );
}

function formatAgo(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
