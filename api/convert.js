const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { wav } = req.body;
    if (!wav) return res.status(400).json({ error: 'Falta audio' });

    const wavBuffer = Buffer.from(wav, 'base64');

    // Leer header WAV
    const numChannels  = wavBuffer.readUInt16LE(22);
    const sampleRate   = wavBuffer.readUInt32LE(24);
    const dataOffset   = 44;
    const dataLength   = wavBuffer.readUInt32LE(40);

    const samples = new Int16Array(
      wavBuffer.buffer,
      wavBuffer.byteOffset + dataOffset,
      dataLength / 2
    );

    // Separar canales
    const left = [], right = [];
    if (numChannels === 2) {
      for (let i = 0; i < samples.length; i += 2) {
        left.push(samples[i]);
        right.push(samples[i + 1]);
      }
    } else {
      for (let i = 0; i < samples.length; i++) {
        left.push(samples[i]);
        right.push(samples[i]);
      }
    }

    // lamejs como CommonJS
    const lamejs = require('lamejs');
    const encoder = new lamejs.Mp3Encoder(2, sampleRate, 128);
    const CHUNK = 1152;
    const mp3Parts = [];

    for (let i = 0; i < left.length; i += CHUNK) {
      const l = new Int16Array(left.slice(i, i + CHUNK));
      const r = new Int16Array(right.slice(i, i + CHUNK));
      const chunk = encoder.encodeBuffer(l, r);
      if (chunk.length > 0) mp3Parts.push(Buffer.from(chunk));
    }

    const flush = encoder.flush();
    if (flush.length > 0) mp3Parts.push(Buffer.from(flush));

    const mp3Buffer = Buffer.concat(mp3Parts);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="flash.mp3"');
    res.status(200).send(mp3Buffer);

  } catch (e) {
    console.error('convert error:', e);
    res.status(500).json({ error: e.message });
  }
};
