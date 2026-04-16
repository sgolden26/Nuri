import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Nuri-App/1.0" },
  });
  const data = await res.json();

  if (!data.length) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  const result = data[0];
  return NextResponse.json({
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    address: result.display_name,
  });
}
