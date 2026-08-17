import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, Brain, LayoutDashboard, Package, ListChecks, Settings as SettingsIcon, UploadCloud, Menu, X } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isActive = (path) => location.pathname === path ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900';
  const close = () => setOpen(false);
  const navLink = (path, icon, label) => <Link to={path} onClick={close} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${isActive(path)}`}>{icon}{label}</Link>;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link to="/" className="text-lg font-black tracking-tight flex items-center gap-2"><span className="bg-gradient-to-br from-indigo-600 to-cyan-500 p-1.5 rounded-lg"><Database size={17} className="text-white" /></span>Product<span className="text-indigo-600">IQ</span></Link>
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-700" aria-label="Open navigation"><Menu size={22} /></button>
      </header>
      {open && <button aria-label="Close navigation" onClick={close} className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <div className="bg-gradient-to-br from-indigo-600 to-cyan-500 p-1.5 rounded-lg shadow-lg shadow-indigo-200"><Database size={20} className="text-white" /></div>
          Product<span className="text-indigo-600">IQ</span>
        </h1><button onClick={close} className="p-2 text-slate-500 lg:hidden" aria-label="Close navigation"><X size={20} /></button></div>
      </div>
      <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
        {navLink('/', <LayoutDashboard size={18} />, 'Dashboard')}
        {navLink('/products', <Package size={18} />, 'Products')}
        {navLink('/upload', <UploadCloud size={18} />, 'Upload Data')}
        {navLink('/reviews', <ListChecks size={18} />, 'Review Queue')}
        <div className="mt-6 mb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">AI Engine</div>
        {navLink('/training', <Brain size={18} />, 'AI Training & Eval')}
      </nav>
      <div className="m-3 p-3 rounded-2xl bg-slate-900 text-slate-300">
        <p className="text-[10px] uppercase tracking-widest font-bold text-cyan-300">AI operations</p><p className="text-xs mt-1">Human-reviewed intelligence</p>
        <Link to="/settings" onClick={close} className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isActive('/settings')}`}><SettingsIcon size={18} /> Settings</Link>
      </div>
    </aside>
    </>
  );
}
