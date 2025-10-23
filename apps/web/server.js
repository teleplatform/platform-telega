const http = require('http');
const port = process.env.PORT || 3000;
const handler = (_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<h1>Tele•Ga Web</h1><p>Заглушка сервера. Позже заменим на Next.js.</p>`);
};
http.createServer(handler).listen(port, () => {
  console.log(`Tele•Ga web placeholder running on http://localhost:${port}`);
});
