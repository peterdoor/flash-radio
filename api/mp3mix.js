import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const tmp = os.tmpdir();
  const vozPath  = path.join(tmp, `voz_${Date.now()}.mp3`);
  const outPath  = path.join(tmp, `out_${Date.now()}.mp3`);
  const introPath = path.join(process.cwd(), 'public', 'intro.mp3');
  const outroPath = path.join(process.cwd(), 'public', 'outro.mp3');

  try {
    const { voz } = req.body;
    if (!voz) return res.status(400).json({ error: 'Falta la voz' });

    // Guardar voz MP3
    fs.writeFileSync(vozPath, Buffer.from(voz, 'base64'));

    // Verificar que FFmpeg esté disponible
    try { execSync('ffmpeg -version', { stdio: 'ignore' }); }
    catch(e) { return res.status(500).json({ error: 'FFmpeg no disponible' }); }

    // FFmpeg: concatenar intro + voz + outro y normalizar volumen
    // Usamos filter_complex para mezclar correctamente
    const cmd = `ffmpeg -y \
      -i "${introPath}" \
      -i "${vozPath}" \
      -i "${outroPath}" \
      -filter_complex "\
        [0:a]aformat=fltp:44100:stereo,volume=0.8[intro];\
        [1:a]aformat=fltp:44100:stereo,volume=1.0[voz];\
        [2:a]aformat=fltp:44100:stereo,volume=0.8[outro];\
        [intro][voz][outro]concat=n=3:v=0:a=1[out]" \
      -map "[out]" \
      -codec:a libmp3lame -b:a 128k -ar 44100 \
      "${outPath}"`;

    execSync(cmd, { timeout: 30000, stdio: 'ignore' });

    const mp3 = fs.readFileSync(outPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="flash.mp3"');
    res.status(200).send(mp3);

  } catch(e) {
    console.error('mp3mix error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    try { fs.unlinkSync(vozPath); } catch(e){}
    try { fs.unlinkSync(outPath); } catch(e){}
  }
}
