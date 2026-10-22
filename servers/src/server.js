import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { connectChat } from './chat.js';

const port = Number(process.env.PORT ?? 3000);
const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    return response.end(JSON.stringify({ status: 'ok' }));
  }
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end('Mango Chat WebSocket server. Connect to /ws?room=general&name=Guest');
});

const sockets = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
sockets.on('connection', (socket, request) => connectChat(socket, request.url));

server.listen(port, () => console.log(`Mango Chat server listening on :${port}`));
