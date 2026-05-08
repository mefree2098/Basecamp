const cityCoordinates: Record<string, { lat: number; lng: number; label: string }> = {
  alpine: { lat: 40.4533, lng: -111.7783, label: "Alpine" },
  "american fork": { lat: 40.3769, lng: -111.7958, label: "American Fork" },
  bountiful: { lat: 40.8894, lng: -111.8808, label: "Bountiful" },
  "cedar city": { lat: 37.6775, lng: -113.0619, label: "Cedar City" },
  clearfield: { lat: 41.1108, lng: -112.0261, label: "Clearfield" },
  "cottonwood heights": { lat: 40.6197, lng: -111.8102, label: "Cottonwood Heights" },
  draper: { lat: 40.5247, lng: -111.8638, label: "Draper" },
  "eagle mountain": { lat: 40.3141, lng: -112.0069, label: "Eagle Mountain" },
  farmington: { lat: 40.9805, lng: -111.8874, label: "Farmington" },
  herriman: { lat: 40.5141, lng: -112.0329, label: "Herriman" },
  holladay: { lat: 40.6688, lng: -111.8247, label: "Holladay" },
  layton: { lat: 41.0602, lng: -111.9711, label: "Layton" },
  lehi: { lat: 40.3916, lng: -111.8508, label: "Lehi" },
  lindon: { lat: 40.3433, lng: -111.7208, label: "Lindon" },
  logan: { lat: 41.737, lng: -111.8338, label: "Logan" },
  midvale: { lat: 40.6111, lng: -111.8999, label: "Midvale" },
  millcreek: { lat: 40.6869, lng: -111.8755, label: "Millcreek" },
  murray: { lat: 40.6669, lng: -111.8879, label: "Murray" },
  ogden: { lat: 41.223, lng: -111.9738, label: "Ogden" },
  orem: { lat: 40.2969, lng: -111.6946, label: "Orem" },
  "park city": { lat: 40.6461, lng: -111.498, label: "Park City" },
  "pleasant grove": { lat: 40.3641, lng: -111.7385, label: "Pleasant Grove" },
  provo: { lat: 40.2338, lng: -111.6585, label: "Provo" },
  riverton: { lat: 40.5219, lng: -111.9391, label: "Riverton" },
  sandy: { lat: 40.5649, lng: -111.8389, label: "Sandy" },
  "salt lake city": { lat: 40.7608, lng: -111.891, label: "Salt Lake City" },
  "saint george": { lat: 37.0965, lng: -113.5684, label: "St. George" },
  "saratoga springs": { lat: 40.3491, lng: -111.9047, label: "Saratoga Springs" },
  "south jordan": { lat: 40.5622, lng: -111.9297, label: "South Jordan" },
  "south salt lake": { lat: 40.7188, lng: -111.8883, label: "South Salt Lake" },
  "spanish fork": { lat: 40.1149, lng: -111.6549, label: "Spanish Fork" },
  "st. george": { lat: 37.0965, lng: -113.5684, label: "St. George" },
  taylorsville: { lat: 40.6677, lng: -111.9388, label: "Taylorsville" },
  vineyard: { lat: 40.297, lng: -111.7466, label: "Vineyard" },
  "west jordan": { lat: 40.6097, lng: -111.9391, label: "West Jordan" },
  "west valley city": { lat: 40.6916, lng: -112.0011, label: "West Valley City" }
};

const utahBounds = {
  north: 42.05,
  south: 36.95,
  west: -114.05,
  east: -109.05
};

export function coordinatesForAddress(address: string, seed: string) {
  const exact = matchKnownCity(address);

  if (exact) {
    return {
      lat: cityCoordinates[exact].lat,
      lng: cityCoordinates[exact].lng,
      confidence: "city" as const
    };
  }

  const hash = stableHash(seed || address || "utah");
  const lat =
    utahBounds.south +
    ((hash % 10_000) / 10_000) * (utahBounds.north - utahBounds.south);
  const lng =
    utahBounds.west +
    (((hash / 10_000) % 10_000) / 10_000) *
      (utahBounds.east - utahBounds.west);

  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    confidence: "synthetic" as const
  };
}

export function locationForAddress(address: string) {
  const exact = matchKnownCity(address);
  if (exact) return cityCoordinates[exact].label;
  if (/\but\b|\butah\b/i.test(address)) return "Utah";
  return "";
}

export function projectUtahPoint(lat: number, lng: number) {
  const x = ((lng - utahBounds.west) / (utahBounds.east - utahBounds.west)) * 100;
  const y = ((utahBounds.north - lat) / (utahBounds.north - utahBounds.south)) * 100;

  return {
    x: clamp(x, 5, 95),
    y: clamp(y, 6, 94)
  };
}

function matchKnownCity(address: string) {
  const normalized = address.toLowerCase();
  return Object.keys(cityCoordinates)
    .sort((a, b) => b.length - a.length)
    .find((city) => new RegExp(`(^|[^a-z])${escapeRegExp(city)}([^a-z]|$)`).test(normalized));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stableHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}
