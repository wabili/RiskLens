import re
import os
from pathlib import Path
from bs4 import BeautifulSoup

def read_filing_file(file_path: str) -> str:
    """
    Read a filing file (.txt or .html) with robust encoding handling.
    """
    encodings = ['utf-8', 'latin-1', 'cp1252']
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, OSError):
            continue
    raise ValueError(f"Could not read file {file_path} with any standard encoding.")

def extract_clean_text(html_or_text: str) -> str:
    """
    Extract and clean visible text from SEC filing content.
    Handles both raw HTML and plain text (with embedded HTML tags).
    """
    try:
        # Use BeautifulSoup to remove scripts/styles and extract visible text
        soup = BeautifulSoup(html_or_text, 'html.parser')
        for tag in soup(['script', 'style', 'header', 'footer', 'nav', 'form', 'img']):
            tag.decompose()
        # Get all visible text
        text = ' '.join(soup.stripped_strings)
    except Exception as e:
        # If BeautifulSoup rejects the markup, treat as plain text
        print(f"[extract_clean_text] Warning: Markup rejected by parser, treating as plain text. Error: {e}")
        text = html_or_text

    # Now apply **conservative** cleaning (preserve financial/legal terms)
    text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
    text = re.sub(r'Page \d+ of \d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\b\d{1,2}/\d{1,2}/\d{2,4}\b', '', text)  # Remove dates
    text = re.sub(r'https?://\S+|www\.\S+', '', text)         # Remove URLs
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', text)  # Emails
    text = re.sub(r'\b\d{6,}\b', '', text)  # Remove long numbers (e.g., internal IDs)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def process_filing_file(file_path: str) -> str:
    """
    High-level function: read file → extract clean text.
    Designed to be called directly by the API.
    
    Args:
        file_path (str): Path to SEC filing (.txt file with possible HTML/XML).
    
    Returns:
        str: Clean, single-string text ready for keyword analysis.
    """
    raw_content = read_filing_file(file_path)
    clean_text = extract_clean_text(raw_content)
    return clean_text