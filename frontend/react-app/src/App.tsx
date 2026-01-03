// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import FilingGraph from './components/FilingGraph';
import StockSidebar from './components/StockSidebar';
import RightSidebar from './components/RightSidebar';

export default function App() {
  const [ticker, setTicker] = useState('HCTI');
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const [limit, setLimit] = useState(10);
  const [windowDays, setWindowDays] = useState(100);
  const [includeRaw, setIncludeRaw] = useState(false);
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickerInputRef = useRef<HTMLInputElement>(null);

  // Focus ticker input on mount
  useEffect(() => {
    tickerInputRef.current?.focus();
  }, []);

  // Legend for event_nature (border colors)
  const eventNatureLegend = [
    { name: 'Event Nature: Single', color: '#22c55e' },   // green border
    { name: 'Event Nature: Process', color: '#a21caf' }, // purple border
  ];

  const analyze = async () => {
    setError(null);
    setLoading(true);
    setResults([]);
    const params = new URLSearchParams({
      ticker: ticker.trim().toUpperCase(),
      limit: limit.toString(),
      window_days: windowDays.toString(),
      include_raw: includeRaw.toString(),
    });
    try {
      const response = await fetch(`/analyze?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }
      const data = await response.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 flex flex-col" style={{ minHeight: 0 }}>
        <div className="flex flex-col lg:flex-row gap-6 flex-1" style={{ minHeight: 0 }}>
          {/* Left Sidebar */}
          <div className="flex flex-col" style={{ flex: '0 0 220px', minWidth: 180, maxWidth: 260 }}>
            <StockSidebar setTicker={setTicker} setSelectedStock={setSelectedStock} />
          </div>

          {/* Main Panel */}
          <div className="flex flex-col flex-1" style={{ minHeight: 0 }}>
            {/* ...existing code... */}
            <div className="text-center mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">SEC Scanner</h1>
              <p className="text-gray-400 text-sm">Systematic Risk Visualization</p>
            </div>
            {/* Controls (form) always visible */}
            <div
              className="bg-[#18181b] rounded-lg shadow p-3 mb-6 flex flex-wrap items-end gap-3 justify-center border border-gray-800"
              style={{ maxWidth: 700, margin: '0 auto' }}
            >
              <div className="flex flex-col" style={{ minWidth: 120 }}>
                <label className="block text-xs font-medium text-gray-400 mb-1">Ticker</label>
                <input
                  ref={tickerInputRef}
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="px-3 py-1.5 border border-gray-700 bg-black text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder-gray-500 w-full"
                  placeholder="e.g. AAPL"
                />
              </div>
              <div className="flex flex-col" style={{ minWidth: 120 }}>
                <label className="block text-xs font-medium text-gray-400 mb-1">Filings Limit</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={limit}
                  onChange={(e) => setLimit(Math.min(50, Math.max(1, Number(e.target.value))))}
                  className="px-3 py-1.5 border border-gray-700 bg-black text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder-gray-500 w-full"
                />
              </div>
              <div className="flex flex-col" style={{ minWidth: 120 }}>
                <label className="block text-xs font-medium text-gray-400 mb-1">Date Window</label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={windowDays}
                  onChange={(e) => setWindowDays(Math.min(3650, Math.max(1, Number(e.target.value))))}
                  className="px-3 py-1.5 border border-gray-700 bg-black text-white rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm placeholder-gray-500 w-full"
                />
              </div>
              <div className="flex flex-row items-center gap-2" style={{ minWidth: 100, marginTop: 18 }}>
                <input
                  id="include-raw"
                  type="checkbox"
                  checked={includeRaw}
                  onChange={(e) => setIncludeRaw(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-700 bg-black focus:ring-blue-500"
                />
                <label htmlFor="include-raw" className="block text-xs text-gray-400 cursor-pointer select-none">
                  Raw
                </label>
              </div>
              <button
                onClick={analyze}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-75 transition-colors text-sm shadow"
                style={{ minWidth: 120, marginTop: 2 }}
              >
                {loading ? 'Analyzing...' : 'Analyze Filings'}
              </button>
            </div>
            {/* Error message */}
            {error && (
              <div className="bg-red-900 border-l-4 border-red-500 p-4 mb-6 rounded max-w-2xl mx-auto w-full">
                <p className="text-red-100">{error}</p>
              </div>
            )}
            {/* Graph or empty message */}
            {results.length > 0 ? (
              <div className="bg-gray-900 rounded-lg p-2 flex-1 relative overflow-hidden" style={{ minHeight: 0, height: '100%', marginTop: 12 }}>
                <FilingGraph filing={results} ticker={ticker} />
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg flex-1 flex flex-col items-center justify-start" style={{ minHeight: 220, marginTop: 12, paddingTop: 48 }}>
                <div style={{
                  fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
                  fontWeight: 600,
                  fontSize: 24,
                  color: '#4ade80', // Tailwind emerald-400
                  marginBottom: 12,
                  letterSpacing: 0.2,
                  textAlign: 'center',
                  textShadow: '0 2px 8px rgba(76,222,128,0.12)'
                }}>
                  Great news! 🎉
                </div>
                <div style={{
                  fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
                  fontWeight: 400,
                  fontSize: 18,
                  color: '#e5e7eb',
                  textAlign: 'center',
                  maxWidth: 520,
                  lineHeight: 1.5
                }}>
                  No concerning keywords were found in the most recent {limit} filings for ticker <span style={{ color: '#60a5fa', fontWeight: 500 }}>{ticker}</span>.<br />Everything looks clean and positive!
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="flex flex-col" style={{ flex: '0 0 220px', minWidth: 180, maxWidth: 260 }}>
            <RightSidebar stock={selectedStock} />
          </div>
        </div>
      </div>

      {/* Footer Legend */}
      <footer className="bg-gray-900 text-gray-300 text-xs py-2.5 px-4 border-t border-gray-800">
        <div className="flex flex-wrap justify-center gap-4">
          {eventNatureLegend.map((item) => (
            <span key={item.name} className="flex items-center gap-1.5">
              {/* Border legend: show as a small bordered rectangle */}
              <span
                style={{
                  display: 'inline-block',
                  width: 20,
                  height: 12,
                  background: 'transparent',
                  border: `2px solid ${item.color}`,
                  borderRadius: 2,
                }}
              />
              <span>{item.name}</span>
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}