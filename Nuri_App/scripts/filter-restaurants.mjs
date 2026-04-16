import { createReadStream, writeFileSync } from "fs";
import { createInterface } from "readline";

const INPUT = "data/Registered_Business_Locations_-_San_Francisco_20260317.csv";
const OUTPUT = "data/sf-restaurants.csv";

// Column indices (0-based) from the header
const COL = {
  DBA_NAME: 4,
  STREET_ADDRESS: 5,
  CITY: 6,
  STATE: 7,
  ZIPCODE: 8,
  BUSINESS_END_DATE: 10,
  NAICS_CODE: 18,
  LIC_CODE: 21,
  LIC_CODE_DESC: 22,
  BUSINESS_LOCATION: 26,
  NEIGHBORHOODS: 28,
};

const RESTAURANT_LIC = ["H24", "H25", "H26"];

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function parsePoint(pointStr) {
  const match = pointStr.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/);
  if (!match) return null;
  return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
}

function hasRestaurantLIC(licCode) {
  for (const code of RESTAURANT_LIC) {
    if (licCode.includes(code)) return true;
  }
  return false;
}

const rl = createInterface({ input: createReadStream(INPUT), crlfDelay: Infinity });

const rows = [];
let lineNum = 0;
let skipped = { closed: 0, noCoords: 0, noMatch: 0, notSF: 0 };

for await (const line of rl) {
  lineNum++;
  if (lineNum === 1) continue; // skip header

  const cols = parseCSVLine(line);

  // Filter: must have restaurant NAICS or LIC code
  const naics = cols[COL.NAICS_CODE] || "";
  const licCode = cols[COL.LIC_CODE] || "";
  const licDesc = (cols[COL.LIC_CODE_DESC] || "").toUpperCase();

  const isNAICSFood = naics.startsWith("7220") || naics.startsWith("7221") || naics.startsWith("7222") || naics.startsWith("7223") || naics.startsWith("7224") || naics.startsWith("7225") || naics === "7220-7229";
  const isLICRestaurant = hasRestaurantLIC(licCode) || licDesc.includes("RESTAURANT");

  if (!isNAICSFood && !isLICRestaurant) {
    skipped.noMatch++;
    continue;
  }

  // Filter: must be in San Francisco
  const city = (cols[COL.CITY] || "").trim();
  if (city.toLowerCase() !== "san francisco") {
    skipped.notSF++;
    continue;
  }

  // Filter: must still be open (Business End Date is empty)
  const endDate = (cols[COL.BUSINESS_END_DATE] || "").trim();
  if (endDate) {
    skipped.closed++;
    continue;
  }

  // Filter: must have coordinates
  const pointStr = cols[COL.BUSINESS_LOCATION] || "";
  const coords = parsePoint(pointStr);
  if (!coords) {
    skipped.noCoords++;
    continue;
  }

  rows.push({
    name: (cols[COL.DBA_NAME] || "").trim(),
    address: (cols[COL.STREET_ADDRESS] || "").trim(),
    city: city,
    state: (cols[COL.STATE] || "").trim(),
    zip: (cols[COL.ZIPCODE] || "").trim(),
    neighborhood: (cols[COL.NEIGHBORHOODS] || "").trim(),
    lat: coords.lat,
    lng: coords.lng,
    licCode: licCode.trim(),
    licDescription: (cols[COL.LIC_CODE_DESC] || "").trim(),
  });
}

// Deduplicate by name + address
const seen = new Set();
const unique = rows.filter((r) => {
  const key = `${r.name.toLowerCase()}|${r.address.toLowerCase()}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Build CSV
const header = "name,address,city,state,zip,neighborhood,lat,lng,lic_code,lic_description";
const csvRows = unique.map((r) =>
  [r.name, r.address, r.city, r.state, r.zip, r.neighborhood, r.lat, r.lng, r.licCode, r.licDescription]
    .map((v) => `"${String(v).replace(/"/g, '""')}"`)
    .join(",")
);

writeFileSync(OUTPUT, [header, ...csvRows].join("\n"), "utf-8");

console.log(`Done! Wrote ${unique.length} restaurants to ${OUTPUT}`);
console.log(`Skipped: ${skipped.closed} closed, ${skipped.noCoords} no coordinates, ${skipped.notSF} not in SF, ${skipped.noMatch} not food/restaurant`);
console.log(`(${rows.length - unique.length} duplicates removed)`);
