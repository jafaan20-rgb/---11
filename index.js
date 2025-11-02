// === STUDY BOT v1.0 (Levels 1–12) — исправленный ===
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Ошибка: BOT_TOKEN не задан в .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
let users = {};
const file = './users.json';

// === ЗАГРУЗКА И НОРМАЛИЗАЦИЯ ДАННЫХ ===
function readUsers() {
  try {
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // нормализуем каждую запись: добавим недостающие поля
    for (const id of Object.keys(parsed)) {
      const u = parsed[id] || {};
      if (typeof u.name === 'undefined') u.name = id;
      if (typeof u.xp !== 'number') u.xp = 0;
      if (typeof u.level !== 'number') u.level = 1;
      if (typeof u.coins !== 'number') u.coins = 0;
      if (typeof u.career === 'undefined') u.career = null;
      if (typeof u.bonus !== 'number') u.bonus = 1;
      if (typeof u.lastIncome !== 'number') u.lastIncome = Date.now();
      if (typeof u.upgrades !== 'object' || u.upgrades === null) u.upgrades = {};
      if (!Array.isArray(u.achievements)) u.achievements = [];
      if (typeof u.quests !== 'object' || u.quests === null) u.quests = { lessonsToday: 0, date: new Date().toDateString() };
    }
    return parsed;
  } catch (e) {
    console.error('Ошибка чтения users.json:', e);
    return {};
  }
}

function writeUsers(obj) {
  try {
    fs.writeFileSync(file + '.tmp', JSON.stringify(obj, null, 2));
    fs.renameSync(file + '.tmp', file);
  } catch (e) {
    console.error('Ошибка записи users.json:', e);
  }
}

users = readUsers();

// === Утилиты ===
function save() {
  writeUsers(users);
}

function ensureUser(id, name) {
  id = String(id);
  if (!users[id]) {
    users[id] = {
      name: name || String(id),
      xp: 0,
      level: 1,
      coins: 0,
      career: null,
      bonus: 1,
      lastIncome: Date.now(),
      upgrades: {},
      achievements: [],
      quests: { lessonsToday: 0, date: new Date().toDateString() }
    };
    save();
  } else {
    // на всякий случай нормализуем поля у уже существующего
    const u = users[id];
    if (typeof u.name === 'undefined') u.name = name || id;
    if (typeof u.xp !== 'number') u.xp = 0;
    if (typeof u.level !== 'number') u.level = 1;
    if (typeof u.coins !== 'number') u.coins = 0;
    if (typeof u.career === 'undefined') u.career = null;
    if (typeof u.bonus !== 'number') u.bonus = 1;
    if (typeof u.lastIncome !== 'number') u.lastIncome = Date.now();
    if (typeof u.upgrades !== 'object' || u.upgrades === null) u.upgrades = {};
    if (!Array.isArray(u.achievements)) u.achievements = [];
    if (typeof u.quests !== 'object' || u.quests === null) u.quests = { lessonsToday: 0, date: new Date().toDateString() };
  }
  return users[id];
}

// === XP И УРОВНИ ===
function addXP(u, amount) {
  if (u.upgrades?.knowledge) amount += 20;
  if (u.upgrades?.premium) amount = Math.floor(amount * 1.3);
  const bonusXP = Math.floor(amount * (u.bonus || 1));
  u.xp += bonusXP;
  const requiredXP = (u.level || 1) * 50;
  if (u.xp >= requiredXP) {
    u.level = (u.level || 1) + 1;
    u.xp = u.xp - requiredXP;
    checkAchievements(u);
    return `🎉 Новый уровень! Теперь ${u.level}!`;
  }
  return `+${bonusXP} XP (${u.xp}/${requiredXP})`;
}

// === ПАССИВНЫЙ ДОХОД ===
function passiveIncome(u) {
  const now = Date.now();
  const last = u.lastIncome || 0;
  const diff = now - last;
  if (diff >= 60_000) { // 1 минута
    const minutes = Math.floor(diff / 60_000);
    let income = minutes * 5;
    if (u.upgrades?.energy) income *= 2;
    u.coins = (u.coins || 0) + income;
    u.lastIncome = now;
    save();
    return income;
  }
  return 0;
}

// === ДОСТИЖЕНИЯ ===
function checkAchievements(u) {
  if (!Array.isArray(u.achievements)) u.achievements = [];
  const add = (title) => { if (!u.achievements.includes(title)) u.achievements.push(title); };
  if ((u.level || 0) >= 5) add('Новичок');
  if ((u.level || 0) >= 10) add('Опытный');
  if ((u.xp || 0) >= 1000) add('Усердный ученик');
  if ((u.coins || 0) >= 1000) add('Миллионер знаний');
  save();
}

// === МОТИВАЦИЯ ===
const quotes = ['🚀 Ты становишься лучше с каждым уроком!', '💪 Продолжай — ты на пути к успеху!', '📘 Настоящий мастер не боится ошибок!', '🔥 Даже 10 минут учёбы — это шаг вперёд!'];
function randomQuote() { return quotes[Math.floor(Math.random() * quotes.length)]; }

// === КОМАНДЫ ===
bot.start((ctx) => {
  const id = String(ctx.from.id);
  const name = ctx.from.first_name || ctx.from.username || id;
  ensureUser(id, name);
  ctx.reply(`Привет, ${name}! 👋\nЯ твой учебный бот 🤖\nПиши /lesson /career /shop /quests /status`);
});

// /lesson
bot.command('lesson', (ctx) => {
  const id = String(ctx.from.id);
  const u = ensureUser(id, ctx.from.first_name);
  // безопасная работа с quests
  const today = new Date().toDateString();
  if (!u.quests || typeof u.quests !== 'object') u.quests = { lessonsToday: 0, date: today };
  if (u.quests.date !== today) u.quests = { lessonsToday: 0, date: today };
  u.quests.lessonsToday = (u.quests.lessonsToday || 0) + 1;

  const msg = addXP(u, 10);
  const income = passiveIncome(u);
  checkAchievements(u);

  let reply = `📚 Урок завершён!\n${msg}`;
  if (income > 0) reply += `\n💰 Пассивный доход: +${income} монет`;
  if (u.quests.lessonsToday === 3) {
    u.coins = (u.coins || 0) + 100;
    reply += `\n🎁 Квест выполнен! +100 монет`;
  }
  reply += `\n\n${randomQuote()}`;
  save();
  ctx.reply(reply);
});

// /status
bot.command('status', (ctx) => {
  const id = String(ctx.from.id);
  const u = ensureUser(id, ctx.from.first_name);
  const income = passiveIncome(u);
  if (income > 0) save();
  ctx.reply(`📊 Твой статус:\n👤 ${u.name}\n💼 Профессия: ${u.career || 'не выбрана'}\n⭐ Уровень: ${u.level}\n✨ XP: ${u.xp}\n💰 Монеты: ${u.coins}`);
});

// /career и выбор профессии
bot.command('career', (ctx) => {
  const id = String(ctx.from.id);
  const u = ensureUser(id, ctx.from.first_name);
  if (u.career) return ctx.reply(`👨‍💼 Уже выбрана: ${u.career}`);
  ctx.reply('💼 Выбери профессию:\n1) /career_front\n2) /career_design\n3) /career_analyst');
});
bot.command('career_front', (ctx) => chooseCareer(ctx, 'Frontend-разработчик', 1.2));
bot.command('career_design', (ctx) => chooseCareer(ctx, 'Дизайнер', 1.1));
bot.command('career_analyst', (ctx) => chooseCareer(ctx, 'Аналитик', 1.15));
function chooseCareer(ctx, career, bonus) {
  const id = String(ctx.from.id);
  const u = ensureUser(id, ctx.from.first_name);
  if (u.career) return ctx.reply('Профессию можно выбрать только один раз!');
  u.career = career;
  u.bonus = bonus;
  save();
  ctx.reply(`✅ Профессия выбрана: ${career} (XP ×${bonus})`);
}

// /shop и покупки
bot.command('shop', (ctx) => ctx.reply('🛍 Магазин:\n/buy_knowledge 100\n/buy_energy 150\n/buy_premium 200'));
bot.command('buy_knowledge', (ctx) => buyUpgrade(ctx, 'knowledge', 100));
bot.command('buy_energy', (ctx) => buyUpgrade(ctx, 'energy', 150));
bot.command('buy_premium', (ctx) => buyUpgrade(ctx, 'premium', 200));
function buyUpgrade(ctx, type, cost) {
  const id = String(ctx.from.id);
  const u = ensureUser(id, ctx.from.first_name);
  if (!u.upgrades) u.upgrades = {};
  if (u.upgrades[type]) return ctx.reply('Уже куплено');
  if ((u.coins || 0) < cost) return ctx.reply('Недостаточно монет');
  u.coins -= cost;
  u.upgrades[type] = true;
  save();
  ctx.reply(`Куплено: ${type}`);
}

// /quests
bot.command('quests', (ctx) => {
  const id = String(ctx.from.id);
  const u = ensureUser(id, ctx.from.first_name);
  const today = new Date().toDateString();
  if (!u.quests || typeof u.quests !== 'object') u.quests = { lessonsToday: 0, date: today };
  if (u.quests.date !== today) u.quests = { lessonsToday: 0, date: today };
  ctx.reply(`🎯 Ежедневные задания:\nПройди 3 урока (${u.quests.lessonsToday}/3)`);
});

// /achievements
bot.command('achievements', (ctx) => {
  const id = String(ctx.from.id);
  const u = ensureUser(id, ctx.from.first_name);
  if (!u.achievements || u.achievements.length === 0) return ctx.reply('Пока нет достижений');
  ctx.reply(`🏅 Достижения:\n${u.achievements.map(a => `- ${a}`).join('\n')}`);
});

// /top
bot.command('top', (ctx) => {
  const sorted = Object.entries(users).map(([id, u]) => ({ name: u.name || id, level: u.level || 0, xp: u.xp || 0 }))
    .sort((a, b) => b.xp - a.xp).slice(0, 5);
  let msg = '🏆 ТОП-5:\n';
  sorted.forEach((u, i) => msg += `${i+1}. ${u.name} — ${u.xp} XP (уровень ${u.level})\n`);
  ctx.reply(msg);
});

// === ЗАПУСК ===
bot.launch().then(() => console.log('✅ Study Bot запущен')).catch(e => console.error('Ошибка запуска:', e));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
