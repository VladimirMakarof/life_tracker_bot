const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET_TOKEN;

app.use(express.json());

// Проверка подписи для безопасности
function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return `sha256=${hmac}` === signature;
}

// Обработчик Webhook
app.post('/github-webhook', (req, res) => {
  if (!verifySignature(req)) {
    console.error('Неверная подпись');
    return res.status(403).send('Неверная подпись');
  }

  console.log('Получен Webhook:', req.body);

  // Выполняем git pull для обновления  кода 
  exec('git pull origin main', { cwd: '/var/www/lifetrackerb_usr/data/www/lifetrackerbot.ru' }, (err, stdout, stderr) => {
    if (err) {
      console.error(`Ошибка: ${stderr}`);
      return res.status(500).send('Ошибка при обновлении');
    }

    console.log(`Обновление выполнено: ${stdout}`);
    res.status(200).send('Webhook обработан, проект обновлён');
  });
});

app.listen(PORT, () => {
  console.log(`Webhook слушает на порту ${PORT}`);
});
