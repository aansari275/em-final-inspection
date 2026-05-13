import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ArticleInspectionV3, ColorInspectionV3 } from '../../types';
import { useInspectionFormV3, useV2CompatDispatch } from '../../context/InspectionFormContextV3';
import SizeTabBar from './SizeTabBar';
import SizeInspectionPanel from '../SizeInspectionPanel';

interface Props {
  article: ArticleInspectionV3;
  color: ColorInspectionV3;
}

export default function ColorAccordion({ article, color }: Props) {
  const { state, dispatch } = useInspectionFormV3();
  const isOpen = state.activeColorIdByArticle[article.id] === color.id;
  const completedSizes = color.sizes.filter((s) => !!s.inspectionResult).length;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: 'EXPAND_COLOR',
            articleId: article.id,
            colorId: isOpen ? null : color.id,
          })
        }
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown size={16} className="text-gray-400" />
          ) : (
            <ChevronRight size={16} className="text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-800">Color: {color.colorName}</span>
          <span className="text-xs text-gray-500">({color.qty} pcs)</span>
        </div>
        <span className="text-xs text-gray-500">
          {completedSizes}/{color.sizes.length} sizes
        </span>
      </button>

      {isOpen && <ColorBody article={article} color={color} />}
    </div>
  );
}

function ColorBody({ article, color }: { article: ArticleInspectionV3; color: ColorInspectionV3 }) {
  const { state } = useInspectionFormV3();
  const activeSizeId = state.activeSizeIdByColor[color.id];
  const activeSize = color.sizes.find((s) => s.id === activeSizeId) ?? color.sizes[0];

  return (
    <div className="bg-white">
      <SizeTabBar color={color} />
      {activeSize ? (
        <SizePanel
          articleId={article.id}
          colorId={color.id}
          sizeData={activeSize}
          sizeIndex={0}
          totalSizes={color.sizes.length}
        />
      ) : (
        <div className="p-4 text-sm text-gray-500 italic">Select a size tab to inspect.</div>
      )}
    </div>
  );
}

interface SizePanelProps {
  articleId: string;
  colorId: string;
  sizeData: ColorInspectionV3['sizes'][number];
  sizeIndex: number;
  totalSizes: number;
}

function SizePanel({ articleId, colorId, sizeData, sizeIndex, totalSizes }: SizePanelProps) {
  // Use V2-compat dispatcher so the existing SizeInspectionPanel works unchanged.
  const compatDispatch = useV2CompatDispatch(articleId, colorId, sizeData.id);

  return (
    <SizeInspectionPanel
      sizeData={sizeData}
      sizeIndex={sizeIndex}
      isActive={true}
      totalSizes={totalSizes}
      onToggle={() => {
        /* tabs handle activation, panel is always expanded inside the active tab */
      }}
      onRemove={() => {
        /* V3 does not allow removing sizes; they come from the OPS */
      }}
      dispatch={compatDispatch}
    />
  );
}
