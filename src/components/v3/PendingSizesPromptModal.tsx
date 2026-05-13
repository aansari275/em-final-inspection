import { AlertTriangle } from 'lucide-react';

interface Props {
  articleName: string;
  incompleteSizes: Array<{ colorName: string; size: string }>;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PendingSizesPromptModal({
  articleName,
  incompleteSizes,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl overflow-hidden">
        <div className="px-5 py-4 flex items-start gap-3 border-b border-gray-100">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              {incompleteSizes.length} size{incompleteSizes.length === 1 ? '' : 's'} pending
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">{articleName}</span> has sizes without a PASS/FAIL
              result.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 max-h-48 overflow-y-auto bg-gray-50">
          <ul className="space-y-1 text-sm">
            {incompleteSizes.map((s, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-gray-700">{s.size}</span>
                <span className="text-xs text-gray-500">{s.colorName}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-5 py-3 flex justify-end gap-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Go back and finish
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
          >
            Submit anyway
          </button>
        </div>
      </div>
    </div>
  );
}
