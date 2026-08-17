import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, Brain, LayoutDashboard, Package, ListChecks, Settings as SettingsIcon, UploadCloud } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900';

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full z-10">
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <div className="bg-gradient-to-br from-indigo-600 to-cyan-500 p-1.5 rounded-lg shadow-lg shadow-indigo-200"><Database size={20} className="text-white" /></div>
          Product<span className="text-indigo-600">IQ</span>
        </h1>
      </div>
      <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
        <Link to="/" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/')}`}><LayoutDashboard size={18} /> Dashboard</Link>
        <Link to="/products" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/products')}`}><Package size={18} /> Products</Link>
        <Link to="/upload" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/upload')}`}><UploadCloud size={18} /> Upload Data</Link>
        <Link to="/reviews" className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/reviews')}`}>
          <div className="flex items-center gap-3"><ListChecks size={18} /> Review Queue</div>
        </Link>
        <div className="mt-6 mb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">AI Engine</div>
        <Link to="/training" className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isActive('/training')}`}><Brain size={18} /> AI Training & Eval</Link>
      </nav>
      <div className="m-3 p-3 rounded-2xl bg-slate-900 text-slate-300">
        <p className="text-[10px] uppercase tracking-widest font-bold text-cyan-300">AI operations</p><p className="text-xs mt-1">Human-reviewed intelligence</p>
        <Link to="/settings" className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isActive('/settings')}`}><SettingsIcon size={18} /> Settings</Link>
      </div>
    </aside>
  );
}
