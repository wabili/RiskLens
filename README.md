This project is a modular, deployable system for automated detection of high-risk disclosures in U.S. Securities and Exchange Commission (SEC) filings. Leveraging a pipeline of structured data retrieval, intelligent text preprocessing, and context-aware risk analysis, the system
identifies “dangerous sentences” — such as those
indicating financial distress, legal exposure, or
operational vulnerabilities — from public 10-K
and 10-Q reports. The architecture comprises
three core components: (1) a compliant SEC filing fetcher that respects rate limits and downloads
only essential document text; (2) a robust text
processor that cleans and extracts meaningful nar-
rative content while discarding boilerplate and
non-relevant sections; and (3) a configurable risk
analyzer that combines curated keyword dictionaries with weighted phrase matching and contextual
filtering to prioritize truly material risks. Built
with FastAPI and containerized via Docker, the
backend is optimized for deployment on cloud
platforms such as Fly.io, ensuring scalability, reproducibility, and adherence to SEC Fair Access
Policy. The system avoids large language mod-
els (LLMs) in favor of lightweight, interpretable,
and low-latency techniques, making it suitable for
real-time screening of corporate disclosures. Optional frontend integration enables user-friendly
access, while a flexible keyword management
strategy supports continuous refinement of risk de-
tection logic. This tool aims to empower investors,
researchers, and compliance professionals with
timely insights into emerging corporate risks —
all within a transparent, maintainable, and ethically responsible framework.
<img width="1895" height="976" alt="Screenshot 2026-01-03 at 20 43 38" src="https://github.com/user-attachments/assets/54d6bb49-ca81-43af-bcee-0d2a9b4e1dfc" />


