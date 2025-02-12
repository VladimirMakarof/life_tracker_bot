const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 5000;
const DATA_FOLDER = path.join(__dirname, "data");

// Создаём папку для хранения анкет, если её нет
if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER);
}

app.use(express.json());
app.use(cors());

// 📌 1. Сохранение анкеты
app.post("/save", (req, res) => {
    const { name, goal, reminders, daily_limit, tasks } = req.body;

    // Проверяем обязательные поля
    if (!name || !goal || typeof reminders !== "boolean" || !daily_limit || !Array.isArray(tasks)) {
        return res.status(400).json({ success: false, error: "Некорректные данные" });
    }

    const fileId = uuidv4().slice(0, 8); // Генерируем короткий ID
    const filePath = path.join(DATA_FOLDER, `${fileId}.json`);

    fs.writeFile(filePath, JSON.stringify(req.body, null, 2), (err) => {
        if (err) return res.status(500).json({ success: false, error: "Ошибка сохранения" });
        res.json({ success: true, id: fileId });
    });
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
app.listen(PORT, () => console.log(`✅ Сервер запущен на http://localhost:${PORT}`));
