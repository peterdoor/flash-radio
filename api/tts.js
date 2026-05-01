module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { texto, proveedor, voz } = req.body;
  if (!texto) return res.status(400).json({ error: 'Falta el texto' });

  try {
    let audioBuffer;

    if (proveedor === 'google') {
      const key = process.env.GOOGLE_TTS_API_KEY;
      if (!key) return res.status(500).json({ error: 'GOOGLE_TTS_API_KEY no configurada en Vercel' });

      const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: texto },
          voice: {
            languageCode: 'es-AR',
            name: voz || 'es-AR-WaveNet-C', // masculina argentina
            ssmlGender: 'MALE'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.1,
            pitch: -1.0
          }
        })
      });

      if (!r.ok) {
        const e = await r.json();
        throw new Error('Google TTS: ' + (e.error?.message || r.status));
      }

      const d = await r.json();
      // Google devuelve base64
      audioBuffer = Buffer.from(d.audioContent, 'base64');

    } else {
      // ElevenLabs
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) return res.status(500).json({ error: 'ELEVENLABS_API_KEY no configurada en Vercel' });
      const voiceId = voz || 'qnvusyIjzlSoWYJ0C2Nm';

      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
        body: JSON.stringify({
          text: texto,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.30, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true, speed: 1.15 }
        })
      });
      if (!r.ok) throw new Error('ElevenLabs: ' + r.status);
      audioBuffer = Buffer.from(await r.arrayBuffer());
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(audioBuffer);

  } catch (e) {
    console.error('TTS error:', e);
    res.status(500).json({ error: e.message });
  }
};
