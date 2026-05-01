export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  if (req.method === 'OPTIONS') return res.status(200).end();
  // POST para evitar cache de CDN
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const key = process.env.ELEVENLABS_API_KEY;
    console.log('ELEVENLABS_API_KEY presente:', !!key);
    if (!key) return res.status(200).json({ voices: [], error: 'Sin API key' });
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key }
    });
    console.log('ElevenLabs status:', r.status);
    const d = await r.json();
    console.log('Voces recibidas:', d.voices?.length || 0);
    res.status(200).json(d);
  } catch (e) {
    console.error('voices error:', e.message);
    res.status(500).json({ voices: [], error: e.message });
  }
}
