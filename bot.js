// --- ГЛОБАЛЬНАЯ ЗАЩИТА ОТ ПАДЕНИЙ (СЕТЕВЫЕ ОШИБКИ) ---
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Необработанная ошибка (сеть):', reason.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Критическая ошибка (сеть):', err.message);
});

// Отключаем строгую проверку SSL для запросов к Сберу (GigaChat)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// --- ПОДКЛЮЧЕНИЕ К SUPABASE ---
const supabaseUrl = 'https://mbatvendpeyxjzfsjbiy.supabase.co';
const supabaseKey = 'sb_publishable_xWVduzDP1f0bPfy-UvXr8A_dWmCy5yx';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- ПОДКЛЮЧЕНИЕ К TELEGRAM (ЧЕРЕЗ МОСТ) ---
const token = process.env.TELEGRAM_TOKEN;
const bot = new Telegraf(token, {
  telegram: { apiRoot: 'https://tg-proxy.gusj12.workers.dev' }
});

// --- НАСТРОЙКИ GIGACHAT ---
const GIGACHAT_AUTH_KEY = process.env.GIGACHAT_AUTH_KEY; 
let gigachatAccessToken = null;
let tokenExpiry = 0;

async function getGigaChatToken() {
  if (gigachatAccessToken && Date.now() < tokenExpiry) return gigachatAccessToken;
  
  try {
    const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': '6f0b1291-c7f3-43c6-bb2e-9f3efb2dc7ec',
        'Authorization': `Basic ${GIGACHAT_AUTH_KEY}`
      },
      body: new URLSearchParams({ scope: 'GIGACHAT_API_PERS' }),
      // @ts-ignore
      agent: new (require('https').Agent)({ rejectUnauthorized: false })
    });
    
    const data = await response.json();
    
    if (data.access_token) {
      gigachatAccessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 300000;
      console.log('✅ Токен GigaChat успешно получен!');
      return gigachatAccessToken;
    } else {
      console.error('❌ Сбер вернул ошибку вместо токена:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Сетевая ошибка при получении токена GigaChat:', error.message);
    return null;
  }
}

// --- ФУНКЦИЯ ЗАПРОСА К ИИ С ТАЙМ-АУТОМ (15 СЕКУНД) ---
const askGigaChat = async (prompt, systemPrompt = "Ты — умный помощник.") => {
  const token = await getGigaChatToken();
  if (!token) return "Не удалось подключиться к ИИ.";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); 

    const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'GigaChat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.01 // Делаем ответы максимально точными
      }),
      signal: controller.signal,
      // @ts-ignore
      agent: new (require('https').Agent)({ rejectUnauthorized: false })
    });

    clearTimeout(timeoutId);
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    if (error.name === 'AbortError') return "ИИ задумался слишком надолго. Попробуй позже.";
    console.error("Ошибка GigaChat:", error.message);
    return "Ошибка при обращении к ИИ.";
  }
};

// --- УМНОЕ ОПРЕДЕЛЕНИЕ КАТЕГОРИИ ---
const getSmartCategory = async (text) => {
  const prompt = `Задача: "${text}". Ответь ОДНИМ СЛОВОМ из списка: [Сон, Учеба, Работа, Быт, Отдых, Другое]. Без знаков препинания, без кавычек, без лишних слов.`;
  const rawCategory = await askGigaChat(prompt, "Ты строгий классификатор. Твой ответ должен состоять ровно из одного слова из предложенного списка.");
  
  console.log(`🤖 ИИ ответил на "${text}" -> "${rawCategory}"`);

  // Очищаем от всего, кроме русских букв
  const cleanCategory = rawCategory.replace(/[^а-яА-ЯёЁ]/g, '');
  
  const validCategories = ['Сон', 'Учеба', 'Работа', 'Быт', 'Отдых', 'Другое'];
  const found = validCategories.find(c => cleanCategory.toLowerCase() === c.toLowerCase());
  
  return found || 'Другое';
};

// --- КЛАВИАТУРЫ ---
const mainKeyboard = Markup.keyboard([
  ['📋 Мои задачи', '➕ Добавить задачу'],
  ['🧠 Спланировать день (ИИ)', '⚡️ Моя энергия'],
  ['⚙️ Расписание', '🔄 Начать сначала']
]).resize();

const energyKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🔋 Мало сил', 'energy_1')],
  [Markup.button.callback('🔋🔋 Норма', 'energy_2')],
  [Markup.button.callback('🔋🔋🔋 Полон сил', 'energy_3')]
]);

// --- ФУНКЦИИ БАЗЫ ДАННЫХ ---
const getUser = async (userId) => {
  const { data } = await supabase.from('users').select('*').eq('id', userId).single();
  return data;
};
const updateUser = async (userId, updates) => {
  await supabase.from('users').update(updates).eq('id', userId);
};
const getTasks = async (userId) => {
  const { data } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('done', false);
  return data || [];
};

// --- СТАРТ И ОНБОРДИНГ ---
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  let user = await getUser(userId);
  if (!user) {
    await supabase.from('users').insert([{ id: userId, setup_step: 1 }]);
    return ctx.reply('Привет! 👋 Давай настроим твой график.\n\n📅 <b>Шаг 1 из 3:</b>\nВо сколько ты работаешь в будние дни? (09:00-18:00)', { parse_mode: 'HTML' });
  }
  if (user.setup_step !== 0) {
    return ctx.reply('Давай завершим настройку.\n\n📅 <b>Шаг 1 из 3:</b>\nВо сколько ты работаешь в будние дни?', { parse_mode: 'HTML' });
  }
  ctx.reply('С возвращением! Твой умный Ритм готов к работе.', mainKeyboard);
});

// --- СБРОС ---
const resetUser = async (ctx) => {
  const userId = ctx.from.id;
  await supabase.from('tasks').delete().eq('user_id', userId);
  await updateUser(userId, { setup_step: 1, schedule: null, energy: null, pending_task: null });
  ctx.reply('🔄 Начинаем заново.\n\n📅 <b>Шаг 1 из 3:</b>\nВо сколько ты работаешь в будние дни?', { parse_mode: 'HTML' });
};
bot.command('reset', resetUser);
bot.hears('🔄 Начать сначала', resetUser);

// --- ЛОГИКА ОНБОРДИНГА ---
bot.on('text', async (ctx, next) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return next();
  
  const text = ctx.message.text;
  const ignoreList = ['/start', '/reset', '📋 Мои задачи', '➕ Добавить задачу', '⚡️ Моя энергия', '⚙️ Расписание', '🔄 Начать сначала', '🧠 Спланировать день (ИИ)'];
  if (text.startsWith('/') || ignoreList.includes(text)) return next();

  if (user.setup_step && user.setup_step !== 0) {
    if (user.setup_step === 1) {
      await updateUser(userId, { schedule: { weekday: text, weekend: null, sleep: null }, setup_step: 2 });
      return ctx.reply('📅 <b>Шаг 2 из 3:</b>\nА в выходные? (10:00-15:00 или "Отдыхаю")', { parse_mode: 'HTML' });
    }
    if (user.setup_step === 2) {
      const schedule = { ...user.schedule, weekend: text };
      await updateUser(userId, { schedule, setup_step: 3 });
      return ctx.reply('😴 <b>Шаг 3 из 3:</b>\nВо сколько ты ложишься спать и встаешь? (23:00-07:00)', { parse_mode: 'HTML' });
    }
    if (user.setup_step === 3) {
      const schedule = { ...user.schedule, sleep: text };
      await updateUser(userId, { schedule, setup_step: 0 });
      return ctx.reply('✅ Отлично! Все записал. Теперь ты можешь добавлять задачи.', mainKeyboard);
    }
  }
  return next();
});

// --- ЭНЕРГИЯ ---
bot.hears('⚡️ Моя энергия', (ctx) => ctx.reply('Как твои силы?', energyKeyboard));
bot.action(/energy_(.+)/, async (ctx) => {
  try {
    const level = parseInt(ctx.match[1]);
    await updateUser(ctx.from.id, { energy: level });
    await ctx.answerCbQuery(`Записал!`);
    await ctx.editMessageText(`Энергия: ${level === 1 ? '🔋 Мало' : level === 3 ? '🔋🔋🔋 Полон сил' : '🔋🔋 Норма'}`);
  } catch (e) { ctx.answerCbQuery('Ошибка'); }
});

// --- УМНЫЙ ПЛАН НА ДЕНЬ ---
bot.hears('🧠 Спланировать день (ИИ)', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  const tasks = await getTasks(userId);

  if (tasks.length === 0) return ctx.reply('У тебя нет активных задач. Отдыхай! 🎉');

  const thinkingMsg = await ctx.reply('🧠 GigaChat анализирует... (до 15 секунд)');

  const now = new Date();
  const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  
  const scheduleText = user.schedule ? `Будни: ${user.schedule.weekday}. Выходные: ${user.schedule.weekend}. Сон: ${user.schedule.sleep}.` : 'Расписание не задано.';
  const energyText = user.energy === 1 ? 'Мало сил' : user.energy === 3 ? 'Полон сил' : 'Норма';
  const tasksText = tasks.map((t, i) => `${i + 1}. ${t.text} (категория: ${t.category})`).join('\n');

  const prompt = `Сейчас ${timeStr} (${isWeekend ? 'выходной' : 'будний день'}).\nРасписание: ${scheduleText}\nЭнергия: ${energyText}.\nЗадачи:\n${tasksText}\n\nСоставь план: в какое время лучше сделать каждую задачу? Когда отдохнуть? Ответь кратко.`;

  const plan = await askGigaChat(prompt, "Ты эксперт по продуктивности. Твои советы реалистичны.");
  
  await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => {});
  
  if (plan.includes("Ошибка") || plan.includes("Не удалось") || plan.includes("задумался")) {
    ctx.reply(`⚠️ ${plan}`);
  } else {
    ctx.reply(`📝 <b>Твой план от ИИ:</b>\n\n${plan}`, { parse_mode: 'HTML' });
  }
});

// --- СПИСОК ЗАДАЧ ---
bot.hears('📋 Мои задачи', async (ctx) => {
  const userId = ctx.from.id;
  const tasks = await getTasks(userId);
  if (tasks.length === 0) return ctx.reply('У тебя нет активных задач. Отдыхай или добавь новую! 🎉');

  let message = '📋 <b>Твои задачи:</b>\n\n';
  const buttons = [];
  tasks.forEach((task, index) => {
    message += `${index + 1}. [${task.category}] ${task.text}\n`;
    buttons.push([Markup.button.callback(`✅ Выполнить: ${task.text.slice(0, 15)}...`, `done_${task.id}`)]);
  });
  ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
});

// --- ВЫПОЛНЕНИЕ ЗАДАЧИ ---
bot.action(/done_(.+)/, async (ctx) => {
  const taskId = parseInt(ctx.match[1]);
  await supabase.from('tasks').update({ done: true }).eq('id', taskId);
  ctx.answerCbQuery('Выполнено! ✅');
  ctx.editMessageText('✅ Задача выполнена! Молодец.').catch(() => {});
});

// --- ДОБАВЛЕНИЕ ЗАДАЧИ ---
bot.hears('➕ Добавить задачу', (ctx) => ctx.reply('Напиши текст задачи (например: "Подготовиться к экзамену")'));

// --- РАСПИСАНИЕ ---
bot.hears('⚙️ Расписание', async (ctx) => {
  const user = await getUser(ctx.from.id);
  if (!user || !user.schedule) return ctx.reply('Расписание не настроено.');
  const s = user.schedule;
  ctx.reply(`⚙️ Твое расписание:\n\n• Будни: ${s.weekday}\n• Выходные: ${s.weekend}\n• Сон: ${s.sleep}`);
});

// --- ОБРАБОТКА НОВОЙ ЗАДАЧИ (ОПРЕДЕЛЕНИЕ КАТЕГОРИИ) ---
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user || user.setup_step !== 0) return;
  
  const text = ctx.message.text;
  const ignoreList = ['📋 Мои задачи', '➕ Добавить задачу', '⚡️ Моя энергия', '⚙️ Расписание', '🔄 Начать сначала', '🧠 Спланировать день (ИИ)'];
  if (text.startsWith('/') || ignoreList.includes(text)) return;

  const thinkingMsg = await ctx.reply('⏳ GigaChat определяет категорию...');
  const category = await getSmartCategory(text);

  const newTask = {
    id: Date.now(),
    user_id: userId,
    text: text,
    category: category,
    done: false,
    deadline: null,
    remind_time: null
  };
  
  await supabase.from('tasks').insert([newTask]);
  await ctx.telegram.deleteMessage(ctx.chat.id, thinkingMsg.message_id).catch(() => {});
  ctx.reply(`✅ Задача сохранена: "${text}"\n🧠 GigaChat определил: [${category}]`, mainKeyboard);
});

// --- ПЕРЕХВАТЧИК ОШИБОК TELEGRAF ---
bot.catch((err, ctx) => {
  console.error(`Ошибка при обработке ${ctx.updateType}:`, err.message);
  if (err.message.includes('ECONNRESET') || err.message.includes('network')) {
    ctx.reply('⚠️ Произошел сбой сети. Я переподключился, попробуй еще раз!').catch(() => {});
  }
});

// --- ЗАПУСК ---
bot.launch();
console.log('🤖 Умный бот Ритм с ИИ-планировщиком запущен!');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));