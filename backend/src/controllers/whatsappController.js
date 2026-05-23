const { getStatus } = require('../whatsapp/client');

// GET /api/whatsapp/status
const getWhatsAppStatus = (req, res) => {
  const { isReady, hasClient, isInitializing } = getStatus();

  let statusMessage;
  let statusCode;

  if (isReady) {
    statusMessage = 'WhatsApp is connected and ready to send messages.';
    statusCode    = 'connected';
  } else if (isInitializing) {
    statusMessage = 'WhatsApp client is initializing. Please check the backend console for the QR code.';
    statusCode    = 'initializing';
  } else {
    statusMessage = 'WhatsApp client is disconnected or not ready. Please scan the QR code in the server console.';
    statusCode    = 'disconnected';
  }

  res.json({ isReady, hasClient, isInitializing, statusCode, statusMessage });
};

module.exports = { getWhatsAppStatus };
