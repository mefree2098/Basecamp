const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  "salt lake city": { lat: 40.7608, lng: -111.891 },
  lehi: { lat: 40.3916, lng: -111.8508 },
  provo: { lat: 40.2338, lng: -111.6585 },
  orem: { lat: 40.2969, lng: -111.6946 },
  ogden: { lat: 41.223, lng: -111.9738 },
  logan: { lat: 41.737, lng: -111.8338 },
  draper: { lat: 40.5247, lng: -111.8638 },
  sandy: { lat: 40.5649, lng: -111.8389 },
  "st. george": { lat: 37.0965, lng: -113.5684 },
  "saint george": { lat: 37.0965, lng: -113.5684 },
  cedar: { lat: 37.6775, lng: -113.0619 },
  "cedar city": { lat: 37.6775, lng: -113.0619 },
  park: { lat: 40.6461, lng: -111.498 },
  "park city": { lat: 40.6461, lng: -111.498 },
  bountiful: { lat: 40.8894, lng: -111.8808 },
  layton: { lat: 41.0602, lng: -111.9711 },
  clearfield: { lat: 41.1108, lng: -112.0261 },
  west: { lat: 40.6916, lng: -112.0011 },
  "west valley city": { lat: 40.6916, lng: -112.0011 },
  south: { lat: 40.5622, lng: -111.9297 },
  "south jordan": { lat: 40.5622, lng: -111.9297 },
  midvale: { lat: 40.6111, lng: -111.8999 },
  herriman: { lat: 40.5141, lng: -112.0329 },
  cottonwood: { lat: 40.6197, lng: -111.8102 }
};

const utahBounds = {
  north: 42.05,
  south: 36.95,
  west: -114.05,
  east: -109.05
};

export function coordinatesForAddress(address: string, seed: string) {
  const normalized = address.toLowerCase();
  const exact = Object.keys(cityCoordinates)
    .sort((a, b) => b.length - a.length)
    .find((city) => normalized.includes(city));

  if (exact) {
    return {
      ...cityCoordinates[exact],
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

export function projectUtahPoint(lat: number, lng: number) {
  const x = ((lng - utahBounds.west) / (utahBounds.east - utahBounds.west)) * 100;
  const y = ((utahBounds.north - lat) / (utahBounds.north - utahBounds.south)) * 100;

  return {
    x: clamp(x, 5, 95),
    y: clamp(y, 6, 94)
  };
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
