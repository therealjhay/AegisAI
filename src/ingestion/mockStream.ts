/**
 * Mock stream items used for local ingestion testing.
 */
export const mockAlertStream: unknown[] = [
  {
    raw_text: "Flash flood reported near river delta. Several roads inaccessible.",
    source: "gdacs",
    coordinates: { lat: 6.5244, lon: 3.3792 },
    urgency_score: 4,
    timestamp: new Date().toISOString()
  },
  {
    raw_text: "Duplicate flood alert from nearby district.",
    source: "social_media",
    coordinates: { lat: 6.528, lon: 3.381 },
    urgency_score: 4,
    timestamp: new Date().toISOString()
  },
  {
    raw_text: "",
    source: "anonymous_tip",
    coordinates: { lat: 91, lon: 11 },
    urgency_score: 5
  }
];
