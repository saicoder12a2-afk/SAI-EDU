const { getStatus } = require('../whatsapp/client');

// GET /api/whatsapp/status
const getWhatsAppStatus = (req, res) => {
  const { isReady, hasClient, isInitializing, qrCode } = getStatus();

  let statusMessage;
  let statusCode;

  if (isReady) {
    statusMessage = 'WhatsApp is connected and ready to send messages.';
    statusCode    = 'connected';
  } else if (isInitializing) {
    statusMessage = qrCode 
      ? 'WhatsApp is not connected. Scan the QR code in the popup to connect.'
      : 'WhatsApp client is initializing. Generating QR code...';
    statusCode    = 'initializing';
  } else {
    statusMessage = 'WhatsApp client is disconnected. Click to reconnect.';
    statusCode    = 'disconnected';
  }

  res.json({ isReady, hasClient, isInitializing, statusCode, statusMessage, qrCode });
};

module.exports = { getWhatsAppStatus };
