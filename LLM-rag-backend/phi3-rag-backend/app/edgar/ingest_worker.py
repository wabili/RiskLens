import os
import time
import json
import threading
import requests
from typing import List

from .fetcher import list_recent_filings, build_document_url, download_document

EDGAR_CIKS = os.getenv("EDGAR_CIKS", "0000320193,0000789019")
POLL_INTERVAL = int(os.getenv("EDGAR_POLL_INTERVAL", "300"))
PROCESSED_FILE = os.getenv("EDGAR_PROCESSED_FILE", "data/edgar_processed.json")
INGEST_ENDPOINT = os.getenv("LOCAL_INGEST_URL", "http://127.0.0.1:8000/ingest")
USER_AGENT = os.getenv("EDGAR_USER_AGENT", "sec-scanner/0.1 (contact: dev@example.com)")


def _load_processed():
    if os.path.exists(PROCESSED_FILE):
        try:
            return set(json.load(open(PROCESSED_FILE)))
        except Exception:
            return set()
    return set()


def _save_processed(s):
    os.makedirs(os.path.dirname(PROCESSED_FILE) or '.', exist_ok=True)
    with open(PROCESSED_FILE, 'w') as f:
        json.dump(list(s), f)


def _post_file_to_ingest(file_path: str) -> bool:
    try:
        with open(file_path, 'rb') as fh:
            # re-read env var at call time so runtime overrides take effect
            endpoint = os.getenv("LOCAL_INGEST_URL", INGEST_ENDPOINT)
            # send as a list to ensure multipart formfield is repeated correctly
            files = [("files", (os.path.basename(file_path), fh))]
            headers = {"User-Agent": USER_AGENT}
            resp = requests.post(endpoint, files=files, headers=headers, timeout=60)
            if resp.status_code != 200:
                try:
                    body = resp.text
                except Exception:
                    body = "<no-body>"
                print(f"[edgar.ingest_worker] POST to {endpoint} failed: {resp.status_code} {body}")
            return resp.status_code == 200
    except Exception:
        return False


def process_once(ciks: List[str]):
    processed = _load_processed()
    new_processed = False
    for cik in ciks:
        filings = list_recent_filings(cik, limit=10)
        for f in filings:
            acc = f.get('accessionNumber')
            if not acc or acc in processed:
                continue
            doc = f.get('primaryDocument')
            url = build_document_url(cik, acc, doc)
            if not url:
                processed.add(acc)
                new_processed = True
                continue
            dest = os.path.join('data', 'edgar', cik, acc.replace('-', ''), doc)
            ok = download_document(url, dest)
            if ok:
                posted = _post_file_to_ingest(dest)
                if posted:
                    processed.add(acc)
                    new_processed = True
    if new_processed:
        _save_processed(processed)


def run_loop():
    ciks = [c.strip() for c in EDGAR_CIKS.split(',') if c.strip()]
    while True:
        try:
            process_once(ciks)
        except Exception:
            pass
        time.sleep(POLL_INTERVAL)


def start_worker_in_thread():
    t = threading.Thread(target=run_loop, daemon=True, name='edgar-ingest-worker')
    t.start()
    return t
