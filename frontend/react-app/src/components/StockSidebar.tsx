import React, { useRef, useState, useEffect } from 'react';
import styles from './StockSidebar.module.css';

type StockSidebarProps = {
  setTicker: (ticker: string) => void;
  setSelectedStock: (stock: any) => void;
};

export default function StockSidebar({ setTicker, setSelectedStock }: StockSidebarProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  // Sorting state
  const [sortBy, setSortBy] = useState<'symbol' | 'price'>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  // Load stocks from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('stockInfoData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setStocks(parsed);
      } catch {}
    }
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setResult(null);
    const formData = new FormData();
    formData.append('csv_file', file);
    try {
      const res = await fetch('/stock-info', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setResult(data);
      if (data && data.symbols && data.data) {
        const newStocks = data.symbols.map((symbol: string) => {
          const info = data.data[symbol] || {};
          // Attach ticker and name for UI, but keep all backend fields
          return {
            ticker: symbol,
            name: info.shortName || info.longName || symbol,
            price: typeof info.regularMarketPrice === 'number' ? info.regularMarketPrice : null,
            ...info,
          };
        });
        setStocks(newStocks);
        localStorage.setItem('stockInfoData', JSON.stringify(newStocks));
      }
    } catch (err) {
      setResult({ error: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  // Sorting logic
  const sortedStocks = [...stocks].sort((a, b) => {
    if (sortBy === 'symbol') {
      if (sortOrder === 'asc') return a.ticker.localeCompare(b.ticker);
      else return b.ticker.localeCompare(a.ticker);
    } else if (sortBy === 'price') {
      if (typeof a.price !== 'number') return 1;
      if (typeof b.price !== 'number') return -1;
      if (sortOrder === 'asc') return a.price - b.price;
      else return b.price - a.price;
    }
    return 0;
  });

  return (
    <div
      style={{
        width: 210,
        minWidth: 180,
        background: '#232b36',
        border: '1px solid #232b36',
        boxShadow: '0 4px 32px #0001, 0 2px 16px #0002',
        color: '#fff',
        borderRadius: 18,
        marginRight: 24,
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        height: '100%',
        maxHeight: '100vh',
      }}
    >
      <button
        style={{
          width: '90%',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '10px 0',
          fontWeight: 600,
          fontSize: 15,
          marginBottom: 10,
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.7 : 1,
        }}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload CSV'}
      </button>
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {/* Sorting controls */}
      <div style={{ width: '90%', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: 0.3, fontFamily: 'Inter, Segoe UI, Arial, sans-serif', color: '#e5e7eb', opacity: 0.92 }}>Stocks</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '2px 6px', boxShadow: '0 1px 4px #0001' }}>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'symbol' | 'price')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#d1d5db',
              border: '1px solid #374151',
              borderRadius: 6,
              fontSize: 13,
              padding: '2px 8px',
              fontWeight: 400,
              outline: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
              boxShadow: 'none',
              transition: 'border 0.15s, background 0.15s',
              minWidth: 56,
            }}
          >
            <option value="symbol">A-Z</option>
            <option value="price">Price</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              background: 'none',
              border: 'none',
              color: '#93c5fd',
              fontSize: 16,
              cursor: 'pointer',
              padding: '0 2px',
              marginLeft: 0,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              transition: 'background 0.15s, color 0.15s',
              opacity: 0.85,
            }}
            aria-label="Toggle sort order"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.08)')}
            onMouseOut={e => (e.currentTarget.style.background = 'none')}
          >
            {sortOrder === 'asc' ? (
              <span style={{ fontSize: 15, lineHeight: 1, display: 'inline-block', transform: 'translateY(1px)' }}>▲</span>
            ) : (
              <span style={{ fontSize: 15, lineHeight: 1, display: 'inline-block', transform: 'translateY(1px)' }}>▼</span>
            )}
          </button>
        </div>
      </div>
      {sortedStocks.length === 0 && (
        <div style={{ color: '#aaa', fontSize: 14 }}>No stocks to display.</div>
      )}
      <div
        className={styles['custom-scrollbar']}
        style={{
          width: '100%',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          background: '#232b36',
        }}
      >
        {sortedStocks.map((stock) => {
          // Calculate price change and color
          let change = null;
          let changeColor = '#bbb';
          if (typeof stock.price === 'number' && typeof stock.previousClose === 'number') {
            change = stock.price - stock.previousClose;
            changeColor = change > 0 ? '#6ee7b7' : change < 0 ? '#f87171' : '#bbb';
          }

          // === Health Score Calculation (copied from RightSidebar) ===
          function getColorAndScore(
            value: number | null | undefined,
            thresholds: any,
            mode: 'lowGood' | 'highGood' | 'rangeGood' = 'lowGood'
          ): { color: string; score: number } {
            if (value == null || typeof value !== 'number') {
              return { color: '#bbb', score: 0 };
            }
            let inGreen = false;
            let inOrange = false;
            if (mode === 'lowGood') {
              inGreen = value <= thresholds.green;
              inOrange = value > thresholds.green && value <= thresholds.orange;
            } else if (mode === 'highGood') {
              inGreen = value >= thresholds.green;
              inOrange = value < thresholds.green && value >= thresholds.orange;
            } else if (mode === 'rangeGood') {
              inGreen = value >= thresholds.green[0] && value <= thresholds.green[1];
              inOrange = value >= thresholds.orange[0] && value <= thresholds.orange[1] && !inGreen;
            }
            if (inGreen) return { color: '#4ade80', score: 1 };
            if (inOrange) return { color: '#f97316', score: 0 };
            return { color: '#ef4444', score: -1 };
          }

          const shortPct = stock.shortPercentOfFloat;
          const floatShares = stock.floatShares;
          const beta = stock.beta;
          const debtToEquity = stock.debtToEquity;
          const currentRatio = stock.currentRatio;
          const quickRatio = stock.quickRatio;
          const freeCashflow = stock.freeCashflow;
          const returnOnEquity = stock.returnOnEquity;
          const profitMargins = stock.profitMargins;

          const s1 = getColorAndScore(shortPct, { green: 0.05, orange: 0.15, red: 0.2 }, 'lowGood').score;
          const s2 = getColorAndScore(floatShares, { green: 50e6, orange: 10e6, red: 0 }, 'highGood').score;
          const s3 = getColorAndScore(beta, { green: [0.8, 1.2], orange: [0.5, 2.0] }, 'rangeGood').score;
          const s4 = getColorAndScore(debtToEquity, { green: 0.5, orange: 1.0, red: 1.5 }, 'lowGood').score;
          const s5 = getColorAndScore(currentRatio, { green: 1.5, orange: 1.0, red: 0 }, 'highGood').score;
          const s6 = getColorAndScore(quickRatio, { green: 1.0, orange: 0.8, red: 0 }, 'highGood').score;
          const s7 = getColorAndScore(freeCashflow, { green: 0, orange: 0, red: -1 }, 'highGood').score;
          const s8 = getColorAndScore(returnOnEquity, { green: 0.15, orange: 0.05, red: 0 }, 'highGood').score;
          const s9 = getColorAndScore(profitMargins, { green: 0.15, orange: 0.05, red: 0 }, 'highGood').score;
          const totalScore = s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8 + s9;

          let bgColor = '#232b36';
          if (totalScore >= 5) {
            bgColor = 'rgba(34,197,94,0.13)'; // light green
          } else if (totalScore <= -5) {
            bgColor = 'rgba(239,68,68,0.13)'; // light red
          }
          const isSelected = stock.ticker === selectedTicker;
          return (
            <div
              key={stock.ticker}
              style={{
                width: '90%',
                background: isSelected ? 'rgba(59, 130, 246, 0.2)' : bgColor, // Blue highlight for selected
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 6px #0001',
                border: isSelected ? '2px solid #3b82f6' : 'none',
                borderBottom: '1px solid #2d3238', // Always have bottom border
                transition: 'background 0.18s, box-shadow 0.18s',
                cursor: 'pointer',
                borderRadius: isSelected ? 8 : 0, // Rounded corners for selected
              }}
              onMouseOver={e => (e.currentTarget.style.background = isSelected ? 'rgba(59, 130, 246, 0.3)' : (totalScore >= 5 ? 'rgba(34,197,94,0.18)' : '#2d3238'))}
              onMouseOut={e => (e.currentTarget.style.background = isSelected ? 'rgba(59, 130, 246, 0.2)' : bgColor)}
              onClick={() => {
                setTicker(stock.ticker);
                setSelectedStock(stock);
                setSelectedTicker(stock.ticker);
              }}
            >
              {/* Left: name and symbol */}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 400, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stock.name}</div>
                <div style={{ fontSize: 13, color: '#bbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stock.ticker}</div>
              </div>
              {/* Right: price and change */}
              <div style={{ textAlign: 'right', marginLeft: 12 }}>
                {typeof stock.price === 'number' ? (
                  <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>${stock.price.toFixed(2)}</div>
                ) : (
                  <div style={{ fontSize: 14, color: '#f87171' }}>Price N/A</div>
                )}
                {typeof stock.price === 'number' && typeof stock.previousClose === 'number' ? (
                  <div style={{ fontSize: 13, color: changeColor }}>
                    {change > 0 ? '+' : ''}{change?.toFixed(2)}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}