import { Package } from 'lucide-react';
import { useInspectionFormV3 } from '../../context/InspectionFormContextV3';
import ArticleAccordion from './ArticleAccordion';

export default function ArticleAccordionList() {
  const { state } = useInspectionFormV3();

  if (state.articles.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center">
        <Package size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">
          Load an OPS above to populate articles, colors, and sizes for inspection.
        </p>
      </div>
    );
  }

  return (
    <div>
      {state.articles.map((a) => (
        <ArticleAccordion key={a.id} article={a} />
      ))}
    </div>
  );
}
