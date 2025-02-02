require('dotenv').config();
const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const axios = require('axios'); // Загружаем один раз


const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;
const URL = process.env.URL;

if (!SECRET || !BOT_TOKEN || !URL) {
  console.error('❌ ОШИБКА: Не все переменные окружения установлены.');
  process.exit(1);
}

app.use(express.json());

// ✅ Функция проверки подписи GitHub для защиты вебхуков
function verifyGitHubSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.error('❌ Подпись отсутствует.');
    return false;
  }

  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return `sha256=${hmac}` === signature;
}

// ✅ Обработчик вебхука от GitHub
app.post('/github-webhook', async (req, res) => {
  try {
    if (!verifyGitHubSignature(req)) {
      console.error('❌ Неверная подпись GitHub');
      return res.status(403).send('Неверная подпись');
    }

    console.log('🔄 Получен вебхук от GitHub:', req.body);

    // Выполняем `git pull` для обновления кода
    exec('git fetch origin && git reset --hard origin/main', { cwd: '/var/www/lifetrackerb_usr/data/www/lifetrackerbot.ru' }, (err, stdout, stderr) => {
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

// ✅ Обработчик вебхука от Telegram
app.post(`/bot${BOT_TOKEN}`, async (req, res) => {
  try {
    const message = req.body.message;

    if (message && message.text) {
      const chatId = message.chat.id;
      const responseText = `Вы написали: ${message.text}`;

      // Отправляем ответное сообщение
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

// ✅ Устанавливаем вебхук для Telegram
async function setTelegramWebhook() {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      url: `${URL}/bot${BOT_TOKEN}`,
      secret_token: SECRET, // Указываем секретный токен для защиты вебхука
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

// ✅ Устанавливаем вебхук при старте сервера
setTelegramWebhook();

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
