import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FinalInspection } from '../types';
import { Trash2, Eye, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export function InspectionList() {
  const [inspections, setInspections] = useState<(FinalInspection & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchInspections();
  }, []);

  const fetchInspections = async () => {
    try {
      const q = query(
        collection(db, 'final-inspections'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as (FinalInspection & { id: string })[];
      setInspections(data);
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inspection?')) return;

    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'final-inspections', id));
      setInspections(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error deleting inspection:', error);
      alert('Failed to delete inspection');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (inspections.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No inspections found.</p>
        <p className="text-sm mt-2">Submit your first inspection to see it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Past Inspections</h2>

      {inspections.map((inspection) => (
        <div
          key={inspection.id}
          className="bg-white rounded-lg shadow-sm border overflow-hidden"
        >
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
            onClick={() => setExpandedId(expandedId === inspection.id ? null : inspection.id)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {inspection.inspectionResult === 'PASS' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className="font-medium text-gray-900">
                  {inspection.customerName}
                </span>
                <span className="text-sm text-gray-500">
                  {inspection.inspectionDate}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  inspection.inspectionResult === 'PASS'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {inspection.inspectionResult}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Design: {inspection.buyerDesignName} | OPS: {inspection.opsNo}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(inspection.id);
                }}
                disabled={deleting === inspection.id}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                {deleting === inspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 size={18} />
                )}
              </button>
              {expandedId === inspection.id ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </div>
          </div>

          {expandedId === inspection.id && (
            <div className="border-t px-4 py-4 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Inspector:</span>
                  <span className="ml-2 text-gray-900">{inspection.qcInspectorName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Customer Code:</span>
                  <span className="ml-2 text-gray-900">{inspection.customerCode}</span>
                </div>
                <div>
                  <span className="text-gray-500">Customer PO:</span>
                  <span className="ml-2 text-gray-900">{inspection.customerPoNo}</span>
                </div>
                <div>
                  <span className="text-gray-500">EMPL Design:</span>
                  <span className="ml-2 text-gray-900">{inspection.emplDesignNo}</span>
                </div>
                <div>
                  <span className="text-gray-500">Color:</span>
                  <span className="ml-2 text-gray-900">{inspection.colorName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sizes:</span>
                  <span className="ml-2 text-gray-900">{inspection.productSizes}</span>
                </div>
                <div>
                  <span className="text-gray-500">Merchant:</span>
                  <span className="ml-2 text-gray-900">{inspection.merchant}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Order:</span>
                  <span className="ml-2 text-gray-900">{inspection.totalOrderQty}</span>
                </div>
                <div>
                  <span className="text-gray-500">Inspected Lot:</span>
                  <span className="ml-2 text-gray-900">{inspection.inspectedLotQty}</span>
                </div>
                <div>
                  <span className="text-gray-500">AQL:</span>
                  <span className="ml-2 text-gray-900">{inspection.aql}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sample Size:</span>
                  <span className="ml-2 text-gray-900">{inspection.sampleSize}</span>
                </div>
                <div>
                  <span className="text-gray-500">Accepted:</span>
                  <span className="ml-2 text-green-600 font-medium">{inspection.acceptedQty}</span>
                </div>
                <div>
                  <span className="text-gray-500">Rejected:</span>
                  <span className="ml-2 text-red-600 font-medium">{inspection.rejectedQty}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t text-sm">
                <div>
                  <span className="text-gray-500">Carton Dimension:</span>
                  <span className={`ml-2 font-medium ${inspection.cartonDimension === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
                    {inspection.cartonDimension}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Product Label:</span>
                  <span className={`ml-2 font-medium ${inspection.productLabel === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
                    {inspection.productLabel}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Carton Label:</span>
                  <span className={`ml-2 font-medium ${inspection.cartonLabel === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
                    {inspection.cartonLabel}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Barcode Scan:</span>
                  <span className={`ml-2 font-medium ${inspection.barcodeScan === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
                    {inspection.barcodeScan}
                  </span>
                </div>
              </div>

              {inspection.qcInspectorRemarks && (
                <div className="mt-4 pt-4 border-t">
                  <span className="text-sm text-gray-500">Remarks:</span>
                  <p className="text-sm text-gray-900 mt-1">{inspection.qcInspectorRemarks}</p>
                </div>
              )}

              {/* Photos */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500 mb-2">Photos:</p>
                <div className="flex flex-wrap gap-2">
                  {inspection.approvedSamplePhoto && (
                    <a href={inspection.approvedSamplePhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Approved Sample
                    </a>
                  )}
                  {inspection.idPhoto && (
                    <a href={inspection.idPhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> ID
                    </a>
                  )}
                  {inspection.redSealFrontPhoto && (
                    <a href={inspection.redSealFrontPhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Red Seal Front
                    </a>
                  )}
                  {inspection.redSealSidePhoto && (
                    <a href={inspection.redSealSidePhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Red Seal Side
                    </a>
                  )}
                  {inspection.backPhoto && (
                    <a href={inspection.backPhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Back
                    </a>
                  )}
                  {inspection.labelPhoto && (
                    <a href={inspection.labelPhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Label
                    </a>
                  )}
                  {inspection.moisturePhoto && (
                    <a href={inspection.moisturePhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Moisture
                    </a>
                  )}
                  {inspection.sizeFrontPhoto && (
                    <a href={inspection.sizeFrontPhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Size Front
                    </a>
                  )}
                  {inspection.sizeSidePhoto && (
                    <a href={inspection.sizeSidePhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Size Side
                    </a>
                  )}
                  {inspection.inspectedSamplesPhoto && (
                    <a href={inspection.inspectedSamplesPhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Inspected Samples
                    </a>
                  )}
                  {inspection.metalCheckingPhoto && (
                    <a href={inspection.metalCheckingPhoto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Metal Checking
                    </a>
                  )}
                  {inspection.otherPhotos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline text-sm">
                      <Eye size={14} /> Other {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
