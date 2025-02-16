const { Telegraf, session } = require("telegraf"); 
const axios = require("axios");
require("dotenv").config();
console.log("🤖 Бот запущен...");
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Инициализируем сессию с пустым объектом по умолчанию
bot.use(session({ initial: () => ({}) }));

bot.start((ctx) => ctx.reply("Привет! Отправьте мне ссылку на настройки."));

bot.on("text", async (ctx) => {
    const url = ctx.message.text.trim();

    if (!url.startsWith("http")) {
        return ctx.reply("Пожалуйста, отправьте корректную ссылку.");
    }

    try {
        const response = await axios.get(url);
        const settings = response.data;

        if (!settings.name || !settings.goal || !settings.tasks) {
            return ctx.reply("Ошибка: JSON-файл не содержит всех нужных параметров.");
        }

        // Сохраняем настройки в сессию пользователя
        ctx.session.settings = settings;

        ctx.reply(
            `✅ Настройки загружены:\n` +
            `👤 Имя: ${settings.name}\n` +
            `🎯 Цель: ${settings.goal}\n` +
            `🔔 Напоминания: ${settings.reminders ? "Включены" : "Отключены"}\n` +
            `📌 Лимит задач в день: ${settings.daily_limit}\n` +
            `📋 Задачи:\n${settings.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
        );
    } catch (error) {
        console.error("Ошибка при загрузке настроек:", error.message);
        ctx.reply(`❌ Ошибка загрузки настроек: ${error.message}`);
    }
});

// Команда для проверки настроек
bot.command("settings", (ctx) => {
    if (!ctx.session.settings) {
        return ctx.reply("❌ Настройки не загружены. Отправьте мне ссылку.");
    }

    const settings = ctx.session.settings;
    ctx.reply(
        `📋 Ваши текущие настройки:\n` +
        `👤 Имя: ${settings.name}\n` +
        `🎯 Цель: ${settings.goal}\n` +
        `🔔 Напоминания: ${settings.reminders ? "Включены" : "Отключены"}\n` +
        `📌 Лимит задач в день: ${settings.daily_limit}\n` +
        `📋 Задачи:\n${settings.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
    );
});

bot.launch();
console.log("🤖 Бот запущен...");
