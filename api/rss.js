export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Falta URL' });

  try {
    const r = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0 Flash-Radio-Bot/1.0' }
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
