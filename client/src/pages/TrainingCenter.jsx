import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { Brain, Target, TrendingUp, AlertCircle, Database, Sparkles, Beaker, Play } from 'lucide-react';
import { api } from '../api';

const FIELD_LABELS = {
  manufacturer: 'Manufacturer',
  brand: 'Brand',
  classification: 'Classification',
  description: 'Description',
  attributes: 'Attributes',
};

export default function TrainingCenter() {
  const [activeTab, setActiveTab] = useState('evaluation');
  const [groundTruthCount, setGroundTruthCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, processed: 0 });
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [gt, s, hist, last] = await Promise.all([
        api.get('/api/ground-truth/count'),
        api.get('/api/stats'),
        api.get('/api/eval/history'),
        api.get('/api/eval/latest'),
      ]);
      setGroundTruthCount(gt.count);
      setStats(s);
      setHistory(hist);
      setLatest(last);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const runEvaluation = async () => {
    setRunning(true);
    setError(null);
    try {
      await api.post('/api/eval/run', {});
      await fetchAll();
    } catch (e) {
      setError(e.message);
    }
    setRunning(false);
  };

  const fieldPerformance = latest
    ? Object.entries(latest.fieldScores || {})
        .filter(([, v]) => typeof v === 'number')
        .map(([key, score]) => ({ name: FIELD_LABELS[key] || key, score }))
    : [];

  const runHistory = history.map((run, i) => ({
    run: `Run ${i + 1}`,
    score: run.overallScore,
  }));

  return (
    <div className="p-8 max-w-[1400px] mx-auto min-h-screen">
      <div className="mb-8 flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Brain className="text-blue-600" size={32} /> AI Training & Evaluation Center
          </h1>
          <p className="text-slate-500 mt-2 text-lg max-w-2xl">
            Ground-truth examples are used to score AI predictions and track accuracy over time.
          </p>
        </div>
        <button
          onClick={runEvaluation}
          disabled={running || groundTruthCount === 0}
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-bold shadow-sm text-white transition-colors ${
            running || groundTruthCount === 0 ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <Play size={16} /> {running ? 'Running Evaluation...' : 'Run Evaluation'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4 mb-6">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {groundTruthCount === 0 && !loading && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-4 mb-6">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>
            No ground truth uploaded yet. Go to <strong>Upload Data</strong> and upload your expected-output
            CSV before running an evaluation.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl mb-8 w-fit">
        {[
          { id: 'dataset', icon: <Database size={16} />, label: 'Dataset' },
          { id: 'evaluation', icon: <Target size={16} />, label: 'Evaluation Results' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dataset' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Database size={48} />
            </div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Ground Truth Rows</h3>
            <p className="text-4xl font-black text-slate-900 mt-2">{groundTruthCount}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Database size={48} />
            </div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Products in DB</h3>
            <p className="text-4xl font-black text-slate-900 mt-2">{stats.total}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Database size={48} />
            </div>
            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Processed by AI</h3>
            <p className="text-4xl font-black text-slate-900 mt-2">{stats.processed}</p>
          </div>
        </div>
      )}

      {activeTab === 'evaluation' &&
        (!latest ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-xl h-64 flex flex-col items-center justify-center text-slate-400">
            <Beaker size={48} className="mb-4 opacity-50" />
            <p className="font-medium text-lg">
              {groundTruthCount === 0
                ? 'Upload ground truth data to begin evaluating.'
                : 'No evaluation runs yet. Click "Run Evaluation" above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Database size={48} />
                </div>
                <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">Matched Products</h3>
                <p className="text-4xl font-black text-slate-900 mt-2">{latest.matchedCount}</p>
                <p className="text-xs text-slate-400 mt-2 font-medium">of {latest.groundTruthCount} ground truth rows</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm bg-blue-50/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-600">
                  <Sparkles size={48} />
                </div>
                <h3 className="text-blue-600 font-bold text-xs uppercase tracking-wider">Overall Model Score</h3>
                <p className="text-4xl font-black text-blue-700 mt-2">{latest.overallScore}%</p>
                <p className="text-xs text-blue-500 mt-2 font-bold">Run #{history.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Target size={18} className="text-blue-500" /> Field Performance vs Ground Truth
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fieldPerformance} layout="vertical" margin={{ left: 40, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <TrendingUp size={18} className="text-green-500" /> AI Performance History
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={runHistory} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="run" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-500" /> Extraction Errors (this run)
                </h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-6 py-4">MPN</th>
                    <th className="px-6 py-4">Field</th>
                    <th className="px-6 py-4">Expected (Ground Truth)</th>
                    <th className="px-6 py-4">Predicted (AI)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(latest.mismatches || []).map((err, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{err.mfgPartNum}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{err.field}</td>
                      <td className="px-6 py-4 text-emerald-600 font-medium">{err.expected || '—'}</td>
                      <td className="px-6 py-4 text-red-500 font-medium">{err.predicted || '—'}</td>
                    </tr>
                  ))}
                  {(!latest.mismatches || latest.mismatches.length === 0) && (
                    <tr>
                      <td colSpan="4" className="text-center py-8 text-slate-500">
                        No mismatches found on this run 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}
