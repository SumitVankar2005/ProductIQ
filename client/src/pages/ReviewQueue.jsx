import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Search, Check, X, AlertCircle, Eye } from 'lucide-react';
import ProductComparison from '../components/ProductComparison';
import { api } from '../api';

// Picks the field(s) that most likely caused a product to land in the review
// queue, based on confidence scores actually stored on the product.
const flaggedFields = (product) => {
  const flags = [];
  const intel = product.intelligence;
  if (!intel) return [{ field: 'All fields', issue: 'Processing failed or not yet run.' }];

  if ((intel.manufacturer?.confidence ?? 100) < 85) {
    flags.push({
      field: 'Manufacturer',
      predicted: intel.manufacturer?.value,
      issue: `Confidence ${Math.round(intel.manufacturer?.confidence ?? 0)}% below threshold.`,
    });
  }
  if ((intel.brand?.confidence ?? 100) < 85) {
    flags.push({
      field: 'Brand',
      predicted: intel.brand?.value,
      issue: `Confidence ${Math.round(intel.brand?.confidence ?? 0)}% below threshold.`,
    });
  }
  if ((intel.classification?.confidence ?? 100) < 85) {
    flags.push({
      field: 'Classification',
      predicted: intel.classification?.fine || intel.classification?.class,
      issue: `Confidence ${Math.round(intel.classification?.confidence ?? 0)}% below threshold.`,
    });
  }
  for (const attr of intel.attributes || []) {
    if (attr.validationStatus !== 'VALID') {
      flags.push({
        field: attr.label,
        predicted: `${attr.value} ${attr.uom || ''}`.trim(),
        issue:
          attr.validationStatus === 'INVALID'
            ? 'Extraction confidence very low.'
            : 'Extraction confidence below threshold.',
      });
    }
  }
  if (product.processingError) {
    flags.push({ field: 'Processing', issue: product.processingError });
  }
  return flags.length > 0 ? flags : [{ field: '—', issue: 'Flagged for manual review.' }];
};

export default function ReviewQueue() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [previewProduct, setPreviewProduct] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [needsReview, highRisk] = await Promise.all([
        api.get('/api/products?status=NEEDS_REVIEW&limit=100'),
        api.get('/api/products?status=HIGH_RISK&limit=100'),
      ]);
      let all = [...needsReview.products, ...highRisk.products].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      if (search) {
        const q = search.toLowerCase();
        all = all.filter(
          (p) =>
            p.rawInput?.mfgPartNum?.toLowerCase().includes(q) ||
            p.rawInput?.partDesc?.toLowerCase().includes(q)
        );
      }
      setProducts(all);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleAction = async (id, action) => {
    setActioningId(id);
    try {
      await api.patch(`/api/products/${id}/${action}`, {});
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (e) {
      setError(e.message);
    }
    setActioningId(null);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            Review Queue
            <span className="bg-amber-100 text-amber-700 text-sm py-1 px-3 rounded-full font-bold">
              {products.length} Pending
            </span>
          </h1>
          <p className="text-slate-500 mt-2">Human-in-the-loop resolution for uncertain AI predictions.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {previewProduct && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">Detailed View</h2>
            <button onClick={() => setPreviewProduct(null)} className="text-sm text-slate-500 underline">
              Close View
            </button>
          </div>
          <ProductComparison product={previewProduct} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by MPN or description..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-6 py-4">MPN / Product</th>
                <th className="px-6 py-4">Flagged Field(s)</th>
                <th className="px-6 py-4">AI Prediction</th>
                <th className="px-6 py-4">Issue Description</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const flags = flaggedFields(p);
                const primary = flags[0];
                return (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-slate-800 font-semibold">{p.rawInput?.mfgPartNum || 'N/A'}</div>
                      <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{p.rawInput?.partDesc}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {primary.field}
                      {flags.length > 1 && (
                        <span className="text-xs text-slate-400 font-normal"> +{flags.length - 1} more</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-blue-600 font-medium">{primary.predicted || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle size={14} /> <span className="text-xs">{primary.issue}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setPreviewProduct(p)}
                          className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleAction(p._id, 'approve')}
                          disabled={actioningId === p._id}
                          className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg border border-green-200 disabled:opacity-50"
                          title="Approve Prediction"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handleAction(p._id, 'reject')}
                          disabled={actioningId === p._id}
                          className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-200 disabled:opacity-50"
                          title="Reject"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500">
                    Nothing to review right now.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-400">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
