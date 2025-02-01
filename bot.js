const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
require('dotenv').config();

// Вставьте сюда токен вашего бота, полученный от BotFather.321123
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const dbPath = process.env.DB_PATH;
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');


const userVersion = db.pragma('user_version', { simple: true });
if (userVersion < 2) {
  // Добавить миграции (пример для новых столбцов)
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

// Создание таблицы users
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
    subscription_plan TEXT DEFAULT 'free', -- Добавляем план подписки
    consent_given INTEGER DEFAULT 0, -- Добавляем согласие пользователя
    is_exempt INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    morning_time TEXT DEFAULT '08:00',
    evening_time TEXT DEFAULT '20:00'
  )
`).run();

// Создание таблицы goals
db.prepare(`
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    goal_type TEXT, -- 'long-term' или 'short-term'
    description TEXT,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'failed'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )
`).run();

// Создание таблицы daily_logs
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

// Создание таблицы notifications
db.prepare(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message_type TEXT, -- 'morning' или 'evening'
    message_content TEXT,
    sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )
`).run();

// Создание таблицы settings
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

// Создание индексов

// Индекс для поиска пользователей по chat_id
db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_chat_id ON users(chat_id)').run();

// Индексы для быстрого доступа к утреннему и вечернему времени
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_morning_time ON users(morning_time)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_evening_time ON users(evening_time)').run();

// Индекс для быстрого поиска пользователей по подписке
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_subscription_plan ON users(subscription_plan)').run();

// Индекс для поиска пользователей по согласию
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_consent_given ON users(consent_given)').run();

// Для других таблиц, если они уже существуют
db.prepare('CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_logs_user_id ON daily_logs(user_id)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)').run();
db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_settings_user_key 
  ON settings(user_id, key)
`).run();



// Логика бота
bot.onText(/\/test/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Бот работает!');
});

// Добавьте обработку для работы с таблицей settings
bot.onText(/\/set_setting (\w+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const key = match[1];
  const value = match[2];

  // Получение пользователя
  const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
  if (!user) {
    bot.sendMessage(chatId, 'Вы не зарегистрированы. Нажмите /start.');
    return;
  }

  // Установка настройки
  db.prepare(`
    INSERT INTO settings (user_id, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(user.id, key, value);

  bot.sendMessage(chatId, `Настройка "${key}" обновлена на "${value}".`);
});

bot.onText(/\/get_setting (\w+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const key = match[1];

  // Получение пользователя
  const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
  if (!user) {
    bot.sendMessage(chatId, 'Вы не зарегистрированы. Нажмите /start.');
    return;
  }

  // Получение настройки
  const setting = db.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(user.id, key);
  if (setting) {
    bot.sendMessage(chatId, `Значение настройки "${key}": "${setting.value}".`);
  } else {
    bot.sendMessage(chatId, `Настройка "${key}" не найдена.`);
  }
});

function isValidTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false; // Сначала базовая проверка формата
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
const userStates = {}; // Хранение состояний пользователей

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  // Если language_code отсутствует – задаём язык по умолчанию (en)
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
        if (/^\d{2}:\d{2}$/.test(text)) {
          try {
            // Логируем сам ввод
            logger.info(`[ask_evening_time] User ${chatId} sets evening_time = "${text}"`);
      
            // Сохраняем время в БД
            db.prepare('UPDATE users SET evening_time = ? WHERE chat_id = ?').run(text, chatId);
          } catch (e) {
            logger.error('[ask_evening_time] SQL error on UPDATE evening_time:', e.message);
            bot.sendMessage(chatId, 'Произошла ошибка при сохранении вечернего времени, попробуйте ещё раз позже.');
            return; // Прекращаем дальнейшее выполнение
          }
      
          // Убираем состояние (завершаем цепочку опроса)
          delete userStates[chatId];
      
          let user;
          try {
            // Читаем обновлённые данные пользователя
            user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
          } catch (e) {
            logger.error('[ask_evening_time] SQL error on SELECT user:', e.message);
            bot.sendMessage(chatId, 'Произошла ошибка при чтении данных пользователя, попробуйте ещё раз позже.');
            return;
          }
      
          // Если по каким-то причинам запись в БД не найдена
          if (!user) {
            bot.sendMessage(chatId, 'Не удалось найти вашу запись в системе. Попробуйте /start или /reset.');
            return;
          }
      
          // Проверяем, что у пользователя действительно есть дата рождения
          if (!user.birthdate) {
            bot.sendMessage(chatId, 'Данные о дате рождения не были сохранены. Попробуйте /reset и ввести заново.');
            return;
          }
      
          // Попытаемся преобразовать birthdate в валидную дату
          const birthdateParts = user.birthdate.split('.');
          if (birthdateParts.length !== 3) {
            bot.sendMessage(chatId, 'Формат даты рождения некорректный. Попробуйте /reset и ввести заново.');
            return;
          }
      
          // Форматируем под YYYY-MM-DD
          const birthdate = new Date(birthdateParts.reverse().join('-'));
          const targetAge = user.target_age;
      
          // Проверяем, что target_age - число
          if (!targetAge || isNaN(targetAge)) {
            bot.sendMessage(chatId, 'Целевой возраст не найден или некорректен. Попробуйте /reset.');
            return;
          }
      
          // Считаем, сколько осталось лет
          const today = new Date();
          let yearsPassed = today.getFullYear() - birthdate.getFullYear();
          const monthDiff = today.getMonth() - birthdate.getMonth();
      
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
            yearsPassed--;
          }
      
          const yearsLeft = targetAge - yearsPassed;
      
          // Отправляем итоговое сообщение
          bot.sendMessage(
            chatId,
            `Спасибо! Ты указал, что хотел бы прожить ${targetAge} лет. Осталось примерно ${yearsLeft} лет.`
          );
      
        } else {
          // Формат времени не подходит
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

        db.prepare('UPDATE users SET morning_time = ? WHERE chat_id = ?')
          .run(time, chatId);
          
        bot.sendMessage(chatId, messages[userLanguage].successSetMorning);
      } catch (e) {
        logger.error('Ошибка установки утреннего времени:', e);
        bot.sendMessage(chatId, messages[userLanguage].error);
      }
    });
  } catch (e) {
    logger.error('Ошибка в /set_morning:', e);
    bot.sendMessage(chatId, messages.en.error); // Fallback на английский
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

        db.prepare('UPDATE users SET evening_time = ? WHERE chat_id = ?')
          .run(time, chatId);
          
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
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM

  // Утренние уведомления
  const morningUsers = db.prepare('SELECT * FROM users WHERE morning_time = ?').all(currentTime);
  morningUsers.forEach(user => {
    // Добавим лог:
    console.log('[DEBUG] morningUsers item:', user);

    if (!user.birthdate || !user.target_age) {
      console.log('[DEBUG] Skip user because birthdate or target_age is empty:', user.chat_id);
      return;
    }
    
    // Если есть birthdate — вызываем calculateTimeLeft
    bot.sendMessage(
      user.chat_id,
      `Доброе утро, ${user.name || 'друг'}! Осталось ${calculateTimeLeft(user)} лет до цели.`
    );
  });

  // Вечерние уведомления
  const eveningUsers = db.prepare('SELECT * FROM users WHERE evening_time = ?').all(currentTime);
  eveningUsers.forEach(user => {
    console.log('[DEBUG] eveningUsers item:', user);

    if (!user.birthdate || !user.target_age) {
      console.log('[DEBUG] Skip user because birthdate or target_age is empty:', user.chat_id);
      return;
    }

    bot.sendMessage(
      user.chat_id,
      `Добрый вечер, ${user.name}! Сегодня ты стал на один день ближе к своей цели. Спокойной ночи!`
    );
  });
});


// Функция для расчета оставшегося времени
const calculateTimeLeft = (user) => {

  console.log('[DEBUG] calculateTimeLeft called with user:', user);

  if (!user.birthdate || !user.target_age) {
    return '–'; // или какое-то другое текстовое значение, если дата не заполнена
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
};

