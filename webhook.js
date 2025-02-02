// Загрузка переменных окружения из файла .env
require('dotenv').config();

const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const Database = require('better-sqlite3');

const app = express();
const port = process.env.PORT || 3000;
const url = process.env.URL || 'https://lifetrackerbot.ru/';
const dbPath = process.env.DB_PATH || 'data.db';
const SECRET = process.env.SECRET_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;
const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key';

// Проверка обязательных переменных окружения
if (!SECRET || !BOT_TOKEN || !url) {
  console.error('❌ ОШИБКА: Не все переменные окружения установлены.');
  process.exit(1);
}

// Инициализация базы данных 
const db = new Database(dbPath);

// Инициализация Telegram-бота и установка вебхука для него
const bot = new TelegramBot(BOT_TOKEN);
bot.setWebHook(`${url}/bot${BOT_TOKEN}`);

// Подключение middleware
// Для маршрута GitHub вебхука используем raw body
app.use('/github-webhook', express.raw({ type: '*/*' }));
// Для остальных маршрутов — стандартный парсинг JSON
app.use(express.json());
app.use(cookieParser());
app.use(express.static('pages'));

// -------------------------
//  Обработка GitHub вебхука
// -------------------------

// Функция проверки подписи GitHub
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

// Обработчик вебхука от GitHub
app.post('/github-webhook', async (req, res) => {
  try {
    if (!verifyGitHubSignature(req)) {
      console.error('❌ Неверная подпись GitHub');
      return res.status(403).send('Неверная подпись');
    }
    // Парсим JSON вручную (req.body — Buffer)
    const parsedBody = JSON.parse(req.body.toString('utf8'));
    console.log('🔄 Получен вебхук от GitHub:', parsedBody);

    // Выполняем git pull для обновления кода
    exec('git pull origin main', { cwd: '/var/www/lifetrackerb_usr/data/www/lifetrackerbot.ru' }, (err, stdout, stderr) => {
      if (err) {
        console.error(`❌ Ошибка при обновлении: ${stderr}`);
        return res.status(500).send('Ошибка при обновлении');
      }
      console.log(`✅ Обновление выполнено: ${stdout}`);
      res.status(200).send('Вебхук обработан, проект обновлён');
    });
  } catch (error) {
    console.error('❌ Ошибка при обработке GitHub вебхука:', error);
    res.status(500).send('Внутренняя ошибка сервера.');
  }
});

// -------------------------
//  Обработка Telegram вебхука
// -------------------------

app.post(`/bot${BOT_TOKEN}`, async (req, res) => {
  try {
    const message = req.body.message;
    if (message && message.text) {
      const chatId = message.chat.id;
      const responseText = `Вы написали: ${message.text}`;
      // Отправляем ответное сообщение через Telegram API
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: responseText,
      });
      console.log(`📨 Сообщение отправлено пользователю ${chatId}: ${responseText}`);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Ошибка при обработке Telegram вебхука:', error);
    res.sendStatus(500);
  }
});

// Функция установки вебхука для Telegram
async function setTelegramWebhook() {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      url: `${url}/bot${BOT_TOKEN}`,
      secret_token: SECRET,
    });
    if (response.data.ok) {
      console.log('✅ Вебхук для Telegram установлен успешно');
    } else {
      console.error('❌ Ошибка при установке вебхука для Telegram:', response.data);
    }
  } catch (error) {
    console.error('❌ Ошибка при установке вебхука для Telegram:', error);
  }
}
setTelegramWebhook();

// -------------------------
//  Серверная логика: API, авторизация и личный кабинет
// -------------------------

// Создание таблицы login_codes (для временных кодов авторизации)
db.prepare(`
    CREATE TABLE IF NOT EXISTS login_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE,
        code TEXT,
        expires_at TEXT
    )
`).run();

// 1. Генерация кода и отправка через Telegram
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

// 2. Проверка кода и генерация JWT-токена
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

// 3. Защищённый маршрут (личный кабинет)
app.get('/dashboard', authenticateToken, (req, res) => {
  res.json({ message: `👋 Добро пожаловать! Ваш Chat ID: ${req.user.chatId}` });
});

// 4. Получение данных пользователя
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

// 5. Выход (очистка токена)
app.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: '✅ Вы вышли из системы' });
});

// 6. Обновление профиля пользователя (PUT)
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

// 7. Удаление аккаунта пользователя (DELETE)
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

// Запускаем сервер (один раз!)
app.listen(port, () => console.log(`🚀 Сервер запущен на порту ${port}`));
