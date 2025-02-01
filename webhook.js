const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET_TOKEN;
const BOT_TOKEN = process.env.BOT_TOKEN;
const URL = process.env.URL;

app.use(bodyParser.json());

// Проверка подписи GitHub для безопасности
function verifyGitHubSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return `sha256=${hmac}` === signature;
}

// Обработчик вебхука от GitHub
app.post('/github-webhook', (req, res) => {
  if (!verifyGitHubSignature(req)) {
    console.error('Неверная подпись GitHub');
    return res.status(403).send('Неверная подпись');
  }

  console.log('Получен вебхук от GitHub:', req.body);

  // Выполняем git pull для обновления кода
  exec('git fetch origin && git reset --hard origin/main', { cwd: '/var/www/lifetrackerb_usr/data/www/lifetrackerbot.ru' }, (err, stdout, stderr) => {
    if (err) {
      console.error(`Ошибка при обновлении: ${stderr}`);
      return res.status(500).send('Ошибка при обновлении');
    }

    console.log(`Обновление выполнено: ${stdout}`);
    res.status(200).send('Вебхук обработан, проект обновлён');
  });
});

// Обработчик вебхука от Telegram
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
  const message = req.body.message;

  if (message && message.text) {
    const chatId = message.chat.id;
    const responseText = `Вы написали: ${message.text}`;

    // Отправляем ответное сообщение
    const axios = require('axios');
    axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: responseText,
    })
    .then(response => {
      console.log('Сообщение отправлено:', response.data);
    })
    .catch(error => {
      console.error('Ошибка при отправке сообщения:', error);
    });
  }

  res.sendStatus(200);
});

// Устанавливаем вебхук для Telegram
const axios = require('axios');
axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  url: `${URL}/bot${BOT_TOKEN}`,
})
.then(response => {
  if (response.data.ok) {
    console.log('Вебхук для Telegram установлен успешно');
  } else {
    console.error('Ошибка при установке вебхука для Telegram:', response.data);
  }
})
.catch(error => {
  console.error('Ошибка при установке вебхука для Telegram:', error);
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
