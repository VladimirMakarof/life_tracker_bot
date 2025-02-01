const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const port = 3000;
const dbPath = process.env.DB_PATH || 'data.db'; 
const db = new Database(dbPath);
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

app.use(express.json());
app.use(cookieParser());

// Статические файлы (например, для dashboard.html)
app.use(express.static('pages'));

const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key';

// ✅ Создание таблицы login_codes (для временных кодов авторизации)
db.prepare(`
    CREATE TABLE IF NOT EXISTS login_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE,
        code TEXT,
        expires_at TEXT
    )
`).run();

// ✅ 1. Генерация кода и отправка через Telegram
app.post('/request-login', (req, res) => {
    const { chatId } = req.body;

    // Проверяем, существует ли пользователь
    const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
    if (!user) {
        return res.status(400).json({ success: false, error: 'Chat ID не найден.' });
    }

    // Генерируем случайный код
    const code = Math.floor(100000 + Math.random() * 900000);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // Код действует 5 минут

    // Сохраняем код в БД
    db.prepare(`
        INSERT INTO login_codes (chat_id, code, expires_at) 
        VALUES (?, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
    `).run(chatId, code, expiresAt);

    // Отправляем код пользователю в Telegram
    bot.sendMessage(chatId, `🚀 *Ваш код для входа на сайт:* \`${code}\` (действителен 5 минут)`, { parse_mode: 'Markdown' });

    res.json({ success: true, message: 'Код отправлен в Telegram.' });
});

// ✅ 2. Проверка кода и генерация JWT-токена
app.post('/verify-login', (req, res) => {
    const { chatId, code } = req.body;

    // Получаем код из БД
    const record = db.prepare('SELECT * FROM login_codes WHERE chat_id = ?').get(chatId);
    
    if (!record || record.code !== code || new Date(record.expires_at) < new Date()) {
        return res.status(400).json({ success: false, error: '❌ Неверный или просроченный код' });
    }

    // Удаляем использованный код
    db.prepare('DELETE FROM login_codes WHERE chat_id = ?').run(chatId);

    // Создаем JWT-токен (действует 7 дней)
    const token = jwt.sign({ chatId }, SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION || '7d' });

    // Отправляем токен в cookie
    res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'Strict' });

    res.json({ success: true, message: '✅ Авторизация успешна!', token });
});

// ✅ 3. Middleware для проверки JWT
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

// ✅ 4. Защищённый маршрут (личный кабинет)
app.get('/dashboard', authenticateToken, (req, res) => {
    res.json({ message: `👋 Добро пожаловать! Ваш Chat ID: ${req.user.chatId}` });
});

// ✅ 5. Получение данных пользователя
app.get('/api/user', authenticateToken, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(req.user.chatId);
    
    if (!user) {
        return res.status(404).json({ success: false, error: '❌ Пользователь не найден' });
    }

    res.json({ success: true, user });
});

// ✅ 6. Выход (очистка токена)
app.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: '✅ Вы вышли из системы' });
});

// Запускаем сервер
app.listen(port, () => console.log(`🚀 Сервер запущен на порту ${port}`));
