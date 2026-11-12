require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

// --- ПОДКЛЮЧЕНИЕ К SUPABASE ---
const supabaseUrl = 'https://mbatvendpeyxjzfsjbiy.supabase.co';
const supabaseKey = 'sb_publishable_xWVduzDP1f0bPfy-UvXr8A_dWmCy5yx';
const supabase = createClient(supabaseUrl, supabaseKey);

const token = process.env.TELEGRAM_TOKEN;
const bot = new Telegraf(token, {
  telegram: { apiRoot: 'https://tg-proxy.gusj12.workers.dev' }
});

// --- КЛАВИАТУРЫ ---
const mainKeyboard = Markup.keyboard([
  [Markup.button.webApp('🌿 Открыть Ритм (Мини-Апп)', 'https://ritm-app-61l.pages.dev')],
  ['📋 Список задач', '⚡️ Моя энергия'],
  ['🧠 Спланировать день', '⚙️ Мое расписание'],
  ['🔄 Начать сначала']
]).resize();

const energyKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🔋 Мало сил', 'energy_1')],
  [Markup.button.callback('🔋🔋 Норма', 'energy_2')],
  [Markup.button.callback('🔋🔋🔋 Полон сил', 'energy_3')]
]);

const deadlineKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🔥 Сегодня', 'dl_today'), Markup.button.callback('📅 Завтра', 'dl_tomorrow')],
  [Markup.button.callback('⏳ Через 3 дня', 'dl_3days'), Markup.button.callback('📆 До конца месяца', 'dl_month_end')],
  [Markup.button.callback('❌ Без дедлайна', 'dl_none')]
]);

// --- "ИИ" ДЛЯ КАТЕГОРИЙ ---
const getCategory = (text) => {
  const t = text.toLowerCase();
  if (t.includes('сон') || t.includes('поспать') || t.includes('спать') || t.includes('дрем')) return 'Сон';
  if (t.includes('лекци') || t.includes('учеб') || t.includes('курсов') || t.includes('читать') || t.includes('экзамен')) return 'Учеба';
  if (t.includes('работ') || t.includes('отчет') || t.includes('созвон') || t.includes('письм') || t.includes('смен')) return 'Работа';
  if (t.includes('купить') || t.includes('убрать') || t.includes('врач') || t.includes('дом')) return 'Быт';
  if (t.includes('отдохнуть') || t.includes('играть') || t.includes('гулять') || t.includes('кино')) return 'Отдых';
  return 'Другое';
};

// --- ФУНКЦИИ ДЛЯ РАБОТЫ С БАЗОЙ (С ЛОГАМИ ОШИБОК) ---
const getUser = async (userId) => {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error && error.code !== 'PGRST116') console.error("ОШИБКА ПОЛУЧЕНИЯ:", error.message);
    return data;
  } catch (e) {
    console.error(e);
    return null;
  }
};

const createUser = async (userId) => {
  try {
    await supabase.from('users').insert([{ id: userId, setup_step: 1 }]);
  } catch (e) { console.error(e); }
};

const updateUser = async (userId, updates) => {
  try {
    await supabase.from('users').update(updates).eq('id', userId);
  } catch (e) { console.error(e); }
};

const getTasks = async (userId) => {
  try {
    const { data } = await supabase.from('tasks').select('*').eq('user_id', userId).eq('done', false);
    return data || [];
  } catch (e) { return []; }
};

// --- СТАРТ И СБРОС ---
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  let user = await getUser(userId);

  if (!user) {
    await createUser(userId);
  } else if (user.setup_step === 0) {
    return ctx.reply('С возвращением! Твой Ритм готов к работе.', mainKeyboard);
  }

  await updateUser(userId, { setup_step: 1 });
  ctx.reply('Привет! 👋 Настроим твой график.\n\n📅 <b>Шаг 1 из 3:</b>\nВо сколько ты работаешь в будние дни? (Например: 09:00-18:00)', { parse_mode: 'HTML' });
});

bot.hears('🔄 Начать сначала', async (ctx) => {
  const userId = ctx.from.id;
  await supabase.from('tasks').delete().eq('user_id', userId);
  await updateUser(userId, { setup_step: 1, schedule: null, energy: null, pending_task: null });
  ctx.reply('🔄 Начинаем заново.\n\n📅 <b>Шаг 1 из 3:</b>\nВо сколько ты работаешь в будние дни? (Например: 09:00-18:00)', { parse_mode: 'HTML' });
});

// --- ГЛАВНЫЙ ОБРАБОТЧИК ТЕКСТА (И НАСТРОЙКА, И ЗАДАЧИ) ---
bot.on('text', async (ctx, next) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return next();

  const text = ctx.message.text;
  const ignoreList = ['/start', '📋 Список задач', '⚡️ Моя энергия', '⚙️ Мое расписание', '🧹 Очистить всё', '🔄 Начать сначала', '🧠 Спланировать день'];
  if (text.startsWith('/') || ignoreList.includes(text)) return next();

  // 1. ЕСЛИ МЫ В ПРОЦЕССЕ НАСТРОЙКИ
  if (user.setup_step && user.setup_step !== 0) {
    if (user.setup_step === 1) {
      await updateUser(userId, { schedule: { weekday: text, weekend: null, sleep: null }, setup_step: 2 });
      return ctx.reply('📅 <b>Шаг 2 из 3:</b>\nА в выходные? (10:00-15:00 или "Отдыхаю")', { parse_mode: 'HTML' });
    }
    if (user.setup_step === 2) {
      const schedule = { ...user.schedule, weekend: text };
      await updateUser(userId, { schedule, setup_step: 3 });
      return ctx.reply('😴 <b>Шаг 3 из 3:</b>\nВо сколько ты ложишься спать и встаешь? (Например: 23:00-07:00)', { parse_mode: 'HTML' });
    }
    if (user.setup_step === 3) {
      const schedule = { ...user.schedule, sleep: text };
      await updateUser(userId, { schedule, setup_step: 0 });
      return ctx.reply('✅ Отлично! Все записал. Теперь можешь добавлять задачи.', mainKeyboard);
    }
  }

  // 2. ЕСЛИ НАСТРОЙКА ПРОЙДЕНА — ДОБАВЛЯЕМ ЗАДАЧУ
  if (user.setup_step === 0) {
    const category = getCategory(text);
    await updateUser(userId, { pending_task: { text: text, category: category } });
    ctx.reply(`📝 Задача: "${text}" [${category}]\n\n📅 Когда планируешь выполнить?`, deadlineKeyboard);
  }
});

// --- ЭНЕРГИЯ ---
bot.hears('⚡️ Моя энергия', (ctx) => ctx.reply('Как твои силы?', energyKeyboard));
bot.action(/energy_(.+)/, async (ctx) => {
  const level = parseInt(ctx.match[1]);
  await updateUser(ctx.from.id, { energy: level });
  ctx.editMessageText(`Энергия: ${level === 1 ? '🔋 Мало' : level === 3 ? '🔋🔋🔋 Полон сил' : '🔋🔋 Норма'}\n\nЗаписал!`);
});

// --- ПЛАНИРОВЩИК ---
bot.hears('🧠 Спланировать день', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (!user || !user.schedule) return ctx.reply('Сначала настрой расписание (/start).');
  
  let activeTasks = await getTasks(userId);
  if (activeTasks.length === 0) return ctx.reply('Нет активных задач для планирования.');

  activeTasks.sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity));

  const { weekday, weekend, sleep } = user.schedule;
  const now = new Date();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const workTime = isWeekend ? weekend : weekday;

  const parseTime = (str) => {
    if (!str || str.toLowerCase().includes('отдых')) return null;
    const [start, end] = str.split('-').map(s => s.trim());
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return { start: sh * 60 + sm, end: eh * 60 + em };
  };

  const work = parseTime(workTime);
  const sleepHours = parseTime(sleep) || { start: 23 * 60, end: 7 * 60 };

  const isFree = (minute) => {
    if (work && minute >= work.start && minute < work.end) return false;
    if (sleepHours.start < sleepHours.end) {
      if (minute >= sleepHours.start && minute < sleepHours.end) return false;
    } else {
      if (minute >= sleepHours.start || minute < sleepHours.end) return false;
    }
    return true;
  };

  let currentMinute = Math.max(8 * 60, now.getHours() * 60 + now.getMinutes());
  const plan = [];

  activeTasks.forEach(task => {
    let duration = 30;
    if (task.text.length > 20) duration = 60;
    if (task.text.toLowerCase().includes('отчет') || task.text.toLowerCase().includes('курсов')) duration = 120;
    if (task.category === 'Сон') duration = 60;

    while (currentMinute + duration <= 22 * 60) {
      if (isFree(currentMinute)) {
        plan.push({ ...task, time: `${Math.floor(currentMinute / 60)}:${(currentMinute % 60).toString().padStart(2, '0')}`, duration });
        currentMinute += duration + 10;
        break;
      }
      currentMinute += 30;
    }
  });

  if (plan.length === 0) return ctx.reply('Свободного времени сегодня не осталось. Отдыхай! 🎉');

  let message = '🧠 <b>Твой план на сегодня:</b>\n\n';
  plan.forEach(p => {
    const dl = p.deadline ? ` [до ${new Date(p.deadline).toLocaleDateString()}]` : '';
    message += `⏰ ${p.time} — ${p.text} (~${p.duration} мин)${dl}\n`;
  });

  if (sleepHours) {
      const sleepStr = `${Math.floor(sleepHours.start/60).toString().padStart(2, '0')}:${(sleepHours.start%60).toString().padStart(2, '0')}`;
      const wakeStr = `${Math.floor(sleepHours.end/60).toString().padStart(2, '0')}:${(sleepHours.end%60).toString().padStart(2, '0')}`;
      message += `\n😴 Не забудь про сон: с ${sleepStr} до ${wakeStr}`;
  }
  ctx.reply(message, { parse_mode: 'HTML' });
});

// --- СПИСОК ЗАДАЧ ---
bot.hears('📋 Список задач', async (ctx) => {
  const userId = ctx.from.id;
  const activeTasks = await getTasks(userId);
  if (activeTasks.length === 0) return ctx.reply('Список пуст!');

  let message = '📋 Твои задачи:\n\n';
  activeTasks.forEach((task, i) => { 
    const dl = task.deadline ? ` (до ${new Date(task.deadline).toLocaleDateString()})` : '';
    message += `${i + 1}. [${task.category}] ${task.text}${dl}\n`; 
  });
  
  const buttons = activeTasks.map(task => [
    Markup.button.callback(`✅ ${task.text.slice(0, 15)}...`, `done_${task.id}`),
    Markup.button.callback(`🔄 Категория`, `cat_${task.id}`)
  ]);
  ctx.reply(message, Markup.inlineKeyboard(buttons));
});

// --- ВЫПОЛНЕНИЕ И КАТЕГОРИИ ---
bot.action(/cat_(.+)/, (ctx) => {
  const taskId = ctx.match[1];
  const catKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Учеба', `setcat_${taskId}_Учеба`), Markup.button.callback('Работа', `setcat_${taskId}_Работа`)],
    [Markup.button.callback('Быт', `setcat_${taskId}_Быт`), Markup.button.callback('Отдых', `setcat_${taskId}_Отдых`)],
    [Markup.button.callback('Сон', `setcat_${taskId}_Сон`)]
  ]);
  ctx.editMessageText('Выбери новую категорию:', catKeyboard);
});

bot.action(/setcat_(.+)_(.+)/, async (ctx) => {
  const taskId = parseInt(ctx.match[1]);
  const newCat = ctx.match[2];
  await supabase.from('tasks').update({ category: newCat }).eq('id', taskId);
  ctx.answerCbQuery(`Категория: ${newCat}`);
  ctx.editMessageText(`✅ Задача обновлена. Новая категория: [${newCat}]`);
});

bot.action(/done_(.+)/, async (ctx) => {
  const taskId = parseInt(ctx.match[1]);
  await supabase.from('tasks').update({ done: true }).eq('id', taskId);
  ctx.answerCbQuery('Выполнено! ✅');
  ctx.editMessageText(`✅ Задача выполнена! Молодец!`);
});

// --- РАСПИСАНИЕ И ОЧИСТКА ---
bot.hears('⚙️ Мое расписание', async (ctx) => {
  const user = await getUser(ctx.from.id);
  if (!user || !user.schedule) return ctx.reply('Расписание не настроено.');
  const s = user.schedule;
  ctx.reply(`⚙️ Твое расписание:\n\n• Будни: ${s.weekday}\n• Выходные: ${s.weekend}\n• Сон: ${s.sleep}`);
});

bot.hears('🧹 Очистить всё', async (ctx) => {
  await supabase.from('tasks').delete().eq('user_id', ctx.from.id);
  ctx.reply('Все задачи удалены!');
});

// --- ДОБАВЛЕНИЕ ЗАДАЧИ (ШАГ 2: ДЕДЛАЙН) ---
bot.action(/dl_(.+)/, async (ctx) => {
  const deadlineType = ctx.match[1];
  const userId = ctx.from.id;
  const user = await getUser(userId);

  if (!user || !user.pending_task) {
    return ctx.answerCbQuery('Ошибка: текст задачи потерялся. Напиши заново.');
  }

  const now = new Date();
  let deadlineTimestamp = null;
  let remindTimestamp = null;
  let deadlineText = '';

  if (deadlineType === 'today') {
    deadlineTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59).getTime();
    remindTimestamp = now.getTime() + (3 * 60 * 60 * 1000);
    deadlineText = 'Сегодня';
  } 
  else if (deadlineType === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    deadlineTimestamp = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59).getTime();
    remindTimestamp = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 0).getTime();
    deadlineText = 'Завтра';
  } 
  else if (deadlineType === '3days') {
    const in3Days = new Date(now);
    in3Days.setDate(in3Days.getDate() + 3);
    deadlineTimestamp = new Date(in3Days.getFullYear(), in3Days.getMonth(), in3Days.getDate(), 23, 59).getTime();
    remindTimestamp = new Date(in3Days.getFullYear(), in3Days.getMonth(), in3Days.getDate(), 10, 0).getTime();
    deadlineText = 'Через 3 дня';
  } 
  else if (deadlineType === 'month_end') {
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);
    deadlineTimestamp = endOfMonth.getTime();
    endOfMonth.setHours(10, 0, 0, 0);
    remindTimestamp = endOfMonth.getTime();
    deadlineText = 'До конца месяца';
  } 
  else {
    deadlineText = 'Без дедлайна';
  }

  const newTask = {
    id: Date.now(),
    user_id: userId,
    text: user.pending_task.text,
    category: user.pending_task.category,
    done: false,
    deadline: deadlineTimestamp,
    remind_time: remindTimestamp
  };
  
  await supabase.from('tasks').insert([newTask]);
  await updateUser(userId, { pending_task: null });

  ctx.answerCbQuery(`Дедлайн: ${deadlineText}`);
  ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
  ctx.reply(`✅ Задача сохранена: "${newTask.text}"\n📁 Категория: [${newTask.category}]\n📅 Дедлайн: ${deadlineText}`, mainKeyboard);
});

// --- ФОНОВЫЕ НАПОМИНАНИЯ ---
setInterval(async () => {
  const now = Date.now();
  try {
    const { data: tasksToRemind } = await supabase
      .from('tasks')
      .select('*')
      .lte('remind_time', now)
      .eq('done', false)
      .not('remind_time', 'is', null);

    if (tasksToRemind && tasksToRemind.length > 0) {
      for (const task of tasksToRemind) {
        let msg = `🔔 <b>НАПОМИНАНИЕ:</b> "${task.text}"\n`;
        if (task.deadline) msg += `Дедлайн: ${new Date(task.deadline).toLocaleDateString()}!`;
        
        bot.telegram.sendMessage(task.user_id, msg, { parse_mode: 'HTML' }).catch(e => console.log(e));
        await supabase.from('tasks').update({ remind_time: null }).eq('id', task.id);
      }
    }
  } catch (e) {
    console.error("Ошибка в напоминаниях:", e);
  }
}, 30000); 

bot.launch();
console.log('🤖 Бот Ритм с базой данных Supabase запущен!');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));