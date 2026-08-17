import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

export default function Settings() {
  const [threshold, setThreshold] = useState(90);
  const [geminiModel, setGeminiModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const settings = await api.get('/api/settings');
        setThreshold(settings.confidenceThreshold);
        setGeminiModel(settings.geminiModel);
        setError(null);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put('/api/settings', { confidenceThreshold: Number(threshold) });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
        <SettingsIcon className="text-blue-600" /> Platform Settings
      </h1>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Gemini Model Configuration</label>
          <input
            type="text"
            disabled
            value={loading ? 'Loading...' : `${geminiModel} (managed via server .env)`}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Confidence Threshold for Auto-Approval</label>
          <input
            type="number"
            min="0"
            max="100"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={loading}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg"
          />
          <p className="text-xs text-slate-400 mt-2">
            Products with AI confidence at or above this score are auto-approved. Products more than 30
            points below it are routed to High Risk instead of Needs Review.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 disabled:opacity-60"
        >
          {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
