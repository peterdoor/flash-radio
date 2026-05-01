import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { voz } = req.body;
    if (!voz) return res.status(400).json({ error: 'Falta la voz' });

    const vozBuf = Buffer.from(voz, 'base64');
    const introPath = path.join(process.cwd(), 'public', 'intro.wav');
    const outroPath = path.join(process.cwd(), 'public', 'outro.wav');
    const introBuf = fs.readFileSync(introPath);
    const outroWav = fs.readFileSync(outroPath);

    // Extraer PCM de WAV (saltar header 44 bytes)
    function pcmFromWav(buf) {
      // Buscar chunk 'data'
      let i = 12;
      while (i < buf.length - 8) {
        const id = buf.slice(i, i+4).toString();
        const size = buf.readUInt32LE(i+4);
        if (id === 'data') return { data: buf.slice(i+8, i+8+size), sr: buf.readUInt32LE(24), ch: buf.readUInt16LE(22) };
        i += 8 + size;
      }
      // fallback
      return { data: buf.slice(44), sr: 44100, ch: 2 };
    }

    const intro = pcmFromWav(introBuf);
    const outro = pcmFromWav(outroWav);
    const SR = intro.sr;
    const CH = intro.ch;

    // La voz viene como MP3 — no podemos decodificarla en Node puro fácilmente
    // Estrategia: armar WAV = intro PCM + silencio breve + outro PCM
    // y entregar el MP3 de la voz por separado
    // El cliente reproduce: intro WAV → voz MP3 → outro WAV en secuencia
    // SIN mezcla, sin espera

    // Armar WAV con intro + silencio(0.2s) + outro
    const silSamples = Math.floor(SR * 0.15) * CH * 2;
    const silencio = Buffer.alloc(silSamples, 0);

    const pcmTotal = Buffer.concat([intro.data, silencio, outro.data]);
    const wavHeader = makeWavHeader(pcmTotal.length, SR, CH);
    const wavFinal = Buffer.concat([wavHeader, pcmTotal]);

    // Devolver intro+outro WAV y voz MP3 como base64
    res.status(200).json({
      ok: true,
      introOutroWav: wavFinal.toString('base64'), // intro+outro juntos para radio
      vozMp3: voz,
    });

  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

function makeWavHeader(dataLen, sr, ch) {
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * ch * 2, 28);
  buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  return buf;
}
