/**
 * complaintTemplates.js
 * -----------------------------------------------------------------------
 * Notification message templates for Citizens and Officers.
 * Supports English, Marathi, and Hindi localizations.
 */

function formatCategoryLabel(category, lang = 'en') {
  if (!category) return lang === 'mr' ? 'सामान्य' : lang === 'hi' ? 'सामान्य' : 'General';
  const clean = category.toLowerCase().trim();
  const mapping = {
    en: {
      water_supply: 'Water Supply',
      roads: 'Roads & Infrastructure',
      roads_and_infrastructure: 'Roads & Infrastructure',
      sanitation: 'Sanitation',
      law_and_order: 'Law & Order',
      electricity: 'Electricity & Lighting',
      electricity_and_lighting: 'Electricity & Lighting',
      drainage: 'Drainage',
      general: 'General / Other',
      general_other: 'General / Other',
    },
    mr: {
      water_supply: 'पाणी पुरवठा',
      roads: 'रस्ते आणि पायाभूत सुविधा',
      roads_and_infrastructure: 'रस्ते आणि पायाभूत सुविधा',
      sanitation: 'स्वच्छता',
      law_and_order: 'कायदा आणि सुव्यवस्था',
      electricity: 'वीज आणि प्रकाश व्यवस्था',
      electricity_and_lighting: 'वीज आणि प्रकाश व्यवस्था',
      drainage: 'सांडपाणी व्यवस्था',
      general: 'सामान्य / इतर',
      general_other: 'सामान्य / इतर',
    },
    hi: {
      water_supply: 'पानी की आपूर्ति',
      roads: 'सड़कें और बुनियादी ढांचा',
      roads_and_infrastructure: 'सड़कें और बुनियादी ढांचा',
      sanitation: 'स्वच्छता',
      law_and_order: 'कानून और व्यवस्था',
      electricity: 'बिजली और प्रकाश व्यवस्था',
      electricity_and_lighting: 'बिजली और प्रकाश व्यवस्था',
      drainage: 'जल निकासी',
      general: 'सामान्य / अन्य',
      general_other: 'सामान्य / अन्य',
    }
  };
  
  const langMap = mapping[lang] || mapping['en'];
  if (langMap[clean]) return langMap[clean];
  
  return clean
    .split(/[_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatStatusLabel(status, lang = 'en') {
  if (!status) return lang === 'mr' ? 'प्राप्त' : lang === 'hi' ? 'प्राप्त' : 'Received';
  const clean = status.trim().toLowerCase();
  const mapping = {
    en: {
      received: 'Received',
      assigned: 'Assigned',
      in_progress: 'In Progress',
      needsclarification: 'Needs More Details',
      resolved: 'Resolved',
    },
    mr: {
      received: 'प्राप्त',
      assigned: 'नियुक्त',
      in_progress: 'प्रगतीपथावर',
      needsclarification: 'तपशील आवश्यक',
      resolved: 'निवारण झाले',
    },
    hi: {
      received: 'प्राप्त',
      assigned: 'सौंपा गया',
      in_progress: 'प्रगति पर',
      needsclarification: 'विवरण आवश्यक',
      resolved: 'निवारण हो चुका',
    }
  };
  const langMap = mapping[lang] || mapping['en'];
  return langMap[clean] || status.charAt(0).toUpperCase() + status.slice(1);
}

function getShortDescription(complaint) {
  if (typeof complaint === 'string') {
    return complaint.length > 80 ? complaint.slice(0, 77) + '...' : complaint;
  }
  const desc = complaint.structured?.description || complaint.rawText || '';
  if (desc.length > 80) {
    return desc.slice(0, 77) + '...';
  }
  return desc;
}

function getClosingLine(status, lang = 'en') {
  const clean = (status || '').toLowerCase().trim();
  const closingLines = {
    en: {
      received: 'We appreciate your patience while we assign this to the concerned department.',
      in_progress: 'Your complaint is now being actively addressed by the concerned officer. We appreciate your patience and cooperation.',
      resolved: 'We are pleased to inform you that this issue has been resolved. Thank you for helping us improve our community.',
      needsclarification: 'We need a bit more information to proceed. Please reply with additional details about this issue.',
    },
    mr: {
      received: 'आम्ही हे संबंधित विभागाकडे सोपवत असताना आपल्या संयमाची प्रशंसा करतो.',
      in_progress: 'तुमच्या तक्रारीवर संबंधित अधिकाऱ्याकडून सक्रियपणे काम केले जात आहे. आपल्या सहकार्याबद्दल धन्यवाद.',
      resolved: 'आम्हाला कळवण्यास आनंद होत आहे की या समस्येचे निवारण झाले आहे. आमचे शहर सुधारण्यास मदत केल्याबद्दल धन्यवाद.',
      needsclarification: 'पुढील कारवाईसाठी आम्हाला काही अधिक माहिती हवी आहे. कृपया समस्येचे अतिरिक्त तपशील पाठवा.',
    },
    hi: {
      received: 'हम संबंधित विभाग को इसे सौंपने तक आपके धैर्य की सराहना करते हैं।',
      in_progress: 'आपकी शिकायत पर संबंधित अधिकारी द्वारा सक्रिय रूप से काम किया जा रहा है। आपके सहयोग के लिए धन्यवाद।',
      resolved: 'हमें सूचित करते हुए प्रसन्नता हो रही है कि इस समस्या का समाधान हो गया है। आपके सहयोग के लिए धन्यवाद।',
      needsclarification: 'हमें आगे बढ़ने के लिए थोड़ी और जानकारी चाहिए। कृपया इस समस्या के बारे में अतिरिक्त विवरण के साथ उत्तर दें।'
    }
  };
  const langMap = closingLines[lang] || closingLines['en'];
  return langMap[clean] || '';
}

/**
 * Template 1 — Complaint Registered confirmation card
 * Supports both (complaint, lang) and (complaintId, status, lang) calling styles.
 */
function getCitizenAckMessage(complaintOrId, langOrStatus, maybeLang) {
  let complaintId;
  let lang;
  let status = 'received';
  let issueSummary = '';
  let categoryFormatted = 'General';
  let statusFormatted = 'Received';
  let hasLocation = false;

  if (typeof complaintOrId === 'object' && complaintOrId !== null) {
    // (complaint, lang) signature
    const complaint = complaintOrId;
    complaintId = complaint._id ? complaint._id.toString() : 'N/A';
    status = complaint.status || 'received';
    lang = langOrStatus || 'en';
    issueSummary = getShortDescription(complaint);
    categoryFormatted = formatCategoryLabel(complaint.structured?.category, lang);
    statusFormatted = formatStatusLabel(status, lang);
    hasLocation = !!(complaint.location?.coordinates && complaint.location.coordinates.length >= 2);
  } else {
    // (complaintId, status, lang) signature
    complaintId = complaintOrId || 'N/A';
    status = langOrStatus || 'received';
    lang = maybeLang || 'en';
    issueSummary = 'As reported by citizen';
    categoryFormatted = formatCategoryLabel('general', lang);
    statusFormatted = formatStatusLabel(status, lang);
    hasLocation = false;
  }

  let locationPrompt = '';
  if (lang === 'mr') {
    locationPrompt = hasLocation
      ? 'तुमचे स्थान यशस्वीरित्या नोंदवले गेले आहे.'
      : 'तक्रार निवारण जलद गतीने करण्यासाठी, कृपया व्हॉट्सॲप लोकेशन फीचर वापरून तुमचे अचूक स्थान 📍 शेअर करा (📎 -> Location).';
  } else if (lang === 'hi') {
    locationPrompt = hasLocation
      ? 'आपकी सटीक लोकेशन हमारे पास सफलतापूर्वक दर्ज कर ली गई है।'
      : 'शिकायत निवारण जल्दी करने के लिए, कृपया व्हाट्सएप लोकेशन फीचर का उपयोग करके अपनी सटीक लोकेशन 📍 साझा करें (📎 -> Location)।';
  } else {
    locationPrompt = hasLocation
      ? 'Your location has been successfully recorded alongside your complaint details.'
      : 'To help municipal officers locate the issue quickly, please share your exact location 📍 using WhatsApp\'s Location attachment feature (📎 -> Location).';
  }

  if (lang === 'mr') {
    return `🏛️ *CivicVoice – तक्रार नोंदवली गेली*

नमस्कार नागरिक! 👋

तुमची तक्रार यशस्वीरीत्या नोंदवली गेली आहे. ✅

📋 *संदर्भ क्रमांक*: ${complaintId}
📌 *समस्या*: ${issueSummary}
📍 *विभाग*: ${categoryFormatted}
🕐 *स्थिती*: ${statusFormatted}

✨ ${locationPrompt}

⏭️ *पुढील पावले*:
आमचे अधिकारी लवकरच या तक्रारीचे पुनरावलोकन करतील. तक्रारीची स्थिती बदलल्यावर तुम्हाला व्हॉट्सॲपवर अपडेट मिळेल.

💡 _तक्रारीचा मागोवा घेण्यासाठी कधीही *STATUS* पाठवा._

_– CivicVoice हेल्प डेस्क_`;
  } else if (lang === 'hi') {
    return `🏛️ *CivicVoice – शिकायत दर्ज की गई*

नमस्कार नागरिक! 👋

आपकी शिकायत सफलतापूर्वक दर्ज कर ली गई है। ✅

📋 *संदर्भ संख्या*: ${complaintId}
📌 *समस्या*: ${issueSummary}
📍 *विभाग*: ${categoryFormatted}
🕐 *स्थिति*: ${statusFormatted}

✨ ${locationPrompt}

⏭️ *आगे का कदम*:
हमारे अधिकारी जल्द ही इस शिकायत की समीक्षा करेंगे। स्थिति में बदलाव होने पर आपको व्हाट्सएप पर अपडेट मिलेगा।

💡 _अपनी शिकायतों की जांच के लिए किसी भी समय *STATUS* भेजें।_

_– CivicVoice हेल्प डेस्क_`;
  } else {
    return `🏛️ *CivicVoice – Complaint Registered*

Hi Citizen! 👋

Your complaint has been successfully registered. ✅

📋 *Reference No*: ${complaintId}
📌 *Issue*: ${issueSummary}
📍 *Category*: ${categoryFormatted}
🕐 *Status*: ${statusFormatted}

✨ ${locationPrompt}

⏭️ *What Happens Next*:
Our officer will review this complaint shortly. You will receive a WhatsApp notification whenever its status changes.

💡 _Reply *STATUS* at any time to track this complaint._

_– CivicVoice Help Desk_`;
  }
}

/**
 * Template 2 — Status change update card
 * Supports both (complaint, lang) and (complaintId, status, note, lang) calling styles.
 */
function getCitizenStatusChangeMessage(complaintOrId, langOrStatus, maybeNote, maybeLang) {
  let complaintId;
  let status;
  let lang;
  let issueSummary = '';
  let statusFormatted = 'Received';

  if (typeof complaintOrId === 'object' && complaintOrId !== null) {
    const complaint = complaintOrId;
    complaintId = complaint._id ? complaint._id.toString() : 'N/A';
    status = complaint.status || 'received';
    lang = langOrStatus || 'en';
    issueSummary = getShortDescription(complaint);
    statusFormatted = formatStatusLabel(status, lang);
  } else {
    complaintId = complaintOrId || 'N/A';
    status = langOrStatus || 'received';
    lang = maybeLang || 'en';
    issueSummary = getShortDescription(maybeNote || 'As reported');
    statusFormatted = formatStatusLabel(status, lang);
  }

  const closingLine = getClosingLine(status, lang);

  if (lang === 'mr') {
    return `🏛️ *CivicVoice – तक्रार स्थिती अपडेट*

नमस्कार नागरिक! 👋

तुमच्या तक्रारीबाबत नवीन अपडेट आले आहे.

📋 *संदर्भ क्रमांक*: ${complaintId}
📌 *समस्या*: ${issueSummary}
🔄 *स्थिती*: ${statusFormatted}

✨ ${closingLine}

💡 _तक्रारीचा मागोवा घेण्यासाठी कधीही *STATUS* पाठवा._

_– CivicVoice हेल्प डेस्क_`;
  } else if (lang === 'hi') {
    return `🏛️ *CivicVoice – शिकायत स्थिति अपडेट*

नमस्कार नागरिक! 👋

आपकी शिकायत के बारे में एक नया अपडेट आया है।

📋 *संदर्भ संख्या*: ${complaintId}
📌 *समस्या*: ${issueSummary}
🔄 *स्थिति*: ${statusFormatted}

✨ ${closingLine}

💡 _अपनी शिकायतों की जांच के लिए किसी भी समय *STATUS* भेजें।_

_– CivicVoice हेल्प डेस्क_`;
  } else {
    return `🏛️ *CivicVoice – Status Update*

Hi Citizen! 👋

There is an update on your complaint.

📋 *Reference No*: ${complaintId}
📌 *Issue*: ${issueSummary}
🔄 *Status*: ${statusFormatted}

✨ ${closingLine}

💡 _Reply *STATUS* at any time to track this complaint._

_– CivicVoice Help Desk_`;
  }
}

/**
 * Template 3 — Officer assignment alert card
 */
function getOfficerAssignmentMessage(complaintId, category, location, rawText, lang = 'en') {
  if (lang === 'mr') {
    return `🏛️ *CivicVoice – नवीन तक्रार नियुक्त*

📋 *तक्रार संदर्भ क्रमांक*: #${complaintId}
📍 *विभाग*: ${formatCategoryLabel(category, lang)}
📍 *स्थान*: ${location || 'नमुद केलेले नाही'}
📝 *तपशील*: "${rawText}"`;
  } else if (lang === 'hi') {
    return `🏛️ *CivicVoice – नई शिकायत सौंपी गई*

📋 *शिकायत संदर्भ संख्या*: #${complaintId}
📍 *श्रेणी*: ${formatCategoryLabel(category, lang)}
📍 *स्थान*: ${location || 'निर्दिष्ट नहीं है'}
📝 *विवरण*: "${rawText}"`;
  } else {
    return `[CivicVoice Alert] New Complaint Assigned: #${complaintId}\nCategory: ${formatCategoryLabel(category, 'en')}\nLocation: ${location || 'Not specified'}\nDetails: "${rawText}"`;
  }
}

module.exports = {
  getCitizenAckMessage,
  getCitizenStatusChangeMessage,
  getOfficerAssignmentMessage,
  formatCategoryLabel,
  formatStatusLabel,
};
