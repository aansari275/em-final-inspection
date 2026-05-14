import { useState } from 'react';
import { FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';
import { computeOpsResult } from '../../types';
import { submitOpsRollupV3 } from '../../lib/v3SubmitFlow';

export default function SubmitOpsRollupButton() {
  const { state } = useInspectionFormV3();
  const allSubmitted =
    state.articles.length > 0 && state.articles.every((a) => !!a.submittedAt);
  const overall = computeOpsResult(state.articles);
  const [inFlight, setInFlight] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [sentAt, setSentAt] = useState<Date | null>(null);

  const onClick = async () => {
    if (!state.global.opsNo) return;
    setInFlight(true);
    setStatus('Building OPS summary…');
    try {
      const r = await submitOpsRollupV3(state.global.opsNo);
      if (r.status === 'sent') {
        setSentAt(new Date());
        setStatus(`Sent OPS summary covering ${r.articleCount} article${r.articleCount === 1 ? '' : 's'}`);
      } else if (r.status === 'no-recipients') {
        setStatus('No email recipients configured. Add some in Settings.');
      } else if (r.status === 'no-articles') {
        setStatus('No submitted articles found for this OPS.');
      } else {
        setStatus('Email send failed after retries. Check Netlify function logs.');
      }
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setInFlight(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t-2 border-emerald-100 bg-gray-50/60 rounded-lg p-4">
      <button
        type="button"
        disabled={!allSubmitted || inFlight}
        onClick={onClick}
        className={`w-full px-4 py-3 font-semibold rounded-md flex items-center justify-center gap-2 border-2 transition-colors ${
          !allSubmitted || inFlight
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-emerald-600 text-emerald-700 hover:bg-emerald-50'
        }`}
      >
        {inFlight ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        {inFlight
          ? status
          : `Submit OPS${state.global.opsNo ? ` ${state.global.opsNo}` : ''} Summary Report`}
        {overall && allSubmitted && !inFlight && (
          <span
            className={`ml-2 text-xs font-bold px-2 py-0.5 rounded ${
              overall === 'PASS' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
            }`}
          >
            {overall}
          </span>
        )}
      </button>

      {!inFlight && status && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {sentAt ? (
            <CheckCircle2 size={14} className="text-emerald-600" />
          ) : (
            <AlertCircle size={14} className="text-amber-600" />
          )}
          <span className={sentAt ? 'text-emerald-700' : 'text-amber-700'}>{status}</span>
          {sentAt && (
            <span className="text-gray-500">· {sentAt.toLocaleTimeString()}</span>
          )}
        </div>
      )}

      {!status && (
        <p className="text-xs text-gray-500 text-center mt-2">
          {allSubmitted
            ? 'Sends a combined PDF + email roll-up covering all articles.'
            : `Enabled when all ${state.articles.length} article${
                state.articles.length === 1 ? '' : 's'
              } have been submitted.`}
        </p>
      )}
    </div>
  );
}
