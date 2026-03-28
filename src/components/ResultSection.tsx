import { CheckCircle2, XCircle } from 'lucide-react';
import { SizeInspectionFormState } from '../types';

interface ResultSectionProps {
  sizeData: SizeInspectionFormState;
  sizeIndex: number;
  onFieldChange: (field: string, value: unknown) => void;
}

export default function ResultSection({
  sizeData,
  sizeIndex,
  onFieldChange,
}: ResultSectionProps) {
  return (
    <div className="space-y-4">
      {/* Remarks */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          QC Inspector Remarks
        </label>
        <textarea
          rows={3}
          value={sizeData.qcInspectorRemarks}
          onChange={(e) => onFieldChange('qcInspectorRemarks', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
          placeholder="Enter any additional remarks..."
        />
      </div>

      {/* PASS / FAIL */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Inspection Result *
        </label>
        <div className="flex gap-4">
          <label
            className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              sizeData.inspectionResult === 'PASS'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name={`size_${sizeIndex}_inspectionResult`}
              value="PASS"
              checked={sizeData.inspectionResult === 'PASS'}
              onChange={() => onFieldChange('inspectionResult', 'PASS')}
              className="hidden"
            />
            <CheckCircle2
              className={`w-6 h-6 ${
                sizeData.inspectionResult === 'PASS' ? 'text-green-600' : 'text-gray-400'
              }`}
            />
            <span
              className={`font-semibold ${
                sizeData.inspectionResult === 'PASS' ? 'text-green-700' : 'text-gray-500'
              }`}
            >
              PASS
            </span>
          </label>
          <label
            className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
              sizeData.inspectionResult === 'FAIL'
                ? 'border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name={`size_${sizeIndex}_inspectionResult`}
              value="FAIL"
              checked={sizeData.inspectionResult === 'FAIL'}
              onChange={() => onFieldChange('inspectionResult', 'FAIL')}
              className="hidden"
            />
            <XCircle
              className={`w-6 h-6 ${
                sizeData.inspectionResult === 'FAIL' ? 'text-red-600' : 'text-gray-400'
              }`}
            />
            <span
              className={`font-semibold ${
                sizeData.inspectionResult === 'FAIL' ? 'text-red-700' : 'text-gray-500'
              }`}
            >
              FAIL
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
