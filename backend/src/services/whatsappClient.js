const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

let client = null;
let isConnected = false;
let qrCode = null;

/**
 * Initialize WhatsApp Client using whatsapp-web.js (Puppeteer / real Chrome)
 * Exported function name is identical to the old Baileys version — nothing else needs to change.
 */
async function initWhatsApp() {
  // Avoid creating multiple instances on reconnect
  if (client) {
    console.log('[WhatsApp] Client already initializing or initialized.');
    return client;
  }

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'growth-engine',
      dataPath: path.resolve(__dirname, '../../wa-session')
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-extensions',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--mute-audio'
      ],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }
  });

  // Keep-alive heartbeat (sends a ping every 30s to prevent socket idle)
  const heartbeat = setInterval(async () => {
    if (isConnected && client) {
      try {
        await client.getState();
      } catch (e) {
        console.log('[WhatsApp] Heartbeat sync lost. Connection may be stale.');
      }
    }
  }, 30000);

  // QR Code — print to terminal for scanning
  client.on('qr', (qr) => {
    qrCode = qr;
    console.log('\n[WhatsApp] Scan the QR code below:\n');
    qrcode.generate(qr, { small: true });
  });

  // Connected and ready
  client.on('ready', () => {
    console.log('✅ [WhatsApp] Client is READY — connected via whatsapp-web.js');
    console.log('[WhatsApp] Waiting 10 seconds for session warm-up...');
    setTimeout(() => {
      isConnected = true;
      qrCode = null;
      console.log('[WhatsApp] 🚀 Engine warmed up. Ready to send.');
    }, 10000);
  });

  // Restoring existing session from disk
  client.on('loading_screen', (percent, message) => {
    if (percent === 0) console.log('[WhatsApp] 🔄 Restoring saved session...');
  });

  // Auth success
  client.on('authenticated', () => {
    console.log('[WhatsApp] ✅ Authenticated successfully. Session saved.');
  });

  // Auth failure
  client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Auth FAILED:', msg);
    isConnected = false;
    client = null; // Allow re-init
  });

  // Disconnected
  client.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Disconnected:', reason);
    isConnected = false;
    client = null; // Allow re-init on next request
  });

  // Incoming messages — reply listener
  client.on('message', async (msg) => {
    if (msg.fromMe) return; // Skip own messages
    if (!msg.from.endsWith('@c.us')) return; // Ignore groups/broadcasts

    // Only process text messages or media with captions
    // Media types include 'image', 'video', 'audio', 'sticker', 'document', etc.
    // In whatsapp-web.js, msg.body contains the text or caption.
    // If it's media without a caption, body might be empty or a thumbnail string in some versions.

    if (msg.type !== 'chat' && !msg.body) {
      // Skip media with no caption or body
      return;
    }

    // Protection: If body starts with /9j/ or other binary-like headers, skip it
    if (msg.body && (msg.body.startsWith('/9j/') || msg.body.startsWith('iVBORw0KGgo'))) {
      console.warn(`[WhatsApp] Skipping suspicious binary text in message body from ${msg.from}`);
      return;
    }

    const { handleIncomingReply } = require('./replyHandler');
    const phone = msg.from.replace('@c.us', '').replace(/^91/, '');
    const text = msg.body;

    if (!text) return;
    console.log(`[WhatsApp] Incoming reply from +91${phone}: ${text.substring(0, 50)}...`);
    await handleIncomingReply(phone, text);
  });

  await client.initialize();
  return client;
}

/**
 * Send a WhatsApp message to a phone number.
 * @param {string} phone - Raw phone number (digits only, with or without 91 prefix)
 * @param {string} message - Text content to send
 * @param {string} [mediaUrl] - Optional URL of the media (image) to attach
 */
async function sendWhatsAppMessage(phone, message, mediaUrl = null) {
  if (!client || !isConnected) {
    throw new Error('WhatsApp client not connected. Please scan the QR code first.');
  }

  // TEST MODE Interception
  // 🚨 TEST MODE Interceptor
  const IS_TEST = (process.env.TEST_MODE || '').trim().toLowerCase() === 'true';
  if (IS_TEST) {
    const originalPhone = phone;
    phone = (process.env.TEST_PHONE || phone);
    message = `[TEST REDIRECT FROM ${originalPhone}] ${message}`;
    console.log(`🚨 [TEST MODE] Intercepted message to ${originalPhone}. Redirecting to ${phone}`);
  }

  // Normalize to digits only
  const digits = phone.replace(/\D/g, '');

  // Smart India Prefix: If it's 10 digits, it's a local mobile. Add 91.
  // If it's already 12 digits and starts with 91, keep it.
  let finalPhone = digits;
  if (digits.length === 10) {
    finalPhone = `91${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    finalPhone = digits;
  }

  console.log(`[WhatsApp] Normalizing ${phone} -> +${finalPhone}`);

  // Force the traditional JID format which is often more reliable for UI sync
  const targetJid = `${finalPhone}@c.us`;

  console.log(`[WhatsApp] Searching for chat: ${targetJid}...`);

  try {
    // Force the browser to "open" or "fetch" the chat first
    const chat = await client.getChatById(targetJid);
    console.log(`[WhatsApp] Chat found: ${chat.name || 'Unknown'}. Sending now...`);

    let textResult = null;
    let mediaResult = null;

    // STEP 1: Send the Text Pitch first
    console.log(`[WhatsApp] Sending Text Pitch...`);
    textResult = await chat.sendMessage(message);

    // STEP 2: Send the Media as a separate follow-up bubble
    if (mediaUrl) {
      try {
        console.log(`[WhatsApp] Fetching media from ${mediaUrl}...`);
        const axios = require('axios');
        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(response.data, 'binary').toString('base64');
        const mimetype = response.headers['content-type'] || 'image/png';
        const media = new MessageMedia(mimetype, base64Data, 'mockup.png');

        console.log(`[WhatsApp] Sending Media follow-up...`);
        mediaResult = await chat.sendMessage(media);
      } catch (mediaErr) {
        console.warn(`[WhatsApp] Failed to send media bubble from ${mediaUrl}. Error: ${mediaErr.message}`);
      }
    }

    if (textResult || mediaResult) {
      console.log(`[WhatsApp] ✅ Delivery triggered`);
      console.log('[WhatsApp] ⏳ Holding connection open for 5s to flush buffer...');
      await new Promise(r => setTimeout(r, 5000));
      console.log('[WhatsApp] Handoff complete.');
    }
    return textResult || mediaResult;
  } catch (err) {
    console.log(`[WhatsApp] Chat resolution/send failed: ${err.message}. Trying direct legacy send...`);

    // Legacy fallback also uses the two-step split for consistency
    await client.sendMessage(targetJid, message);
    if (mediaUrl) {
      try {
        const axios = require('axios');
        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(response.data, 'binary').toString('base64');
        const mimetype = response.headers['content-type'] || 'image/png';
        const media = new MessageMedia(mimetype, base64Data, 'mockup.png');
        return await client.sendMessage(targetJid, media);
      } catch (e) {
        return null;
      }
    }
  }
}

/**
 * NEW: Selective history sync for a specific lead.
 * Fetches recent messages ONLY for this lead's phone to safeguard privacy.
 */
async function syncLeadHistory(phone, limit = 20) {
  if (!client || !isConnected) return [];

  // Normalize phone
  const digits = phone.replace(/\D/g, '');
  const finalPhone = (digits.length === 10) ? `91${digits}` : digits;
  const targetJid = `${finalPhone}@c.us`;

  try {
    const chat = await client.getChatById(targetJid);
    const msgs = await chat.fetchMessages({ limit });

    return msgs.map(m => ({
      type: m.fromMe ? 'sent' : 'received',
      text: m.body,
      timestamp: new Date(m.timestamp * 1000).toISOString(),
      channel: 'whatsapp'
    }));
  } catch (err) {
    console.warn(`[WhatsApp] 🚨 Sync failed for ${targetJid}:`, err.message);
    return [];
  }
}

/**
 * Returns the current connection state and QR code (if awaiting scan).
 */
function getConnectionStatus() {
  return { connected: isConnected, qr: qrCode };
}

/**
 * Check if a number is actually registered on WhatsApp.
 */
async function isRegisteredUser(phone) {
  if (!client || !isConnected) return true; // Optimistic if not connected
  const digits = phone.replace(/\D/g, '');
  const finalPhone = (digits.length === 10) ? `91${digits}` : digits;
  try {
    const id = await client.getNumberId(finalPhone);
    if (id) return true;

    // Try without prefix if it failed with 91
    if (finalPhone.startsWith('91')) {
      const fallbackId = await client.getNumberId(finalPhone.substring(2));
      if (fallbackId) return true;
    }

    return false;
  } catch (e) {
    console.warn(`[WhatsApp] Registration check failed for ${phone}, assuming valid:`, e.message);
    return true; // Fallback to optimistic dispatch
  }
}

module.exports = {
  initWhatsApp,
  sendWhatsAppMessage,
  getConnectionStatus,
  syncLeadHistory,
  isRegisteredUser
};
