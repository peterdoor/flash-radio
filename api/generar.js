import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import fs from 'fs';
import path from 'path';
import os from 'os';

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
    responseLimit: '50mb',
  }
};

function runFFmpeg(ffmpegBin, ffmpegMod, inputs, filterComplex, outputOpts, outPath) {
  return new Promise((resolve, reject) => {
    let cmd = ffmpegMod().setFfmpegPath(ffmpegBin);
    inputs.forEach(i => cmd = cmd.input(i));
    cmd
      .complexFilter(filterComplex)
      .outputOptions(outputOpts)
      .output(outPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { guion, proveedor, voz } = req.body;
  if (!guion) return res.status(400).json({ error: 'Falta el guión' });

  const tmp = os.tmpdir();
  const ts = Date.now();
  const vozPath   = path.join(tmp, `voz_${ts}.mp3`);
  const radioPath = path.join(tmp, `radio_${ts}.mp3`);
  const wasapPath = path.join(tmp, `wasap_${ts}.mp3`);
  const intro     = path.join(process.cwd(), 'public', 'intro.mp3');
  const outro     = path.join(process.cwd(), 'public', 'outro.mp3');

  try {
    // 1. Generar voz
    let vozBuf;
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
      if (!r.ok) { const e = await r.json(); throw new Error('Google TTS: ' + (e.error?.message || r.status)); }
      vozBuf = Buffer.from((await r.json()).audioContent, 'base64');
    } else {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) throw new Error('Sin clave ElevenLabs');
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz || 'qnvusyIjzlSoWYJ0C2Nm'}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({
          text: guion,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.30, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true, speed: 1.15 }
        })
      });
      if (!r.ok) throw new Error('ElevenLabs: ' + r.status);
      vozBuf = Buffer.from(await r.arrayBuffer());
    }
    fs.writeFileSync(vozPath, vozBuf);

    // 2. FFmpeg
    const ffmpegBin = require('ffmpeg-static');
    const ffmpegMod = require('fluent-ffmpeg');

    const filter = '[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]';

    // Radio: 128kbps stereo 44100Hz
    await runFFmpeg(ffmpegBin, ffmpegMod,
      [intro, vozPath, outro],
      filter,
      ['-map', '[out]', '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2'],
      radioPath
    );

    // WhatsApp: 48kbps mono 24000Hz → ~3MB para 2 minutos
    await runFFmpeg(ffmpegBin, ffmpegMod,
      [intro, vozPath, outro],
      filter,
      ['-map', '[out]', '-codec:a', 'libmp3lame', '-b:a', '48k', '-ar', '24000', '-ac', '1'],
      wasapPath
    );

    const radioBuf = fs.readFileSync(radioPath);
    const wasapBuf = fs.readFileSync(wasapPath);

    res.status(200).json({
      radio: radioBuf.toString('base64'),
      wasap: wasapBuf.toString('base64'),
      radioMB: (radioBuf.length / 1024 / 1024).toFixed(1),
      wasapMB: (wasapBuf.length / 1024 / 1024).toFixed(1),
    });

  } catch (e) {
    console.error('generar error:', e.message);
    res.status(500).json({ error: e.message });
  } finally {
    [vozPath, radioPath, wasapPath].forEach(p => { try { fs.unlinkSync(p); } catch(e){} });
  }
}
