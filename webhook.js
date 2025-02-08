// Загружаем переменные окружения
require('dotenv').config();

const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const Database = require('better-sqlite3');
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

// Логгер 123
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

// Настройки
const app = express();
const port = process.env.PORT || 3000;
const url = process.env.URL || 'https://lifetrackerbot.ru';
const dbPath = process.env.DB_PATH || 'data.db';
const SECRET = process.env.SECRET_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key';

if (!SECRET || !BOT_TOKEN || !url) {
  console.error('❌ ОШИБКА: Не все переменные окружения установлены.');
  process.exit(1);
}

// Инициализация базы данных
const db = new Database(dbPath, { timeout: 5000 });
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Применяем миграции для таблицы users (пример)
const userVersion = db.pragma('user_version', { simple: true });
if (userVersion < 2) {
  const hasColumn = db.prepare(`
    SELECT COUNT(*) AS column_exists 
    FROM pragma_table_info('users') 
    WHERE name = 'subscription_status'
  `).get().column_exists;
  if (!hasColumn) {
    db.prepare(`
      ALTER TABLE users 
      ADD COLUMN subscription_status TEXT DEFAULT 'free'
    `).run();
  }
  db.pragma('user_version = 2');
}

// Создание таблиц и индексов
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
    subscription_plan TEXT DEFAULT 'free',
    consent_given INTEGER DEFAULT 0,
    is_exempt INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    morning_time TEXT DEFAULT '08:00',
    evening_time TEXT DEFAULT '20:00'
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    goal_type TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT DEFAULT CURRENT_DATE,
    achievements TEXT,
    obstacles TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message_type TEXT,
    message_content TEXT,
    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(user_id, key), 
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )
`).run();

// Создаем индексы
db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_chat_id ON users(chat_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_morning_time ON users(morning_time)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_evening_time ON users(evening_time)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_subscription_plan ON users(subscription_plan)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_consent_given ON users(consent_given)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_logs_user_id ON daily_logs(user_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)').run();
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_settings_user_key 
  ON settings(user_id, key)
`).run();
//  const bot = new TelegramBot(BOT_TOKEN, {webHook: {port: 3000}});
const bot = new TelegramBot(BOT_TOKEN);
// bot.setWebHook(`${url}/bot${BOT_TOKEN}`, { secret_token: SECRET });

bot.setWebHook(`${url}/bot${BOT_TOKEN}`, { secret_token: SECRET })
  .then((resp) => {
    console.log('✅ Вебхук для Telegram установлен успешно', resp.data);
  })
  .catch((err) => {
    console.error('❌ Ошибка при установке вебхука для Telegram:', err);
  });


// Подключение middleware
app.use('/github-webhook', express.raw({ type: '*/*' })); // для GitHub
app.use(express.json());
app.use(cookieParser());
app.use(express.static('pages'));

// -------------------------
// Обработка GitHub вебхука
// -------------------------
 function verifyGitHubSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.error('❌ Подпись отсутствует.');
    return false;
  }
  try {
    const hmac = crypto.createHmac('sha256', Buffer.from(SECRET, 'utf8'));
   hmac.update(req.body);
    const digest = `sha256=${hmac.digest('hex')}`;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
 } catch (error) {
  console.error('❌ Ошибка при проверке подписи:', error);
   return false;
  }
}

app.post('/github-webhook', async (req, res) => {
  try {
    if (!verifyGitHubSignature(req)) {
      console.error('❌ Неверная подпись GitHub');
      return res.status(403).send('Неверная подпись');
    }
    const parsedBody = JSON.parse(req.body.toString('utf8'));
   console.log('🔄 Получен вебхук от GitHub:', parsedBody);
    exec(
      'git fetch origin && git reset --hard origin/main && git clean -fd',
      { cwd: '/var/www/lifetrackerb_usr/data/www/lifetrackerbot.ru' },
      (err, stdout, stderr) => {
        if (err) {
          console.error(`❌ Ошибка при обновлении: ${stderr}`);
          return res.status(500).send('Ошибка при обновлении');
        }
        console.log(`✅ Обновление выполнено: ${stdout}`);
        res.status(200).send('Вебхук обработан, проект обновлён');
      }
    );
  } catch (error) {
    console.error('❌ Ошибка при обработке GitHub вебхука:', error);
    res.status(500).send('Внутренняя ошибка сервера.');
  }
});

// -------------------------
// Обработка Telegram вебхука
// -------------------------
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  try {
    // Логируем обновление (для отладки, можно убрать)
    console.log('Получено обновление от Telegram:', req.body);
    // Передаём обновление в библиотеку для обработки соответствующими обработчиками
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Ошибка при обработке обновления Telegram:', error);
    res.sendStatus(500);
  }
});


// Функция установки вебхука для Telegram
// async function setTelegramWebhook() {
//   try {
//     const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
//       url: `${url}/bot${BOT_TOKEN}`,
//       secret_token: SECRET,
//     });
//     if (response.data.ok) {
//       console.log('✅ Вебхук для Telegram установлен успешно');
//     } else {
//       console.error('❌ Ошибка при установке вебхука для Telegram:', response.data);
//     }
//   } catch (error) {
//     console.error('❌ Ошибка при установке вебхука для Telegram:', error);
//   }
// }
// setTelegramWebhook();

// -------------------------
// Серверная логика: API, авторизация и личный кабинет
// -------------------------
app.post('/request-login', async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return res.status(400).json({ success: false, error: 'Chat ID не предоставлен.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь с таким Chat ID не найден.' });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO login_codes (chat_id, code, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
    `).run(chatId, code, expiresAt);
    await bot.sendMessage(chatId, `🚀 *Ваш код для входа на сайт:* \`${code}\` (действителен 5 минут)`, { parse_mode: 'Markdown' });
    res.json({ success: true, message: 'Код отправлен в Telegram.' });
  } catch (error) {
    console.error('Ошибка при обработке запроса /request-login:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера.' });
  }
});

app.post('/verify-login', (req, res) => {
  try {
    const { chatId, code } = req.body;
    if (!chatId || !code) {
      return res.status(400).json({ success: false, error: '❌ Chat ID и код обязательны.' });
    }
    const record = db.prepare('SELECT * FROM login_codes WHERE chat_id = ?').get(chatId);
    if (!record || record.code !== code || new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: '❌ Неверный или просроченный код' });
    }
    db.prepare('DELETE FROM login_codes WHERE chat_id = ?').run(chatId);
    const token = jwt.sign({ chatId }, SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION || '7d' });
    res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'Strict' });
    res.json({ success: true, message: '✅ Авторизация успешна!', token });
  } catch (error) {
    console.error('❌ Ошибка при обработке запроса /verify-login:', error);
    res.status(500).json({ success: false, error: '❌ Внутренняя ошибка сервера.' });
  }
});

// Middleware для проверки JWT
const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(403).json({ success: false, error: '⚠ Необходима авторизация' });
  }
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: '❌ Неверный или просроченный токен' });
    }
    req.user = decoded;
    next();
  });
};

app.get('/dashboard', authenticateToken, (req, res) => {
  res.json({ message: `👋 Добро пожаловать! Ваш Chat ID: ${req.user.chatId}` });
});

app.get('/api/user', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(req.user.chatId);
    if (!user) {
      return res.status(404).json({ success: false, error: '❌ Пользователь не найден' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('❌ Ошибка при обработке запроса /api/user:', error);
    res.status(500).json({ success: false, error: '❌ Внутренняя ошибка сервера.' });
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: '✅ Вы вышли из системы' });
});

app.put('/api/user', authenticateToken, (req, res) => {
  const { name, birthdate, target_age, language, morning_time, evening_time } = req.body;
  const result = db.prepare(`
    UPDATE users
    SET name = ?, birthdate = ?, target_age = ?, language = ?, morning_time = ?, evening_time = ?
    WHERE chat_id = ?
  `).run(name, birthdate, target_age, language, morning_time, evening_time, req.user.chatId);
  if (result.changes > 0) {
    res.json({ success: true, message: 'Профиль обновлён' });
  } else {
    res.status(400).json({ success: false, error: 'Ошибка обновления профиля' });
  }
});

app.delete('/api/user', authenticateToken, (req, res) => {
  const chatId = req.user.chatId;
  const userId = db.prepare('SELECT id FROM users WHERE chat_id = ?').pluck().get(chatId);
  if (!userId) {
    return res.status(404).json({ success: false, error: 'Пользователь не найден' });
  }
  const deleteUser = db.transaction(() => {
    db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM daily_logs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  try {
    deleteUser();
    res.json({ success: true, message: 'Пользователь удалён' });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Ошибка при удалении пользователя' });
  }
});

// -------------------------
// Логика бота: команды и взаимодействие
// -------------------------

const userStates = {};

// Обработка команды /test
bot.onText(/\/test/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Бот работает!');
});

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userLanguage = (msg.from.language_code && msg.from.language_code.startsWith('ru')) ? 'ru' : 'en';
  const username = msg.from.username || 'unknown';

  let user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
  if (!user) {
    db.prepare(`
      INSERT INTO users (chat_id, username, language)
      VALUES (?, ?, ?)
    `).run(chatId, username, userLanguage);
    user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
    userStates[chatId] = { step: 'ask_name' };
    bot.sendMessage(chatId, 'Привет! Как тебя зовут?');
  } else {
    bot.sendMessage(chatId, 'С возвращением!');
  }
});

// Обработка входящих сообщений для регистрации
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!userStates[chatId]) return;
  const state = userStates[chatId];
  switch (state.step) {
    case 'ask_name':
      db.prepare('UPDATE users SET name = ? WHERE chat_id = ?').run(text, chatId);
      userStates[chatId].step = 'ask_birthdate';
      bot.sendMessage(chatId, 'Отлично! Теперь введи свою дату рождения в формате ДД.ММ.ГГГГ:');
      break;
    case 'ask_birthdate':
      if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
        db.prepare('UPDATE users SET birthdate = ? WHERE chat_id = ?').run(text, chatId);
        userStates[chatId].step = 'ask_target_age';
        bot.sendMessage(chatId, 'Сколько лет ты хотел бы прожить?');
      } else {
        bot.sendMessage(chatId, 'Неверный формат даты. Попробуй еще раз (ДД.ММ.ГГГГ):');
      }
      break;
    case 'ask_target_age':
      if (/^\d+$/.test(text)) {
        db.prepare('UPDATE users SET target_age = ? WHERE chat_id = ?').run(parseInt(text), chatId);
        userStates[chatId].step = 'ask_morning_time';
        bot.sendMessage(chatId, 'Отлично! Теперь укажи время для утреннего уведомления (например, 08:00):');
      } else {
        bot.sendMessage(chatId, 'Пожалуйста, введи число:');
      }
      break;
    case 'ask_morning_time':
      if (/^\d{2}:\d{2}$/.test(text)) {
        db.prepare('UPDATE users SET morning_time = ? WHERE chat_id = ?').run(text, chatId);
        userStates[chatId].step = 'ask_evening_time';
        bot.sendMessage(chatId, 'Теперь укажи время для вечернего уведомления (например, 20:00):');
      } else {
        bot.sendMessage(chatId, 'Неверный формат времени. Попробуй еще раз (например, 08:00):');
      }
      break;
    case 'ask_evening_time':
      if (/^\d{2}:\d{2}$/.test(text)) {
        try {
          logger.info(`[ask_evening_time] User ${chatId} sets evening_time = "${text}"`);
          db.prepare('UPDATE users SET evening_time = ? WHERE chat_id = ?').run(text, chatId);
        } catch (e) {
          logger.error('[ask_evening_time] SQL error on UPDATE evening_time:', e.message);
          bot.sendMessage(chatId, 'Произошла ошибка при сохранении вечернего времени, попробуйте ещё раз позже.');
          return;
        }
        delete userStates[chatId];
        let user;
        try {
          user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
        } catch (e) {
          logger.error('[ask_evening_time] SQL error on SELECT user:', e.message);
          bot.sendMessage(chatId, 'Произошла ошибка при чтении данных пользователя, попробуйте ещё раз позже.');
          return;
        }
        if (!user) {
          bot.sendMessage(chatId, 'Не удалось найти вашу запись в системе. Попробуйте /start или /reset.');
          return;
        }
        if (!user.birthdate) {
          bot.sendMessage(chatId, 'Данные о дате рождения не были сохранены. Попробуйте /reset и ввести заново.');
          return;
        }
        const birthdateParts = user.birthdate.split('.');
        if (birthdateParts.length !== 3) {
          bot.sendMessage(chatId, 'Формат даты рождения некорректный. Попробуйте /reset и ввести заново.');
          return;
        }
        const birthdate = new Date(birthdateParts.reverse().join('-'));
        const targetAge = user.target_age;
        if (!targetAge || isNaN(targetAge)) {
          bot.sendMessage(chatId, 'Целевой возраст не найден или некорректен. Попробуйте /reset.');
          return;
        }
        const today = new Date();
        let yearsPassed = today.getFullYear() - birthdate.getFullYear();
        const monthDiff = today.getMonth() - birthdate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
          yearsPassed--;
        }
        const yearsLeft = targetAge - yearsPassed;
        bot.sendMessage(
          chatId,
          `Спасибо! Ты указал, что хотел бы прожить ${targetAge} лет. Осталось примерно ${yearsLeft} лет.`
        );
      } else {
        bot.sendMessage(chatId, 'Неверный формат времени. Попробуй ещё раз (например, 20:00):');
      }
      break;
  }
});

// Обработка команды /set_morning
bot.onText(/\/set_morning/, (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
    if (!user) {
      bot.sendMessage(chatId, messages.ru.errorUserNotFound);
      return;
    }
    const userLanguage = user.language || 'en';
    bot.sendMessage(chatId, messages[userLanguage].setMorning);
    bot.once('message', (response) => {
      try {
        const time = response.text.trim();
        if (!isValidTime(time)) {
          bot.sendMessage(chatId, messages[userLanguage].invalidTime);
          return;
        }
        db.prepare('UPDATE users SET morning_time = ? WHERE chat_id = ?').run(time, chatId);
        bot.sendMessage(chatId, messages[userLanguage].successSetMorning);
      } catch (e) {
        logger.error('Ошибка установки утреннего времени:', e);
        bot.sendMessage(chatId, messages[userLanguage].error);
      }
    });
  } catch (e) {
    logger.error('Ошибка в /set_morning:', e);
    bot.sendMessage(chatId, messages.en.error);
  }
});

// Обработка команды /set_evening
bot.onText(/\/set_evening/, (msg) => {
  const chatId = msg.chat.id;
  try {
    const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
    if (!user) {
      bot.sendMessage(chatId, messages.ru.errorUserNotFound);
      return;
    }
    const userLanguage = user.language || 'en';
    bot.sendMessage(chatId, messages[userLanguage].setEvening);
    bot.once('message', (response) => {
      try {
        const time = response.text.trim();
        if (!isValidTime(time)) {
          bot.sendMessage(chatId, messages[userLanguage].invalidTime);
          return;
        }
        db.prepare('UPDATE users SET evening_time = ? WHERE chat_id = ?').run(time, chatId);
        bot.sendMessage(chatId, messages[userLanguage].successSetEvening);
      } catch (e) {
        logger.error('Ошибка установки вечернего времени:', e);
        bot.sendMessage(chatId, messages[userLanguage].error);
      }
    });
  } catch (e) {
    logger.error('Ошибка в /set_evening:', e);
    bot.sendMessage(chatId, messages.en.error);
  }
});

// Обработка команды /reset
bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  const deleteUser = db.transaction(() => {
    const userId = db.prepare('SELECT id FROM users WHERE chat_id = ?')
      .pluck()
      .get(chatId);
    if (userId) {
      db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM daily_logs WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    }
  });
  try {
    deleteUser();
    delete userStates[chatId];
    const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
    const lang = user?.language || 'en';
    bot.sendMessage(chatId, messages[lang].resetSuccess);
  } catch (e) {
    logger.error('Ошибка при сбросе:', e);
    bot.sendMessage(chatId, messages.en.error);
  }
});

// Обработка callback_query (нажатия кнопок)
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userLanguage = query.from.language_code.startsWith('ru') ? 'ru' : 'en';
  if (query.data === 'start_bot') {
    bot.sendMessage(chatId, messages[userLanguage]?.success || 'Bot successfully started!');
  }
});

// Вспомогательная функция для проверки формата времени
function isValidTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false;
  const [hours, minutes] = time.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

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
    invalidTime: '⏳ Некорректный формат времени. Используйте ЧЧ:ММ (например, 08:00)',
    error: '⚠️ Произошла ошибка, попробуйте позже',
    errorUserNotFound: '❌ Пользователь не найден. Нажмите /start',
    resetSuccess: '✅ Все данные успешно сброшены!'
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
    invalidTime: '⏳ Invalid time format. Use HH:MM (e.g., 08:00)',
    error: '⚠️ An error occurred, please try again',
    errorUserNotFound: '❌ User not found. Press /start',
    resetSuccess: '✅ All data has been successfully reset!'
  }
};

// Функция для расчета оставшегося времени
function calculateTimeLeft(user) {
  console.log('[DEBUG] calculateTimeLeft called with user:', user);
  if (!user.birthdate || !user.target_age) {
    return '–';
  }
  const birthdate = new Date(user.birthdate.split('.').reverse().join('-'));
  const targetAge = user.target_age;
  const today = new Date();
  let yearsPassed = today.getFullYear() - birthdate.getFullYear();
  const monthDiff = today.getMonth() - birthdate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
    yearsPassed--;
  }
  const yearsLeft = targetAge - yearsPassed;
  return yearsLeft > 0 ? `${yearsLeft} лет` : 'Цель достигнута!';
}

// Запускаем сервер
app.listen(port, () => console.log(`🚀 Сервер запущен на порту ${port}`));
