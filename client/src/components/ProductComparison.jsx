import React from 'react';
import { CheckCircle2, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';

const statusBadge = (status) => {
  switch (status) {
    case 'AUTO_APPROVED':
      return (
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-green-200 shadow-sm">
          <CheckCircle2 size={12} strokeWidth={3} /> Auto-Approved
        </span>
      );
    case 'NEEDS_REVIEW':
      return (
        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-amber-200 shadow-sm">
          <AlertTriangle size={12} strokeWidth={3} /> Needs Review
        </span>
      );
    case 'HIGH_RISK':
      return (
        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-red-200 shadow-sm">
          <AlertTriangle size={12} strokeWidth={3} /> High Risk
        </span>
      );
    default:
      return (
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-200">
          {status || 'RAW'}
        </span>
      );
  }
};

const confidenceBadge = (confidence) => {
  if (confidence === undefined || confidence === null) return null;
  const color =
    confidence >= 85
      ? 'bg-blue-50 text-blue-600'
      : confidence >= 50
      ? 'bg-amber-50 text-amber-600'
      : 'bg-red-50 text-red-600';
  return <span className={`${color} text-[10px] px-2 py-0.5 rounded font-bold`}>{Math.round(confidence)}% CONF</span>;
};

const Row = ({ label, value, extra }) => (
  <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-blue-100 shadow-sm gap-3">
    <span className="text-slate-500 font-medium text-xs uppercase shrink-0">{label}</span>
    <div className="text-right flex items-center gap-3 min-w-0">
      <span className="font-bold text-slate-900 truncate">{value || '—'}</span>
      {extra}
    </div>
  </div>
);

// Renders a raw-vs-AI-enriched comparison for a single product. `product` is
// expected to be a full Mongo Product document (rawInput + intelligence +
// status), not a synthetic shape — this renders whatever is actually there.
export default function ProductComparison({ product }) {
  if (!product) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
        No product selected.
      </div>
    );
  }

  const { rawInput = {}, intelligence, status } = product;
  const classification = intelligence?.classification;
  const attributes = intelligence?.attributes || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-xl shadow-sm border border-slate-200 p-2">
      {/* RAW DATA */}
      <div className="bg-slate-50 p-6 rounded-lg border-r border-slate-100">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
          Raw Input Data
        </h3>
        <div className="space-y-5 text-sm">
          <div>
            <span className="block text-slate-400 font-medium mb-1 text-xs uppercase">Mfg Part Number</span>
            <span className="font-mono font-semibold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 block">
              {rawInput.mfgPartNum || '—'}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-medium mb-1 text-xs uppercase">Description</span>
            <span className="font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 block">
              {rawInput.partDesc || '—'}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-medium mb-1 text-xs uppercase">Manufacturer</span>
            <span className="font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 block">
              {rawInput.partManuf || '—'}
            </span>
          </div>
          <div>
            <span className="block text-slate-400 font-medium mb-1 text-xs uppercase">Brand</span>
            <span className="font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 block italic">
              {rawInput.brand || '-- Unbranded --'}
            </span>
          </div>
        </div>
      </div>

      {/* AI ENRICHED DATA */}
      <div className="bg-blue-50/40 p-6 rounded-lg relative overflow-hidden">
        <Zap className="absolute -right-10 -bottom-10 text-blue-100" size={150} opacity={0.5} />

        <div className="flex justify-between items-center mb-6 relative z-10">
          <h3 className="text-xs font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
            AI Enriched Intelligence
          </h3>
          {statusBadge(status)}
        </div>

        {!intelligence ? (
          <div className="relative z-10 text-sm text-slate-500 italic bg-white/60 rounded-lg p-4 border border-blue-100">
            Not processed yet. Run "Process Pending Products" from the Dashboard.
          </div>
        ) : (
          <div className="space-y-4 text-sm relative z-10">
            <Row
              label="Manufacturer"
              value={intelligence.manufacturer?.value?.toUpperCase()}
              extra={confidenceBadge(intelligence.manufacturer?.confidence)}
            />
            <Row
              label="Brand"
              value={intelligence.brand?.value?.toUpperCase()}
              extra={
                <span className="bg-purple-50 text-purple-600 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <ShieldCheck size={10} /> {confidenceBadge(intelligence.brand?.confidence)}
                </span>
              }
            />
            <Row
              label="Category"
              value={classification?.fine || classification?.class || classification?.department}
              extra={confidenceBadge(classification?.confidence)}
            />
            {intelligence.content?.shortDescription && (
              <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                <span className="text-slate-500 font-medium text-xs uppercase block mb-1">Short Description</span>
                <span className="text-slate-800 text-sm">{intelligence.content.shortDescription}</span>
              </div>
            )}
            {attributes.length > 0 && (
              <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                <span className="text-slate-500 font-medium text-xs uppercase block mb-2">Attributes</span>
                <div className="space-y-1.5">
                  {attributes.map((attr, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-slate-500">{attr.label}</span>
                      <span className="font-semibold text-slate-800">
                        {attr.value} {attr.uom || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
