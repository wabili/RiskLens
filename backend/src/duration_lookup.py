import json
from pathlib import Path

class EventDurationLookup:
    def __init__(self, config_path: str = "config/event_durations.json"):
        config_file = Path(__file__).parent.parent / config_path
        if not config_file.exists():
            raise FileNotFoundError(f"Event duration config not found: {config_file}")
        try:
            with open(config_file, 'r') as f:
                self.events = json.load(f)
        except Exception as e:
            raise RuntimeError(f"Failed to load event durations from {config_file}: {e}")
    
    def get_duration(self, event_type: str) -> dict:
        """Return T* and metadata for an event type."""
        return self.events.get(event_type)
    
    def get_all_event_types(self) -> list:
        """Return list of all supported event types."""
        return list(self.events.keys())