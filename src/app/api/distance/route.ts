import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originLat, originLng, destLat, destLng } = body;
    if (
      typeof originLat !== 'number' ||
      typeof originLng !== 'number' ||
      typeof destLat !== 'number' ||
      typeof destLng !== 'number'
    ) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const straightLineKm = haversineKm(originLat, originLng, destLat, destLng);

    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (googleKey) {
      try {
        const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleKey,
            'X-Goog-FieldMask': 'routes.distanceMeters',
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
            destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
            travelMode: 'DRIVE',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const meters = data?.routes?.[0]?.distanceMeters;
          if (typeof meters === 'number') {
            return NextResponse.json({
              roadDistanceKm: meters / 1000,
              straightLineKm,
              source: 'google',
            });
          }
        }
      } catch {
        // fall through to OSRM
      }
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const meters = data?.routes?.[0]?.distance;
        if (typeof meters === 'number') {
          return NextResponse.json({
            roadDistanceKm: meters / 1000,
            straightLineKm,
            source: 'osrm',
          });
        }
      }
    } catch {
      // fall through
    }

    return NextResponse.json({
      roadDistanceKm: null,
      straightLineKm,
      source: 'none',
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to calculate distance' }, { status: 500 });
  }
}