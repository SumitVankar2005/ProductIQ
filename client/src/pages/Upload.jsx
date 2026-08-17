import React, { useState } from 'react';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Target, Plus, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import { api } from '../api';

function UploadCard({ title, description, icon, onFile, onPreview }) {
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [message, setMessage] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('uploading');
    setMessage('');

    try {
      await onPreview?.(file);
      const result = await onFile(file);
      setMessage(result);
      setStatus('success');
    } catch (error) {
      setMessage(error.message || 'Upload failed.');
      setStatus('error');
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>

      {status === 'success' ? (
        <div className="p-10 flex flex-col items-center justify-center text-center bg-green-50 rounded-xl border border-green-200">
          <CheckCircle2 size={48} className="text-green-500 mb-4" />
          <h3 className="font-bold text-green-800">Upload Complete!</h3>
          <p className="text-sm text-green-600 mt-2">{message}</p>
          <button onClick={() => setStatus('idle')} className="mt-6 text-blue-600 font-semibold underline">
            Upload another file
          </button>
        </div>
      ) : (
        <label className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
          <UploadCloud
            size={48}
            className={`mb-4 ${status === 'uploading' ? 'text-slate-300 animate-bounce' : 'text-blue-500'}`}
          />
          <h3 className="font-bold text-slate-700">
            {status === 'uploading' ? 'Processing...' : 'Click to select CSV file'}
          </h3>
          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-600 text-xs mt-3">
              <AlertCircle size={14} /> {message}
            </div>
          )}
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
            disabled={status === 'uploading'}
          />
        </label>
      )}
    </div>
  );
}

const parseCsv = (file) =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject,
    });
  });

export default function Upload() {
  const [preview, setPreview] = useState(null);
  const [quickProduct, setQuickProduct] = useState({ mfgPartNum: '', partDesc: '', partManuf: '', brand: '' });
  const [quickStatus, setQuickStatus] = useState({ loading: false, message: '', error: false });

  const submitQuickProduct = async (event) => {
    event.preventDefault();
    setQuickStatus({ loading: true, message: '', error: false });
    try {
      await api.post('/api/products', quickProduct);
      setQuickProduct({ mfgPartNum: '', partDesc: '', partManuf: '', brand: '' });
      setQuickStatus({ loading: false, message: 'Product added to the processing queue. Open Dashboard to run AI.', error: false });
    } catch (error) {
      setQuickStatus({ loading: false, message: error.message, error: true });
    }
  };

  return (
    <div className="p-5 sm:p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Upload Data</h1>
        <p className="text-slate-500 mt-1">Start with a CSV for many products, or paste one product below to test an AI prediction immediately.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">
        <UploadCard
          title="Raw Catalog Data (CSV)"
          description="Required: Mfg_Part_Num or Part_Desc. Optional: Part_Manuf and Brand. We preview the first rows before saving."
          icon={<FileType className="text-blue-600" size={24} />}
          onPreview={async (file) => {
            const rows = await parseCsv(file);
            setPreview({ name: file.name, count: rows.length, headers: Object.keys(rows[0] || {}), rows: rows.slice(0, 4) });
          }}
          onFile={async (file) => {
            const rows = await parseCsv(file);
            const result = await api.post('/api/upload', { data: rows });
            return `Successfully saved ${result.count} products to the database.`;
          }}
        />

        <UploadCard
          title="Ground Truth (Expected Output CSV)"
          description="e.g. Unihack_ Expected Output - Delivery Format.csv — used by the AI Training & Eval Center to score accuracy"
          icon={<Target className="text-purple-600" size={24} />}
          onFile={async (file) => {
            const csvText = await file.text();
            const result = await api.post('/api/ground-truth/upload', { csv: csvText });
            return `Loaded ${result.count} ground-truth rows. Go to AI Training & Eval to run a scoring pass.`;
          }}
        />
      </div>

      {preview && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">Dataset preview</h2><p className="text-xs text-slate-500">{preview.name} · {preview.count} usable rows · first 4 shown</p></div><span className="text-xs font-semibold text-emerald-700">Ready for AI processing</span></div>
          <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{preview.headers.map((header) => <th className="whitespace-nowrap px-4 py-3 font-bold" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{preview.rows.map((row, index) => <tr key={index}>{preview.headers.map((header) => <td key={header} className="max-w-64 truncate px-4 py-3 text-slate-700">{row[header] || '—'}</td>)}</tr>)}</tbody></table></div>
        </section>
      )}

      <section className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 sm:p-7">
        <div className="mb-5 flex items-start gap-3"><span className="rounded-xl bg-indigo-600 p-2 text-white"><Sparkles size={18} /></span><div><h2 className="font-bold text-slate-900">Try one product</h2><p className="text-sm text-slate-500">Add a single product without a CSV. It joins the queue and its results will populate live in Products.</p></div></div>
        <form onSubmit={submitQuickProduct} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={quickProduct.mfgPartNum} onChange={(e) => setQuickProduct({ ...quickProduct, mfgPartNum: e.target.value })} placeholder="Part number (e.g. DWE402)" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          <input value={quickProduct.partManuf} onChange={(e) => setQuickProduct({ ...quickProduct, partManuf: e.target.value })} placeholder="Manufacturer (optional)" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          <input value={quickProduct.partDesc} onChange={(e) => setQuickProduct({ ...quickProduct, partDesc: e.target.value })} placeholder="Product description" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm sm:col-span-2" />
          <input value={quickProduct.brand} onChange={(e) => setQuickProduct({ ...quickProduct, brand: e.target.value })} placeholder="Brand (optional)" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          <button disabled={quickStatus.loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"><Plus size={16} />{quickStatus.loading ? 'Adding…' : 'Add to queue'}</button>
        </form>
        {quickStatus.message && <p className={`mt-3 text-sm ${quickStatus.error ? 'text-red-600' : 'text-emerald-700'}`}>{quickStatus.message}</p>}
      </section>
    </div>
  );
}
