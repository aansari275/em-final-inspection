import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FinalInspection, COMPANY_NAMES } from '../types';
import { generateFinalInspectionPDF } from '../lib/pdfGenerator';
import { emailSettingsService } from '../lib/emailSettingsService';
import { Trash2, Eye, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Download, Mail, FileText } from 'lucide-react';

// Helper component for OK/NOT OK status badges
const StatusBadge = ({ status }: { status: 'OK' | 'NOT OK' | string }) => (
  <span className={`font-medium ${status === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
    {status}
  </span>
);

export function InspectionList() {
  const [inspections, setInspections] = useState<(FinalInspection & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [previewInspection, setPreviewInspection] = useState<(FinalInspection & { id: string }) | null>(null);

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

  const handleDownloadPdf = async (inspection: FinalInspection & { id: string }) => {
    setGeneratingPdf(inspection.id);
    try {
      const pdfBase64 = await generateFinalInspectionPDF(inspection);
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfBase64}`;
      link.download = `Final_Inspection_${inspection.customerName}_${inspection.inspectionDate}.pdf`;
      link.click();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleResendEmail = async (inspection: FinalInspection & { id: string }) => {
    const recipients = emailSettingsService.getRecipients();
    if (recipients.length === 0) {
      alert('No email recipients configured. Please go to Settings to add recipients.');
      return;
    }

    setSendingEmail(inspection.id);
    try {
      const pdfBase64 = await generateFinalInspectionPDF(inspection);

      const resultColor = inspection.inspectionResult === 'PASS' ? '#22c55e' : '#ef4444';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Eastern Mills</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Final Inspection Report</p>
          </div>

          <div style="padding: 20px; background: #f9fafb;">
            <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">
                Result: <span style="color: ${resultColor}; font-weight: bold;">${inspection.inspectionResult}</span>
              </h2>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; width: 40%;">Customer:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${inspection.customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Design:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${inspection.buyerDesignName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">OPS No:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${inspection.opsNo}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Inspection Date:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${inspection.inspectionDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Inspector:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: 500;">${inspection.qcInspectorName}</td>
                </tr>
              </table>
            </div>

            <div style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 15px 0; color: #111827; font-size: 16px;">Quantities</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Accepted:</td>
                  <td style="padding: 8px 0; color: #22c55e; font-weight: bold;">${inspection.acceptedQty}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Rejected:</td>
                  <td style="padding: 8px 0; color: #ef4444; font-weight: bold;">${inspection.rejectedQty}</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
            <p>This is an automated email from Eastern Mills QC System</p>
          </div>
        </div>
      `;

      const response = await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject: `Final Inspection Report - ${inspection.customerName} - ${inspection.inspectionResult}`,
          html: emailHtml,
          pdfBase64,
          pdfFilename: `Final_Inspection_${inspection.customerName}_${inspection.inspectionDate}.pdf`
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('Email sent successfully!');
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSendingEmail(null);
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
              <div className="flex items-center gap-3 flex-wrap">
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
                {inspection.company && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {inspection.company}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {inspection.documentNo && <span className="text-emerald-600 font-medium">{inspection.documentNo}</span>}
                {inspection.documentNo && ' | '}
                Design: {inspection.buyerDesignName} | OPS: {inspection.opsNo}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {/* Action Buttons */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewInspection(inspection);
                }}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Preview"
              >
                <FileText size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadPdf(inspection);
                }}
                disabled={generatingPdf === inspection.id}
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Download PDF"
              >
                {generatingPdf === inspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download size={18} />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleResendEmail(inspection);
                }}
                disabled={sendingEmail === inspection.id}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Resend Email"
              >
                {sendingEmail === inspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail size={18} />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(inspection.id);
                }}
                disabled={deleting === inspection.id}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
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
            <div className="border-t px-4 py-4 bg-gray-50 space-y-4">
              {/* Company & Document Info */}
              {inspection.company && (
                <div className="bg-white rounded-lg p-3 border">
                  <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Company & Document</h5>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Company:</span>
                      <span className="ml-2 text-gray-900 font-medium">{COMPANY_NAMES[inspection.company] || inspection.company}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Document No:</span>
                      <span className="ml-2 text-emerald-600 font-medium">{inspection.documentNo}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Basic Information</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
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
                </div>
              </div>

              {/* Quantities */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Quantities</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
              </div>

              {/* Product Quality Checks */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Product Quality Checks</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Approved Sample:</span>
                    <span className={`ml-2 font-medium ${inspection.approvedSampleAvailable === 'Yes' ? 'text-green-600' : 'text-red-600'}`}>
                      {inspection.approvedSampleAvailable || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Material:</span>
                    <span className="ml-2 text-gray-900">{inspection.materialFibreContent || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Motif/Design:</span>
                    <StatusBadge status={inspection.motifDesignCheck || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Backing:</span>
                    <StatusBadge status={inspection.backing || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Binding & Edges:</span>
                    <StatusBadge status={inspection.bindingAndEdges || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Hand Feel:</span>
                    <StatusBadge status={inspection.handFeel || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Embossing/Carving:</span>
                    <StatusBadge status={inspection.embossingCarving || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Workmanship:</span>
                    <StatusBadge status={inspection.workmanship || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Weight Check:</span>
                    <StatusBadge status={inspection.productQualityWeight || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Product Weight:</span>
                    <span className="ml-2 text-gray-900">{inspection.productWeight || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Size Tolerance:</span>
                    <span className="ml-2 text-gray-900">{inspection.sizeTolerance || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pile Height:</span>
                    <span className="ml-2 text-gray-900">{inspection.pileHeight || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Labeling & Marking */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Labeling & Marking</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Label Placement:</span>
                    <StatusBadge status={inspection.labelPlacement || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Side Marking:</span>
                    <StatusBadge status={inspection.sideMarking || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Outer Marking:</span>
                    <StatusBadge status={inspection.outerMarking || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Inner Pack:</span>
                    <StatusBadge status={inspection.innerPack || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Care Labels:</span>
                    <StatusBadge status={inspection.careLabels || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">SKU Stickers:</span>
                    <StatusBadge status={inspection.skuStickers || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">UPC Barcodes:</span>
                    <StatusBadge status={inspection.upcBarcodes || 'N/A'} />
                  </div>
                </div>
              </div>

              {/* Packaging */}
              <div className="bg-white rounded-lg p-3 border">
                <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">Packaging</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Carton Dimension:</span>
                    <StatusBadge status={inspection.cartonDimension || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Product Label:</span>
                    <StatusBadge status={inspection.productLabel || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Carton Label:</span>
                    <StatusBadge status={inspection.cartonLabel || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Barcode Scan:</span>
                    <StatusBadge status={inspection.barcodeScan || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Carton Drop Test:</span>
                    <StatusBadge status={inspection.cartonDropTest || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Carton Numbering:</span>
                    <StatusBadge status={inspection.cartonBaleNumbering || 'N/A'} />
                  </div>
                  <div>
                    <span className="text-gray-500">Packing Type:</span>
                    <span className="ml-2 text-gray-900">{inspection.packingType || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Carton Ply:</span>
                    <span className="ml-2 text-gray-900">{inspection.cartonPly || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Gross Weight:</span>
                    <span className="ml-2 text-gray-900">{inspection.grossWeight || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Net Weight:</span>
                    <span className="ml-2 text-gray-900">{inspection.netWeight || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pcs/Carton:</span>
                    <span className="ml-2 text-gray-900">{inspection.pcsPerCartonBale || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Carton L×W×H:</span>
                    <span className="ml-2 text-gray-900">
                      {inspection.cartonMeasurementL && inspection.cartonMeasurementW && inspection.cartonMeasurementH
                        ? `${inspection.cartonMeasurementL} × ${inspection.cartonMeasurementW} × ${inspection.cartonMeasurementH}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Defects */}
              {inspection.defects && inspection.defects.length > 0 && (
                <div className="bg-white rounded-lg p-3 border">
                  <h5 className="text-xs font-semibold text-red-700 uppercase mb-2">Defects Found</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100 text-left">
                          <th className="px-2 py-1">Code</th>
                          <th className="px-2 py-1">Description</th>
                          <th className="px-2 py-1 text-center">Major</th>
                          <th className="px-2 py-1 text-center">Minor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspection.defects.map((defect, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-1 font-medium">{defect.defectCode}</td>
                            <td className="px-2 py-1">{defect.description}</td>
                            <td className="px-2 py-1 text-center text-red-600 font-medium">{defect.majorCount}</td>
                            <td className="px-2 py-1 text-center text-orange-600 font-medium">{defect.minorCount}</td>
                          </tr>
                        ))}
                        <tr className="border-t bg-gray-50 font-medium">
                          <td className="px-2 py-1" colSpan={2}>Total</td>
                          <td className="px-2 py-1 text-center text-red-600">
                            {inspection.defects.reduce((sum, d) => sum + d.majorCount, 0)}
                          </td>
                          <td className="px-2 py-1 text-center text-orange-600">
                            {inspection.defects.reduce((sum, d) => sum + d.minorCount, 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {inspection.qcInspectorRemarks && (
                <div className="bg-white rounded-lg p-3 border">
                  <h5 className="text-xs font-semibold text-emerald-700 uppercase mb-2">QC Remarks</h5>
                  <p className="text-sm text-gray-900">{inspection.qcInspectorRemarks}</p>
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

      {/* Preview Modal */}
      {previewInspection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-emerald-600 text-white p-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Final Inspection Preview</h3>
              <button
                onClick={() => setPreviewInspection(null)}
                className="text-white hover:bg-emerald-700 rounded-lg p-1"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Result Badge */}
              <div className="text-center">
                <span className={`inline-block px-6 py-2 rounded-full text-lg font-bold ${
                  previewInspection.inspectionResult === 'PASS'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {previewInspection.inspectionResult === 'PASS' ? 'PASSED' : 'FAILED'}
                </span>
              </div>

              {/* Company & Document */}
              {previewInspection.company && (
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="font-semibold text-blue-800">{COMPANY_NAMES[previewInspection.company]}</p>
                  <p className="text-sm text-blue-600">Document No: {previewInspection.documentNo}</p>
                </div>
              )}

              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Order Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Customer:</span> <span className="font-medium">{previewInspection.customerName}</span></div>
                  <div><span className="text-gray-500">Code:</span> <span className="font-medium">{previewInspection.customerCode}</span></div>
                  <div><span className="text-gray-500">PO No:</span> <span className="font-medium">{previewInspection.customerPoNo}</span></div>
                  <div><span className="text-gray-500">OPS No:</span> <span className="font-medium">{previewInspection.opsNo}</span></div>
                  <div><span className="text-gray-500">Buyer Design:</span> <span className="font-medium">{previewInspection.buyerDesignName}</span></div>
                  <div><span className="text-gray-500">EMPL Design:</span> <span className="font-medium">{previewInspection.emplDesignNo}</span></div>
                  <div><span className="text-gray-500">Color:</span> <span className="font-medium">{previewInspection.colorName}</span></div>
                  <div><span className="text-gray-500">Sizes:</span> <span className="font-medium">{previewInspection.productSizes}</span></div>
                </div>
              </div>

              {/* Quantities */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Inspection Quantities</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white rounded-lg p-3">
                    <div className="text-2xl font-bold text-gray-800">{previewInspection.totalOrderQty}</div>
                    <div className="text-xs text-gray-500">Total Order</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-600">{previewInspection.acceptedQty}</div>
                    <div className="text-xs text-gray-500">Accepted</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-red-600">{previewInspection.rejectedQty}</div>
                    <div className="text-xs text-gray-500">Rejected</div>
                  </div>
                </div>
              </div>

              {/* Product Quality Checks */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Product Quality Checks</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Approved Sample:</span>
                    <span className={previewInspection.approvedSampleAvailable === 'Yes' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {previewInspection.approvedSampleAvailable || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Material:</span>
                    <span className="font-medium">{previewInspection.materialFibreContent || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Motif/Design:</span>
                    <StatusBadge status={previewInspection.motifDesignCheck || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Backing:</span>
                    <StatusBadge status={previewInspection.backing || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Binding & Edges:</span>
                    <StatusBadge status={previewInspection.bindingAndEdges || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hand Feel:</span>
                    <StatusBadge status={previewInspection.handFeel || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Embossing/Carving:</span>
                    <StatusBadge status={previewInspection.embossingCarving || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Workmanship:</span>
                    <StatusBadge status={previewInspection.workmanship || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Weight Check:</span>
                    <StatusBadge status={previewInspection.productQualityWeight || 'N/A'} />
                  </div>
                </div>
              </div>

              {/* Labeling & Marking */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Labeling & Marking</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Label Placement:</span>
                    <StatusBadge status={previewInspection.labelPlacement || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Side Marking:</span>
                    <StatusBadge status={previewInspection.sideMarking || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Outer Marking:</span>
                    <StatusBadge status={previewInspection.outerMarking || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Inner Pack:</span>
                    <StatusBadge status={previewInspection.innerPack || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Care Labels:</span>
                    <StatusBadge status={previewInspection.careLabels || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SKU Stickers:</span>
                    <StatusBadge status={previewInspection.skuStickers || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">UPC Barcodes:</span>
                    <StatusBadge status={previewInspection.upcBarcodes || 'N/A'} />
                  </div>
                </div>
              </div>

              {/* Packaging */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-700 mb-3">Packaging</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Dimension:</span>
                    <StatusBadge status={previewInspection.cartonDimension || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Product Label:</span>
                    <StatusBadge status={previewInspection.productLabel || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Label:</span>
                    <StatusBadge status={previewInspection.cartonLabel || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Barcode:</span>
                    <StatusBadge status={previewInspection.barcodeScan || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Drop Test:</span>
                    <StatusBadge status={previewInspection.cartonDropTest || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton Numbering:</span>
                    <StatusBadge status={previewInspection.cartonBaleNumbering || 'N/A'} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Packing Type:</span>
                    <span className="font-medium">{previewInspection.packingType || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carton L×W×H:</span>
                    <span className="font-medium">
                      {previewInspection.cartonMeasurementL && previewInspection.cartonMeasurementW && previewInspection.cartonMeasurementH
                        ? `${previewInspection.cartonMeasurementL}×${previewInspection.cartonMeasurementW}×${previewInspection.cartonMeasurementH}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Defects */}
              {previewInspection.defects && previewInspection.defects.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-700 mb-3">Defects Found</h4>
                  <div className="space-y-2">
                    {previewInspection.defects.map((defect, idx) => (
                      <div key={idx} className="flex justify-between text-sm bg-white p-2 rounded">
                        <span className="font-medium">{defect.defectCode}: {defect.description}</span>
                        <span>
                          <span className="text-red-600">Major: {defect.majorCount}</span>
                          <span className="mx-2">|</span>
                          <span className="text-orange-600">Minor: {defect.minorCount}</span>
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-red-200">
                      <span>Total</span>
                      <span>
                        <span className="text-red-600">Major: {previewInspection.defects.reduce((sum, d) => sum + d.majorCount, 0)}</span>
                        <span className="mx-2">|</span>
                        <span className="text-orange-600">Minor: {previewInspection.defects.reduce((sum, d) => sum + d.minorCount, 0)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {previewInspection.qcInspectorRemarks && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-emerald-700 mb-2">QC Remarks</h4>
                  <p className="text-gray-700">{previewInspection.qcInspectorRemarks}</p>
                </div>
              )}

              {/* Footer */}
              <div className="border-t pt-4 text-sm text-gray-500 text-center">
                <p>Inspected by: {previewInspection.qcInspectorName} | Date: {previewInspection.inspectionDate}</p>
                {previewInspection.documentNo && (
                  <p className="text-emerald-600 font-medium">{previewInspection.documentNo}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="sticky bottom-0 bg-gray-100 p-4 flex gap-3 justify-end">
              <button
                onClick={() => handleDownloadPdf(previewInspection)}
                disabled={generatingPdf === previewInspection.id}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {generatingPdf === previewInspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                Download PDF
              </button>
              <button
                onClick={() => handleResendEmail(previewInspection)}
                disabled={sendingEmail === previewInspection.id}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingEmail === previewInspection.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail size={18} />
                )}
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
