const axios = require('axios');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getMetaErrorDetail = (err) => {
  const fbError = err?.response?.data?.error;
  if (fbError) {
    if (typeof fbError === 'string') {
      return fbError;
    }
    if (fbError.error_user_msg) {
      return fbError.error_user_msg;
    }
    if (fbError.message) {
      return fbError.message;
    }
    const detailParts = [];
    if (fbError.type) {
      detailParts.push(`type=${fbError.type}`);
    }
    if (fbError.code) {
      detailParts.push(`code=${fbError.code}`);
    }
    if (fbError.error_subcode) {
      detailParts.push(`subcode=${fbError.error_subcode}`);
    }
    if (fbError.fbtrace_id) {
      detailParts.push(`fbtrace_id=${fbError.fbtrace_id}`);
    }
    if (detailParts.length) {
      return `${detailParts.join(', ')}${fbError.message ? ` — ${fbError.message}` : ''}`;
    }
    return JSON.stringify(fbError);
  }
  return err?.response?.data?.message || err?.message || String(err);
};

/**
 * Send a WhatsApp message using the Official Meta Cloud API.
 * Requires META_WA_PHONE_NUMBER_ID and META_WA_ACCESS_TOKEN in env.
 */
const sendMessage = async (phone, message) => {
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  const token = process.env.META_WA_ACCESS_TOKEN;

  if (!phoneId || !token) {
    console.error('⚠️ Meta WhatsApp API credentials missing. Message not sent.');
    throw new Error('WhatsApp API not configured');
  }

  const formattedPhone = phone.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { preview_url: false, body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`✅ Meta WhatsApp message sent to ${formattedPhone}`);
  } catch (err) {
    const errorDetail = getMetaErrorDetail(err);
    console.error(`❌ Meta WhatsApp send failed to ${formattedPhone}:`, errorDetail);
    throw new Error(`WhatsApp API Error: ${errorDetail}`);
  }
};

const sendMessageWithRetry = async (phone, message, options = {}) => {
  const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 2;
  const retryDelay = Number.isInteger(options.retryDelay) ? options.retryDelay : 5000;
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    try {
      await sendMessage(phone, message);
      return { success: true, attempts: attempt + 1 };
    } catch (err) {
      lastError = getMetaErrorDetail(err);
      attempt += 1;
      if (attempt > maxRetries) {
        break;
      }
      await sleep(retryDelay);
    }
  }

  return {
    success: false,
    attempts: attempt,
    error: lastError || 'Unknown WhatsApp API error',
  };
};

const getStatus = () => {
  const hasCreds = !!(process.env.META_WA_PHONE_NUMBER_ID && process.env.META_WA_ACCESS_TOKEN);
  return {
    isReady: hasCreds,
    hasClient: hasCreds,
    isInitializing: false,
  };
};

module.exports = {
  sendMessage,
  sendMessageWithRetry,
  getStatus,
};