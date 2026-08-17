import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { api, getBrowserSessionId } from './api';

// Load each workspace only when it is opened. This keeps the first dashboard
// paint fast and moves the charting library out of the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TrainingCenter = lazy(() => import('./pages/TrainingCenter'));
const Products = lazy(() => import('./pages/Products'));
const Upload = lazy(() => import('./pages/Upload'));
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  useEffect(() => {
    const sessionId = getBrowserSessionId();
    const sendHeartbeat = () => api.post('/api/processing/heartbeat', { sessionId }).catch(() => {});
    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 10000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 lg:flex">
        <Sidebar />
        <div className="min-w-0 flex-1 overflow-y-auto">
          <Suspense fallback={<div className="min-h-full grid place-items-center text-sm font-semibold text-slate-400">Loading workspace…</div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/reviews" element={<ReviewQueue />} />
              <Route path="/training" element={<TrainingCenter />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </Router>
  );
}
