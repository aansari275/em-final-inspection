import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ArticleInspectionV3 } from '../../types';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';
import ArticleAqlBlock from './ArticleAqlBlock';
import ColorAccordion from './ColorAccordion';
import SubmitArticleButton from './SubmitArticleButton';

interface Props {
  article: ArticleInspectionV3;
}

export default function ArticleAccordion({ article }: Props) {
  const { state, dispatch } = useInspectionFormV3();
  const isOpen = state.activeArticleId === article.id;
  const totalSizes = article.colors.reduce((s, c) => s + c.sizes.length, 0);
  const completedSizes = article.colors.reduce(
    (s, c) => s + c.sizes.filter((sz) => !!sz.inspectionResult).length,
    0
  );
  const submitted = !!article.submittedAt;

  return (
    <div
      className={`bg-white border rounded-lg overflow-hidden mb-3 ${
        submitted
          ? 'border-emerald-200'
          : isOpen
          ? 'border-emerald-300 shadow-sm'
          : 'border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={() =>
          dispatch({ type: 'EXPAND_ARTICLE', articleId: isOpen ? null : article.id })
        }
        className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 ${
          isOpen ? 'bg-emerald-50/50' : ''
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isOpen ? (
            <ChevronDown size={18} className="text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight size={18} className="text-gray-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{article.articleName}</div>
            <div className="text-xs text-gray-500">
              {article.inspectedQty} pcs · {article.colors.length} color
              {article.colors.length === 1 ? '' : 's'} · {totalSizes} size
              {totalSizes === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 ml-3">
          {submitted ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
              Submitted
            </span>
          ) : completedSizes === totalSizes && totalSizes > 0 ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              {completedSizes}/{totalSizes} done
            </span>
          ) : completedSizes > 0 ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              {completedSizes}/{totalSizes} done
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              Not started
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <>
          <ArticleAqlBlock article={article} />
          <div>
            {article.colors.map((c) => (
              <ColorAccordion key={c.id} article={article} color={c} />
            ))}
          </div>
          <SubmitArticleButton article={article} />
        </>
      )}
    </div>
  );
}
