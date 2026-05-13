import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import type { ArticleInspectionV3 } from '../../types';
import { getIncompleteSizes, computeArticleResult } from '../../types';
import PendingSizesPromptModal from './PendingSizesPromptModal';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';

interface Props {
  article: ArticleInspectionV3;
}

export default function SubmitArticleButton({ article }: Props) {
  const { state, dispatch } = useInspectionFormV3();
  const [showPrompt, setShowPrompt] = useState(false);
  const inFlight = !!state.submitInFlight[article.id];

  const handleClick = () => {
    const incomplete = getIncompleteSizes(article);
    if (incomplete.length > 0) {
      setShowPrompt(true);
      return;
    }
    runSubmit();
  };

  const runSubmit = () => {
    setShowPrompt(false);
    // TODO: wire to v3SubmitFlow.submitArticle in next iteration.
    // For now: mark submitted locally so the UI flow can be tested.
    dispatch({ type: 'SET_ARTICLE_SUBMIT_IN_FLIGHT', articleId: article.id, inFlight: true });
    const result = computeArticleResult(article) ?? 'PASS';
    setTimeout(() => {
      dispatch({
        type: 'MARK_ARTICLE_SUBMITTED',
        articleId: article.id,
        submittedAt: new Date().toISOString(),
        emailStatus: 'pending',
        inspectionResult: result,
      });
      dispatch({ type: 'SET_ARTICLE_SUBMIT_IN_FLIGHT', articleId: article.id, inFlight: false });
    }, 400);
  };

  if (article.submittedAt) {
    return (
      <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-200 flex items-center gap-2">
        <CheckCircle2 size={18} className="text-emerald-600" />
        <span className="text-sm text-emerald-800">
          Submitted {new Date(article.submittedAt).toLocaleString()}
        </span>
        {article.inspectionResult && (
          <span
            className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
              article.inspectionResult === 'PASS'
                ? 'bg-emerald-200 text-emerald-900'
                : 'bg-rose-200 text-rose-900'
            }`}
          >
            {article.inspectionResult}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-white border-t border-gray-200">
      <button
        type="button"
        onClick={handleClick}
        disabled={inFlight}
        className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold rounded-md flex items-center justify-center gap-2 transition-colors"
      >
        <Send size={16} />
        {inFlight ? 'Submitting…' : `Submit Article ${article.articleName}`}
      </button>

      {showPrompt && (
        <PendingSizesPromptModal
          articleName={article.articleName}
          incompleteSizes={getIncompleteSizes(article)}
          onCancel={() => setShowPrompt(false)}
          onConfirm={runSubmit}
        />
      )}
    </div>
  );
}
