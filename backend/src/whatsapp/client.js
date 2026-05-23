const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let isWhatsAppReady = false;
let client = null;
let currentQrCode = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const initializeWhatsApp = () => {
  console.log('🔄 Initializing WhatsApp client...');

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      // If deployed in an environment like Railway where CHROMIUM_BIN is set, use it.
      executablePath: process.env.CHROMIUM_BIN || process.env.PUPPETEER_EXECUTABLE_PATH || null,
    },
  });

  client.on('qr', (qr) => {
    console.log('\n📱 Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    console.log('\n👉 Open WhatsApp → Settings → Linked Devices → Link a Device\n');
    currentQrCode = qr;
  });

  client.on('ready', () => {
    isWhatsAppReady = true;
    currentQrCode = null;
    console.log('✅ WhatsApp is connected and ready!');
  });

  client.on('authenticated', () => {
    currentQrCode = null;
    console.log('🔐 Session authenticated (saved for next time)');
  });

  client.on('auth_failure', (msg) => {
    currentQrCode = null;
    console.error('❌ Authentication failed:', msg);
    console.log('💡 Try deleting the .wwebjs_auth folder and scanning again.');
  });

  client.on('disconnected', (reason) => {
    isWhatsAppReady = false;
    currentQrCode = null;
    console.log('❌ WhatsApp disconnected:', reason);
    console.log('🔄 Reconnecting in 10 seconds...');
    setTimeout(() => {
      client.initialize().catch(err => console.error('Error re-initializing WhatsApp:', err));
    }, 10000);
  });

  client.initialize().catch(err => {
    currentQrCode = null;
    console.error('❌ Failed to initialize WhatsApp client:', err);
  });
};

/**
 * Send a WhatsApp message using whatsapp-web.js.
 */
const sendMessage = async (phone, message) => {
  if (!isWhatsAppReady || !client) {
    console.error('⚠️ WhatsApp client is not ready. Message not sent.');
    throw new Error('WhatsApp client not ready');
  }

  try {
    // Format the phone number to E.164 and suffix with @c.us for whatsapp-web.js
    const formattedPhone = phone.replace(/\D/g, '');
    
    let chatId;
    try {
      const numberId = await client.getNumberId(formattedPhone);
      if (numberId) {
        chatId = numberId._serialized;
      } else {
        console.warn(`⚠️ getNumberId returned null for ${formattedPhone}. Falling back to direct formatting.`);
        chatId = `${formattedPhone}@c.us`;
      }
    } catch (checkErr) {
      console.warn(`⚠️ getNumberId failed for ${formattedPhone}: ${checkErr.message}. Falling back to direct formatting.`);
      chatId = `${formattedPhone}@c.us`;
    }

    await client.sendMessage(chatId, message);
    console.log(`✅ WhatsApp message sent to ${formattedPhone}`);
  } catch (err) {
    console.error(`❌ WhatsApp send failed to ${phone}:`, err.message);
    throw new Error(`WhatsApp API Error: ${err.message}`);
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
      lastError = err.message;
      attempt += 1;
      if (attempt > maxRetries) {
        break;
      }
      console.log(`    🔄 Retry ${attempt}/${maxRetries} for ${phone} in ${retryDelay / 1000}s — ${lastError}`);
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
  return {
    isReady: isWhatsAppReady,
    hasClient: !!client,
    isInitializing: !!client && !isWhatsAppReady,
    qrCode: currentQrCode,
  };
};

module.exports = {
  initializeWhatsApp,
  sendMessage,
  sendMessageWithRetry,
  getStatus,
};