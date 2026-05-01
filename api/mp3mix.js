import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const tmp = os.tmpdir();
  const ts = Date.now();
  const inPath  = path.join(tmp, `in_${ts}.mp3`);
  const outPath = path.join(tmp, `out_${ts}.mp3`);

  try {
    const { voz, calidad } = req.body;
    if (!voz) return res.status(400).json({ error: 'Falta el audio' });

    fs.writeFileSync(inPath, Buffer.from(voz, 'base64'));

    try { execSync('ffmpeg -version', { stdio: 'ignore' }); }
    catch(e) { return res.status(500).json({ error: 'FFmpeg no disponible' }); }

    // wasap: 64kbps mono 22050Hz — liviano para WhatsApp
    // radio: 128kbps stereo 44100Hz — calidad broadcast
    const esWasap = calidad === 'wasap';
    const bitrate  = esWasap ? '64k'  : '128k';
    const channels = esWasap ? 1      : 2;
    const sr       = esWasap ? 22050  : 44100;

    execSync(
      `ffmpeg -y -i "${inPath}" -codec:a libmp3lame -b:a ${bitrate} -ar ${sr} -ac ${channels} "${outPath}"`,
      { timeout: 30000, stdio: 'ignore' }
    );

    const mp3 = fs.readFileSync(outPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(mp3);

  } catch(e) {
    console.error('mp3mix error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    try { fs.unlinkSync(inPath); } catch(e){}
    try { fs.unlinkSync(outPath); } catch(e){}
  }
}
