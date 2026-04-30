export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { turno } = req.body;
  if (!turno) return res.status(400).json({ error: 'Falta el turno' });

  const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hora  = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const prompt = `Hoy es ${fecha}, son las ${hora}. Generá un flash informativo radial para el turno ${turno} de Misiones Cuatro, canal líder de Misiones, Argentina.

BUSCÁ noticias de HOY en:
- misionescuatro.com (PRIORIDAD, fuente principal)
- infobae.com (complemento nacional)

ESTRUCTURA (sin títulos, sin secciones, todo seguido):
- 2 noticias económicas (dólar, inflación, precios, empleo)
- 2 noticias policiales (Misiones o nacionales)
- 2 noticias simpáticas o curiosas
- 2 noticias internacionales

REGLAS:
- Máximo 120 palabras. Duración: 40-50 segundos al aire.
- Cada noticia: UNA oración contundente.
- Estilo rioplatense argentino. Datos duros, directo.
- CERO menciones de fuentes. Sin "(Infobae)", sin nada.
- Sin saludos, sin presentación, sin cierre. Solo noticias.
- Números en letras (mil cuatrocientos, no $1.400).

Respondé SOLO con el texto. Sin títulos, sin numeración, sin markdown.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Error Claude');

    const texto = (d.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    if (!texto) throw new Error('Guión vacío');
    res.status(200).json({ guion: texto });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
