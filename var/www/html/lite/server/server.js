require("dotenv").config(); // Подключаем dotenv
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const DATA_FOLDER = path.join(__dirname, "data");

// Создаём папку для хранения анкет, если её нет
if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

app.use(express.json());
app.use(cors());

// 📌 1. Сохранение анкеты
app.post("/save", (req, res) => {
    const { name, goal, reminders, daily_limit, tasks } = req.body;

    if (!name || !goal || typeof reminders !== "boolean" || !daily_limit || !Array.isArray(tasks)) {
        return res.status(400).json({ success: false, error: "Некорректные данные" });
    }

    if (!fs.existsSync(DATA_FOLDER)) {
        console.log("⚠️ Папка 'data' не найдена, создаем...");
        fs.mkdirSync(DATA_FOLDER, { recursive: true });
    }

    const fileId = uuidv4().slice(0, 8);
    const filePath = path.join(DATA_FOLDER, `${fileId}.json`);

    fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
        if (err) {
            console.error("🔥 Ошибка при сохранении файла:", err);
            return res.status(500).json({ success: false, error: "Ошибка сохранения" });
        }
        console.log(`✅ Файл сохранен: ${filePath}`);
        res.json({ success: true, id: fileId, link: `https://lite.lifetrackerbot.ru/data/${fileId}` });
    });
});

app.post('/telegram-auth', (req, res) => {
    const telegramUser = req.body;
    console.log("Пользователь авторизовался через Telegram:", telegramUser);

    // Проверка полученных данных
    if (!telegramUser || !telegramUser.id) {
        return res.json({ success: false, error: "Неверные данные" });
    }

    // Здесь можно добавить логику проверки/создания пользователя в БД

    // Генерация JWT-токена с использованием вашего JWT_SECRET.
    // В полезную нагрузку можно добавить нужные поля (например, chatId, username, first_name).
    const token = jwt.sign(
        {
            chatId: telegramUser.id,
            username: telegramUser.username,
            first_name: telegramUser.first_name
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    // Отправляем ответ клиенту с полем success и сгенерированным токеном.
    res.json({ success: true, token });
});



app.post('/update', (req, res) => {
    console.log('📩 Получен POST-запрос на /update с данными:', req.body);
    
    try {
        res.json({ success: true, message: 'Данные успешно обновлены' });
        console.log("✅ Успешный ответ отправлен клиенту");
    } catch (error) {
        console.error("❌ Ошибка при обработке запроса /update:", error);
        res.status(500).json({ success: false, error: "Ошибка обновления" });
    }
});



// 📌 2. Получение анкеты по ID
app.get("/data/:id", (req, res) => {
    const filePath = path.join(DATA_FOLDER, `${req.params.id}.json`);

    fs.readFile(filePath, "utf8", (err, data) => {
        if (err) return res.status(404).json({ success: false, error: "Файл не найден" });
        res.json(JSON.parse(data));
    });
});

// 📌 3. Удаление анкеты по ID (если потребуется)
app.delete("/data/:id", (req, res) => {
    const filePath = path.join(DATA_FOLDER, `${req.params.id}.json`);

    fs.unlink(filePath, (err) => {
        if (err) return res.status(404).json({ success: false, error: "Файл не найден" });
        res.json({ success: true, message: "Анкета удалена" });
    });
});

// 📌 4. Запуск сервера
app.listen(PORT, "0.0.0.0", () => console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`));

