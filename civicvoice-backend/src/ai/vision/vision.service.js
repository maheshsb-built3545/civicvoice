/**
 * vision.service.js
 * -----------------------------------------------------------------------
 * Vision analysis module for analyzing images sent by citizens.
 * Calls Groq OpenAI-compatible API with Llama 3.2 11B Vision model.
 */

const config = require('../../config/env');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { buildSystemPrompt, buildUserPrompt } = require('./vision.prompt');
const { validateVisionAnalysis } = require('./vision.schema');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.2-11b-vision-preview';

/**
 * Analyzes the citizen's uploaded image with optional caption text.
 * @param {Buffer} buffer - Binary data of the image
 * @param {string} mimeType - The mimeType of the image
 * @param {string} [captionText] - Optional caption text sent with the image
 * @returns {Promise<object>} Parsed and validated vision analysis object
 */
async function analyzeImage(buffer, mimeType, captionText = '') {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError('VISION_FAILED', 502, 'A valid image buffer is required');
  }

  const base64Image = buffer.toString('base64');
  const userContent = [
    {
      type: 'text',
      text: buildUserPrompt(captionText)
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${base64Image}`
      }
    }
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.groqApiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: userContent }
        ]
      })
    });
  } catch (err) {
    clearTimeout(timeout);
    logger.error('Groq vision API request failed', { error: err.message });
    throw new AppError('VISION_FAILED', 502, `Vision request failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.error('Groq vision API returned non-200 status', { status: response.status, body: errorBody });
    throw new AppError('VISION_FAILED', 502, `Vision service returned status ${response.status}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new AppError('VISION_FAILED', 502, 'Failed to parse vision response JSON');
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError('VISION_FAILED', 502, 'Vision API returned empty content');
  }

  let visionAnalysis;
  try {
    visionAnalysis = JSON.parse(content);
  } catch (err) {
    logger.error('Failed to parse JSON content from Groq Vision response', { content, error: err.message });
    throw new AppError('VISION_FAILED', 502, 'Vision model failed to produce valid JSON output');
  }

  try {
    const validated = validateVisionAnalysis(visionAnalysis);
    return validated;
  } catch (err) {
    logger.error('Vision analysis schema validation failed', { visionAnalysis, error: err.message });
    throw new AppError('VISION_FAILED', 502, `Schema validation failed for vision analysis: ${err.message}`);
  }
}

module.exports = { analyzeImage };
