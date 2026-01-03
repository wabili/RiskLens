import re
from typing import List, Dict, Any

from .duration_lookup import EventDurationLookup


class EventDetector:
    def __init__(self):
        self.lookup = EventDurationLookup()
        self._compile_patterns()

    def _compile_patterns(self) -> None:
        """Pre-compile regex patterns and attach metadata for performance.

        Patterns are stored as a list of dicts with keys `re` and `source` so
        we can prefer regex-derived matches over simple keyword joins when
        deduplicating.
        """
        self.patterns: Dict[str, Dict[str, Any]] = {}
        for event_type, cfg in self.lookup.events.items():
            compiled_list: List[Dict[str, Any]] = []

            # compile keyword-based pattern (word-boundary join)
            keywords = cfg.get('keywords', [])
            if keywords:
                pattern_text = r'\b(?:' + '|'.join(re.escape(kw) for kw in keywords) + r')\b'
                try:
                    compiled_list.append({'re': re.compile(pattern_text, re.IGNORECASE), 'source': 'keyword'})
                except re.error:
                    pass

            # compile any custom regex patterns provided in config
            regexes = cfg.get('regex_patterns', []) or []
            for rx in regexes:
                try:
                    compiled_list.append({'re': re.compile(rx, re.IGNORECASE), 'source': 'regex'})
                except re.error:
                    # skip invalid regex but continue processing other patterns
                    continue

            if not compiled_list:
                continue

            # store list of compiled patterns and metadata
            self.patterns[event_type] = {
                'patterns': compiled_list,
                'T_star_days': cfg.get('T_star_days'),
                'event_nature': cfg.get('event_nature'),
                'likely_triggers': cfg.get('likely_triggers'),
                'description': cfg.get('description'),
                'confidence_interval': cfg.get('confidence_interval')
            }

    def detect_events(self, text: str) -> List[Dict[str, Any]]:
        """Detect all events in the given text and return metadata for each.

        This method collects all raw matches, then deduplicates overlapping
        spans by preferring longer matches and, when equal length, preferring
        matches produced by explicit `regex` patterns over simple `keyword`
        joins.
        """
        raw_matches: List[Dict[str, Any]] = []
        for event_type, meta in self.patterns.items():
            for pat in meta.get('patterns', []):
                compiled = pat.get('re')
                source = pat.get('source', 'keyword')
                for m in compiled.finditer(text):
                    raw_matches.append({
                        'event_type': event_type,
                        'T_star_days': meta.get('T_star_days'),
                        'event_nature': meta.get('event_nature'),
                        'likely_triggers': meta.get('likely_triggers'),
                        'description': meta.get('description'),
                        'confidence_interval': meta.get('confidence_interval'),
                        'match_text': m.group(0),
                        'match_span': m.span(),
                        'pattern_source': source
                    })

        # deduplicate / merge overlapping matches
        # prefer longer matches and prefer 'regex' over 'keyword' when lengths equal
        def _source_priority(src: str) -> int:
            return 0 if src == 'regex' else 1

        # sort by length desc, then source priority so we keep the best matches first
        raw_matches.sort(key=lambda r: (-(r['match_span'][1] - r['match_span'][0]), _source_priority(r.get('pattern_source'))))

        kept: List[Dict[str, Any]] = []
        occupied: List[tuple] = []  # list of kept spans
        for r in raw_matches:
            s, e = r['match_span']
            overlap = False
            for ks, ke in occupied:
                if not (e <= ks or s >= ke):
                    overlap = True
                    break
            if not overlap:
                kept.append(r)
                occupied.append((s, e))

        # return kept matches sorted by their appearance in text
        detected = sorted(kept, key=lambda x: x['match_span'][0])
        return detected
