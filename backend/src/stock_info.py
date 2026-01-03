import yfinance as yf
import pandas as pd
from typing import List, Dict

def get_symbols_from_csv(csv_path: str) -> List[str]:
    df = pd.read_csv(csv_path)
    # Try to find a column with symbol/ticker
    for col in df.columns:
        if col.lower() in ('symbol', 'ticker', 'stock', 'stock_symbol', 'stock_ticker'):
            return df[col].dropna().astype(str).unique().tolist()
    # Fallback: use first column
    return df.iloc[:, 0].dropna().astype(str).unique().tolist()

def fetch_yfinance_data(symbols: List[str]) -> Dict[str, dict]:
    data = {}
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            data[symbol] = info
        except Exception as e:
            data[symbol] = {'error': str(e)}
    return data
