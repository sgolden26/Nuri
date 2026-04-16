import { readFileSync, writeFileSync } from "fs";

const OFFICE_LAT = 37.7921;
const OFFICE_LNG = -122.3951;
const RADIUS_M = 1600;

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const csv = readFileSync("data/sf-restaurants.csv", "utf-8");
const lines = csv.split("\n");
const header = lines[0];

const nearby = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (inQuotes) {
      if (ch === '"' && line[j + 1] === '"') { current += '"'; j++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { fields.push(current); current = ""; }
      else current += ch;
    }
  }
  fields.push(current);

  const lat = parseFloat(fields[6]);
  const lng = parseFloat(fields[7]);
  if (isNaN(lat) || isNaN(lng)) continue;

  const dist = haversineM(OFFICE_LAT, OFFICE_LNG, lat, lng);
  if (dist <= RADIUS_M) {
    const walkMin = Math.round(dist / 80);
    nearby.push({ line, dist, walkMin, name: fields[0] });
  }
}

nearby.sort((a, b) => a.dist - b.dist);

const outHeader = header + ",walk_minutes,distance_m";
const outRows = nearby.map((r) => r.line + `,"${r.walkMin}","${Math.round(r.dist)}"`);

writeFileSync("data/sf-restaurants-101-mission.csv", [outHeader, ...outRows].join("\n"), "utf-8");

console.log(`Found ${nearby.length} restaurants within ${RADIUS_M}m of 101 Mission St`);
console.log(`\nClosest 10:`);
nearby.slice(0, 10).forEach((r) => {
  console.log(`  ${r.walkMin} min walk (${Math.round(r.dist)}m) — ${r.name}`);
});
console.log(`\nFarthest 5:`);
nearby.slice(-5).forEach((r) => {
  console.log(`  ${r.walkMin} min walk (${Math.round(r.dist)}m) — ${r.name}`);
});
