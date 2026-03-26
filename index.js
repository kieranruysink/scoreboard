const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const schedule = require('node-schedule');

// ── QR web server ──────────────────────────────────────────
const app = express();
let lastQR = null;

app.get('/', async (req, res) => {
  if (!lastQR) {
    return res.send('<h2>Waiting for QR code... refresh in 10 seconds.</h2>');
  }
  const img = await qrcode.toDataURL(lastQR);
  res.send(`
    <html>
      <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#111;color:white;font-family:sans-serif;">
        <h2>Scan with WhatsApp → Linked Devices</h2>
        <img src="${img}" style="width:300px;height:300px;" />
        <p>This page refreshes every 20 seconds automatically.</p>
        <script>setTimeout(()=>location.reload(), 20000);</script>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ QR server running on port ${PORT}`));

// ── Emoji map ──────────────────────────────────────────────
const EMOJI_MAP = {
  '☃️':  { name: 'Bjorn',    type: 'factor' },
  '🌖':  { name: 'Wolf',     type: 'factor' },
  '🖤':  { name: 'Onur',     type: 'factor' },
  '♨️':  { name: 'Wolf Jr',  type: 'factor' },
  '👺':  { name: 'Amari',    type: 'factor' },
  '🥳':  { name: 'Yosif',    type: 'factor' },
  '⚡️': { name: 'Jelle',    type: 'factor' },
  '🇫🇷': { name: 'Natan',    type: 'factor' },
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

const PERSON_EMOJIS = {};
for (const [emoji, data] of Object.entries(EMOJI_MAP)) {
  if (!PERSON_EMOJIS[data.name]) PERSON_EMOJIS[data.name] = { factor: null, hf: null };
  PERSON_EMOJIS[data.name][data.type] = emoji;
}

const NAME_MAP = {
  'jaume': 'Jaume', 'bjorn': 'Bjorn', 'wolf jr': 'Wolf Jr', 'wolf': 'Wolf',
  'onur': 'Onur', 'lud': 'Lud', 'ludmilla': 'Lud', 'amari': 'Amari',
  'yosif': 'Yosif', 'mario': 'Mario', 'mike': 'Mike', 'jelle': 'Jelle',
  'natan': 'Natan', 'pauline': 'Pauline', 'wouter': 'Wouter', 'tibo': 'Tibo',
  'elliot': 'Elliot', 'fran': 'Fran', 'kieran': 'Kieran',
};

// ── State ──────────────────────────────────────────────────
let salesData = {}, goals = { orange: null, green: null, star: null };
let quoteOfDay = '"NOT BITCHIN\' START PITCHIN" ~ DISMO GROUP';
let prideBoard = { eersteSale: null, eersteBel: null, eersteGong: null, eerstePR: null };
let totalPRs = 0, sourceGroupId = null;

function resetDaily() {
  salesData = {}; goals = { orange: null, green: null, star: null };
  quoteOfDay = '"NOT BITCHIN\' START PITCHIN" ~ DISMO GROUP';
  prideBoard = { eersteSale: null, eersteBel: null, eersteGong: null, eerstePR: null };
  totalPRs = 0;
  console.log('✅ Daily reset complete.');
}

function getDayName() {
  return ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][new Date().getDay()];
}

function getPersonFromSender(name) {
  const lower = (name || '').toLowerCase();
  for (const [key, val] of Object.entries(NAME_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function extractEmojis(text) {
  return text.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu) || [];
}

function processSale(person, text) {
  const emojis = extractEmojis(text);
  let f = 0, h = 0;
  for (const e of emojis) {
    if (!EMOJI_MAP[e] || EMOJI_MAP[e].name !== person) continue;
    if (EMOJI_MAP[e].type === 'factor') f++;
    else h++;
  }
  if (f + h === 0) return;
  if (!salesData[person]) salesData[person] = { factor: 0, hf: 0, total: 0 };
  salesData[person].factor += f; salesData[person].hf += h; salesData[person].total += f + h;
  const t = salesData[person].total;
  if (!prideBoard.eersteSale) prideBoard.eersteSale = person;
  if (!prideBoard.eersteBel && t >= 3) prideBoard.eersteBel = person;
  if (!prideBoard.eersteGong && t >= 5) prideBoard.eersteGong = person;
  console.log(`📦 SALE: ${person} +${f+h} (Factor:${f} HF:${h}) | Day total: ${t}`);
}

function parseGoals(text) {
  const n = text.match(/\d+/g);
  if (n && n.length >= 3) {
    goals.orange=+n[0]; goals.green=+n[1]; goals.star=+n[2];
    console.log(`🎯 Goals: ${goals.orange}/${goals.green}/${goals.star}`);
  }
}

function buildScoreboard() {
  const sorted = Object.entries(salesData).sort((a,b) => b[1].total - a[1].total);
  const lines = sorted.map(([name, data]) => {
    const e = PERSON_EMOJIS[name] || {};
    return `${name}${(e.factor||'').repeat(data.factor)}${(e.hf||'').repeat(data.hf)}`;
  }).join('\n');
  const total = Object.values(salesData).reduce((s,d) => s+d.total, 0);
  const fmt = (rem, tgt) => rem > 0 ? `${rem} TO GO!!‼️(${tgt})` : `✅ REACHED!!(${tgt})`;
  const goalsStr = goals.orange !== null
    ? `🟠${fmt(goals.orange-total,goals.orange)}\n🟢${fmt(goals.green-total,goals.green)}\n🌟${fmt(goals.star-total,goals.star)}`
    : '🟠 Not set yet\n🟢 Not set yet\n🌟 Not set yet';
  const pb = prideBoard;
  return `🛹💨 _*${getDayName()} = GONGDAAAAYYYY*_ 🛹💨
🍔🥗 *Hellofresh Factor Team* 🥗🍔
${lines || '(no sales yet)'}
Sales Done: 📦 ${total}
PR's Recruited: ${totalPRs || '…'}
🏆⚽ *GOALS* ⚽🏆
${goalsStr}
🏅🫵 *Pride Board* 🫵🏅
Eerste PR ✅: ${pb.eerstePR||''}
Eerste Sale 1️⃣: ${pb.eersteSale||''}
Eerste Bel 🛎: ${pb.eersteBel||''}
Eerste Gong 🥁: ${pb.eersteGong||''}
🗣️ *Quote of the Day* 🗣️
${quoteOfDay}`;
}

// ── WhatsApp client ────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  },
});

client.on('qr', (qr) => {
  lastQR = qr;
  console.log('📱 New QR code ready — open your Railway public URL to scan it!');
});

client.on('ready', async () => {
  lastQR = null;
  console.log('\n✅ WhatsApp connected!\n');
  const chats = await client.getChats();
  const source = chats.find(c => c.name === 'Ghent gamechangers');
  if (source) { sourceGroupId = source.id._serialized; console.log('✅ Reading from: Ghent gamechangers'); }
  else console.log('❌ Could not find: "Ghent gamechangers" — check exact name');
  console.log('\n🔇 PHASE 1: Read-only mode. Scoreboard prints to logs only.\n');
});

client.on('message', async (msg) => {
  if (msg.from !== sourceGroupId) return;
  const contact = await msg.getContact();
  const senderName = contact.pushname || contact.name || '';
  const text = msg.body || '';
  const hasMedia = msg.hasMedia;

  if (text.toLowerCase().startsWith('goals')) { parseGoals(text); return; }
  if (text.toLowerCase().startsWith('quote:')) { quoteOfDay = text.replace(/^quote:/i,'').trim(); return; }
  if (hasMedia && text.includes('✅')) {
    const person = getPersonFromSender(senderName);
    if (!prideBoard.eerstePR && person) prideBoard.eerstePR = person;
    totalPRs++; return;
  }
  if (hasMedia && text.length > 0) {
    const person = getPersonFromSender(senderName);
    if (person) processSale(person, text);
  }
});

// ── Scheduler ──────────────────────────────────────────────
schedule.scheduleJob('0 9-14 * * 1-6', () => {
  console.log('\n======= HOURLY SCOREBOARD =======');
  console.log(buildScoreboard());
  console.log('=================================\n');
});

schedule.scheduleJob('0 0 * * *', resetDaily);
client.initialize();
