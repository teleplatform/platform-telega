import { Telegraf } from 'telegraf';
const token = '8773875030:AAGGjSDH5WGws1blSOjxeMazy1imsCHwrfQ';
const bot = new Telegraf(token);

console.log('Bot created, launching...');
const start = Date.now();
const launchPromise = bot.launch();

launchPromise
  .then(() => {
    console.log('Bot launched, promise resolved after', Date.now() - start, 'ms');
  })
  .catch((err) => {
    console.error('Launch error:', err.message);
  });

const timeout = setTimeout(() => {
  console.log('Timeout 5s, stopping bot');
  bot.stop('test');
}, 5000);

timeout.unref();
