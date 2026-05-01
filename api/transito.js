export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(200).json({ error: 'Sin clave', data: null });

  try {
    const orig = '-27.3671,-55.8961'; // Posadas centro
    const dest1 = '-27.3303,-55.8655'; // Puente San Roque González
    const dest2 = '-27.4206,-55.7430'; // Apóstoles

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${orig}&destinations=${dest1}|${dest2}&departure_time=now&traffic_model=best_guess&key=${key}&language=es`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error('Google Maps ' + r.status);
    const d = await r.json();
    res.status(200).json(d);
  } catch(e) {
    res.status(200).json({ error: e.message, data: null });
  }
}
