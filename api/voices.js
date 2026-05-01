export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return res.status(200).json({ voices: [] });
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key }
    });
    const d = await r.json();
    res.status(200).json(d);
  } catch (e) {
    res.status(500).json({ voices: [] });
  }
};
