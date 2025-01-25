const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
require('dotenv').config();

// Вставьте сюда токен вашего бота, полученный от BotFather.
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Подключение к базе данных
const db = new Database('data.db');

// Обновляем структуру таблицы users (если поля не существуют)
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT UNIQUE,
    username TEXT,
    name TEXT,
    birthdate TEXT,
    target_age INTEGER,
    language TEXT DEFAULT 'en',
    subscription_status TEXT DEFAULT 'free',
    is_exempt INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    morning_time TEXT DEFAULT '08:00',
    evening_time TEXT DEFAULT '20:00'
  )
`).run();

// Сообщения на разных языках
const messages = {
  ru: {
    text: `
Привет, друг! Это life_tracker_bot 🙌

Я помогу тебе не забывать о важности каждого дня. Вместе мы будем:
- Отслеживать твой прогресс 📈 — сколько задач выполнено сегодня или за неделю.
- Напоминать о важных датах и событиях 🎯.
- Помогать двигаться к твоей главной цели каждый день 🕒.

Ты увидишь, как каждый маленький шаг приближает к большой мечте!
    `,
    button: 'Запустить',
    setMorning: 'Введите время утреннего сообщения (например, 08:00):',
    setEvening: 'Введите время вечернего сообщения (например, 20:00):',
    successSetMorning: 'Время утреннего сообщения успешно обновлено!',
    successSetEvening: 'Время вечернего сообщения успешно обновлено!',
  },
  en: {
    text: `
Hi! This is life_tracker_bot 🙌

I’ll help you remember the importance of every day. Together, we’ll:
- Track your progress 📈 — how much you’ve accomplished today or this week.
- Remind you of important dates and milestones 🎯.
- Help you move closer to your main goal every single day 🕒.

You’ll see how every small step brings you closer to your big dream!
    `,
    button: 'Start',
    setMorning: 'Enter the time for the morning message (e.g., 08:00):',
    setEvening: 'Enter the time for the evening message (e.g., 20:00):',
    successSetMorning: 'Morning message time successfully updated!',
    successSetEvening: 'Evening message time successfully updated!',
  }
};
const userStates = {}; // Хранение состояний пользователей

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || 'unknown';
  const userLanguage = msg.from.language_code.startsWith('ru') ? 'ru' : 'en';

  // Проверяем, существует ли пользователь
  let user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);

  if (!user) {
    // Добавляем нового пользователя
    db.prepare(`
      INSERT INTO users (chat_id, username, language)
      VALUES (?, ?, ?)
    `).run(chatId, username, userLanguage);
    user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);

    // Начинаем знакомство
    userStates[chatId] = { step: 'ask_name' };
    bot.sendMessage(chatId, 'Привет! Как тебя зовут?');
  } else {
    // Пользователь уже зарегистрирован
    bot.sendMessage(chatId, 'С возвращением!');
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId]) return; // Пропускаем, если пользователь не в процессе знакомства

  const state = userStates[chatId];

  switch (state.step) {
    case 'ask_name':
      // Сохраняем имя и переходим к следующему шагу
      db.prepare('UPDATE users SET name = ? WHERE chat_id = ?').run(text, chatId);
      userStates[chatId].step = 'ask_birthdate';
      bot.sendMessage(chatId, 'Отлично! Теперь введи свою дату рождения в формате ДД.ММ.ГГГГ:');
      break;

    case 'ask_birthdate':
      // Проверяем формат даты
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
        db.prepare('UPDATE users SET birthdate = ? WHERE chat_id = ?').run(text, chatId);
        userStates[chatId].step = 'ask_target_age';
        bot.sendMessage(chatId, 'Сколько лет ты хотел бы прожить?');
      } else {
        bot.sendMessage(chatId, 'Неверный формат даты. Попробуй еще раз (ДД.ММ.ГГГГ):');
      }
      break;

    case 'ask_target_age':
      // Проверяем, что введено число
      if (/^\d+$/.test(text)) {
        db.prepare('UPDATE users SET target_age = ? WHERE chat_id = ?').run(parseInt(text), chatId);
        userStates[chatId].step = 'ask_morning_time';
        bot.sendMessage(chatId, 'Отлично! Теперь укажи время для утреннего уведомления (например, 08:00):');
      } else {
        bot.sendMessage(chatId, 'Пожалуйста, введи число:');
      }
      break;

    case 'ask_morning_time':
      // Проверяем формат времени
      if (/^\d{2}:\d{2}$/.test(text)) {
        db.prepare('UPDATE users SET morning_time = ? WHERE chat_id = ?').run(text, chatId);
        userStates[chatId].step = 'ask_evening_time';
        bot.sendMessage(chatId, 'Теперь укажи время для вечернего уведомления (например, 20:00):');
      } else {
        bot.sendMessage(chatId, 'Неверный формат времени. Попробуй еще раз (например, 08:00):');
      }
      break;

    case 'ask_evening_time':
      // Проверяем формат времени
      if (/^\d{2}:\d{2}$/.test(text)) {
        db.prepare('UPDATE users SET evening_time = ? WHERE chat_id = ?').run(text, chatId);
        delete userStates[chatId]; // Завершаем процесс знакомства

        // Рассчитываем оставшееся время
        const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
        const birthdate = new Date(user.birthdate.split('.').reverse().join('-'));
        const targetAge = user.target_age;
        const today = new Date();
        const yearsLeft = targetAge - (today.getFullYear() - birthdate.getFullYear());

        bot.sendMessage(chatId, `Спасибо! Ты указал, что хотел бы прожить ${targetAge} лет. Осталось примерно ${yearsLeft} лет.`);
      } else {
        bot.sendMessage(chatId, 'Неверный формат времени. Попробуй еще раз (например, 20:00):');
      }
      break;
  }
});

bot.onText(/\/test/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Бот работает!');
});

// Обработка команды /set_morning
bot.onText(/\/set_morning/, (msg) => {
  const chatId = msg.chat.id;
  const userLanguage = msg.from.language_code.startsWith('ru') ? 'ru' : 'en';

  bot.sendMessage(chatId, messages[userLanguage].setMorning);
  bot.once('message', (response) => {
    const time = response.text.trim();
    if (/^\d{2}:\d{2}$/.test(time)) {
      db.prepare('UPDATE users SET morning_time = ? WHERE chat_id = ?').run(time, chatId);
      bot.sendMessage(chatId, messages[userLanguage].successSetMorning);
    } else {
      bot.sendMessage(chatId, 'Invalid time format. Please try again.');
    }
  });
});

// Обработка команды /set_evening
bot.onText(/\/set_evening/, (msg) => {
  const chatId = msg.chat.id;
  const userLanguage = msg.from.language_code.startsWith('ru') ? 'ru' : 'en';

  bot.sendMessage(chatId, messages[userLanguage].setEvening);
  bot.once('message', (response) => {
    const time = response.text.trim();
    if (/^\d{2}:\d{2}$/.test(time)) {
      db.prepare('UPDATE users SET evening_time = ? WHERE chat_id = ?').run(time, chatId);
      bot.sendMessage(chatId, messages[userLanguage].successSetEvening);
    } else {
      bot.sendMessage(chatId, 'Invalid time format. Please try again.');
    }
  });
});

// Обработка команды /reset
// Обработка команды /reset
bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;

  // Удаляем пользователя из базы данных
  db.prepare('DELETE FROM users WHERE chat_id = ?').run(chatId);

  // Очищаем состояние пользователя
  delete userStates[chatId];

  // Отправляем сообщение о сбросе
  bot.sendMessage(chatId, 'Ваши данные сброшены. Нажмите /start, чтобы начать заново.');
});

// Обработка нажатия кнопки
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userLanguage = query.from.language_code.startsWith('ru') ? 'ru' : 'en';

  if (query.data === 'start_bot') {
    bot.sendMessage(
      chatId,
      messages[userLanguage]?.success || 'Bot successfully started!' 
    );
  }
});


const schedule = require('node-schedule');

// Запускаем задачу каждую минуту
schedule.scheduleJob('* * * * *', () => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // Формат HH:MM

  // Утренние уведомления
  const morningUsers = db.prepare('SELECT * FROM users WHERE morning_time = ?').all(currentTime);
  morningUsers.forEach(user => {
    bot.sendMessage(user.chat_id, `Доброе утро, ${user.name}! Напоминаю, что у тебя осталось ${calculateTimeLeft(user)} до цели. Удачного дня! 🌞`);
  });

  // Вечерние уведомления
  const eveningUsers = db.prepare('SELECT * FROM users WHERE evening_time = ?').all(currentTime);
  eveningUsers.forEach(user => {
    bot.sendMessage(user.chat_id, `Добрый вечер, ${user.name}! Сегодня ты стал на один день ближе к своей цели. Спокойной ночи! 🌙`);
  });
});

// Функция для расчета оставшегося времени
const calculateTimeLeft = (user) => {
  const birthdate = new Date(user.birthdate.split('.').reverse().join('-'));
  const targetAge = user.target_age;
  const today = new Date();
  const yearsLeft = targetAge - (today.getFullYear() - birthdate.getFullYear());
  return `${yearsLeft} лет`;
};

