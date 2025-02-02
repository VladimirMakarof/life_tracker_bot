const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const url = process.env.URL || 'https://lifetrackerbot.ru/';
const dbPath = process.env.DB_PATH || 'data.db'; 
const db = new Database(dbPath);
// const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });  
const bot = new TelegramBot(process.env.BOT_TOKEN);

bot.setWebHook(`${url}/bot${process.env.BOT_TOKEN}`);

// const express = require('express');


app.use(express.json());
app.use(cookieParser());
app.use(express.static('pages'));

app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// app.listen(port, () => {
//   console.log(`Express server is listening on ${port}`);
// });

// app.use(express.json());




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
app.post('/request-login', async (req, res) => {
    try {
        const { chatId } = req.body;

        // Проверяем, был ли передан chatId
        if (!chatId) {
            return res.status(400).json({ success: false, error: 'Chat ID не предоставлен.' });
        }

        // Проверяем, существует ли пользователь
        const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Пользователь с таким Chat ID не найден.' });
        }

        // Генерируем случайный 6-значный код
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // Код действует 5 минут

        // Сохраняем код в базе данных
        db.prepare(`
            INSERT INTO login_codes (chat_id, code, expires_at) 
            VALUES (?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
        `).run(chatId, code, expiresAt);

        // Отправляем код пользователю в Telegram
        await bot.sendMessage(chatId, `🚀 *Ваш код для входа на сайт:* \`${code}\` (действителен 5 минут)`, { parse_mode: 'Markdown' });

        res.json({ success: true, message: 'Код отправлен в Telegram.' });
    } catch (error) {
        console.error('Ошибка при обработке запроса /request-login:', error);
        res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера.' });
    }
});


// ✅ 2. Проверка кода и генерация JWT-токена
app.post('/verify-login', (req, res) => {
    try {
        const { chatId, code } = req.body;

        // Проверяем входные данные
        if (!chatId || !code) {
            return res.status(400).json({ success: false, error: '❌ Chat ID и код обязательны.' });
        }

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
    } catch (error) {
        console.error('❌ Ошибка при обработке запроса /verify-login:', error);
        res.status(500).json({ success: false, error: '❌ Внутренняя ошибка сервера.' });
    }
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

// ✅ 6. Выход (очистка токена)
app.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true, message: '✅ Вы вышли из системы' });
});


// ✅ Добавляем недостающие маршруты в server.js

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


// Запускаем сервер 
app.listen(port, () => console.log(`🚀 Сервер запущен на порту ${port}`));
