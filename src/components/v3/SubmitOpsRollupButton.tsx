import { FileText } from 'lucide-react';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';
import { computeOpsResult } from '../../types';

export default function SubmitOpsRollupButton() {
  const { state } = useInspectionFormV3();
  const allSubmitted =
    state.articles.length > 0 && state.articles.every((a) => !!a.submittedAt);
  const overall = computeOpsResult(state.articles);

  return (
    <div className="mt-4 pt-4 border-t-2 border-emerald-100 bg-gray-50/60 rounded-lg p-4">
      <button
        type="button"
        disabled={!allSubmitted}
        onClick={() => {
          // TODO: wire to rollup PDF + email in next iteration
          alert(
            allSubmitted
              ? 'Roll-up PDF + email will be generated and sent here. (Pending wire-up.)'
              : 'Submit all articles first.'
          );
        }}
        className={`w-full px-4 py-3 font-semibold rounded-md flex items-center justify-center gap-2 border-2 transition-colors ${
          allSubmitted
            ? 'bg-white border-emerald-600 text-emerald-700 hover:bg-emerald-50'
            : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        <FileText size={16} />
        Submit OPS{state.global.opsNo ? ` ${state.global.opsNo}` : ''} Summary Report
        {overall && allSubmitted && (
          <span
            className={`ml-2 text-xs font-bold px-2 py-0.5 rounded ${
              overall === 'PASS' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
            }`}
          >
            {overall}
          </span>
        )}
      </button>
      <p className="text-xs text-gray-500 text-center mt-2">
        {allSubmitted
          ? 'Sends a combined PDF + email roll-up covering all articles.'
          : `Enabled when all ${state.articles.length} article${
              state.articles.length === 1 ? '' : 's'
            } have been submitted.`}
      </p>
    </div>
  );
}
