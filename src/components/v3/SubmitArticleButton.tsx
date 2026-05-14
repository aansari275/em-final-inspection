import { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { ArticleInspectionV3 } from '../../types';
import { getIncompleteSizes, computeArticleResult } from '../../types';
import PendingSizesPromptModal from './PendingSizesPromptModal';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';
import { submitArticleV3 } from '../../lib/v3SubmitFlow';

interface Props {
  article: ArticleInspectionV3;
}

export default function SubmitArticleButton({ article }: Props) {
  const { state, dispatch } = useInspectionFormV3();
  const [showPrompt, setShowPrompt] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const inFlight = !!state.submitInFlight[article.id];

  const handleClick = () => {
    const incomplete = getIncompleteSizes(article);
    if (incomplete.length > 0) {
      setShowPrompt(true);
      return;
    }
    runSubmit();
  };

  const runSubmit = async () => {
    setShowPrompt(false);
    dispatch({ type: 'SET_ARTICLE_SUBMIT_IN_FLIGHT', articleId: article.id, inFlight: true });
    setProgress('Submitting…');
    try {
      const result = await submitArticleV3({
        global: state.global,
        article,
        onProgress: (msg) => setProgress(msg),
      });
      const articleResult = computeArticleResult(article) ?? 'PASS';
      dispatch({
        type: 'MARK_ARTICLE_SUBMITTED',
        articleId: article.id,
        submittedAt: new Date().toISOString(),
        pdfUrl: result.pdfUrl,
        emailStatus: result.emailStatus === 'sent' ? 'sent' : 'failed',
        inspectionResult: articleResult,
      });
      setProgress(
        result.emailStatus === 'sent'
          ? `Submitted · email sent`
          : result.emailStatus === 'no-recipients'
          ? `Submitted · no email recipients configured`
          : `Submitted · email failed (check recipients)`
      );
    } catch (e) {
      console.error(e);
      setProgress(`Error: ${(e as Error).message}`);
    } finally {
      dispatch({ type: 'SET_ARTICLE_SUBMIT_IN_FLIGHT', articleId: article.id, inFlight: false });
    }
  };

  if (article.submittedAt) {
    const failed = article.emailStatus === 'failed';
    return (
      <div
        className={`px-4 py-3 border-t flex items-center gap-2 ${
          failed ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
        }`}
      >
        {failed ? (
          <AlertCircle size={18} className="text-amber-600" />
        ) : (
          <CheckCircle2 size={18} className="text-emerald-600" />
        )}
        <span className={`text-sm ${failed ? 'text-amber-800' : 'text-emerald-800'}`}>
          Submitted {new Date(article.submittedAt).toLocaleString()}
          {article.emailStatus === 'sent' && ' · email sent'}
          {article.emailStatus === 'failed' && ' · email failed'}
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
        {inFlight ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {inFlight ? progress || 'Submitting…' : `Submit Article ${article.articleName}`}
      </button>
      {!inFlight && progress && (
        <div className="mt-2 text-xs text-gray-600">{progress}</div>
      )}
      {inFlight && progress && (
        <div className="mt-2 text-xs text-emerald-700">{progress}</div>
      )}

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
