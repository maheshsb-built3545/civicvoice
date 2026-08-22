/**
 * extraction.service.js
 * -----------------------------------------------------------------------
 * Pure AI Extraction Module boundary: (transcript, metadata) -> { structuredComplaint, needsClarification, rawModelResponse }
 * Uses Groq OpenAI-compatible API with Function Calling / Structured Output mode.
 * Throws AppError('EXTRACTION_FAILED', 502) on failure.
 * Pure function: NO DB writes, NO queue calls, NO side effects.
 */

const config = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { EXTRACTION_TOOL_DEFINITION } = require('./extraction.schema');
const { buildSystemPrompt, buildUserPrompt } = require('./extraction.prompt');
const { trackServiceFailure } = require('../../utils/redis');
const { cleanAndParseJSON } = require('../../utils/jsonSanitizer');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-20b';

/**
 * Pure function to extract structured complaint from raw text/transcript.
 * @param {string} transcript - raw text or STT transcript from citizen
 * @param {object} [metadata] - optional contextual metadata (e.g. channel, senderId, location)
 * @returns {Promise<{ structuredComplaint: object, needsClarification: boolean, rawModelResponse: object }>}
 */
async function extractComplaint(transcript, metadata = {}) {
  const fallbackObject = {
    structuredComplaint: {
      category: 'general',
      subcategory: null,
      description: (transcript && typeof transcript === 'string') ? transcript.substring(0, 150) : 'Raw complaint details',
      urgency: 'medium',
      locationMentioned: null,
      language: 'en',
      confidence: 0.5,
      needsClarification: true
    },
    needsClarification: true,
    rawModelResponse: null
  };

  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return fallbackObject;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.groqApiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.1,
          tools: [EXTRACTION_TOOL_DEFINITION],
          tool_choice: { type: 'function', function: { name: 'extract_complaint' } },
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: buildUserPrompt(transcript, metadata) },
          ],
        }),
      });
    } catch (err) {
      clearTimeout(timeout);
      const phone = metadata.senderId || '';
      const cleanSender = phone.replace(/\D/g, '');
      const maskedPhone = cleanSender.length > 4
        ? `+${cleanSender.substring(0, 2)}******${cleanSender.substring(cleanSender.length - 4)}`
        : phone;

      logger.error('Groq extraction API request failed, falling back', {
        timestamp: new Date().toISOString(),
        step: 'ai_extraction',
        traceId: metadata.traceId || null,
        error: err.message,
        context: {
          channel: metadata.channel,
          phoneNumber: maskedPhone
        }
      });
      await trackServiceFailure('ai_extraction', metadata.traceId || null).catch(() => {});
      return fallbackObject;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const phone = metadata.senderId || '';
      const cleanSender = phone.replace(/\D/g, '');
      const maskedPhone = cleanSender.length > 4
        ? `+${cleanSender.substring(0, 2)}******${cleanSender.substring(cleanSender.length - 4)}`
        : phone;

      logger.error('Groq extraction API returned non-200 status, falling back', {
        timestamp: new Date().toISOString(),
        step: 'ai_extraction',
        traceId: metadata.traceId || null,
        error: `Extraction service returned status ${response.status}`,
        context: {
          channel: metadata.channel,
          phoneNumber: maskedPhone,
          responseBody: errorBody
        }
      });
      await trackServiceFailure('ai_extraction', metadata.traceId || null).catch(() => {});
      return fallbackObject;
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      await trackServiceFailure('ai_extraction', metadata.traceId || null).catch(() => {});
      return fallbackObject;
    }

    const message = data?.choices?.[0]?.message;
    let structuredComplaint = null;

    try {
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        const argsString = toolCall.function?.arguments;
        structuredComplaint = cleanAndParseJSON(argsString);
      } else if (message?.content) {
        structuredComplaint = cleanAndParseJSON(message.content);
      }
    } catch (err) {
      logger.error('Failed to parse structured complaint from tool arguments, falling back', { message, error: err.message });
      await trackServiceFailure('ai_extraction', metadata.traceId || null).catch(() => {});
      return fallbackObject;
    }

    if (!structuredComplaint) {
      return fallbackObject;
    }

    // Strict needsClarification validation logic
    const isCategoryUncertain = !structuredComplaint.category || structuredComplaint.category === 'general';
    const isLocationUncertain = !structuredComplaint.locationMentioned || typeof structuredComplaint.locationMentioned !== 'string' || !structuredComplaint.locationMentioned.trim();
    const isLowConfidence = typeof structuredComplaint.confidence === 'number' && structuredComplaint.confidence < 0.6;

    const needsClarification = Boolean(
      structuredComplaint.needsClarification ||
      isCategoryUncertain ||
      isLocationUncertain ||
      isLowConfidence
    );

    structuredComplaint.needsClarification = needsClarification;

    if (isLocationUncertain) {
      structuredComplaint.locationMentioned = null;
    }
    if (structuredComplaint.subcategory === undefined) {
      structuredComplaint.subcategory = null;
    }

    return {
      structuredComplaint,
      needsClarification,
      rawModelResponse: data,
    };
  } catch (outerErr) {
    logger.error('Unexpected error in extraction pipeline, returning safe fallback', { error: outerErr.message });
    return fallbackObject;
  }
}
}

module.exports = { extractComplaint };
