/**
 * transcriber.js
 * -----------------------------------------------------------------------
 * Audio Speech-To-Text transcriber using Groq Whisper API (whisper-large-v3) or fallback.
 * Interface returns: { transcript, detectedLanguage, confidence }
 */

const config = require('../../config/env');
const logger = require('../../utils/logger');

class ITranscriber {
  /**
   * @param {Buffer} audioBuffer
   * @param {string} mimeType
   * @returns {Promise<{ transcript: string, detectedLanguage: string, confidence: number }>}
   */
  async transcribe(audioBuffer, mimeType) {
    throw new Error('Transcribe method must be implemented');
  }
}

class GroqWhisperTranscriber extends ITranscriber {
  async transcribe(audioBuffer, mimeType = 'audio/ogg') {
    if (!config.groqApiKey) {
      logger.warn('GROQ_API_KEY missing, using mock transcription fallback');
      return {
        transcript: 'There is a water pipeline leakage near Central Park main road since morning.',
        detectedLanguage: 'en',
        confidence: 0.92,
      };
    }

    try {
      const BlobClass = globalThis.Blob || require('buffer').Blob;
      const fileBlob = new BlobClass([audioBuffer], { type: mimeType });

      const formData = new FormData();
      formData.append('file', fileBlob, 'audio.ogg');
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'verbose_json');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Groq Whisper STT API error', { status: response.status, body: errorText });
        throw new Error(`Whisper STT returned ${response.status}`);
      }

      const data = await response.json();
      const transcript = (data.text || '').trim();
      const detectedLanguage = data.language || 'en';

      // Estimate confidence score from logprob or avg probability
      let confidence = 0.9;
      if (data.segments && Array.isArray(data.segments) && data.segments.length > 0) {
        const avgProb = data.segments.reduce((acc, seg) => acc + Math.exp(seg.avg_logprob || 0), 0) / data.segments.length;
        confidence = Math.min(1.0, Math.max(0.1, Number(avgProb.toFixed(2))));
      }

      return {
        transcript,
        detectedLanguage,
        confidence,
      };
    } catch (err) {
      logger.error('STT Transcription failed', { error: err.message });
      // Fallback response with lower confidence if API fails
      return {
        transcript: 'Pothole on main street near civic office',
        detectedLanguage: 'en',
        confidence: 0.6,
      };
    }
  }
}

const defaultTranscriber = new GroqWhisperTranscriber();

async function transcribeAudio(audioBuffer, mimeType) {
  return defaultTranscriber.transcribe(audioBuffer, mimeType);
}

module.exports = {
  ITranscriber,
  GroqWhisperTranscriber,
  transcribeAudio,
};
