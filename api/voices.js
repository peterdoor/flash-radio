export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  
  const key = process.env.ELEVENLABS_API_KEY;
  
  if (!key) {
    return res.status(200).json({ voices: [], debug: 'NO_KEY' });
  }

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key }
    });
    
    const text = await r.text();
    
    if (!r.ok) {
      return res.status(200).json({ 
        voices: [], 
        debug: `ELEVEN_ERROR_${r.status}`,
        msg: text.slice(0,200)
      });
    }
    
    const d = JSON.parse(text);
    return res.status(200).json(d);
    
  } catch (e) {
    return res.status(200).json({ voices: [], debug: 'EXCEPTION', msg: e.message });
  }
}
