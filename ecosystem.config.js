module.exports = {
  apps: [
    {
      name: "life_tracker_bot", // Имя приложения 
      script: "/var/www/lifetrackerb_usr/data/www/lifetrackerbot.ru/webhook.js",
      watch: true, // Автоматически перезапускать при изменениях файлов
      ignore_watch: ["node_modules", "logs"], // Игнорировать эти папки
      env: {
        NODE_ENV: "development" // Настройки для разработки
      },
      env_production: {
        NODE_ENV: "production" // Настройки для продакшена  
      }
    }
  ]
};