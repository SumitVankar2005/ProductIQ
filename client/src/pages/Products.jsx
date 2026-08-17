import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import ProductComparison from '../components/ProductComparison';
import { api, productEventsUrl } from '../api';

const STATUS_STYLES = {
  RAW: 'bg-slate-100 text-slate-600',
  PROCESSING: 'bg-blue-100 text-blue-700',
  AUTO_APPROVED: 'bg-green-100 text-green-700',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-700',
  HIGH_RISK: 'bg-red-100 text-red-700',
  REJECTED: 'bg-slate-200 text-slate-500',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      const data = await api.get(`/api/products?${params.toString()}`);
      setProducts(data.products);
      setTotalPages(data.totalPages || 1);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const stream = new EventSource(productEventsUrl);
    stream.addEventListener('product', (event) => {
      const updated = JSON.parse(event.data);
      setProducts((current) => {
        const position = current.findIndex((product) => product._id === updated._id);
        if (position === -1) return current;
        const next = [...current];
        next[position] = updated;
        return next;
      });
      setSelectedProduct((current) => current?._id === updated._id ? updated : current);
    });
    return () => stream.close();
  }, []);

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="p-5 sm:p-8 max-w-[1400px] mx-auto space-y-6">
      <div><h1 className="text-3xl font-bold text-slate-900">Products Database</h1><p className="mt-1 text-sm text-slate-500">AI results appear in this list as each product is processed.</p></div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {selectedProduct && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">Detailed View</h2>
            <button onClick={() => setSelectedProduct(null)} className="text-sm text-slate-500 underline">
              Close View
            </button>
          </div>
          <ProductComparison product={selectedProduct} />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by MPN or description..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">MPN / Desc</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">AI manufacturer</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Confidence</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p._id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-bold">{p.rawInput?.mfgPartNum || 'N/A'}</div>
                  <div className="text-xs text-slate-500 truncate max-w-md">{p.rawInput?.partDesc}</div>
                </td>
                <td className="px-6 py-4 font-medium text-slate-700">{p.intelligence?.manufacturer?.value || <span className="text-slate-400">Waiting for AI</span>}</td>
                <td className="px-6 py-4 text-slate-600">{p.intelligence?.classification?.fine || p.intelligence?.classification?.class || <span className="text-slate-400">—</span>}</td>
                <td className="px-6 py-4">{typeof p.aiConfidenceScore === 'number' ? <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">{p.aiConfidenceScore}%</span> : <span className="text-slate-400">—</span>}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${STATUS_STYLES[p.status] || STATUS_STYLES.RAW}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => setSelectedProduct(p)}
                    className="text-blue-600 font-semibold flex items-center justify-end gap-1 w-full"
                  >
                    <Eye size={16} /> View
                  </button>
                </td>
              </tr>
            ))}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-500">
                  No products found. Upload some data first!
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table></div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-sm font-semibold text-slate-600 disabled:text-slate-300"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-sm font-semibold text-slate-600 disabled:text-slate-300"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
