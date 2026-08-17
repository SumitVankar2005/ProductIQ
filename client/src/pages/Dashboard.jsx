import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowUpRight, Clock3, Layers3, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    pending: 0,
    needsReview: 0,
    highRisk: 0,
    autoApproved: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await api.get('/api/stats');
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const startProcessing = async () => {
    setIsProcessing(true);
    setError(null);
    setProgress({ done: 0, total: stats.pending, failed: 0 });
    try {
      let remaining = stats.pending;
      let done = 0;
      let failed = 0;
      // Each request processes at most the server's safe batch size (3 by
      // default). This supports 10, 100, or more rows without one timeout.
      while (remaining > 0) {
        const result = await api.post('/api/process-batch', { limit: 3 });
        if (result.processed === 0) break;
        done += result.processed;
        failed += result.failed;
        remaining = result.remaining;
        setProgress({ done, total: stats.pending, failed });
      }
      await fetchStats();
      if (failed > 0) {
        setError(`Finished ${done} records, with ${failed} sent to review due to an AI error.`);
      }
    } catch (e) {
      setError(e.message);
    }
    setIsProcessing(false);
  };

  const cards = [
    { label: 'Catalog records', value: stats.total, tone: 'text-slate-950', icon: Layers3, detail: 'All imported products' },
    { label: 'AI enriched', value: stats.processed, tone: 'text-emerald-500', icon: Sparkles, detail: 'Ready for use' },
    { label: 'Awaiting analysis', value: stats.pending, tone: 'text-amber-500', icon: Clock3, detail: 'Queued for Gemini' },
    { label: 'Review queue', value: stats.needsReview + stats.highRisk, tone: 'text-rose-500', icon: AlertCircle, detail: 'Needs a human decision' },
  ];

  return (
    <div className="p-5 sm:p-8 max-w-7xl mx-auto space-y-7">
      <div className="hero-grid rounded-3xl p-7 sm:p-9 text-white overflow-hidden relative">
        <div className="relative z-10 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide text-cyan-100"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> INTELLIGENCE PIPELINE</div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight">Your product data, <span className="text-cyan-300">made useful.</span></h1>
          <p className="text-slate-300 mt-3 max-w-xl">Enrich fragmented industrial catalog data, surface uncertainty, and keep every decision reviewable.</p>
        </div>
        <div className="lg:text-right">
          <button
            onClick={startProcessing}
            disabled={isProcessing || stats.pending === 0}
            className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold shadow-lg transition-all ${
              isProcessing || stats.pending === 0 ? 'bg-slate-600 text-slate-300' : 'bg-cyan-300 text-slate-950 hover:bg-white hover:-translate-y-0.5'
            }`}
          >
            <Sparkles size={17} /> {isProcessing ? 'Processing queue…' : `Process ${stats.pending} pending record${stats.pending === 1 ? '' : 's'}`}
          </button>
          {isProcessing && (
            <p className="text-xs text-cyan-100 mt-3">{progress?.done || 0} of {progress?.total || 0} completed — safely processing in small batches.</p>
          )}
        </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, tone, icon: Icon, detail }) => (
          <div key={label} className="metric-card bg-white p-5 rounded-2xl border border-slate-200/80">
            <div className="flex justify-between items-start"><span className="text-slate-500 font-bold text-sm">{label}</span><span className="rounded-xl bg-slate-100 p-2 text-slate-600"><Icon size={17} /></span></div>
            <p className={`text-4xl font-black tracking-tight mt-5 ${tone}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-2">{detail}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row gap-5 justify-between items-start">
        <div><h2 className="font-bold text-slate-900">Pipeline health</h2><p className="text-sm text-slate-500 mt-1">{stats.autoApproved} auto-approved · {stats.needsReview} awaiting review · {stats.highRisk} high-risk</p></div>
        <Link to="/reviews" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800">Open review queue <ArrowUpRight size={16} /></Link>
      </div>
    </div>
  );
}
