import re
import os
from pathlib import Path
from typing import List, Set

# Determine the keys directory relative to this file
KEYS_DIR = Path(__file__).parent.parent / "keys"

def _load_keyword_set(filename: str) -> Set[str]:
    """Safely load a keyword file from the keys/ directory."""
    filepath = KEYS_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Keyword file not found: {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        return {line.strip().lower() for line in f if line.strip()}

def _has_risk_context(sentence_lower: str, risk_words: Set[str]) -> bool:
    words = set(re.findall(r'\b\w+\b', sentence_lower))
    return bool(words & risk_words)

def _is_boilerplate(sentence: str, exclude_phrases: Set[str]) -> bool:
    lower = sentence.lower()
    if any(phrase in lower for phrase in exclude_phrases):
        return True
    if len(re.findall(r'\d{5,}', sentence)) >= 2:
        return True
    if len(sentence) > 20:
        digit_ratio = sum(c.isdigit() for c in sentence) / len(sentence)
        if digit_ratio > 0.15:
            return True
    return False

def _clean_sec_text(raw: str) -> str:
    # Remove all HTML/XML tags (including incomplete ones and with attributes)
    raw = re.sub(r'<[^>]*>', '', raw, flags=re.MULTILINE)
    # Remove leftover tag fragments
    raw = re.sub(r'["\']?\s*>\s*</\w+>', '', raw)
    raw = re.sub(r'["\'>]+\s*</p>', '', raw)
    raw = re.sub(r'margin:\s*\d+pt\s*\d+["\']?\)', '', raw)
    # Remove HTML entities
    raw = re.sub(r'&nbsp;', ' ', raw)
    raw = re.sub(r'&quot;', '"', raw)
    raw = re.sub(r'&amp;', '&', raw)
    raw = re.sub(r'&lt;', '<', raw)
    raw = re.sub(r'&gt;', '>', raw)
    raw = re.sub(r'&#\d+;', '', raw)
    # Remove bullet points and list markers
    raw = re.sub(r'\b([a-z])\)\s*', r'', raw)
    raw = re.sub(r'([a-z])\)\s*([a-z])', r'\1\2', raw)
    # Add spaces between numbers and letters
    raw = re.sub(r'(\d)([A-Z])', r'\1 \2', raw)
    raw = re.sub(r'([a-z])(\d)', r'\1 \2', raw)
    # Remove sections
    raw = re.sub(r'\n\s*EXHIBIT\s+\S+.*?(?=\n\s*(?:EXHIBIT|SIGNATURE|ANNEX|\Z))', '', raw, flags=re.I | re.S)
    raw = re.sub(r'\n\s*SIGNATURE\s+.*', '', raw, flags=re.I | re.S)
    raw = re.sub(r'\n\s*INDEX TO EXHIBITS.*', '', raw, flags=re.I | re.S)
    raw = re.sub(r'(?i)(?:pursuant to the requirements|in accordance with the)', '', raw)
    # Final cleanup of extra whitespace
    raw = re.sub(r'\s+', ' ', raw).strip()
    return raw

def _split_into_sentences(text: str) -> List[str]:
    # Preserve your excellent regex-based splitter (no NLTK dependency)
    text = re.sub(r'provided\s*,?\s+however', '~~PH~~', text, flags=re.I)
    text = re.sub(r'notwithstanding', '~~NW~~', text, flags=re.I)

    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    refined = []
    for s in sentences:
        s = s.strip()
        if not s or len(s.split()) < 6:
            continue
        if len(s.split()) > 60:
            parts = re.split(r'[.;]\s+', s)
            refined.extend([p.strip() for p in parts if p.strip() and len(p.split()) >= 6])
        else:
            refined.append(s)

    return [s.replace('~~PH~~', 'provided, however').replace('~~NW~~', 'notwithstanding') for s in refined]

def _smart_truncate(text: str, max_len: int = 280) -> str:
    if len(text) <= max_len:
        return text
    cutoff = text[:max_len].rfind('. ')
    if cutoff != -1:
        return text[:cutoff + 1]
    return text[:max_len] + " [...]"

def find_dangerous_sentences(sec_document: str) -> List[str]:
    """
    Analyze a cleaned SEC document and return high-risk sentences.
    Keyword files are loaded on-demand from backend/keys/.
    """
    # Load keyword sets (lazily, per call)
    try:
        CRITICAL_PHRASES = _load_keyword_set("critical_phrases.txt")
        HIGH_PRIORITY_PHRASES = _load_keyword_set("high_priority_phrases.txt")
        RISK_CONTEXT_WORDS = _load_keyword_set("risk_context_words.txt")
        BOILERPLATE_EXCLUDE = _load_keyword_set("boilerplate_exclude.txt")
    except FileNotFoundError as e:
        raise RuntimeError(f"Missing keyword file: {e}")

    ALL_PHRASES = CRITICAL_PHRASES | HIGH_PRIORITY_PHRASES

    # Escape phrases for regex
    escaped = [re.escape(p) for p in ALL_PHRASES]
    pattern = re.compile(r'\b(?:' + '|'.join(escaped) + r')\b', re.IGNORECASE)

    clean_text = _clean_sec_text(sec_document)
    sentences = _split_into_sentences(clean_text)

    seen_fingerprints: Set[str] = set()
    scored: List[tuple[int, str]] = []

    for sent in sentences:
        if len(sent.split()) < 6:
            continue
        if _is_boilerplate(sent, BOILERPLATE_EXCLUDE):
            continue

        sent_lower = sent.lower()
        found_critical = [ph for ph in CRITICAL_PHRASES if ph in sent_lower]
        found_high = [ph for ph in HIGH_PRIORITY_PHRASES if ph in sent_lower]

        if not (found_critical or found_high):
            continue
        if not _has_risk_context(sent_lower, RISK_CONTEXT_WORDS):
            continue

        # Deduplication via fingerprint
        fingerprint = re.sub(r'[^a-z]', '', sent_lower)
        if len(fingerprint) < 35 or fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)

        # Scoring (keep single high-priority if impactful)
        score = len(found_critical) * 15 + len(found_high) * 10
        if score < 10:  # Reduced threshold to catch strong single phrases
            continue

        display = _smart_truncate(sent)
        scored.append((score, display))

    # Return top 10 by score
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s for _, s in scored[:10]]