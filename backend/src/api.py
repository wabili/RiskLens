from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import tempfile
from pathlib import Path
from datetime import datetime, timedelta
import traceback
import requests
import re

# Local modules (assumed to exist)
from .stock_info import get_symbols_from_csv, fetch_yfinance_data
from .event_detector import EventDetector
from .sec_data_fetcher import download_sec_filings
from .text_processor import process_filing_file
from .risk_analyzer import find_dangerous_sentences

# ✅ Create the FastAPI app ONCE
app = FastAPI(
    title="SEC Risk Analyzer API",
    description="Analyze SEC filings for high-risk or 'dangerous' sentences.",
    version="1.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoints ---

@app.post("/stock-info")
async def stock_info(csv_file: UploadFile = File(...)):
    """Upload a CSV file, extract stock symbols, fetch yfinance info, and return as JSON."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
        contents = await csv_file.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        symbols = get_symbols_from_csv(tmp_path)
        if not symbols:
            raise HTTPException(status_code=400, detail="No stock symbols found in CSV.")
        data = fetch_yfinance_data(symbols)
        return {"symbols": symbols, "data": data}
    finally:
        os.unlink(tmp_path)  # safer than os.remove in some edge cases


@app.get("/analyze")
def analyze_ticker(
    ticker: str = Query(..., min_length=1, max_length=10),
    limit: int = Query(1, ge=1, le=50),
    window_days: int = Query(365, ge=1, le=3650),
    include_raw: bool = Query(False),
):
    ticker = ticker.strip().upper()
    if not ticker.isalpha():
        raise HTTPException(status_code=400, detail="Ticker must contain only letters.")

    limit = min(limit, 50)

    with tempfile.TemporaryDirectory() as temp_dir:
        original_cwd = os.getcwd()
        try:
            os.chdir(temp_dir)
            folder = download_sec_filings(ticker, num_filings=limit)
            if not folder:
                raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found.")

            try:
                detector = EventDetector()
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Event detector init error: {e}")

            all_dangerous = []
            filings_analyzed = 0
            all_txt_paths = []

            for i in range(1, limit + 1):
                filing_dir = Path(folder) / str(i)
                if not filing_dir.exists():
                    break

                txt_files = list(filing_dir.glob("*.txt"))
                if not txt_files:
                    continue

                try:
                    filings_analyzed += 1
                    filing_path = txt_files[0]
                    full_text = process_filing_file(str(filing_path))
                    # Create a processed text file
                    processed_path = os.path.join(temp_dir, f"processed_{i}.txt")
                    with open(processed_path, 'w', encoding='utf-8') as pf:
                        pf.write(full_text)
                    all_txt_paths.append(processed_path)
                    dangerous = find_dangerous_sentences(full_text)
                    detected_events = detector.detect_events(full_text)
                except Exception as e:
                    print(f"Error processing filing {i}: {e}")
                    print(traceback.format_exc())
                    all_dangerous.append({"filing_number": i, "error": str(e)})
                    continue

                # Load metadata
                metadata_path = filing_dir / "metadata.json"
                filing_date = "N/A"
                form_type = "N/A"
                days_ago = None
                if metadata_path.exists():
                    import json
                    with open(metadata_path, "r") as mf:
                        metadata = json.load(mf)
                        filing_date = metadata.get("filing_date", "N/A")
                        form_type = metadata.get("form_type", "N/A")
                        if filing_date != "N/A":
                            try:
                                filing_dt = datetime.strptime(filing_date, "%Y-%m-%d").date()
                                today = datetime.now().date()
                                days_ago = (today - filing_dt).days
                            except ValueError:
                                days_ago = None

                # Enrich events
                enriched_events = []
                if detected_events:
                    for ev in detected_events:
                        ev_copy = ev.copy()
                        match_span = ev_copy.get('match_span')
                        event_start = None

                        if match_span and isinstance(match_span, (list, tuple)):
                            try:
                                parsed = _parse_date_nearest_to_span(full_text, match_span, filing_date, window_days)
                                if parsed:
                                    event_start = parsed
                            except Exception:
                                pass

                        if not event_start and filing_date != "N/A":
                            try:
                                event_start = datetime.strptime(filing_date, "%Y-%m-%d").date()
                            except Exception:
                                pass

                        ev_copy['event_started_on'] = None
                        ev_copy['event_ends_on'] = None
                        ev_copy['days_remaining'] = None
                        ev_copy['time_relation'] = 'unknown'

                        if event_start is not None:
                            try:
                                T_star = int(ev_copy.get('T_star_days', 0))
                                end_dt = event_start + timedelta(days=T_star)
                                ev_copy['event_started_on'] = event_start.isoformat()
                                ev_copy['event_ends_on'] = end_dt.isoformat()
                                ev_copy['days_remaining'] = (end_dt - datetime.now().date()).days

                                today = datetime.now().date()
                                if end_dt < today:
                                    ev_copy['time_relation'] = 'past'
                                elif event_start > today:
                                    ev_copy['time_relation'] = 'future'
                                else:
                                    ev_copy['time_relation'] = 'ongoing'
                            except Exception:
                                pass

                        try:
                            ev_copy['trigger_sentence'] = _get_sentence_for_span(full_text, match_span)
                        except Exception:
                            ev_copy['trigger_sentence'] = None

                        enriched_events.append(ev_copy)

                # Group events by type
                grouped = {}
                for ev in enriched_events:
                    et = ev.get('event_type')
                    if not et:
                        continue
                    if et not in grouped:
                        grouped[et] = {
                            'event_type': et,
                            'event_nature': ev.get('event_nature'),
                            'likely_triggers': list(dict.fromkeys(ev.get('likely_triggers') or [])),
                            'description': ev.get('description'),
                            'confidence_interval': ev.get('confidence_interval'),
                            'count': 0,
                            'subevents': []
                        }
                    g = grouped[et]
                    span = tuple(ev.get('match_span') or [])
                    existing_spans = {tuple(s.get('match_span') or []) for s in g['subevents']}
                    if span in existing_spans:
                        continue
                    g['subevents'].append(ev)
                    g['count'] += 1
                    for lt in ev.get('likely_triggers') or []:
                        if lt not in g['likely_triggers']:
                            g['likely_triggers'].append(lt)

                grouped_list = []
                for et, g in grouped.items():
                    if not g['subevents']:
                        continue
                    subs = g['subevents']
                    subs_sorted = sorted(
                        subs,
                        key=lambda s: (0 if s.get('pattern_source') == 'regex' else 1, -len(s.get('match_text') or ''))
                    )
                    rep = subs_sorted[0]
                    g['representative_match'] = rep.get('match_text')
                    g['T_star_days'] = rep.get('T_star_days')

                    starts = [s.get('event_started_on') for s in subs if s.get('event_started_on')]
                    ends = [s.get('event_ends_on') for s in subs if s.get('event_ends_on')]

                    try:
                        start_dates = [datetime.fromisoformat(x).date() for x in starts]
                        end_dates = [datetime.fromisoformat(x).date() for x in ends]
                        g['event_started_on'] = min(start_dates).isoformat() if start_dates else None
                        g['event_ends_on'] = max(end_dates).isoformat() if end_dates else None
                        if g['event_ends_on']:
                            g['days_remaining'] = (
                                datetime.fromisoformat(g['event_ends_on']).date() - datetime.now().date()
                            ).days

                        relations = [s.get('time_relation') for s in subs if s.get('time_relation')]
                        if any(r == 'future' for r in relations):
                            g['time_relation'] = 'future'
                        elif any(r == 'ongoing' for r in relations):
                            g['time_relation'] = 'ongoing'
                        elif relations and all(r == 'past' for r in relations):
                            g['time_relation'] = 'past'
                        else:
                            g['time_relation'] = 'unknown'
                    except Exception:
                        g['event_started_on'] = None
                        g['event_ends_on'] = None
                        g['days_remaining'] = None
                        g['time_relation'] = 'unknown'

                    grouped_list.append(g)

                if dangerous or grouped_list:
                    result_entry = {
                        "filing_number": i,
                        "filing_date": filing_date,
                        "form_type": form_type,
                        "sentences": dangerous,
                        "detected_event_categories": grouped_list,
                    }
                    if days_ago is not None:
                        result_entry["days_ago"] = days_ago
                    if include_raw:
                        result_entry["detected_events"] = enriched_events
                    all_dangerous.append(result_entry)

            result = {
                "ticker": ticker,
                "filings_analyzed": filings_analyzed,
                "results": all_dangerous
            }

            # Upload the downloaded filings to the Phi-3 RAG backend
            if all_txt_paths:
                try:
                    files = [("files", open(path, "rb")) for path in all_txt_paths]
                    resp = requests.post("http://127.0.0.1:8010/ingest", files=files, timeout=30)
                    for _, f in files:
                        f.close()
                    if resp.status_code != 200:
                        print(f"Failed to upload to phi3: {resp.status_code} {resp.text}")
                except Exception as e:
                    print(f"Error uploading to phi3: {e}")

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
        finally:
            os.chdir(original_cwd)

    return result


# --- Helper Functions (moved below for clarity) ---

def _parse_date_from_text(text: str):
    if not text:
        return None
    # ISO yyyy-mm-dd
    m = re.search(r"(\d{4}-\d{2}-\d{2})", text)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y-%m-%d").date()
        except ValueError:
            pass
    # mm/dd/yyyy
    m = re.search(r"(\d{1,2}/\d{1,2}/\d{2,4})", text)
    if m:
        s = m.group(1)
        for fmt in ("%m/%d/%Y", "%m/%d/%y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    # Month name
    m = re.search(r"([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})", text)
    if m:
        s = m.group(1)
        for fmt in ("%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    return None


def _find_dates_in_text(text: str):
    if not text:
        return []
    dates = []
    # ISO
    for m in re.finditer(r"(\d{4}-\d{2}-\d{2})", text):
        try:
            d = datetime.strptime(m.group(1), "%Y-%m-%d").date()
            dates.append((d, m.start(1), m.end(1)))
        except ValueError:
            continue
    # mm/dd/yyyy
    for m in re.finditer(r"(\d{1,2}/\d{1,2}/\d{2,4})", text):
        s = m.group(1)
        for fmt in ("%m/%d/%Y", "%m/%d/%y"):
            try:
                d = datetime.strptime(s, fmt).date()
                dates.append((d, m.start(1), m.end(1)))
                break
            except ValueError:
                continue
    # Month name
    for m in re.finditer(r"([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})", text):
        s = m.group(1)
        for fmt in ("%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y"):
            try:
                d = datetime.strptime(s, fmt).date()
                dates.append((d, m.start(1), m.end(1)))
                break
            except ValueError:
                continue
    return dates


def _parse_date_nearest_to_span(text: str, match_span, filing_date=None, window_days: int = 365):
    if not text or not match_span:
        return None
    try:
        s_span, e_span = int(match_span[0]), int(match_span[1])
    except (ValueError, TypeError):
        return None

    candidates = _find_dates_in_text(text)
    if not candidates:
        return None

    if filing_date:
        try:
            if isinstance(filing_date, str):
                filing_dt = datetime.strptime(filing_date, "%Y-%m-%d").date()
            else:
                filing_dt = filing_date
            min_dt = filing_dt - timedelta(days=window_days)
            max_dt = filing_dt + timedelta(days=window_days)
            candidates = [(d, ds, de) for (d, ds, de) in candidates if min_dt <= d <= max_dt]
            if not candidates:
                return None
        except ValueError:
            pass

    center = (s_span + e_span) / 2
    best, best_dist = None, None
    for d, ds, de in candidates:
        dcenter = (ds + de) / 2
        dist = abs(dcenter - center)
        if best is None or dist < best_dist:
            best, best_dist = d, dist
    return best


def _get_sentence_for_span(text: str, match_span, window_chars: int = 250):
    if not text or not match_span:
        return None
    try:
        s_span, e_span = int(match_span[0]), int(match_span[1])
    except (ValueError, TypeError):
        return None

    center = (s_span + e_span) // 2
    left = max([text.rfind(p, 0, center) for p in (".", "?", "!", "\n")])
    if left == -1:
        left = max(0, center - window_chars)
    else:
        left += 1

    right_candidates = [text.find(p, center) for p in (".", "?", "!", "\n")]
    right = min([r for r in right_candidates if r != -1], default=-1)
    if right == -1:
        right = min(len(text), center + window_chars)
    else:
        right += 1

    sent = text[left:right].strip()
    if len(sent) > window_chars * 2:
        mid = len(sent) // 2
        start = max(0, mid - window_chars)
        sent = sent[start:start + window_chars * 2].strip()
    return sent or None


# --- Static File Serving (Frontend) ---

root_dir = Path(__file__).resolve().parents[2]
frontend_candidates = [
    Path(__file__).resolve().parents[1] / "frontend",
    root_dir / "frontend" / "react-app" / "dist",
    root_dir / "frontend" / "dist",
]

frontend_dir = None
for candidate in frontend_candidates:
    if candidate.exists():
        frontend_dir = candidate
        break

if frontend_dir:
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")