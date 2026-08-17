import React, { useState } from 'react';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import Papa from 'papaparse';
import { api } from '../api';

function UploadCard({ title, description, icon, onFile, successMessage }) {
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [message, setMessage] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('uploading');
    setMessage('');

    try {
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
  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Upload Data</h1>
        <p className="text-slate-500 mt-1">Import raw catalog files, or expected-output ground truth for AI evaluation.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 mt-8">
        <UploadCard
          title="Raw Catalog Data (CSV)"
          description="e.g. Unihack_ Sample Dataset - Input.csv"
          icon={<FileType className="text-blue-600" size={24} />}
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
    </div>
  );
}
