const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const User = require('../models/User');
const AutoReply = require('../models/AutoReply');
const Log = require('../models/Log');

let client = null;
let connected = false;
let clientInfo = null;

function getTimeStr() {
  return new Date().toTimeString().split(' ')[0];
}

function isConnected() {
  return connected;
}

function getClient() {
  return client;
}

function getInfo() {
  return clientInfo;
}

const initWhatsApp = (io) => {
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './wa-session',
      sessionId: 'wabot-main'
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
        '--disable-gpu'
      ]
    },
    retryOnRateLimit: true,
    maxRetries: 5,
    takeoverOnConflict: true
  });

  client.on('qr', (qr) => {
    console.log('\n========== SCAN QR CODE ==========');
    qrcode.generate(qr, { small: true });
    console.log('===================================\n');
    if (io) {
      io.emit('qr', qr);
      io.emit('connection-status', { connected: false, status: 'qr_ready' });
    }
  });

  client.on('ready', () => {
    connected = true;
    clientInfo = client.info;
    console.log(`[WA] Bot READY! Phone: ${client.info.wid._serialized}`);
    if (io) {
      io.emit('connection-status', {
        connected: true,
        status: 'connected',
        phone: client.info.wid._serialized,
        pushName: client.info.pushName
      });
    }
    Log.create({
      type: 'system',
      message: 'WhatsApp bot connected successfully',
      time: getTimeStr()
    }).catch(() => {});
  });

  client.on('disconnected', (reason) => {
    connected = false;
    clientInfo = null;
    console.log(`[WA] Disconnected: ${reason}`);
    if (io) {
      io.emit('connection-status', { connected: false, status: 'disconnected' });
    }
    Log.create({
      type: 'system',
      message: `WhatsApp bot disconnected: ${reason}`,
      time: getTimeStr()
    }).catch(() => {});
  });

  client.on('auth_failure', (msg) => {
    console.error('[WA] Auth failure:', msg);
    connected = false;
    if (io) {
      io.emit('connection-status', { connected: false, status: 'auth_failure' });
    }
  });

  client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast') return;
    if (msg.isGroup) return;
    if (msg.fromMe) return;

    const phone = msg.from.replace('@s.whatsapp.net', '');
    const text = (msg.body || '').toLowerCase().trim();
    if (!text) return;

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        name: msg.pushName || 'Unknown',
        phone
      });
      console.log(`[WA] New user: ${user.name} (${phone})`);
    }

    await Log.create({
      type: 'received',
      message: `Message from ${user.name} (${phone}): "${msg.body.substring(0, 80)}"`,
      time: getTimeStr()
    });

    // Receipt image handle
    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media && media.mimetype.startsWith('image/')) {
          const fs = require('fs');
          const path = require('path');
          const filename = `receipt_${phone.replace(/[^0-9]/g, '')}_${Date.now()}.${media.mimetype.split('/')[1]}`;
          const filepath = path.join(__dirname, '../../uploads', filename);
          fs.writeFileSync(filepath, Buffer.from(media.data, 'base64'));
          console.log(`[WA] Receipt saved: ${filename}`);

          await Log.create({
            type: 'received',
            message: `Receipt image received from ${phone}`,
            time: getTimeStr()
          });

          await new Promise(r => setTimeout(r, 1000));
          await msg.reply(
            'Your payment receipt has been received. Our team will review and activate your access within 24 hours. Thank you!'
          );
          return;
        }
      } catch (err) {
        console.error('[WA] Media download failed:', err.message);
      }
    }

    // Auto-reply matching
    const rules = await AutoReply.find({ active: true });
    let matched = null;

    for (const rule of rules) {
      if (rule.type === 'exact' && text === rule.keyword.toLowerCase()) {
        matched = rule;
        break;
      }
      if (rule.type === 'contains' && text.includes(rule.keyword.toLowerCase())) {
        matched = rule;
        break;
      }
      if (rule.type === 'regex') {
        try {
          if (new RegExp(rule.keyword, 'i').test(text)) {
            matched = rule;
            break;
          }
        } catch (e) {}
      }
    }

    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));

    const replyText = matched
      ? matched.response
      : 'Sorry, I could not understand your message. Type "menu" to see available options.';

    try {
      await msg.reply(replyText);
      await Log.create({
        type: 'sent',
        message: `Reply sent to ${user.name} (${phone})${matched ? ` [${matched.name}]` : ' [Default]'}`,
        time: getTimeStr()
      });
    } catch (err) {
      await Log.create({
        type: 'error',
        message: `Failed to send to ${phone}: ${err.message}`,
        time: getTimeStr()
      });
    }

    user.messageCount = (user.messageCount || 0) + 1;
    await user.save();
  });

  client.initialize();
  return client;
};

module.exports = { initWhatsApp, isConnected, getClient, getInfo };
