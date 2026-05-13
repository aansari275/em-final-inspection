import { useEffect } from 'react';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';
import { calculateAql, determineResult } from '../../lib/aqlCalculator';
import type { ArticleInspectionV3 } from '../../types';

interface Props {
  article: ArticleInspectionV3;
}

export default function ArticleAqlBlock({ article }: Props) {
  const { dispatch } = useInspectionFormV3();
  const { aql } = article;

  // Recalculate AQL fields when lot qty changes
  useEffect(() => {
    if (aql.lotQty < 2) return;
    const r = calculateAql(aql.lotQty, '2.5', 'II');
    if (!r.isValid) return;
    if (
      r.codeLetter !== aql.codeLetter ||
      r.sampleSize !== aql.calculatedSampleSize ||
      r.acceptNumber !== aql.acceptNumber ||
      r.rejectNumber !== aql.rejectNumber
    ) {
      dispatch({
        type: 'UPDATE_ARTICLE_AQL',
        articleId: article.id,
        aql: {
          codeLetter: r.codeLetter,
          effectiveCodeLetter: r.effectiveCodeLetter,
          calculatedSampleSize: r.sampleSize,
          acceptNumber: r.acceptNumber,
          rejectNumber: r.rejectNumber,
        },
      });
    }
  }, [aql.lotQty, article.id, aql.codeLetter, aql.calculatedSampleSize, aql.acceptNumber, aql.rejectNumber, dispatch]);

  const result =
    aql.rejectNumber > 0 ? determineResult(aql.rejectedQty, aql.rejectNumber) : 'PASS';

  return (
    <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-200">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
        AQL Sampling · This Article
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Field
          label="Lot Qty"
          value={String(aql.lotQty || '')}
          onChange={(v) =>
            dispatch({
              type: 'UPDATE_ARTICLE_AQL',
              articleId: article.id,
              aql: { lotQty: Number(v) || 0 },
            })
          }
          type="number"
        />
        <Static label="Code" value={aql.effectiveCodeLetter || aql.codeLetter || '—'} />
        <Static label="Sample" value={aql.calculatedSampleSize ? String(aql.calculatedSampleSize) : '—'} />
        <Static label="Accept" value={String(aql.acceptNumber)} />
        <Static label="Reject" value={String(aql.rejectNumber)} />
        <Field
          label="Rejected"
          value={String(aql.rejectedQty || '')}
          onChange={(v) =>
            dispatch({
              type: 'UPDATE_ARTICLE_AQL',
              articleId: article.id,
              aql: { rejectedQty: Number(v) || 0 },
            })
          }
          type="number"
        />
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-gray-500">AQL 2.5 · Level II</span>
        <span
          className={`px-2 py-0.5 rounded font-bold ${
            result === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {result}
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 border border-gray-200 rounded text-sm font-mono"
      />
    </div>
  );
}

function Static({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="px-2 py-1 bg-white border border-gray-200 rounded text-sm font-mono text-gray-700">
        {value}
      </div>
    </div>
  );
}
