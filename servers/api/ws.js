import { WebSocketServer } from 'ws';
import { connectChat } from '../src/chat.js';

const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

export default function handler(request, response) {
  if (request.url?.startsWith('/api/ws')) {
    sockets.handleUpgrade(request, request.socket, Buffer.alloc(0), (socket) => {
      connectChat(socket, request.url);
    });
    return;
  }
  response.statusCode = 426;
  response.end('WebSocket upgrade required');
}
