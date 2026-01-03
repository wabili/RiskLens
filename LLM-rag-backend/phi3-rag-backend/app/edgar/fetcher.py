import os
import requests
from typing import List, Dict, Optional

USER_AGENT = os.getenv("EDGAR_USER_AGENT", "sec-scanner/0.1 (contact: dev@example.com)")


def get_submissions_json(cik: str) -> Optional[Dict]:
    """Fetch the company submissions JSON from SEC data API for a CIK (no 'CIK' prefix)."""
    url = f"https://data.sec.gov/submissions/CIK{cik.zfill(10)}.json"
    headers = {"User-Agent": USER_AGENT}
    resp = requests.get(url, headers=headers, timeout=30)
    if resp.status_code != 200:
        return None
    return resp.json()


def list_recent_filings(cik: str, form_type_filter: List[str] = None, limit: int = 5) -> List[Dict]:
    """Return a list of recent filings with accession and primaryDocument fields.

    Each entry is: {"accessionNumber": ..., "primaryDocument": ..., "reportDate": ..., "form": ...}
    """
    data = get_submissions_json(cik)
    if not data:
        return []
    filings = []
    recent = data.get("filings", {}).get("recent", {})
    accession_list = recent.get("accessionNumber", [])
    primary_docs = recent.get("primaryDocument", [])
    forms = recent.get("form", [])
    report_dates = recent.get("reportDate", [])
    for i, acc in enumerate(accession_list[:limit]):
        form = forms[i] if i < len(forms) else ""
        if form_type_filter and form not in form_type_filter:
            continue
        filings.append({
            "accessionNumber": acc,
            "primaryDocument": primary_docs[i] if i < len(primary_docs) else None,
            "form": form,
            "reportDate": report_dates[i] if i < len(report_dates) else None,
        })
    return filings


def build_document_url(cik: str, accession: str, primary_doc: str) -> Optional[str]:
    """Construct a URL to the primary document under Archives.

    accession param may contain dashes; we need the no-dash form in the path.
    """
    if not primary_doc:
        return None
    cik_nz = str(int(cik))
    acc_no_dash = accession.replace('-', '')
    return f"https://www.sec.gov/Archives/edgar/data/{cik_nz}/{acc_no_dash}/{primary_doc}"


def download_document(url: str, dest_path: str) -> bool:
    headers = {"User-Agent": USER_AGENT}
    try:
        r = requests.get(url, headers=headers, timeout=30)
        if r.status_code == 200:
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with open(dest_path, "wb") as f:
                f.write(r.content)
            return True
    except Exception:
        pass
    return False
