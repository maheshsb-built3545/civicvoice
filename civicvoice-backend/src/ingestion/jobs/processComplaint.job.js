/**
 * processComplaint.job.js
 * -----------------------------------------------------------------------
 * Queue worker and job handler wrapping media processing, STT transcription,
 * conversational status lookup, and complaint.service.js createComplaint orchestration.
 * Now acts as the central background processor for all WhatsApp webhook events.
 */

const { Worker } = require('bullmq');
const { connection, complaintQueue } = require('../queue/queue');
const Complaint = require('../../models/Complaint');
const ConversationState = require('../../models/ConversationState');
const Citizen = require('../../models/Citizen');
const complaintService = require('../../domain/complaints/complaint.service');
const { downloadMedia, sendMessage, sendListMessage, sendButtonMessage, sendLocationRequestMessage } = require('../../channels/whatsapp/whatsapp.client');
const logger = require('../../utils/logger');

const STATUS_KEYWORDS = ['STATUS', 'MY COMPLAINTS', 'CHECK STATUS', 'STATUS LOOKUP', 'MY STATUS', 'TRACK', 'STATUS?'];

// Simple in-memory cache for message idempotency
const processedMessagesCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function isDuplicateMessage(messageId) {
  if (!messageId) return false;

  const now = Date.now();

  // Evict expired entries
  for (const [id, timestamp] of processedMessagesCache.entries()) {
    if (now - timestamp > CACHE_TTL_MS) {
      processedMessagesCache.delete(id);
    }
  }

  if (processedMessagesCache.has(messageId)) {
    return true;
  }

  processedMessagesCache.set(messageId, now);
  return false;
}

function findMatchingWard(userInput, dbWards) {
  if (!userInput) return null;
  const normalizedInput = userInput.toLowerCase().trim().replace(/[\s-]/g, '');
  
  // Try exact or substring match in English/Marathi
  for (const ward of dbWards) {
    const normNameEn = ward.name.toLowerCase().replace(/[\s-]/g, '');
    const normNameMr = (ward.marathiName || '').toLowerCase().replace(/[\s-]/g, '');
    
    if (normalizedInput.includes(normNameEn) || normNameEn.includes(normalizedInput)) {
      return ward;
    }
    if (normNameMr && (normalizedInput.includes(normNameMr) || normNameMr.includes(normalizedInput))) {
      return ward;
    }
  }

  // Basic edit distance check for fuzzy matching
  let bestMatch = null;
  let highestScore = 0;

  const getLevenshteinDistance = (a, b) => {
    const tmp = [];
    let i, j;
    for (i = 0; i <= a.length; i++) {
      tmp[i] = [i];
    }
    for (j = 0; j <= b.length; j++) {
      tmp[0][j] = j;
    }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[a.length][b.length];
  };

  for (const ward of dbWards) {
    const namesToCheck = [ward.name.toLowerCase(), (ward.marathiName || '').toLowerCase()];
    for (const name of namesToCheck) {
      if (!name) continue;
      const normalizedName = name.replace(/[\s-]/g, '');
      const distance = getLevenshteinDistance(normalizedInput, normalizedName);
      const maxLength = Math.max(normalizedInput.length, normalizedName.length);
      const similarity = 1 - distance / maxLength;
      if (similarity > 0.6 && similarity > highestScore) {
        highestScore = similarity;
        bestMatch = ward;
      }
    }
  }

  return bestMatch;
}

async function sendLanguagePrompt(sender) {
  const welcomeText = "🏛️ *CivicVoice*\nWelcome to the citizen helpline.\nनागरिक हेल्पलाईनमध्ये आपले स्वागत आहे.\nनागरिक हेल्पलाइन में आपका स्वागत है।\n\n🌐 Please select your language / भाषा निवडा / भाषा चुनें:";
  const langRows = [
    { id: 'lang_en', title: 'English' },
    { id: 'lang_mr', title: 'मराठी (Marathi)' },
    { id: 'lang_hi', title: 'हिंदी (Hindi)' },
    { id: 'global_help', title: '❓ Help / मदत / सहायता', description: 'Get help / मदत / सहायता' },
    { id: 'global_cancel', title: '❌ Cancel / रद्द', description: 'Restart / पुन्हा सुरू करा / रीसेट' }
  ];
  try {
    await sendListMessage(sender, welcomeText, 'Select Language', langRows);
  } catch (sendErr) {
    logger.warn('Interactive Language List send failed, falling back to text', { error: sendErr.message });
    const textWelcome = welcomeText + "\n\n1. English\n2. मराठी (Marathi)\n3. हिंदी (Hindi)\n4. Help\n5. Cancel";
    await sendMessage(sender, textWelcome);
  }
}

async function sendIntentPrompt(sender, lang) {
  let intentMsg = '';
  let buttonLabel = '';
  let intentRows = [];
  if (lang === 'en') {
    intentMsg = "❓ *How can we help you today?*\n\nSelect an option below to file a new grievance or check the status of previous submissions.";
    buttonLabel = 'Choose Option';
    intentRows = [
      { id: 'intent_report', title: '📝 Report an issue', description: 'File a new grievance' },
      { id: 'intent_status', title: '📋 Check Status', description: 'Check previous submissions' },
      { id: 'global_help', title: '❓ Help', description: 'Get assistance' },
      { id: 'global_cancel', title: '❌ Cancel', description: 'Restart conversation' }
    ];
  } else if (lang === 'mr') {
    intentMsg = "❓ *आम्ही तुम्हाला कशी मदत करू शकतो?*\n\nनवीन तक्रार नोंदवण्यासाठी किंवा मागील तक्रारींची स्थिती पाहण्यासाठी खालील पर्याय निवडा.";
    buttonLabel = 'पर्याय निवडा';
    intentRows = [
      { id: 'intent_report', title: '📝 तक्रार नोंदवा', description: 'नवीन तक्रार दाखल करा' },
      { id: 'intent_status', title: '📋 तक्रार स्थिती', description: 'मागील तक्रारी तपासा' },
      { id: 'global_help', title: '❓ मदत', description: 'मदत मिळवा' },
      { id: 'global_cancel', title: '❌ रद्द करा', description: 'संभाषण पुन्हा सुरू करा' }
    ];
  } else if (lang === 'hi') {
    intentMsg = "❓ *हम आज आपकी कैसे सहायता कर सकते हैं?*\n\nनई शिकायत दर्ज करने या पिछली शिकायतों की स्थिति जानने के लिए नीचे दिए गए विकल्प चुनें।";
    buttonLabel = 'विकल्प चुनें';
    intentRows = [
      { id: 'intent_report', title: '📝 शिकायत दर्ज करें', description: 'नई शिकायत दर्ज करें' },
      { id: 'intent_status', title: '📋 स्थिति जांचें', description: 'पिछली शिकायतें जांचें' },
      { id: 'global_help', title: '❓ सहायता', description: 'मदद प्राप्त करें' },
      { id: 'global_cancel', title: '❌ रद्द करें', description: 'बातचीत फिर से शुरू करें' }
    ];
  }

  try {
    await sendListMessage(sender, intentMsg, buttonLabel, intentRows);
  } catch (sendErr) {
    let fallbackText = '';
    if (lang === 'mr') {
      fallbackText = intentMsg + "\n\n1. " + intentRows[0].title + "\n2. " + intentRows[1].title + "\n3. मदत (HELP)\n4. रद्द करा (CANCEL)";
    } else if (lang === 'hi') {
      fallbackText = intentMsg + "\n\n1. " + intentRows[0].title + "\n2. " + intentRows[1].title + "\n3. सहायता (HELP)\n4. रद्द करें (CANCEL)";
    } else {
      fallbackText = intentMsg + "\n\n1. " + intentRows[0].title + "\n2. " + intentRows[1].title + "\n3. Help\n4. Cancel";
    }
    await sendMessage(sender, fallbackText);
  }
}

async function sendWardListPrompt(sender, lang) {
  // Hardcoded ward selection list is no longer shown to citizen.
}

async function sendTimeoutPrompt(sender, lang) {
  let welcomeBackMsg = '';
  let buttonLabel = '';
  let timeoutRows = [];
  if (lang === 'mr') {
    welcomeBackMsg = `CivicVoice हेल्पलाईनमध्ये आपले स्वागत आहे. 🏛️\n\nतुमची एक अपूर्ण तक्रार प्रगतीपथावर आहे.\n\nतुम्हाला काय करायचे आहे?`;
    buttonLabel = 'पर्याय निवडा';
    timeoutRows = [
      { id: 'timeout_continue', title: '🔄 चालू ठेवा', description: 'अपूर्ण तक्रार सुरू ठेवा' },
      { id: 'timeout_new', title: '➕ नवीन सुरू करा', description: 'मागील मसुदा रद्द करा' },
      { id: 'global_help', title: '❓ मदत', description: 'मदत मिळवा' },
      { id: 'global_cancel', title: '❌ रद्द करा', description: 'संभाषण पुन्हा सुरू करा' }
    ];
  } else if (lang === 'hi') {
    welcomeBackMsg = `CivicVoice हेल्पलाइन में आपका स्वागत है। 🏛️\n\nआपकी एक अधूरी शिकायत प्रगति पर है।\n\nआप क्या करना चाहते हैं?`;
    buttonLabel = 'विकल्प चुनें';
    timeoutRows = [
      { id: 'timeout_continue', title: '🔄 जारी रखें', description: 'अधूरी शिकायत जारी रखें' },
      { id: 'timeout_new', title: '➕ नया शुरू करें', description: 'पिछला मसौदा रद्द करें' },
      { id: 'global_help', title: '❓ सहायता', description: 'मदद प्राप्त करें' },
      { id: 'global_cancel', title: '❌ रद्द करें', description: 'बातचीत फिर से शुरू करें' }
    ];
  } else {
    welcomeBackMsg = `Welcome back to CivicVoice Helpline. 🏛️\n\nWe found an incomplete complaint in progress.\n\nWhat would you like to do?`;
    buttonLabel = 'Choose Option';
    timeoutRows = [
      { id: 'timeout_continue', title: '🔄 Continue', description: 'Resume pending complaint' },
      { id: 'timeout_new', title: '➕ Start New', description: 'Discard draft and start fresh' },
      { id: 'global_help', title: '❓ Help', description: 'Get assistance' },
      { id: 'global_cancel', title: '❌ Cancel', description: 'Restart conversation' }
    ];
  }

  try {
    await sendListMessage(sender, welcomeBackMsg, buttonLabel, timeoutRows);
  } catch (err) {
    let fallbackText = '';
    if (lang === 'mr') {
      fallbackText = welcomeBackMsg + '\n\n1. ' + timeoutRows[0].title + '\n2. ' + timeoutRows[1].title + '\n3. मदत (HELP)\n4. रद्द करा (CANCEL)';
    } else if (lang === 'hi') {
      fallbackText = welcomeBackMsg + '\n\n1. ' + timeoutRows[0].title + '\n2. ' + timeoutRows[1].title + '\n3. सहायता (HELP)\n4. रद्द करें (CANCEL)';
    } else {
      fallbackText = welcomeBackMsg + '\n\n1. ' + timeoutRows[0].title + '\n2. ' + timeoutRows[1].title + '\n3. Help\n4. Cancel';
    }
    await sendMessage(sender, fallbackText);
  }
}

async function sendExtractionSummary(sender, state, lang) {
  const structuredComplaint = state.pendingStructuredComplaint.structured;
  const { formatCategoryLabel } = require('../../notifications/templates/complaintTemplates');
  const formatSubcategory = (sub, l) => {
    if (!sub) return l === 'mr' ? 'सामान्य' : l === 'hi' ? 'सामान्य' : 'General';
    return sub.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const displayCat = formatCategoryLabel(structuredComplaint.category, lang);
  const displaySub = formatSubcategory(structuredComplaint.subcategory, lang);
  const displayDesc = structuredComplaint.description || '';

  const isLowConfidence = typeof structuredComplaint.confidence === 'number' && structuredComplaint.confidence < 0.6;
  let lowConfidenceWarning = '';
  if (isLowConfidence) {
    if (lang === 'mr') {
      lowConfidenceWarning = '⚠️ *टीप*: आमच्या AI ला या वर्गीकरणाबद्दल पूर्ण खात्री नाही. जर हे चुकीचे वाटत असल्यास, कृपया दुरुस्त करण्यासाठी "दुरुस्त करा" वर क्लिक करा.\n\n';
    } else if (lang === 'hi') {
      lowConfidenceWarning = '⚠️ *टिप्पणी*: हमारे AI को इस वर्गीकरण के बारे में पूरी तरह से यकीन नहीं है। यदि यह गलत लगता है, तो कृपया सुधार करने के लिए "सुधार करें" पर क्लिक करें।\n\n';
    } else {
      lowConfidenceWarning = '⚠️ *Note*: Our AI is not very confident about this classification. If it seems incorrect, please click "Let me fix it" to correct it.\n\n';
    }
  }

  let summaryMsg = '';
  let buttonLabel = '';
  let confirmRows = [];
  if (lang === 'mr') {
    summaryMsg = `🤖 *CivicVoice AI समजूत*\n\nआम्हाला तुमच्या तक्रारीचे खालील तपशील समजले आहेत:\n📂 *विभाग*: *${displayCat}*\n🏷️ *उपविभाग*: *${displaySub}*\n📝 *थोडक्यात वर्णन*: ${displayDesc}\n\n${lowConfidenceWarning}हे बरोबर आहे का?`;
    buttonLabel = 'पर्याय निवडा';
    confirmRows = [
      { id: 'confirm_looks_right', title: '✅ बरोबर आहे', description: 'माहिती बरोबर असल्याचे निश्चित करा' },
      { id: 'confirm_fix_it', title: '📝 दुरुस्त करा', description: 'योग्य तपशील प्रदान करा' },
      { id: 'global_help', title: '❓ मदत', description: 'मदत मिळवा' },
      { id: 'global_cancel', title: '❌ रद्द करा', description: 'संभाषण पुन्हा सुरू करा' }
    ];
  } else if (lang === 'hi') {
    summaryMsg = `🤖 *CivicVoice AI समझ*\n\nहमें आपकी शिकायत के निम्नलिखित विवरण समझ आए हैं:\n📂 *श्रेणी*: *${displayCat}*\n🏷️ *उपश्रेणी*: *${displaySub}*\n📝 *संक्षिप्त विवरण*: ${displayDesc}\n\n${lowConfidenceWarning}क्या यह सही है?`;
    buttonLabel = 'विकल्प चुनें';
    confirmRows = [
      { id: 'confirm_looks_right', title: '✅ सही है', description: 'जानकारी सही होने की पुष्टि करें' },
      { id: 'confirm_fix_it', title: '📝 सुधार करें', description: 'सही विवरण प्रदान करें' },
      { id: 'global_help', title: '❓ सहायता', description: 'मदद प्राप्त करें' },
      { id: 'global_cancel', title: '❌ रद्द करें', description: 'बातचीत फिर से शुरू करें' }
    ];
  } else {
    summaryMsg = `🤖 *CivicVoice AI Understanding*\n\nWe understood your complaint as:\n📂 *Category*: *${displayCat}*\n🏷️ *Category Scope*: *${displaySub}*\n📝 *Summary*: ${displayDesc}\n\n${lowConfidenceWarning}Is that right?`;
    buttonLabel = 'Choose Option';
    confirmRows = [
      { id: 'confirm_looks_right', title: '✅ Looks Right', description: 'Confirm parsed category' },
      { id: 'confirm_fix_it', title: '📝 Let Me Fix It', description: 'Provide correct category/details' },
      { id: 'global_help', title: '❓ Help', description: 'Get assistance' },
      { id: 'global_cancel', title: '❌ Cancel', description: 'Restart conversation' }
    ];
  }

  try {
    await sendListMessage(sender, summaryMsg, buttonLabel, confirmRows);
  } catch (err) {
    let fallbackText = '';
    if (lang === 'mr') {
      fallbackText = summaryMsg + '\n\n1. ' + confirmRows[0].title + '\n2. ' + confirmRows[1].title + '\n3. मदत (HELP)\n4. रद्द करा (CANCEL)';
    } else if (lang === 'hi') {
      fallbackText = summaryMsg + '\n\n1. ' + confirmRows[0].title + '\n2. ' + confirmRows[1].title + '\n3. सहायता (HELP)\n4. रद्द करें (CANCEL)';
    } else {
      fallbackText = summaryMsg + '\n\n1. ' + confirmRows[0].title + '\n2. ' + confirmRows[1].title + '\n3. Help\n4. Cancel';
    }
    await sendMessage(sender, fallbackText);
  }
}

async function rePromptCurrentStep(sender, step, lang) {
  const cancelHelpFooter = lang === 'mr'
    ? '\n\n_रीसेट करण्यासाठी CANCEL किंवा मदतीसाठी HELP लिहा._'
    : lang === 'hi'
    ? '\n\n_रीसेट करने के लिए CANCEL या सहायता के लिए HELP लिखें।_'
    : '\n\n_Reply CANCEL to restart or HELP for assistance._';

  if (step === 'awaiting_language') {
    await sendLanguagePrompt(sender);
  } else if (step === 'awaiting_intent') {
    await sendIntentPrompt(sender, lang);
  } else if (step === 'collecting_input') {
    let activeMsg = lang === 'mr'
      ? "✍️ *तुमची तक्रार नोंदवा*\n\nकृपया समस्येचा तपशील पाठवा. तुम्ही करू शकता:\n📝 तपशील *टाईप* करा\n🎙️ *व्हॉइस नोट* पाठवा\n📷 समस्येचा *फोटो* पाठवा\n\nसर्व तपशील पाठवून झाल्यावर खालील 'झाले' वर क्लिक करा."
      : lang === 'hi'
      ? "✍️ *अपनी शिकायत का विवरण दें*\n\nकृपया अपनी समस्या का विवरण भेजें। आप कर सकते हैं:\n📝 विवरण *टाइप* करें\n🎙️ *वॉयस नोट* भेजें\n📷 समस्या का *फोटो* भेजें\n\nसभी विवरण भेजने के बाद नीचे 'पूर्ण' पर क्लिक करें।"
      : "✍️ *Describe your grievance*\n\nPlease send us the details of your issue. You can:\n📝 *Type* it out\n🎙️ Send a *voice note*\n📷 Attach a *photo*\n\nOnce you are finished adding details, tap 'Done' below.";

    let ackButtons = [];
    if (lang === 'mr') {
      ackButtons = [
        { id: 'collect_done', title: '✅ झाले' },
        { id: 'global_cancel', title: '❌ रद्द करा' }
      ];
    } else if (lang === 'hi') {
      ackButtons = [
        { id: 'collect_done', title: '✅ पूर्ण' },
        { id: 'global_cancel', title: '❌ रद्द करें' }
      ];
    } else {
      ackButtons = [
        { id: 'collect_done', title: '✅ Done' },
        { id: 'global_cancel', title: '❌ Cancel' }
      ];
    }

    try {
      await sendButtonMessage(sender, activeMsg, ackButtons);
    } catch (err) {
      await sendMessage(sender, activeMsg);
    }
  } else if (step === 'awaiting_presubmit_confirm') {
    const state = await ConversationState.findOne({ phoneNumber: sender.replace(/\D/g, '') });
    if (state) {
      let inactivityMsg = lang === 'mr' ? 'तुमची तक्रार दाखल करण्यास तयार आहात, की अजून काही जोडायचे आहे?' : lang === 'hi' ? 'क्या आप शिकायत दर्ज करने के लिए तैयार हैं, या अभी कुछ और जोड़ना है?' : 'Ready to submit, or still adding something?';
      inactivityMsg += cancelHelpFooter;
      let buttonLabel = '';
      let inactivityRows = [];
      if (lang === 'mr') {
        buttonLabel = 'पर्याय निवडा';
        inactivityRows = [
          { id: 'presubmit_submit', title: '✅ दाखल करा', description: 'तक्रार सबमिट करा' },
          { id: 'presubmit_adding', title: '➕ आणखी जोडा', description: 'अधिक तपशील जोडा' },
          { id: 'global_help', title: '❓ मदत', description: 'मदत मिळवा' },
          { id: 'global_cancel', title: '❌ रद्द करा', description: 'संभाषण पुन्हा सुरू करा' }
        ];
      } else if (lang === 'hi') {
        buttonLabel = 'विकल्प चुनें';
        inactivityRows = [
          { id: 'presubmit_submit', title: '✅ दर्ज करें', description: 'शिकायत सबमिट करें' },
          { id: 'presubmit_adding', title: '➕ और जोड़ें', description: 'और विवरण जोड़ें' },
          { id: 'global_help', title: '❓ सहायता', description: 'मदद प्राप्त करें' },
          { id: 'global_cancel', title: '❌ रद्द करें', description: 'बातचीत फिर से शुरू करें' }
        ];
      } else {
        buttonLabel = 'Choose Option';
        inactivityRows = [
          { id: 'presubmit_submit', title: '✅ Submit', description: 'Submit collected details' },
          { id: 'presubmit_adding', title: '➕ Still Adding', description: 'Add more details' },
          { id: 'global_help', title: '❓ Help', description: 'Get assistance' },
          { id: 'global_cancel', title: '❌ Cancel', description: 'Restart conversation' }
        ];
      }
      try {
        await sendListMessage(sender, inactivityMsg, buttonLabel, inactivityRows);
      } catch (err) {
        let fallbackText = '';
        if (lang === 'mr') {
          fallbackText = inactivityMsg + '\n\n1. ' + inactivityRows[0].title + '\n2. ' + inactivityRows[1].title + '\n3. मदत (HELP)\n4. रद्द करा (CANCEL)';
        } else if (lang === 'hi') {
          fallbackText = inactivityMsg + '\n\n1. ' + inactivityRows[0].title + '\n2. ' + inactivityRows[1].title + '\n3. सहायता (HELP)\n4. रद्द करें (CANCEL)';
        } else {
          fallbackText = inactivityMsg + '\n\n1. ' + inactivityRows[0].title + '\n2. ' + inactivityRows[1].title + '\n3. Help\n4. Cancel';
        }
        await sendMessage(sender, fallbackText);
      }
    }
  } else if (step === 'awaiting_confirm_edit') {
    const state = await ConversationState.findOne({ phoneNumber: sender.replace(/\D/g, '') });
    if (state && state.pendingStructuredComplaint) {
      await sendExtractionSummary(sender, state, lang);
    }
  } else if (step === 'awaiting_complaint_text') {
    let fixPrompt = lang === 'mr' ? 'कृपया तुमच्या तक्रारीसाठी दुरुस्ती टाईप करा:' : lang === 'hi' ? 'कृपया अपनी शिकायत के लिए सुधार टाइप करें:' : 'Please type the correction for your complaint:';
    fixPrompt += cancelHelpFooter;
    await sendMessage(sender, fixPrompt);
  } else if (step === 'location_requested') {
    let locationPrompt = lang === 'mr'
      ? 'कृपया तुमचे स्थान शेअर करा. 📍 तुम्ही व्हॉट्सॲपवरून लोकेशन पिन पाठवू शकता किंवा तुमचा पत्ता/परिसराचे नाव टाईप करू शकता.'
      : lang === 'hi'
      ? 'कृपया अपनी लोकेशन साझा करें। 📍 आप व्हाट्सएप से लोकेशन पिन भेज सकते हैं या अपना पता/क्षेत्र का नाम टाइप कर सकते हैं.'
      : 'Please share your location. 📍 You can send a WhatsApp location pin, or type your address/area name.';
    locationPrompt += cancelHelpFooter;
    
    try {
      let bodyText = lang === 'mr'
        ? '📍 तक्रार नोंदणीसाठी खालील बटण वापरून तुमचे स्थान शेअर करा. किंवा तुमचा पत्ता/परिसराचे नाव खाली टाईप करा.'
        : lang === 'hi'
        ? '📍 शिकायत स्थल दर्ज करने के लिए नीचे दिए गए बटन का उपयोग करके अपनी लोकेशन साझा करें। अथवा नीचे अपना पता/क्षेत्र का नाम टाइप करें।'
        : '📍 Share your location using the button below to register the complaint spot. Alternatively, type your address/area name below.';
      bodyText += cancelHelpFooter;
      await sendLocationRequestMessage(sender, bodyText);
    } catch (err) {
      await sendMessage(sender, locationPrompt);
    }
  } else if (step === 'awaiting_timeout_choice') {
    await sendTimeoutPrompt(sender, lang);
  }
}

async function finalizeIntakeComplaint(sender, state, lang) {
  const pending = state.pendingStructuredComplaint || {};
  const coordinates = pending.location?.coordinates;

  const internalMessage = {
    channel: 'whatsapp',
    senderId: sender,
    rawText: pending.rawText,
    timestamp: new Date(),
    attachment: pending.attachment,
    coordinates: coordinates ? { lat: coordinates[1], lng: coordinates[0] } : undefined,
    wardIdOverride: pending.wardId,
    flaggedForReviewOverride: pending.flaggedForReview,
    flagReasonOverride: pending.flagReason
  };

  const registeringMsg = lang === 'mr' ? '⏳ तक्रार नोंदवत आहे...' : lang === 'hi' ? '⏳ शिकायत दर्ज की जा रही है...' : '⏳ Registering complaint...';
  try {
    await sendMessage(sender, registeringMsg);
  } catch (sendErr) { }

  try {
    const result = await complaintService.createComplaint(internalMessage);

    state.step = 'collecting_input';
    state.pendingComplaintId = null;
    state.pendingComplaint = null;
    state.pendingStructuredComplaint = null;
    await state.save();

    if (result && result.duplicate) {
      const existing = result.complaint || {};
      let dupMsg = '';
      
      const statusLabel = existing.status || 'received';
      let statusLocalized = statusLabel;
      if (lang === 'mr') {
        const mrMap = { received: 'प्राप्त', assigned: 'नियुक्त', in_progress: 'प्रगतीपथावर', needsclarification: 'तपशील आवश्यक', resolved: 'निवारण झाले' };
        statusLocalized = mrMap[statusLabel.toLowerCase()] || statusLabel;
        dupMsg = `⚠️ आम्हाल अलीकडेच तुमच्याकडून अशीच तक्रार प्राप्त झाली आहे (संदर्भ क्र: ${existing._id}). सध्याची स्थिती: ${statusLocalized}. आम्ही यावर काम करत आहोत आणि लवकरच तुम्हाला अपडेट करू.`;
      } else if (lang === 'hi') {
        const hiMap = { received: 'प्राप्त', assigned: 'सौंपा गया', in_progress: 'प्रगति पर', needsclarification: 'विवरण आवश्यक', resolved: 'निवारण हो चुका' };
        statusLocalized = hiMap[statusLabel.toLowerCase()] || statusLabel;
        dupMsg = `⚠️ हमें हाल ही में आपकी ऐसी ही शिकायत मिली है (संदर्भ संख्या: ${existing._id})। वर्तमान स्थिति: ${statusLocalized}। हम इस पर काम कर रहे हैं और जल्द ही आपको अपडेट करेंगे।`;
      } else {
        const enMap = { received: 'Received', assigned: 'Assigned', in_progress: 'In Progress', needsclarification: 'Needs More Details', resolved: 'Resolved' };
        statusLocalized = enMap[statusLabel.toLowerCase()] || statusLabel;
        dupMsg = `⚠️ We already received a similar complaint from you recently (Reference ID: ${existing._id}). Current Status: ${statusLocalized}. We are working on it and will update you soon.`;
      }

      await sendMessage(sender, dupMsg);
      return;
    }
  } catch (err) {
    logger.error('Error creating complaint at final state', { error: err.message });
    state.step = 'collecting_input';
    // Preserve session state buffer if saving to DB fails
    await state.save();
    await sendMessage(sender, lang === 'mr' ? 'तक्रार जतन करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.' : lang === 'hi' ? 'शिकायत सहेजते समय त्रुटि हुई। कृपया पुन: प्रयास करें।' : 'Sorry, there was an error saving your complaint. Please try again.');
  }
}

/**
 * Checks whether raw message text is a status lookup keyword request.
 * @param {string} text
 * @returns {boolean}
 */
function isStatusKeyword(text) {
  if (!text || typeof text !== 'string') return false;
  const normalized = text.trim().toUpperCase();
  return STATUS_KEYWORDS.some((kw) => normalized === kw || normalized.startsWith('STATUS ') || normalized.startsWith('CHECK STATUS'));
}

/**
 * Handles processing of a WhatsApp webhook event payload.
 */
async function handleWhatsappWebhookJob(data) {
  const { payload, traceId } = data;
  
  logger.info('[Worker] Processing async WhatsApp webhook payload...', { traceId });

  const firstMessage = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!firstMessage) {
    logger.info('[Worker] WhatsApp webhook payload contains no actionable messages', { traceId });
    return;
  }

  // 1. Message Age / Freshness Check
  if (firstMessage.timestamp) {
    const messageTimestampSec = parseInt(firstMessage.timestamp, 10);
    const currentTimestampSec = Math.floor(Date.now() / 1000);
    const ageSeconds = currentTimestampSec - messageTimestampSec;
    if (ageSeconds > 120) {
      logger.warn('[Worker] WhatsApp message ignored due to age (older than 2 minutes)', {
        messageId: firstMessage.id,
        timestamp: firstMessage.timestamp,
        ageSeconds,
        traceId
      });
      return;
    }
  }

  // 2. Message Idempotency / Deduplication Check
  if (firstMessage.id && isDuplicateMessage(firstMessage.id)) {
    logger.warn('[Worker] WhatsApp message ignored because it is a duplicate (already processed)', {
      messageId: firstMessage.id,
      traceId
    });
    return;
  }

  const sender = firstMessage.from;
  const type = firstMessage.type;

  const { formatIndianPhoneNumber } = require('../../utils/phoneHelper');
  const formattedPhone = formatIndianPhoneNumber(sender);
  const cleanPhone = formattedPhone.replace(/\D/g, '');

  // 1. Look up Conversation State and Citizen preference early
  let state = await ConversationState.findOne({ phoneNumber: cleanPhone });
  const citizen = await Citizen.findOne({ phone: formattedPhone });

  let rawText = '';
  let attachment = null;
  let locationObj = null;
  let interactiveId = null;

  if (type === 'text') {
    rawText = firstMessage.text?.body;
  } else if (type === 'location') {
    locationObj = firstMessage.location;
  } else if (type === 'interactive') {
    if (firstMessage.interactive?.button_reply) {
      interactiveId = firstMessage.interactive.button_reply.id;
      rawText = firstMessage.interactive.button_reply.title;
    } else if (firstMessage.interactive?.list_reply) {
      interactiveId = firstMessage.interactive.list_reply.id;
      rawText = firstMessage.interactive.list_reply.title;
    }
  } else if (type === 'audio' || type === 'voice') {
    // Skip audio processing if awaiting location pin to optimize
    if (state && state.step === 'awaiting_location') {
      // Will be handled as unsupported in state machine
    } else {
      const audioObj = firstMessage.audio || firstMessage.voice;
      const mediaId = audioObj?.id;
      if (!mediaId) {
        logger.warn('[Worker] WhatsApp audio message is missing media ID', { traceId });
        return;
      }

      try {
        const { transcribeAudio } = require('../../ai/stt/transcriber');

        const { buffer, mimeType } = await downloadMedia(mediaId);
        const sttResult = await transcribeAudio(buffer, mimeType);

        rawText = sttResult.transcript;
        logger.info('[Worker] WhatsApp audio transcription result', { sender, rawText, confidence: sttResult.confidence, traceId });
      } catch (transcribeErr) {
        logger.error('[Worker] Error during audio transcription', { error: transcribeErr.message, traceId });
      }

      if (!rawText || !rawText.trim()) {
        try {
          await sendMessage(
            sender,
            "Sorry, I couldn't clearly hear your voice message. Please try sending it again or type your complaint as text."
          );
        } catch (sendErr) {
          logger.error('[Worker] Error fallback message send failed', { recipient: sender, traceId });
        }
        return;
      }
    }
  } else if (type === 'image') {
    // Skip image download if awaiting location pin to optimize
    if (state && state.step === 'awaiting_location') {
      // Will be handled as unsupported in state machine
    } else {
      const imgObj = firstMessage.image;
      const mediaId = imgObj?.id;
      if (!mediaId) {
        logger.warn('[Worker] WhatsApp image message is missing media ID', { traceId });
        return;
      }

      try {
        const { downloadMedia: downloadToUrl } = require('../../media/mediaDownloader');

        rawText = imgObj.caption || '';
        const downloadResult = await downloadToUrl(mediaId, imgObj.mime_type || 'image/jpeg');

        attachment = {
          url: downloadResult.url,
          mediaId: mediaId,
          mimeType: downloadResult.mimeType,
          uploadedAt: new Date(),
        };

        if (!rawText || !rawText.trim()) {
          rawText = 'Image Complaint';
        }
      } catch (err) {
        logger.error('[Worker] Error during image processing in worker', { error: err.message, stack: err.stack, traceId });
        try {
          await sendMessage(sender, "Sorry, we encountered an error processing your image. Please try again.");
        } catch (sendErr) {
          logger.warn('[Worker] Failed to send error notification for image processing route', { recipient: sender, traceId });
        }
        return;
      }
    }
  } else {
    logger.info(`[Worker] Unsupported message type: ${type}`, { traceId });
    // If not in awaiting_location state, ignore/return early
    if (!state || state.step !== 'awaiting_location') {
      return;
    }
  }

  if (type !== 'location' && type !== 'interactive' && (state?.step !== 'awaiting_location' || type === 'text') && (!rawText || !rawText.trim())) {
    logger.warn('[Worker] WhatsApp message has no raw text body content after processing', { traceId });
    return;
  }

  const textNormalized = (rawText || '').trim().toLowerCase();
  const isStartKeyword = ['hi', 'hello', 'start'].includes(textNormalized);

  const lang = state?.language || (citizen?.language || 'en');

  // 1. Universal Cancel / Restart Check
  if (interactiveId === 'global_cancel' || ['cancel', 'restart', 'radd', 'रद्द करा', 'रद्द करें', 'रद्द'].includes(textNormalized)) {
    if (state) {
      state.step = 'awaiting_intent';
      state.pendingComplaintId = null;
      state.pendingComplaint = null;
      state.pendingStructuredComplaint = null;
      state.lastInteractionAt = new Date();
      await state.save();
    }
    const cancelMsg = lang === 'mr' 
      ? '❌ संभाषण रीसेट केले. चला पुन्हा सुरुवात करूया.' 
      : lang === 'hi' 
      ? '❌ बातचीत रीसेट कर दी गई है। आइए फिर से शुरू करें।' 
      : '❌ Conversation reset. Let\'s start over.';
    await sendMessage(sender, cancelMsg);
    await sendIntentPrompt(sender, lang);
    return;
  }

  // 2. Universal Help Check
  if (interactiveId === 'global_help' || ['help', 'मदत', 'सहायता'].includes(textNormalized)) {
    let helpMsg = '';
    if (lang === 'mr') {
      helpMsg = "🏛️ *CivicVoice बद्दल माहिती*\nCivicVoice ही तुमची AI-आधारित पालिका मदतसेवा आहे. रस्ते, कचरा, पाणी यांसारख्या समस्या थेट व्हॉट्सॲपवरून नोंदवा!\n\n📲 *वापर कसा करावा:*\n१. *समस्या सांगा:* मेसेज टाईप करा, व्हॉईस नोट किंवा फोटो पाठवा.\n२. *लोकेशन शेअर करा:* लोकेशन पिन किंवा पत्ता टाईप करा.\n३. *स्थिती तपासा:* स्टेटस पाहण्यासाठी कधीही STATUS लिहा.\n\n_मुख्य मेनूवर जाण्यासाठी कधीही CANCEL लिहा._";
    } else if (lang === 'hi') {
      helpMsg = "🏛️ *CivicVoice के बारे में*\nCivicVoice आपकी AI-संचालित नागरिक सेवा है। सड़कें, कचरा, पानी जैसी समस्याओं को सीधे व्हाट्सएप से दर्ज करें!\n\n📲 *उपयोग कैसे करें:*\n1. *समस्या बताएं:* टेक्स्ट टाइप करें, वॉइस नोट या फोटो भेजें।\n2. *लोकेशन शेयर करें:* लोकेशन पिन या पता टाइप करें।\n3. *स्टेटस ट्रैक करें:* स्थिति देखने के लिए कभी भी STATUS लिखें।\n\n_मुख्य मेनू पर जाने के लिए कभी भी CANCEL लिखें।_";
    } else {
      helpMsg = "🏛️ *About CivicVoice*\nCivicVoice is your AI-powered municipal helpline. Report civic issues (potholes, garbage, water leaks) directly via WhatsApp—no apps or logins needed!\n\n📲 *How to Use:*\n1. *Describe Issue:* Type text, send a voice note, or attach a photo.\n2. *Share Location:* Tap the location button or type your address.\n3. *Track Status:* Reply STATUS anytime to track your complaint.\n\n_Reply CANCEL anytime to return to the main menu._";
    }
    await sendMessage(sender, helpMsg);
    if (state && state.step) {
      await rePromptCurrentStep(sender, state.step, lang);
    }
    return;
  }

  // 2.5 Universal Status Check (keeps draft session intact)
  if (interactiveId === 'global_status' || isStatusKeyword(rawText)) {
    const complaints = await Complaint.find({
      $or: [
        { senderId: sender },
        { senderId: cleanPhone },
        { senderId: `+${cleanPhone}` }
      ]
    }).sort({ createdAt: -1 }).limit(5).lean();

    const { formatCategoryLabel, formatStatusLabel } = require('../../notifications/templates/complaintTemplates');

    let responseText = '';
    if (!complaints || complaints.length === 0) {
      responseText = lang === 'mr' ? '❌ तुमच्या नावावर कोणतीही नोंदणीकृत तक्रार आढळलेली नाही.' : lang === 'hi' ? '❌ आपके नाम पर कोई पंजीकृत शिकायत नहीं मिली।' : '❌ You have no registered complaints on record.';
    } else {
      const listText = complaints
        .map((c, i) => {
          const category = formatCategoryLabel(c.structured?.category, lang);
          const statusLabel = formatStatusLabel(c.status, lang);
          const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A';
          return `${i + 1}. ID: *${c._id}*\n   📂 *Category*: ${category}\n   🕐 *Status*: ${statusLabel}\n   📅 *Updated*: ${dateStr}`;
        })
        .join('\n\n');

      responseText = lang === 'mr' ? `📋 *तुमच्या नोंदणीकृत तक्रारी*:\n\n${listText}` : lang === 'hi' ? `📋 *आपकी पंजीकृत शिकायतें*:\n\n${listText}` : `📋 *Your Registered Complaints*:\n\n${listText}`;
    }

    await sendMessage(sender, responseText);
    if (state && state.step) {
      await rePromptCurrentStep(sender, state.step, lang);
      return;
    }
  }

  // 3. 15-Minute Session Timeout Re-orientation
  const now = new Date();
  if (state && !isStartKeyword && state.step) {
    const lastInteraction = state.lastInteractionAt || state.updatedAt || now;
    const diffMs = now - lastInteraction;
    const diffMins = diffMs / (1000 * 60);

    if (diffMins > 15) {
      state.lastInteractionAt = now;
      await state.save();

      const welcomeBackMsg = lang === 'mr'
        ? '👋 पुन्हा स्वागत आहे! तुम्ही इथे थांबला होतात:'
        : lang === 'hi'
        ? '👋 स्वागत है! आप यहाँ रुके थे:'
        : '👋 Welcome back! Here is where you left off:';
      await sendMessage(sender, welcomeBackMsg);
      await rePromptCurrentStep(sender, state.step, lang);
      return;
    }
  }

  if (state) {
    state.lastInteractionAt = now;
    await state.save();
  }

  if (isStartKeyword) {
    const oldStep = state ? state.step : 'none';
    if (!state) {
      state = new ConversationState({ phoneNumber: cleanPhone });
    }
    state.step = 'awaiting_language';
    state.language = null;
    state.pendingComplaint = null;
    state.pendingStructuredComplaint = null;
    state.lastInteractionAt = new Date();
    await state.save();

    console.log(`[state] ${cleanPhone} moved from ${oldStep} to awaiting_language (forced via keyword)`);
    await sendLanguagePrompt(sender);
    return;
  }

  if (!state || !state.step) {
    const oldStep = state ? state.step : 'none';
    if (!state) {
      state = new ConversationState({ phoneNumber: cleanPhone });
    }
    state.pendingComplaint = null;
    state.pendingStructuredComplaint = null;
    state.lastInteractionAt = new Date();

    if (citizen && citizen.language) {
      state.step = 'awaiting_intent';
      state.language = citizen.language;
      await state.save();
      console.log(`[state] ${cleanPhone} moved from ${oldStep} to awaiting_intent (saved language: ${citizen.language})`);
      await sendIntentPrompt(sender, citizen.language);
    } else {
      state.step = 'awaiting_language';
      state.language = null;
      await state.save();
      console.log(`[state] ${cleanPhone} moved from ${oldStep} to awaiting_language (no saved language)`);
      await sendLanguagePrompt(sender);
    }
    return;
  }

  // Handle Timeout Choice step
  if (state.step === 'awaiting_timeout_choice') {
    const lang = state.language || 'en';
    let isContinue = false;
    let isStartNew = false;

    if (interactiveId === 'timeout_continue' || ['1', 'continue', 'चालू', 'चालू ठेवा', 'जारी', 'जारी रखें'].includes(textNormalized)) {
      isContinue = true;
    } else if (interactiveId === 'timeout_new' || ['2', 'start new', 'new', 'नवीन', 'नवीन सुरू करा', 'नया', 'नया शुरू करें'].includes(textNormalized)) {
      isStartNew = true;
    }

    if (isContinue) {
      let targetStep = 'collecting_input';
      if (state.pendingStructuredComplaint && state.pendingStructuredComplaint.location) {
        targetStep = 'location_requested';
      } else if (state.pendingStructuredComplaint && state.pendingStructuredComplaint.structured?.category) {
        targetStep = 'awaiting_confirm_edit';
      }

      state.step = targetStep;
      if (!state.pendingComplaint) {
        state.pendingComplaint = { intent: 'report', inputs: [] };
      } else {
        state.pendingComplaint.intent = 'report';
      }
      state.lastInteractionAt = new Date();
      await state.save();

      await rePromptCurrentStep(sender, targetStep, lang);
    } else if (isStartNew) {
      state.step = 'collecting_input';
      state.pendingComplaint = { intent: 'report', inputs: [] };
      state.pendingStructuredComplaint = null;
      state.lastInteractionAt = new Date();
      await state.save();

      await rePromptCurrentStep(sender, 'collecting_input', lang);
    } else {
      const fallbackWarning = lang === 'mr'
        ? '⚠️ मला ते समजले नाही. कृपया खालील पर्यायांपैकी एक निवडा, किंवा रद्द करण्यासाठी CANCEL लिहा.'
        : lang === 'hi'
        ? '⚠️ मुझे समझ नहीं आया। कृपया नीचे दिए गए विकल्पों में से एक चुनें, या रीसेट करने के लिए CANCEL लिखें।'
        : "⚠️ I didn't understand that. Please select one of the options below, or reply CANCEL to reset.";
      await sendMessage(sender, fallbackWarning);
      await sendTimeoutPrompt(sender, lang);
    }
    return;
  }

  // 2. Process Onboarding State Machine
  if (state.step === 'awaiting_language') {
    let chosenLang = null;
    if (interactiveId === 'lang_en' || ['1', 'english', 'eng', 'en'].includes(textNormalized)) {
      chosenLang = 'en';
    } else if (interactiveId === 'lang_mr' || ['2', 'marathi', 'mar', 'mr', 'मराठी'].includes(textNormalized)) {
      chosenLang = 'mr';
    } else if (interactiveId === 'lang_hi' || ['3', 'hindi', 'hin', 'hi', 'हिंदी'].includes(textNormalized)) {
      chosenLang = 'hi';
    }

    if (chosenLang) {
      const oldStep = state.step;
      state.step = 'awaiting_intent';
      state.language = chosenLang;
      state.lastInteractionAt = new Date();
      await state.save();

      console.log(`[state] ${cleanPhone} moved from ${oldStep} to awaiting_intent`);

      if (citizen) {
        citizen.language = chosenLang;
        await citizen.save();
      }

      await sendIntentPrompt(sender, chosenLang);
    } else {
      const fallbackWarning = "⚠️ I didn't understand that. Please select one of the options below.\n⚠️ मला ते समजले नाही. कृपया खालील पर्यायांपैकी एक निवडा.\n⚠️ मुझे समझ नहीं आया। कृपया नीचे दिए गए विकल्पों में से एक चुनें।";
      await sendMessage(sender, fallbackWarning);
      await sendLanguagePrompt(sender);
    }
    return;
  }

  if (state.step === 'awaiting_intent') {
    const lang = state.language || 'en';
    let isReport = false;
    let isStatus = false;

    if (interactiveId === 'intent_report' || ['1', 'report', 'issue', 'grievance', 'तक्रार नोंदवा', 'शिकायत दर्ज करें', 'नोंदवा', 'दर्ज करें'].includes(textNormalized)) {
      isReport = true;
    } else if (interactiveId === 'intent_status' || ['2', 'status', 'check status', 'तक्रार स्थिती', 'स्थिति जांचें', 'स्थिती', 'जांचें'].includes(textNormalized) || isStatusKeyword(rawText)) {
      isStatus = true;
    }

    if (isReport) {
      state.step = 'collecting_input';
      state.pendingComplaint = { intent: 'report', inputs: [] };
      state.pendingStructuredComplaint = null;
      state.lastInteractionAt = new Date();
      await state.save();

      await rePromptCurrentStep(sender, 'collecting_input', lang);
    } else if (isStatus) {
      const complaints = await Complaint.find({
        $or: [
          { senderId: sender },
          { senderId: cleanPhone },
          { senderId: `+${cleanPhone}` }
        ]
      }).sort({ createdAt: -1 }).limit(5).lean();

      const { formatCategoryLabel, formatStatusLabel } = require('../../notifications/templates/complaintTemplates');

      let responseText = '';
      if (!complaints || complaints.length === 0) {
        responseText = lang === 'mr' ? '❌ तुमच्या नावावर कोणतीही नोंदणीकृत तक्रार आढळली नाही.' : lang === 'hi' ? '❌ आपके नाम पर कोई पंजीकृत शिकायत नहीं मिली।' : '❌ You have no registered complaints on record.';
      } else {
        const listText = complaints
          .map((c, i) => {
            const category = formatCategoryLabel(c.structured?.category, lang);
            const statusLabel = formatStatusLabel(c.status, lang);
            const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A';
            return `${i + 1}. ID: *${c._id}*\n   📂 *Category*: ${category}\n   🕐 *Status*: ${statusLabel}\n   📅 *Updated*: ${dateStr}`;
          })
          .join('\n\n');

        responseText = lang === 'mr' ? `📋 *तुमच्या नोंदणीकृत तक्रारी*:\n\n${listText}` : lang === 'hi' ? `📋 *आपकी पंजीकृत शिकायतें*:\n\n${listText}` : `📋 *Your Registered Complaints*:\n\n${listText}`;
      }

      await sendMessage(sender, responseText);
      await sendIntentPrompt(sender, lang);
    } else {
      const fallbackWarning = lang === 'mr'
        ? '⚠️ मला ते समजले नाही. कृपया खालील पर्यायांपैकी एक निवडा, किंवा रद्द करण्यासाठी CANCEL लिहा.'
        : lang === 'hi'
        ? '⚠️ मुझे समझ नहीं आया। कृपया नीचे दिए गए विकल्पों में से एक चुनें, या रीसेट करने के लिए CANCEL लिखें।'
        : "⚠️ I didn't understand that. Please select one of the options below, or reply CANCEL to reset.";
      await sendMessage(sender, fallbackWarning);
      await sendIntentPrompt(sender, lang);
    }
    return;
  }

  // 3. Process Custom Conversational State Machine Steps
  if (state.step === 'collecting_input') {
    const lang = state.language || 'en';

    if (!state.pendingComplaint || (!state.pendingComplaint.intent && !state.pendingComplaint.category)) {
      state.step = 'awaiting_intent';
      await state.save();
      await sendIntentPrompt(sender, lang);
      return;
    }

    if (!Array.isArray(state.pendingComplaint.inputs)) {
      state.pendingComplaint.inputs = [];
    }

    const isDone = interactiveId === 'collect_done' || ['done', 'पूर्ण', 'समाप्त', 'झाले'].includes(textNormalized);

    if (isDone) {
      const inputs = state.pendingComplaint.inputs || [];
      const hasValidItem = inputs.some(i => i.type === 'text' || i.type === 'image' || i.type === 'voice' || i.type === 'audio');

      if (!hasValidItem) {
        const emptyMsg = lang === 'mr'
          ? '⚠️ कृपया पूर्ण करण्यापूर्वी तुमच्या समस्येबद्दल किमान एक तपशील (मजकूर, फोटो किंवा व्हॉईस मेसेज) शेअर करा.'
          : lang === 'hi'
          ? '⚠️ कृपया पूर्ण करने से पहले अपनी समस्या के बारे में कम से कम एक विवरण (पाठ, फोटो या वॉयस नोट) साझा करें।'
          : '⚠️ Please share at least one detail (text, photo, or voice note) about your issue before tapping Done.';
        await sendMessage(sender, emptyMsg);
        return;
      }

      await runExtractionAndGoToLocation(sender, state, lang, traceId);
      return;
    }

    let itemAdded = false;
    let ackMsg = '';
    let ackButtons = [];

    if (lang === 'mr') {
      ackMsg = '✅ माहिती प्राप्त झाली! अधिक तपशील (फोटो/व्हॉइस/मजकूर) पाठवा किंवा पूर्ण झाल्यावर खालील \'झाले\' वर क्लिक करा.';
      ackButtons = [
        { id: 'collect_done', title: '✅ झाले' },
        { id: 'global_cancel', title: '❌ रद्द करा' }
      ];
    } else if (lang === 'hi') {
      ackMsg = '✅ विवरण प्राप्त हुआ! और विवरण (फोटो/वॉयस/पाठ) भेजें या समाप्त होने पर नीचे \'पूर्ण\' पर क्लिक करें।';
      ackButtons = [
        { id: 'collect_done', title: '✅ पूर्ण' },
        { id: 'global_cancel', title: '❌ रद्द करें' }
      ];
    } else {
      ackMsg = '✅ Details received! Send more details (photos/voice/text) or tap \'Done\' below when finished.';
      ackButtons = [
        { id: 'collect_done', title: '✅ Done' },
        { id: 'global_cancel', title: '❌ Cancel' }
      ];
    }

    if (type === 'image' && attachment) {
      state.pendingComplaint.inputs.push({
        type: 'image',
        text: rawText || 'Image Complaint',
        attachment
      });
      itemAdded = true;
    } else if (type === 'audio' || type === 'voice') {
      if (rawText && rawText.trim()) {
        state.pendingComplaint.inputs.push({
          type: 'voice',
          text: rawText
        });
        itemAdded = true;
      }
    } else if (type === 'text' && rawText && rawText.trim()) {
      const typedText = rawText.trim();
      if (typedText.length < 10) {
        const cancelHelpFooter = lang === 'mr'
          ? '\n\n_रीसेट करण्यासाठी CANCEL किंवा मदतीसाठी HELP लिहा._'
          : lang === 'hi'
          ? '\n\n_रीसेट करने के लिए CANCEL या सहायता के लिए HELP लिखें।_'
          : '\n\n_Reply CANCEL to restart or HELP for assistance._';
        const lengthError = lang === 'mr'
          ? '⚠️ कृपया तुमच्या समस्येचे थोडे अधिक तपशीलवार वर्णन करा (किमान १० अक्षरे), किंवा फोटो / व्हॉईस मेसेज पाठवा.'
          : lang === 'hi'
          ? '⚠️ कृपया अपनी शिकायत का थोड़ा और विस्तार से वर्णन करें (कम से कम 10 अक्षर), या एक फोटो / वॉयस नोट भेजें।'
          : '⚠️ Please describe your grievance in a bit more detail (at least 10 characters), or send a photo / voice note.';
        await sendMessage(sender, lengthError + cancelHelpFooter);
        return;
      }

      state.pendingComplaint.inputs.push({
        type: 'text',
        text: typedText
      });
      itemAdded = true;
    }

    if (itemAdded) {
      state.markModified('pendingComplaint');
      state.lastInteractionAt = new Date();
      await state.save();

      try {
        await sendButtonMessage(sender, ackMsg, ackButtons);
      } catch (err) {
        let fallbackText = ackMsg + '\n\n1. ' + ackButtons[0].title + '\n2. ' + ackButtons[1].title;
        await sendMessage(sender, fallbackText);
      }

      if (complaintQueue) {
        try {
          await complaintQueue.add(
            'inactivity-check',
            { phoneNumber: cleanPhone, timestamp: Date.now() },
            { delay: 75000 }
          );
        } catch (queueErr) {
          logger.warn('Failed to enqueue inactivity check', { error: queueErr.message });
        }
      }
    } else {
      const unsupportedMsg = lang === 'mr'
        ? '⚠️ कृपया फक्त मजकूर संदेश, फोटो किंवा व्हॉईस मेसेज पाठवा. पूर्ण झाल्यावर खालील पर्याय निवडा किंवा *CANCEL* लिहा.'
        : lang === 'hi'
        ? '⚠️ कृपया केवल पाठ संदेश, फोटो या वॉयस मैसेज भेजें। समाप्त होने पर नीचे दिए गए विकल्प चुनें या *CANCEL* लिखें।'
        : '⚠️ Please send text messages, photos, or voice notes only. Tap one of the options below or reply *CANCEL* to restart.';
      try {
        await sendButtonMessage(sender, unsupportedMsg, ackButtons);
      } catch (err) {
        await sendMessage(sender, unsupportedMsg);
      }
    }
    return;
  }

  if (state.step === 'awaiting_presubmit_confirm') {
    const lang = state.language || 'en';
    let isSubmit = false;
    let isStillAdding = false;

    if (interactiveId === 'presubmit_submit' || ['1', 'submit', 'done', 'दाखल करा', 'दर्ज करें', 'पूर्ण', 'झाले'].includes(textNormalized)) {
      isSubmit = true;
    } else if (interactiveId === 'presubmit_adding' || ['2', 'adding', 'still adding', 'अजून जोडायचे आहे', 'अभी और जोड़ना है', 'अजून', 'अभी'].includes(textNormalized)) {
      isStillAdding = true;
    }

    if (isSubmit) {
      await runExtractionAndGoToLocation(sender, state, lang, traceId);
    } else if (isStillAdding) {
      state.step = 'collecting_input';
      if (!state.pendingComplaint) {
        state.pendingComplaint = { intent: 'report', inputs: [] };
      } else {
        state.pendingComplaint.intent = 'report';
      }
      state.lastInteractionAt = new Date();
      await state.save();

      await rePromptCurrentStep(sender, 'collecting_input', lang);
    } else {
      const fallbackWarning = lang === 'mr'
        ? '⚠️ मला ते समजले नाही. कृपया खालील पर्यायांपैकी एक निवडा, किंवा रद्द करण्यासाठी CANCEL लिहा.'
        : lang === 'hi'
        ? '⚠️ मुझे समझ नहीं आया। कृपया नीचे दिए गए विकल्पों में से एक चुनें, या रीसेट करने के लिए CANCEL लिखें।'
        : "⚠️ I didn't understand that. Please select one of the options below, or reply CANCEL to reset.";
      await sendMessage(sender, fallbackWarning);
      await rePromptCurrentStep(sender, 'awaiting_presubmit_confirm', lang);
    }
    return;
  }

  if (state.step === 'awaiting_confirm_edit') {
    const lang = state.language || 'en';
    let isLooksRight = false;
    let isFixIt = false;

    if (interactiveId === 'confirm_looks_right' || ['1', 'looks right', 'right', 'yes', 'बरोबर आहे', 'सही है', 'बरोबर', 'सही'].includes(textNormalized)) {
      isLooksRight = true;
    } else if (interactiveId === 'confirm_fix_it' || ['2', 'fix it', 'fix', 'no', 'दुरुस्त करा', 'सुधार करें', 'दुरुस्त', 'सुधार'].includes(textNormalized)) {
      isFixIt = true;
    }

    if (isLooksRight) {
      state.step = 'location_requested';
      state.lastInteractionAt = new Date();
      await state.save();

      await rePromptCurrentStep(sender, 'location_requested', lang);
    } else if (isFixIt) {
      state.step = 'awaiting_complaint_text';
      state.lastInteractionAt = new Date();
      await state.save();

      await rePromptCurrentStep(sender, 'awaiting_complaint_text', lang);
    } else {
      const fallbackWarning = lang === 'mr'
        ? '⚠️ मला ते समजले नाही. कृपया खालील पर्यायांपैकी एक निवडा, किंवा रद्द करण्यासाठी CANCEL लिहा.'
        : lang === 'hi'
        ? '⚠️ मुझे समझ नहीं आया। कृपया नीचे दिए गए विकल्पों में से एक चुनें, या रीसेट करने के लिए CANCEL लिखें।'
        : "⚠️ I didn't understand that. Please select one of the options below, or reply CANCEL to reset.";
      await sendMessage(sender, fallbackWarning);
      await sendExtractionSummary(sender, state, lang);
    }
    return;
  }

  if (state.step === 'awaiting_complaint_text') {
    const lang = state.language || 'en';

    if (type === 'text' && rawText && rawText.trim()) {
      let processingMsg = lang === 'mr' ? '⏳ तुमच्या दुरुस्तीचे विश्लेषण करत आहे...' : lang === 'hi' ? '⏳ आपके सुधार का विश्लेषण किया जा रहा...' : '⏳ Analyzing your correction...';
      try {
        await sendMessage(sender, processingMsg);
      } catch (sendErr) { }

      try {
        const { extractComplaint } = require('../../ai/extraction/extraction.service');
        const extractionResult = await extractComplaint(rawText, { channel: 'whatsapp', senderId: sender });
        const { structuredComplaint } = extractionResult;

        state.pendingStructuredComplaint.rawText = `${state.pendingStructuredComplaint.rawText}\n[Correction]: ${rawText}`;
        state.pendingStructuredComplaint.structured = structuredComplaint;
        state.step = 'awaiting_confirm_edit';
        state.lastInteractionAt = new Date();
        state.markModified('pendingStructuredComplaint');
        await state.save();

        await sendExtractionSummary(sender, state, lang);
      } catch (err) {
        logger.error('[Worker] AI re-extraction failed on correction', { error: err.message });
        await sendMessage(sender, lang === 'mr' ? 'विश्लेषण अयशस्वी झाले. कृपया पुन्हा दुरुस्ती टाईप करा:' : lang === 'hi' ? 'विश्लेषण विफल रहा। कृपया पुनः सुधार टाइप करें:' : 'Analysis failed. Please type your correction again:');
      }
    } else {
      await sendMessage(sender, lang === 'mr' ? 'कृपया फक्त दुरुस्तीचा मजकूर टाईप करा:' : lang === 'hi' ? 'कृपया केवल सुधार का पाठ टाइप करें:' : 'Please type your correction as text:');
    }
    return;
  }

  if (state.step === 'location_requested') {
    const lang = state.language || 'en';

    let coordinates = null;
    let locationAddressText = '';

    if (type === 'location' && locationObj) {
      const { latitude, longitude, address, name } = locationObj;
      coordinates = [Number(longitude), Number(latitude)];
      locationAddressText = [name, address].filter(Boolean).join(', ');
    } else if (type === 'text' && rawText && rawText.trim()) {
      const locationText = rawText.trim();
      locationAddressText = locationText;

      try {
        const { geocodeText } = require('../../geo/geocoder');
        const geo = await geocodeText(locationText);
        if (geo && geo.lat != null && geo.lng != null) {
          coordinates = [Number(geo.lng), Number(geo.lat)];
        }
      } catch (geoErr) {
        logger.warn('[Worker] Geocoding failed for address text', { error: geoErr.message });
      }
    }

    let resolvedWard = null;
    if (coordinates || locationAddressText) {
      try {
        const { resolveWard } = require('../../geo/wardResolver');
        resolvedWard = await resolveWard({
          coordinates,
          locationText: locationAddressText,
          traceId: state.pendingStructuredComplaint?.traceId
        });
      } catch (resErr) {
        logger.error('[Worker] resolveWard crashed', { error: resErr.message });
      }
    }

    if (resolvedWard && resolvedWard.wardId) {
      state.pendingStructuredComplaint.wardId = resolvedWard.wardId;
      state.pendingStructuredComplaint.wardName = resolvedWard.wardName;
      state.pendingStructuredComplaint.location = {
        type: 'Point',
        coordinates: coordinates || [73.8567, 18.5204],
        address: locationAddressText
      };
      state.step = 'exact_location_received';
      state.markModified('pendingStructuredComplaint');
      await state.save();

      await finalizeIntakeComplaint(sender, state, lang);
    } else {
      const currentRetry = state.pendingStructuredComplaint.locationRetryCount || 0;
      if (currentRetry < 1) {
        state.pendingStructuredComplaint.locationRetryCount = 1;
        state.markModified('pendingStructuredComplaint');
        await state.save();

        const cancelHelpFooter = lang === 'mr'
          ? '\n\n_रीसेट करण्यासाठी CANCEL किंवा मदतीसाठी HELP लिहा._'
          : lang === 'hi'
          ? '\n\n_रीसेट करने के लिए CANCEL या सहायता के लिए HELP लिखें।_'
          : '\n\n_Reply CANCEL to restart or HELP for assistance._';
        let retryPrompt = lang === 'mr'
          ? 'क्षमस्व, आम्ही ते स्थान शोधू शकलो नाही. कृपया दुसरी लोकेशन पिन पाठवा किंवा जवळचा पत्ता टाईप करा.'
          : lang === 'hi'
          ? 'क्षमा करें, हम आपकी लोकेशन को नहीं ढूंढ सके। कृपया कोई अन्य लोकेशन पिन भेजें या पास का कोई पता टाइप करें।'
          : 'Sorry, we couldn\'t resolve that location. Please send a different location pin or type a nearby address.';
        retryPrompt += cancelHelpFooter;
        await sendMessage(sender, retryPrompt);
      } else {
        state.pendingStructuredComplaint.wardId = null;
        state.pendingStructuredComplaint.wardName = null;
        state.pendingStructuredComplaint.flaggedForReview = true;
        state.pendingStructuredComplaint.flagReason = 'manual_area_assignment';
        state.pendingStructuredComplaint.location = {
          type: 'Point',
          coordinates: coordinates || [73.8567, 18.5204],
          address: locationAddressText || 'Manual area assignment needed'
        };
        state.step = 'exact_location_received';
        state.markModified('pendingStructuredComplaint');
        await state.save();

        await finalizeIntakeComplaint(sender, state, lang);
      }
    }
    return;
  }
}

/**
 * Handles processing of an enqueued legacy complaint message.
 */
async function handleProcessComplaintJob(data) {
  const { internalMessage, traceId } = data;
  const { channel, senderId, type, mediaId, mediaUrl, mimeType, location, timestamp } = internalMessage;

  let rawText = internalMessage.rawText || '';

  const { formatIndianPhoneNumber } = require('../../utils/phoneHelper');
  const formattedPhone = formatIndianPhoneNumber(senderId);
  const cleanPhone = formattedPhone.replace(/\D/g, '');

  const Citizen = require('../../models/Citizen');
  const ConversationState = require('../../models/ConversationState');
  const citizen = await Citizen.findOne({ phone: formattedPhone });
  const state = await ConversationState.findOne({ phoneNumber: cleanPhone });
  const lang = citizen?.language || state?.language || 'en';

  try {
    // 1. Conversational status lookup check (short-circuit before AI extraction)
    if (type !== 'audio' && type !== 'voice' && isStatusKeyword(rawText)) {
      logger.info('Conversational status lookup requested via WhatsApp', { traceId, senderId });

      const complaints = await Complaint.find({ senderId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      let responseText;
      if (!complaints || complaints.length === 0) {
        responseText = 'You have no registered complaints on record.';
      } else {
        const listText = complaints
          .map((c, i) => {
            const category = c.structured?.category || 'General';
            const statusLabel = c.status || 'received';
            const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A';
            return `${i + 1}. ID: *${c._id}*\n   Category: ${category}\n   Status: ${statusLabel}\n   Updated: ${dateStr}`;
          })
          .join('\n\n');

        responseText = `📋 *Your Registered Complaints*:\n\n${listText}\n\nType a description anytime to register a new complaint.`;
      }

      try {
        await sendMessage(senderId, responseText);
      } catch (sendErr) {
        logger.warn('WhatsApp status lookup notification dispatch error (dev/mock mode)', { senderId, error: sendErr.message });
      }

      return { statusLookup: true, count: complaints ? complaints.length : 0, responseText };
    }

    // 2. If voice/audio, run Media Processing -> STT Module first
    let attachment = null;

    if (type === 'audio' || type === 'voice') {
      logger.info('Queued job processing voice note', { traceId, mediaId });
      const downloadResult = await downloadMedia(mediaId || mediaUrl, mimeType);
      const mediaBuffer = downloadResult.buffer;
      const { transcribeAudio } = require('../../ai/stt/transcriber');
      const sttResult = await transcribeAudio(mediaBuffer, mimeType);

      rawText = sttResult.transcript || '[Unclear voice transcription]';
    } else if (type === 'image') {
      logger.info('Queued job processing image', { traceId, mediaId });
      const { downloadMedia: downloadToUrl } = require('../../media/mediaDownloader');
      const downloadResult = await downloadToUrl(mediaId || mediaUrl, mimeType);

      attachment = {
        url: downloadResult.url,
        mediaId: mediaId || null,
        mimeType: downloadResult.mimeType,
        uploadedAt: new Date(),
      };

      if (!rawText || !rawText.trim()) {
        rawText = 'Image Complaint';
      }
    }

    // 3. Pass to complaintService.createComplaint()
    const result = await complaintService.createComplaint({
      channel: channel || 'whatsapp',
      senderId,
      rawText,
      coordinates: location,
      timestamp,
      traceId,
      attachment,
    });

    const complaintDoc = result.complaint || result;
    const isDuplicate = Boolean(result.duplicate);

    if (isDuplicate) {
      let dupMsg = '';
      const statusLabel = complaintDoc.status || 'received';
      let statusLocalized = statusLabel;
      if (lang === 'mr') {
        const mrMap = { received: 'प्राप्त', assigned: 'नियुक्त', in_progress: 'प्रगतीपथावर', needsclarification: 'तपशील आवश्यक', resolved: 'निवारण झाले' };
        statusLocalized = mrMap[statusLabel.toLowerCase()] || statusLabel;
        dupMsg = `⚠️ आम्हाल अलीकडेच तुमच्याकडून अशीच तक्रार प्राप्त झाली आहे (संदर्भ क्र: ${complaintDoc._id}). सध्याची स्थिती: ${statusLocalized}. आम्ही यावर काम करत आहोत आणि लवकरच तुम्हाला अपडेट करू.`;
      } else if (lang === 'hi') {
        const hiMap = { received: 'प्राप्त', assigned: 'सौंपा गया', in_progress: 'प्रगति पर', needsclarification: 'विवरण आवश्यक', resolved: 'निवारण हो चुका' };
        statusLocalized = hiMap[statusLabel.toLowerCase()] || statusLabel;
        dupMsg = `⚠️ हमें हाल ही में आपकी ऐसी ही शिकायत मिली है (संदर्भ संख्या: ${complaintDoc._id})। वर्तमान स्थिति: ${statusLocalized}। हम इस पर काम कर रहे हैं और जल्द ही आपको अपडेट करेंगे।`;
      } else {
        const enMap = { received: 'Received', assigned: 'Assigned', in_progress: 'In Progress', needsclarification: 'Needs More Details', resolved: 'Resolved' };
        statusLocalized = enMap[statusLabel.toLowerCase()] || statusLabel;
        dupMsg = `⚠️ We already received a similar complaint from you recently (Reference ID: ${complaintDoc._id}). Current Status: ${statusLocalized}. We are working on it and will update you soon.`;
      }

      try {
        await sendMessage(senderId, dupMsg);
      } catch (sendErr) {
        logger.warn('WhatsApp duplicate message dispatch error (dev/mock mode)', { senderId, error: sendErr.message });
      }
    }

    logger.info('Queued complaint job processed successfully', {
      traceId,
      complaintId: complaintDoc._id ? complaintDoc._id.toString() : null,
      senderId,
      isDuplicate,
    });

    return result;
  } catch (err) {
    logger.error('Queued complaint processing failed', {
      traceId,
      senderId,
      error: err.message,
    });

    let errorText;
    if (err.code === 'EXTRACTION_FAILED') {
      errorText = lang === 'mr' ? 'तक्रार विश्लेषण अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.' : lang === 'hi' ? 'शिकायत विश्लेषण विफल रहा। कृपया पुन: प्रयास करें।' : 'Sorry, we encountered an error analyzing your complaint. Please try again.';
    } else if (err.code === 'PERSISTENCE_FAILED') {
      errorText = lang === 'mr' ? 'तक्रार जतन करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.' : lang === 'hi' ? 'शिकायत सहेजते समय त्रुटि हुई। कृपया पुन: प्रयास करें।' : 'Sorry, there was an error saving your complaint. Please try again.';
    } else {
      errorText = lang === 'mr' ? 'आम्हाला तुमचा संदेश मिळाला परंतु आम्ही सध्या त्यावर प्रक्रिया करू शकलो नाही. कृपया नंतर पुन्हा प्रयत्न करा.' : lang === 'hi' ? 'हमें आपका संदेश मिला लेकिन हम अभी इसे संसाधित नहीं कर सके। कृपया बाद में पुनः प्रयास करें।' : 'We received your message but could not process it right now. Please try again later.';
    }

    try {
      await sendMessage(senderId, errorText);
    } catch (sendErr) {
      logger.warn('WhatsApp failure ack send failed in worker', {
        traceId,
        error: sendErr.message,
      });
    }

    throw err;
  }
}

/**
 * Instant synchronous check whether Redis client is ready.
 * @returns {boolean}
 */
function isRedisReady() {
  if (!complaintQueue) return false;
  try {
    const client = complaintQueue.client;
    if (client && typeof client === 'object' && client.status === 'ready') {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

/**
 * Enqueues a complaint job to BullMQ/Redis or executes seamless inline fallback.
 */
async function enqueueComplaint(internalMessage, traceId) {
  const ready = isRedisReady();

  if (ready) {
    try {
      await complaintQueue.add('process-complaint', { internalMessage, traceId });
      logger.info('Enqueued WhatsApp complaint job to Redis Queue', { traceId, senderId: internalMessage.senderId });
      return;
    } catch (err) {
      logger.warn('Failed to enqueue job to Redis Queue, switching to inline fallback', { traceId, error: err.message });
    }
  } else {
    logger.error('Redis is offline or not ready, executing immediate in-memory processing fallback', { traceId });
  }

  // Seamless inline fallback execution when Redis is offline or enqueue fails
  setImmediate(() => {
    handleProcessComplaintJob({ internalMessage, traceId }).catch((err) => {
      logger.error('Inline fallback complaint processing failed', { traceId, error: err.message });
    });
  });
}

/**
 * Enqueues a WhatsApp webhook payload job to BullMQ/Redis or executes seamless inline fallback.
 */
async function enqueueWhatsappWebhook(payload, traceId) {
  const ready = isRedisReady();

  if (ready) {
    try {
      await complaintQueue.add('whatsapp-webhook', { payload, traceId });
      logger.info('Enqueued WhatsApp webhook job to Redis Queue', { traceId });
      return;
    } catch (err) {
      logger.warn('Failed to enqueue WhatsApp webhook job to Redis Queue, switching to inline fallback', { traceId, error: err.message });
    }
  } else {
    logger.error('Redis is offline or not ready, executing immediate in-memory processing fallback for WhatsApp webhook', { traceId });
  }

  // Seamless inline fallback execution when Redis is offline or enqueue fails
  setImmediate(() => {
    handleWhatsappWebhookJob({ payload, traceId }).catch((err) => {
      logger.error('Inline fallback WhatsApp webhook processing failed', { traceId, error: err.message });
    });
  });
}

async function runExtractionAndGoToLocation(sender, state, lang, traceId) {
  // Comprehensive Diagnostic Logging
  console.log('[Grievance] Received Done button for user:', sender);
  console.log('[Grievance] Buffer contents:', state?.pendingComplaint?.inputs);
  console.log('[Grievance] Triggering LLM analysis...');

  try {
    if (!state.pendingComplaint || !Array.isArray(state.pendingComplaint.inputs)) {
      throw new Error('State pendingComplaint or inputs is missing/invalid');
    }

    const combinedText = state.pendingComplaint.inputs.map(i => i.text).filter(Boolean).join('\n');
    const firstImage = state.pendingComplaint.inputs.find(i => i.type === 'image' && i.attachment);
    const firstImageAttachment = firstImage ? firstImage.attachment : null;

    const { extractComplaint } = require('../../ai/extraction/extraction.service');
    
    let structuredComplaint;
    try {
      const extractionResult = await extractComplaint(combinedText, { channel: 'whatsapp', senderId: sender });
      structuredComplaint = extractionResult.structuredComplaint;
    } catch (extractErr) {
      logger.error('[Worker] AI extraction failed or timed out, falling back to default structured metadata', {
        error: extractErr.message,
        traceId
      });
      structuredComplaint = {
        category: 'general',
        subcategory: null,
        description: combinedText.substring(0, 150) || 'Raw complaint details',
        urgency: 'medium',
        locationMentioned: null,
        language: lang || 'en',
        confidence: 0.5,
        needsClarification: true
      };
    }

    state.pendingStructuredComplaint = {
      rawText: combinedText,
      attachment: firstImageAttachment,
      structured: structuredComplaint,
      traceId: traceId || null
    };
    state.step = 'location_requested';
    state.lastInteractionAt = new Date();
    state.markModified('pendingStructuredComplaint');

    // Isolate Database Write Operations with its own error boundary
    try {
      await state.save();
    } catch (saveErr) {
      logger.error('[Worker] ConversationState save failed during extraction', {
        error: saveErr.message,
        stack: saveErr.stack,
        traceId
      });
      // Send meaningful feedback on true database/system hard errors instead of "Complaint analysis failed"
      await sendMessage(sender, lang === 'mr' 
        ? 'तक्रार जतन करताना प्रणालीमध्ये त्रुटी आली. कृपया थोड्या वेळाने प्रयत्न करा.' 
        : lang === 'hi' 
        ? 'शिकायत सहेजते समय सिस्टम त्रुटि हुई। कृपया थोड़ी देर बाद प्रयास करें।' 
        : 'A system database error occurred while saving your complaint details. Please try again in a moment.');
      return;
    }

    const cancelHelpFooter = lang === 'mr'
      ? '\n\n_रीसेट करण्यासाठी CANCEL किंवा मदतीसाठी HELP लिहा._'
      : lang === 'hi'
      ? '\n\n_रीसेट करने के लिए CANCEL या सहायता के लिए HELP लिखें।_'
      : '\n\n_Reply CANCEL to restart or HELP for assistance._';

    try {
      let bodyText = lang === 'mr'
        ? '📍 तक्रार नोंदणीसाठी खालील बटण वापरून तुमचे स्थान शेअर करा. किंवा तुमचा पत्ता/परिसराचे नाव खाली टाईप करा.'
        : lang === 'hi'
        ? '📍 शिकायत स्थल दर्ज करने के लिए नीचे दिए गए बटन का उपयोग करके अपनी लोकेशन साझा करें। अथवा नीचे अपना पता/क्षेत्र का नाम टाइप करें।'
        : '📍 Share your location using the button below to register the complaint spot. Alternatively, type your address/area name below.';
      bodyText += cancelHelpFooter;
      await sendLocationRequestMessage(sender, bodyText);
    } catch (err) {
      let locationPrompt = lang === 'mr'
        ? 'कृपया तुमचे स्थान शेअर करा. 📍 तुम्ही व्हॉट्सॲपवरून लोकेशन पिन पाठवू शकता किंवा तुमचा पत्ता/परिसराचे नाव टाईप करू शकता.'
        : lang === 'hi'
        ? 'कृपया अपनी लोकेशन साझा करें। 📍 आप व्हाट्सएप से लोकेशन पिन भेज सकते हैं या अपना पता/क्षेत्र का नाम टाइप कर सकते हैं.'
        : 'Please share your location. 📍 You can send a WhatsApp location pin, or type your address/area name.';
      locationPrompt += cancelHelpFooter;
      await sendMessage(sender, locationPrompt);
    }
  } catch (err) {
    logger.error('[Worker] runExtractionAndGoToLocation failed', { error: err.message });
    await sendMessage(sender, lang === 'mr' ? 'तक्रार विश्लेषण अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.' : lang === 'hi' ? 'शिकायत विश्लेषण विफल रहा। कृपया पुन: प्रयास करें।' : 'Complaint analysis failed. Please try again.');
  }
}

async function handleInactivityCheckJob(data) {
  const { phoneNumber, timestamp } = data;
  const state = await ConversationState.findOne({ phoneNumber });
  if (!state || state.step !== 'collecting_input') {
    return;
  }

  const lastInteraction = state.lastInteractionAt || state.updatedAt;
  if (lastInteraction && new Date(lastInteraction).getTime() > timestamp) {
    return;
  }

  const lang = state.language || 'en';
  state.step = 'awaiting_presubmit_confirm';
  await state.save();

  const sender = `+${phoneNumber}`;

  const cancelHelpFooter = lang === 'mr'
    ? '\n\n_रीसेट करण्यासाठी CANCEL किंवा मदतीसाठी HELP लिहा._'
    : lang === 'hi'
    ? '\n\n_रीसेट करने के लिए CANCEL या सहायता के लिए HELP लिखें।_'
    : '\n\n_Reply CANCEL to restart or HELP for assistance._';

  let inactivityMsg = lang === 'mr' ? 'तुमची तक्रार दाखल करण्यास तयार आहात, की अजून काही जोडायचे आहे?' : lang === 'hi' ? 'क्या आप शिकायत दर्ज करने के लिए तैयार हैं, या अभी कुछ और जोड़ना है?' : 'Ready to submit, or still adding something?';
  inactivityMsg += cancelHelpFooter;
  
  let buttonLabel = '';
  let inactivityRows = [];
  if (lang === 'mr') {
    buttonLabel = 'पर्याय निवडा';
    inactivityRows = [
      { id: 'presubmit_submit', title: '✅ दाखल करा', description: 'तक्रार सबमिट करा' },
      { id: 'presubmit_adding', title: '➕ आणखी जोडा', description: 'अधिक तपशील जोडा' },
      { id: 'global_help', title: '❓ मदत', description: 'मदत मिळवा' },
      { id: 'global_cancel', title: '❌ रद्द करा', description: 'संभाषण पुन्हा सुरू करा' }
    ];
  } else if (lang === 'hi') {
    buttonLabel = 'विकल्प चुनें';
    inactivityRows = [
      { id: 'presubmit_submit', title: '✅ दर्ज करें', description: 'शिकायत सबमिट करें' },
      { id: 'presubmit_adding', title: '➕ और जोड़ें', description: 'और विवरण जोड़ें' },
      { id: 'global_help', title: '❓ सहायता', description: 'मदद प्राप्त करें' },
      { id: 'global_cancel', title: '❌ रद्द करें', description: 'बातचीत फिर से शुरू करें' }
    ];
  } else {
    buttonLabel = 'Choose Option';
    inactivityRows = [
      { id: 'presubmit_submit', title: '✅ Submit', description: 'Submit collected details' },
      { id: 'presubmit_adding', title: '➕ Still Adding', description: 'Add more details' },
      { id: 'global_help', title: '❓ Help', description: 'Get assistance' },
      { id: 'global_cancel', title: '❌ Cancel', description: 'Restart conversation' }
    ];
  }

  try {
    await sendListMessage(sender, inactivityMsg, buttonLabel, inactivityRows);
  } catch (err) {
    let fallbackText = '';
    if (lang === 'mr') {
      fallbackText = inactivityMsg + '\n\n1. ' + inactivityRows[0].title + '\n2. ' + inactivityRows[1].title + '\n3. मदत (HELP)\n4. रद्द करा (CANCEL)';
    } else if (lang === 'hi') {
      fallbackText = inactivityMsg + '\n\n1. ' + inactivityRows[0].title + '\n2. ' + inactivityRows[1].title + '\n3. सहायता (HELP)\n4. रद्द करें (CANCEL)';
    } else {
      fallbackText = inactivityMsg + '\n\n1. ' + inactivityRows[0].title + '\n2. ' + inactivityRows[1].title + '\n3. Help\n4. Cancel';
    }
    await sendMessage(sender, fallbackText);
  }
}

// Worker initialization
let worker = null;
try {
  worker = new Worker(
    'complaint-ingestion',
    async (job) => {
      if (job.name === 'whatsapp-webhook') {
        await handleWhatsappWebhookJob(job.data);
      } else if (job.name === 'inactivity-check') {
        await handleInactivityCheckJob(job.data);
      } else {
        await handleProcessComplaintJob(job.data);
      }
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed with error: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.warn('BullMQ Worker connection warning', { error: err.message });
  });
} catch (err) {
  logger.warn('BullMQ Worker could not be started', { error: err.message });
}

module.exports = {
  handleProcessComplaintJob,
  handleWhatsappWebhookJob,
  enqueueComplaint,
  enqueueWhatsappWebhook,
  isStatusKeyword,
};
