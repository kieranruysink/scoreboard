const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const schedule = require('node-schedule');

// ============================================================
// EMOJI MAP — who owns which emoji
// first emoji = Factor | second emoji = HelloFresh
// one emoji only = HelloFresh only
// ============================================================
const EMOJI_MAP = {
  // Factor emojis
  '☃️':  { name: 'Bjorn',    type: 'factor' },
  '🌖':  { name: 'Wolf',     type: 'factor' },
  '🖤':  { name: 'Onur',     type: 'factor' },
  '♨️':  { name: 'Wolf Jr',  type: 'factor' },
  '👺':  { name: 'Amari',    type: 'factor' },
  '🥳':  { name: 'Yosif',    type: 'factor' },
  '⚡️': { name: 'Jelle',    type: 'factor' },
  '🇫🇷': { name: 'Natan',    type: 'factor' },

  // HelloFresh emojis
  '✌️':   { name: 'Jaume',    type: 'hf' },
  '🎅🏻': { name: 'Bjorn',    type: 'hf' },
  '🐺':   { name: 'Wolf',     type: 'hf' },
  '🥑':   { name: 'Onur',     type: 'hf' },
  '🎀':   { name: 'Lud',      type: 'hf' },
  '🗿':   { name: 'Wolf Jr',  type: 'hf' },
  '🤡':   { name: 'Amari',    type: 'hf' },
  '🕺🏻': { name: 'Yosif',    type: 'hf' },
  '🍀':   { name: 'Mario',    type: 'hf' },
  '🍑':   { name: 'Mike',     type: 'hf' },
  '🦁':   { name: 'Jelle',    type: 'hf' },
  '🎸':   { name: 'Natan',    type: 'hf' },
  '💚':   { name: 'Pauline',  type: 'hf' },
  '🦆':   { name: 'Wouter',   type: 'hf' },
  '🤸‍♀️': { name: 'Tibo',     type: 'hf' },
  '🥊':   { name: 'Elliot',   type: 'hf' },
  '🫡':   { name: 'Fran',     type: 'hf' },
  '🍁':   { name: 'Kieran',   type: 'hf' },
};

// Build reverse map: person → their emojis
const PERSON_EMOJIS = {};
for (const [emoji, data] of Object.entries(EMOJI_MAP)) {
  if (!PERSON_EMOJIS[data.name]) PERSON_EMOJIS[data.name] = { factor: null, hf: null };
  PERSON_EMOJIS[data.name][data.type] = emoji;
}

// ============================================================
// NAME MAP — WhatsApp contact name → system name
// Update these if someone's WhatsApp name is different
// ============================================================
const NAME_MAP = {
  'jaume':    'Jaume',
  'bjorn':    'Bjorn',
  'wolf jr':  'Wolf Jr',
  'wolf':     'Wolf',
  'onur':     'Onur',
  'lud':      'Lud',
  'ludmilla': 'Lud',
  'amari':    'Amari',
  'yosif':    'Yosif',
  'mario':    'Mario',
  'mike':     'Mike',
  'jelle':    'Jelle',
  'natan':    'Natan',
  'pauline':  'Pauline',
  'wouter':   'Wouter',
  'tibo':     'Tibo',
  'elliot':   'Elliot',
  'fran':     'Fran',
  'kieran':   'Kieran',
};

// ============================================================
// STATE — resets every day at midnight
// ============================================================
let salesData  = {};  // { name: { factor: 0, hf: 0, total: 0 } }
let goals      = { orange: null, green: null, star: null };
let quoteOfDay = '"NOT BITCHIN\' START PITCHIN" ~ DISMO GROUP';
let prideBoard = { eersteSale: null, eersteBel: null, eersteGong: null, eerstePR: null };
let totalPRs   = 0;
let sourceGroupId = null;
let targetGroupId = null;

function resetDaily() {
  salesData  = {};
  goals      = { orange: null, green: null, star: null };
  quoteOfDay = '"NOT BITCHIN\' START PITCHIN" ~ DISMO GROUP';
  prideBoard = { eerstesale: null, eersteBel: null, eersteGong: null, eerstePR: null };
  totalPRs   = 0;
  console.log('✅ Daily reset complete.');
}

// ============================================================
// HELPERS
// ============================================================
function getDayName() {
  const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  return days[new Date().getDay()];
}

function getPersonFromSender(whatsappName) {
  const lower = (whatsappName || '').toLowerCase();
  for (const [key, val] of Object.entries(NAME_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function extractEmojis(text) {
  // Matches all emoji characters
  const regex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
  return text.match(regex) || [];
}

// ============================================================
// SALE PROCESSOR
// ============================================================
function processSale(person, messageText) {
  const emojis = extractEmojis(messageText);
  let factorCount = 0;
  let hfCount     = 0;

  for (const e of emojis) {
    if (!EMOJI_MAP[e]) continue;
    if (EMOJI_MAP[e].name !== person) continue; // emoji doesn't belong to this sender
    if (EMOJI_MAP[e].type === 'factor') factorCount++;
    if (EMOJI_MAP[e].type === 'hf')     hfCount++;
  }

  const saleCount = factorCount + hfCount;
  if (saleCount === 0) return;

  if (!salesData[person]) salesData[person] = { factor: 0, hf: 0, total: 0 };
  salesData[person].factor += factorCount;
  salesData[person].hf     += hfCount;
  salesData[person].total  += saleCount;

  const newTotal = salesData[person].total;

  // Pride board checks
  if (!prideBoard.eersteSale) prideBoard.eersteSale = person;
  if (!prideBoard.eersteBel  && newTotal >= 3) prideBoard.eersteBel  = person;
  if (!prideBoard.eersteGong && newTotal >= 5) prideBoard.eersteGong = person;

  console.log(`📦 Sale: ${person} +${saleCount} (Factor: ${factorCount} | HF: ${hfCount}) | Total today: ${newTotal}`);
}

// ============================================================
// GOAL PARSER
// Kieran types: "goals 28 32 36" in the source group
// ============================================================
function parseGoals(text) {
  const numbers = text.match(/\d+/g);
  if (numbers && numbers.length >= 3) {
    goals.orange = parseInt(numbers[0]);
    goals.green  = parseInt(numbers[1]);
    goals.star   = parseInt(numbers[2]);
    console.log(`🎯 Goals set: ${goals.orange} / ${goals.green} / ${goals.star}`);
    return true;
  }
  return false;
}

// ============================================================
// SCOREBOARD BUILDER
// ============================================================
function buildScoreboard() {
  const day = getDayName();

  // Sort by total sales (highest first)
  const sorted = Object.entries(salesData).sort((a, b) => b[1].total - a[1].total);

  // Build person lines
  const lines = sorted.map(([name, data]) => {
    const emojis   = PERSON_EMOJIS[name] || {};
    const fEmoji   = emojis.factor || '';
    const hEmoji   = emojis.hf    || '';
    const fStr     = fEmoji ? fEmoji.repeat(data.factor) : '';
    const hStr     = hEmoji ? hEmoji.repeat(data.hf)     : '';
    return `${name}${fStr}${hStr}`;
  }).join('\n');

  // Total sales
  const totalSales = Object.values(salesData).reduce((sum, d) => sum + d.total, 0);

  // Goals countdown
  let goalsStr = '';
  if (goals.orange !== null) {
    const toOrange = goals.orange - totalSales;
    const toGreen  = goals.green  - totalSales;
    const toStar   = goals.star   - totalSales;
    const fmt = (remaining, target) =>
      remaining > 0
        ? `${remaining} TO GO!!‼️(${target})`
        : `✅ REACHED!!(${target})`;
    goalsStr = `🟠${fmt(toOrange, goals.orange)}\n🟢${fmt(toGreen, goals.green)}\n🌟${fmt(toStar, goals.star)}`;
  } else {
    goalsStr = '🟠 Not set yet\n🟢 Not set yet\n🌟 Not set yet';
  }

  // Pride board
  const pb = prideBoard;
  const prLine  = pb.eerstePR   ? pb.eerstePR   : '';
  const salLine = pb.eersteSale ? pb.eersteSale  : '';
  const belLine = pb.eersteBel  ? pb.eersteBel   : '';
  const gonLine = pb.eersteGong ? pb.eersteGong  : '';

  return (
`🛹💨 _*${day} = GONGDAAAAYYYY*_ 🛹💨
🍔🥗 *Hellofresh Factor Team* 🥗🍔
${lines || '(no sales yet)'}
Sales Done: 📦 ${totalSales}
PR's Recruited: ${totalPRs > 0 ? totalPRs : '…'}
🏆⚽ *GOALS* ⚽🏆
${goalsStr}
🏅🫵 *Pride Board* 🫵🏅
Eerste PR ✅: ${prLine}
Eerste Sale 1️⃣: ${salLine}
Eerste Bel 🛎: ${belLine}
Eerste Gong 🥁: ${gonLine}
🗣️ *Quote of the Day* 🗣️
${quoteOfDay}`
  );
}

// ============================================================
// WHATSAPP CLIENT
// ============================================================
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with your WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('\n✅ WhatsApp connected!\n');

  const chats = await client.getChats();

  const source = chats.find(c => c.name === 'Ghent gamechangers');
  const target = chats.find(c => c.name === 'K13RAN');

  if (source) {
    sourceGroupId = source.id._serialized;
    console.log('✅ Reading from: Ghent gamechangers');
  } else {
    console.log('❌ Could not find group: "Ghent gamechangers" — check the name is exact');
  }

  if (target) {
    targetGroupId = target.id._serialized;
    console.log('✅ Posting to: K13RAN');
  } else {
    console.log('❌ Could not find chat: "K13RAN" — check the name is exact');
  }
});

client.on('message', async (msg) => {
  // Only read messages from the source group
  if (msg.from !== sourceGroupId) return;

  const contact     = await msg.getContact();
  const senderName  = contact.pushname || contact.name || '';
  const text        = msg.body || '';
  const hasMedia    = msg.hasMedia;

  console.log(`📨 [${senderName}]: ${text} | hasMedia: ${hasMedia}`);

  // ── Kieran sets goals: type "goals 28 32 36" in the group
  if (text.toLowerCase().startsWith('goals')) {
    parseGoals(text);
    return;
  }

  // ── Kieran sets quote: type "quote: your quote here" in the group
  if (text.toLowerCase().startsWith('quote:')) {
    quoteOfDay = text.replace(/^quote:/i, '').trim();
    console.log(`🗣️ Quote updated: ${quoteOfDay}`);
    return;
  }

  // ── PR: photo + ✅ emoji
  if (hasMedia && text.includes('✅')) {
    const person = getPersonFromSender(senderName);
    if (!prideBoard.eerstePR && person) prideBoard.eerstePR = person;
    totalPRs++;
    console.log(`🤝 PR counted! Total: ${totalPRs}`);
    return;
  }

  // ── Sale: photo + sender's emoji(s)
  if (hasMedia && text.length > 0) {
    const person = getPersonFromSender(senderName);
    if (person) processSale(person, text);
  }
});

// ============================================================
// SCHEDULER
// Posts scoreboard every hour from 9:00 to 14:00 (Mon–Sat)
// Change the hours below if your workday is different
// ============================================================
schedule.scheduleJob('0 9-14 * * 1-6', async () => {
  if (!targetGroupId) {
    console.log('❌ No target group found — cannot post scoreboard');
    return;
  }
  const board = buildScoreboard();
  await client.sendMessage(targetGroupId, board);
  console.log('📊 Scoreboard posted to K13RAN');
});

// Daily reset at midnight
schedule.scheduleJob('0 0 * * *', resetDaily);

// ============================================================
// START
// ============================================================
client.initialize();
