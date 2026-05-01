import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { guion, proveedor, voz, musica } = req.body;
  if (!guion) return res.status(400).json({ error: 'Falta el guión' });

  const tmp = os.tmpdir();
  const ts = Date.now();
  const vozPath = path.join(tmp, `voz_${ts}.mp3`);
  const outPath = path.join(tmp, `flash_${ts}.mp3`);
  const introPath = path.join(process.cwd(), 'public', 'intro.mp3');
  const outroPath = path.join(process.cwd(), 'public', 'outro.mp3');

  try {
    // 1. Generar voz
    let vozBuffer;
    if (proveedor === 'google') {
      const key = process.env.GOOGLE_TTS_API_KEY;
      if (!key) throw new Error('Sin clave Google TTS');
      const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: guion },
          voice: { languageCode: voz?.substring(0,5)||'es-US', name: voz||'es-US-Neural2-B', ssmlGender: 'MALE' },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.1, pitch: -1.0 }
        })
      });
      if (!r.ok) throw new Error('Google TTS ' + r.status);
      const d = await r.json();
      vozBuffer = Buffer.from(d.audioContent, 'base64');
    } else {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) throw new Error('Sin clave ElevenLabs');
      const voiceId = voz || 'qnvusyIjzlSoWYJ0C2Nm';
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({
          text: guion, model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.30, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true, speed: 1.15 }
        })
      });
      if (!r.ok) throw new Error('ElevenLabs ' + r.status);
      vozBuffer = Buffer.from(await r.arrayBuffer());
    }

    // 2. Mezclar con FFmpeg si hay música
    if (musica !== 'none') {
      fs.writeFileSync(vozPath, vozBuffer);
      execSync(`ffmpeg -y -i "${introPath}" -i "${vozPath}" -i "${outroPath}" \
        -filter_complex "[0:a]aformat=fltp:44100:stereo,volume=0.8[i];[1:a]aformat=fltp:44100:stereo,volume=1.0[v];[2:a]aformat=fltp:44100:stereo,volume=0.8[o];[i][v][o]concat=n=3:v=0:a=1[out]" \
        -map "[out]" -codec:a libmp3lame -b:a 128k -ar 44100 "${outPath}"`,
        { timeout: 60000, stdio: 'ignore' });
      const mp3 = fs.readFileSync(outPath);
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.status(200).send(mp3);
    } else {
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.status(200).send(vozBuffer);
    }
  } catch(e) {
    console.error('generar error:', e.message);
    return res.status(500).json({ error: e.message });
  } finally {
    try { fs.unlinkSync(vozPath); } catch(e){}
    try { fs.unlinkSync(outPath); } catch(e){}
  }
}
