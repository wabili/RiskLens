import React from 'react';
import styles from './StockSidebar.module.css';

type RightSidebarProps = {
  stock: any;
};

// === FIELD DEFINITIONS (unchanged) ===
const financialPerformanceFields = [
  { label: 'Revenue Growth', key: 'revenueGrowth', format: 'percent' },
  { label: 'Revenue Per Share', key: 'revenuePerShare', format: 'usd' },
  { label: 'Gross Profits', key: 'grossProfits', format: 'usd' },
  { label: 'Gross Margins', key: 'grossMargins', format: 'percent' },
  { label: 'Profit Margins', key: 'profitMargins', format: 'percent' },
  { label: 'Net Income to Common', key: 'netIncomeToCommon', format: 'usd' },
  { label: 'EBITDA', key: 'ebitda', format: 'usd' },
  { label: 'Free Cashflow', key: 'freeCashflow', format: 'usd' },
  { label: 'Operating Cashflow', key: 'operatingCashflow', format: 'usd' },
  { label: 'Trailing EPS', key: 'trailingEps', format: 'number' },
];

const balanceSheetFields = [
  { label: 'Total Cash', key: 'totalCash', format: 'usd' },
  { label: 'Total Cash Per Share', key: 'totalCashPerShare', format: 'usd' },
  { label: 'Total Debt', key: 'totalDebt', format: 'usd' },
  { label: 'Debt to Equity', key: 'debtToEquity', format: 'number' },
  { label: 'Current Ratio', key: 'currentRatio', format: 'number' },
  { label: 'Quick Ratio', key: 'quickRatio', format: 'number' },
  { label: 'Return on Assets (ROA)', key: 'returnOnAssets', format: 'percent' },
  { label: 'Return on Equity (ROE)', key: 'returnOnEquity', format: 'percent' },
];

const marketCapFields = [
  { label: 'Market Cap', key: 'marketCap', format: 'usd' },
  { label: 'Enterprise Value', key: 'enterpriseValue', format: 'usd' },
  { label: 'Price to Book', key: 'priceToBook', format: 'number' },
  { label: 'Book Value', key: 'bookValue', format: 'usd' },
  { label: 'Enterprise/Revenue', key: 'enterpriseToRevenue', format: 'number' },
  { label: 'Enterprise/EBITDA', key: 'enterpriseToEbitda', format: 'number' },
];

const historicalPriceFields = [
  { label: '52 Week Low', key: 'fiftyTwoWeekLow', format: 'usd' },
  { label: '52 Week High', key: 'fiftyTwoWeekHigh', format: 'usd' },
  { label: 'All-Time Low', key: 'allTimeLow', format: 'usd' },
  { label: 'All-Time High', key: 'allTimeHigh', format: 'usd' },
  { label: '50 Day Avg', key: 'fiftyDayAverage', format: 'usd' },
  { label: '200 Day Avg', key: 'twoHundredDayAverage', format: 'usd' },
];

const dividendFields = [
  { label: 'Trailing Annual Dividend Rate', key: 'trailingAnnualDividendRate', format: 'usd' },
  { label: 'Last Split Factor', key: 'lastSplitFactor', format: 'string' },
  { label: 'Last Split Date', key: 'lastSplitDate', format: 'date' },
];

const riskFields = [{ label: 'Beta', key: 'beta', format: 'number' }];

const sharesFields = [
  { label: 'Shares Outstanding', key: 'sharesOutstanding', format: 'number' },
  { label: 'Float Shares', key: 'floatShares', format: 'number' },
  { label: 'Shares Short', key: 'sharesShort', format: 'number' },
  { label: 'Shares Short Prior Month', key: 'sharesShortPriorMonth', format: 'number' },
  { label: 'Short Ratio', key: 'shortRatio', format: 'number' },
  { label: 'Short % of Float', key: 'shortPercentOfFloat', format: 'percent' },
  { label: 'Shares % Shares Out', key: 'sharesPercentSharesOut', format: 'percent' },
  { label: 'Held % Insiders', key: 'heldPercentInsiders', format: 'percent' },
  { label: 'Held % Institutions', key: 'heldPercentInstitutions', format: 'percent' },
];

// === UTILITIES ===
function formatDate(value: any) {
  if (!value) return 'N/A';
  if (typeof value === 'number') {
    const d = new Date(value * 1000);
    return d.toLocaleDateString();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleDateString();
    return value;
  }
  return 'N/A';
}

function formatValue(value: any, format: string) {
  if (value == null || value === undefined || value === '') return 'N/A';
  if (format === 'usd') {
    if (typeof value !== 'number') return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  }
  if (format === 'number') {
    if (typeof value !== 'number') return 'N/A';
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (format === 'percent') {
    if (typeof value !== 'number') return 'N/A';
    return (value * 100).toFixed(2) + '%';
  }
  if (format === 'date') {
    return formatDate(value);
  }
  return String(value);
}

// === COLOR & SCORING LOGIC ===
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

  if (mode === 'rangeGood') {
    inGreen = value >= thresholds.green[0] && value <= thresholds.green[1];
    inOrange =
      (value >= thresholds.orange[0] && value <= thresholds.orange[1]) ||
      (value < thresholds.green[0] && value >= thresholds.orange[0]) ||
      (value > thresholds.green[1] && value <= thresholds.orange[1]);
  } else if (mode === 'highGood') {
    inGreen = value >= thresholds.green;
    inOrange = value >= thresholds.orange && value < thresholds.green;
  } else {
    // lowGood
    inGreen = value <= thresholds.green;
    inOrange = value > thresholds.green && value <= thresholds.orange;
  }

  if (inGreen) return { color: '#4ade80', score: 1 }; // green
  if (inOrange) return { color: '#f97316', score: 0 }; // orange
  return { color: '#ef4444', score: -1 }; // red
}

// === MAIN COMPONENT ===
export default function RightSidebar({ stock }: RightSidebarProps) {
  // Early exit if no stock
  if (!stock) {
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
          marginLeft: 24,
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxHeight: '100vh',
        }}
      >
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
          <div
            style={{
              color: '#aaa',
              fontSize: 14,
              textAlign: 'center',
              padding: '24px 12px',
            }}
          >
            Select a stock to view details.
          </div>
        </div>
      </div>
    );
  }

  // === EXTRACT VALUES ===
  const shortPct = stock.shortPercentOfFloat;
  const floatShares = stock.floatShares;
  const beta = stock.beta;
  const debtToEquity = stock.debtToEquity;
  const currentRatio = stock.currentRatio;
  const quickRatio = stock.quickRatio;
  const freeCashflow = stock.freeCashflow;
  const returnOnEquity = stock.returnOnEquity;
  const profitMargins = stock.profitMargins;

  // === COMPUTE SCORES ===
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

  // === STYLE HELPERS ===
  const labelStyle = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 200 as const,
    fontFamily: 'Roboto, Inter, "Helvetica Neue", Arial, sans-serif',
  };

  const valueStyle = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 100 as const,
    fontFamily: 'Roboto, Inter, "Helvetica Neue", Arial, sans-serif',
  };

  // === RENDER ===
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
        marginLeft: 24,
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100vh',
      }}
    >
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
        <div style={{ width: '90%', margin: '0 auto' }}>
          {/* === COMPOSITE SCORE BANNER === */}
          <div
            style={{
              textAlign: 'center',
              fontSize: 16,
              fontWeight: 'bold',
              padding: '12px 0',
              backgroundColor:
                totalScore >= 5 ? '#065f46' : totalScore <= -5 ? '#7f1d1d' : '#374151',
              color: 'white',
              margin: '0 12px 16px',
              borderRadius: 8,
            }}
          >
            Health Score: {totalScore} / 9
          </div>

          {/* Financial Performance */}
          <div style={{ fontWeight: 300, fontSize: 15, margin: '18px 0 8px 0', color: '#e5e7eb', letterSpacing: 0.2 }}>
            Financial Performance
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {financialPerformanceFields.map((field) => {
              let color = '#fff';
              if (field.key === 'freeCashflow') {
                color = getColorAndScore(freeCashflow, { green: 0, orange: 0, red: -1 }, 'highGood').color;
              } else if (field.key === 'profitMargins') {
                color = getColorAndScore(profitMargins, { green: 0.15, orange: 0.05, red: 0 }, 'highGood').color;
              }
              return (
                <div key={field.key} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <div style={{ flex: 1, fontSize: 13, color: '#bbb', ...labelStyle }}>{field.label}</div>
                  <div style={{ flex: 1, fontSize: 13, textAlign: 'right', color, ...valueStyle }}>
                    {formatValue(stock[field.key], field.format)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Balance Sheet & Ratios */}
          <div style={{ fontWeight: 300, fontSize: 15, margin: '18px 0 8px 0', color: '#e5e7eb', letterSpacing: 0.2 }}>
            Balance Sheet &amp; Ratios
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {balanceSheetFields.map((field) => {
              let color = '#fff';
              if (field.key === 'debtToEquity') {
                color = getColorAndScore(debtToEquity, { green: 0.5, orange: 1.0, red: 1.5 }, 'lowGood').color;
              } else if (field.key === 'currentRatio') {
                color = getColorAndScore(currentRatio, { green: 1.5, orange: 1.0, red: 0 }, 'highGood').color;
              } else if (field.key === 'quickRatio') {
                color = getColorAndScore(quickRatio, { green: 1.0, orange: 0.8, red: 0 }, 'highGood').color;
              } else if (field.key === 'returnOnEquity') {
                color = getColorAndScore(returnOnEquity, { green: 0.15, orange: 0.05, red: 0 }, 'highGood').color;
              }
              return (
                <div key={field.key} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <div style={{ flex: 1, fontSize: 13, color: '#bbb', ...labelStyle }}>{field.label}</div>
                  <div style={{ flex: 1, fontSize: 13, textAlign: 'right', color, ...valueStyle }}>
                    {formatValue(stock[field.key], field.format)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Market Capitalization */}
          <div style={{ fontWeight: 300, fontSize: 15, margin: '18px 0 8px 0', color: '#e5e7eb', letterSpacing: 0.2 }}>
            Market Capitalization
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {marketCapFields.map((field) => (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1, fontSize: 13, color: '#bbb', ...labelStyle }}>{field.label}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#fff', textAlign: 'right', ...valueStyle }}>
                  {formatValue(stock[field.key], field.format)}
                </div>
              </div>
            ))}
          </div>

          {/* Historical Price Levels */}
          <div style={{ fontWeight: 300, fontSize: 15, margin: '18px 0 8px 0', color: '#e5e7eb', letterSpacing: 0.2 }}>
            Historical Price Levels
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {historicalPriceFields.map((field) => (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1, fontSize: 13, color: '#bbb', ...labelStyle }}>{field.label}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#fff', textAlign: 'right', ...valueStyle }}>
                  {formatValue(stock[field.key], field.format)}
                </div>
              </div>
            ))}
          </div>

          {/* Dividends & Splits */}
          <div style={{ fontWeight: 300, fontSize: 15, margin: '18px 0 8px 0', color: '#e5e7eb', letterSpacing: 0.2 }}>
            Dividends &amp; Splits
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dividendFields.map((field) => (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1, fontSize: 13, color: '#bbb', ...labelStyle }}>{field.label}</div>
                <div style={{ flex: 1, fontSize: 13, color: '#fff', textAlign: 'right', ...valueStyle }}>
                  {formatValue(stock[field.key], field.format)}
                </div>
              </div>
            ))}
          </div>

          {/* Risk & Volatility */}
          <div style={{ fontWeight: 300, fontSize: 15, margin: '18px 0 8px 0', color: '#e5e7eb', letterSpacing: 0.2 }}>
            Risk &amp; Volatility
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {riskFields.map((field) => {
              let color = '#fff';
              if (field.key === 'beta') {
                color = getColorAndScore(beta, { green: [0.8, 1.2], orange: [0.5, 2.0] }, 'rangeGood').color;
              }
              return (
                <div key={field.key} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <div style={{ flex: 1, fontSize: 13, color: '#bbb', ...labelStyle }}>{field.label}</div>
                  <div style={{ flex: 1, fontSize: 13, textAlign: 'right', color, ...valueStyle }}>
                    {formatValue(stock[field.key], field.format)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shares & Ownership */}
          <div style={{ fontWeight: 300, fontSize: 15, margin: '18px 0 8px 0', color: '#e5e7eb', letterSpacing: 0.2 }}>
            Shares &amp; Ownership
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sharesFields.map((field) => {
              let color = '#fff';
              if (field.key === 'shortPercentOfFloat') {
                color = getColorAndScore(shortPct, { green: 0.05, orange: 0.15, red: 0.2 }, 'lowGood').color;
              } else if (field.key === 'floatShares') {
                color = getColorAndScore(floatShares, { green: 50e6, orange: 10e6, red: 0 }, 'highGood').color;
              }
              return (
                <div key={field.key} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <div style={{ flex: 1, fontSize: 13, color: '#bbb', ...labelStyle }}>{field.label}</div>
                  <div style={{ flex: 1, fontSize: 13, textAlign: 'right', color, ...valueStyle }}>
                    {formatValue(stock[field.key], field.format)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}