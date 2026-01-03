import os
import json
import time
import shutil
import requests
import pandas as pd

# === CONFIGURATION ===
USER_AGENT = "gh.wabil@gmail.com"  # Must be a real email
TICKERS_FILE = "company_tickers.json"
REQUEST_DELAY = 1.2  # seconds between requests (SEC allows ≤10/sec, but be conservative)

# === HELPER: Load or download company tickers ===
def _load_company_data():
    headers = {"User-Agent": USER_AGENT}
    if not os.path.exists(TICKERS_FILE):
        print("🌍 Downloading company_tickers.json from SEC.gov...")
        resp = requests.get("https://www.sec.gov/files/company_tickers.json", headers=headers)
        resp.raise_for_status()
        with open(TICKERS_FILE, "w") as f:
            json.dump(resp.json(), f)
        time.sleep(REQUEST_DELAY)

    with open(TICKERS_FILE, "r") as f:
        raw_data = json.load(f)
    df = pd.DataFrame.from_dict(raw_data, orient="index")
    df["cik_str"] = df["cik_str"].astype(str).str.zfill(10)
    return df

# Load once at module level (safe for API use if file I/O is local)
companyData = _load_company_data()

# === MAIN FUNCTION ===
def download_sec_filings(ticker_symbol: str, num_filings: int = 5, user_agent: str = USER_AGENT):
    """
    Downloads the N latest SEC filings (as plain-text .txt files) for a given ticker.
    Only the primary submission file is downloaded per filing to comply with SEC policy.

    Saves to: ./<TICKER>/1/<accession>.txt, ./<TICKER>/2/..., etc.

    Args:
        ticker_symbol (str): e.g., "AAPL"
        num_filings (int): Number of recent filings to download (default: 5)
        user_agent (str): Your contact email (required by SEC)

    Returns:
        str or None: Path to the main ticker directory if successful, else None
    """
    ticker_upper = ticker_symbol.upper()
    cik_row = companyData[companyData["ticker"] == ticker_upper]
    if cik_row.empty:
        print(f"❌ Ticker '{ticker_symbol}' not found in SEC company database.")
        return None

    cik = cik_row["cik_str"].iloc[0]
    ticker_dir = ticker_upper

    # Clean existing folder
    if os.path.exists(ticker_dir):
        shutil.rmtree(ticker_dir)
    os.makedirs(ticker_dir)
    print(f"📁 Created directory: {ticker_dir}")

    headers = {"User-Agent": user_agent}
    submissions_url = f"https://data.sec.gov/submissions/CIK{cik}.json"

    print(f"📥 Fetching submissions list from: {submissions_url}")
    time.sleep(REQUEST_DELAY)

    try:
        resp = requests.get(submissions_url, headers=headers)
        resp.raise_for_status()
        submissions = resp.json()
        recent = submissions["filings"]["recent"]
    except Exception as e:
        print(f"⚠️ Failed to fetch filings list for CIK {cik}: {e}")
        return None

    accession_numbers = recent.get("accessionNumber", [])
    form_types = recent.get("form", [])
    filing_dates = recent.get("filingDate", [])
    downloaded = 0

    for i in range(min(num_filings, len(accession_numbers))):
        acc_raw = accession_numbers[i]
        form = form_types[i]
        filing_date = filing_dates[i] if i < len(filing_dates) else "N/A"
        acc_clean = acc_raw.replace("-", "")

        # Skip non-10-K/Q if desired (optional)
        # if form not in ["10-K", "10-Q"]:
        #     continue

        filing_dir = os.path.join(ticker_dir, str(i + 1))
        os.makedirs(filing_dir, exist_ok=True)
        filename = f"{acc_raw}.txt"
        file_path = os.path.join(filing_dir, filename)

        # Save metadata (filing date and form type)
        metadata = {
            "filing_date": filing_date,
            "form_type": form,
            "accession_number": acc_raw
        }
        with open(os.path.join(filing_dir, "metadata.json"), "w") as mf:
            json.dump(metadata, mf)

        # Construct correct URL
        file_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_clean}/{acc_raw}.txt"

        print(f"📄 Downloading {form} filing ({i+1}/{num_filings}): {file_url}")

        success = False
        for attempt in range(3):
            try:
                time.sleep(REQUEST_DELAY)
                r = requests.get(file_url, headers=headers)
                if r.status_code == 503:
                    wait = 2 ** attempt  # exponential backoff: 1s, 2s, 4s
                    print(f"   ⚠️ 503 error. Retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                r.raise_for_status()
                with open(file_path, "wb") as f:
                    f.write(r.content)
                success = True
                downloaded += 1
                break
            except Exception as e:
                print(f"   ❌ Attempt {attempt + 1} failed: {e}")
                time.sleep(2 ** attempt)

        if not success:
            print(f"   ❌ Failed to download after 3 attempts.")

    print(f"\n✅ Successfully downloaded {downloaded} filings to ./{ticker_dir}/")
    return os.path.abspath(ticker_dir)