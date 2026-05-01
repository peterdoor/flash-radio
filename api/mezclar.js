const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { voz } = req.body; // voz en base64 (MP3)
    if (!voz) return res.status(400).json({ error: 'Falta la voz' });

    // Leer intro y outro WAV
    const introPath = path.join(process.cwd(), 'public', 'intro.wav');
    const outroPath = path.join(process.cwd(), 'public', 'outro.wav');

    const introWav = fs.readFileSync(introPath);
    const outroWav = fs.readFileSync(outroPath);
    const vozMp3   = Buffer.from(voz, 'base64');

    // Parsear WAV: extraer datos PCM (saltar header de 44 bytes)
    function wavPCM(buf) {
      // Encontrar el chunk 'data'
      let offset = 12;
      while (offset < buf.length - 8) {
        const id = buf.slice(offset, offset + 4).toString('ascii');
        const size = buf.readUInt32LE(offset + 4);
        if (id === 'data') return { pcm: buf.slice(offset + 8, offset + 8 + size), channels: buf.readUInt16LE(22), sampleRate: buf.readUInt32LE(24) };
        offset += 8 + size;
      }
      throw new Error('WAV data chunk no encontrado');
    }

    const intro = wavPCM(introWav);
    const outro = wavPCM(outroWav);
    const SR = intro.sampleRate;

    // Decodificar MP3 de la voz no es trivial en Node puro
    // Estrategia: armar WAV con intro + silencio(placeholder) + outro
    // y devolver un JSON con las partes para que el cliente las una
    // MEJOR: devolver intro+outro como WAV base64 y que el cliente
    // haga la mezcla mínima (solo concatenar, sin renderizar)

    // En realidad lo más simple y rápido:
    // Devolver intro.wav + voz.mp3 + outro.wav como partes separadas
    // El cliente los reproduce en secuencia O los concatena

    // Para concatenar correctamente necesitamos decodificar el MP3
    // Usamos una aproximación: convertir todo a WAV concatenando PCM

    // Silencio de 0.3s entre intro y voz
    const silencioSamples = Math.floor(SR * 0.3) * 2; // stereo
    const silencio = Buffer.alloc(silencioSamples * 2, 0); // 16-bit

    // Total PCM = intro + silencio + (voz como WAV si fuera WAV) + silencio + outro
    // Como la voz llega como MP3, la estrategia más práctica:
    // Devolver las 3 partes como base64 para que el cliente las reproduzca en secuencia

    res.status(200).json({
      intro: introWav.toString('base64'),
      outro: outroWav.toString('base64'),
      voz:   voz  // devolver la voz tal cual
    });

  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
