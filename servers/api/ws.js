import { WebSocketServer } from 'ws';
import { connectChat } from '../src/chat.js';
import { getRoom } from '../src/store.js';
import { authenticateRequest } from '../src/auth.js';

const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

export default async function handler(request, response) {
  const user = await authenticateRequest(request, response);
  if (!user) return;
  if (request.url?.startsWith('/api/ws')) {
    const url = new URL(request.url, 'http://localhost');
    const roomId = url.searchParams.get('roomId');
    if (!roomId || !getRoom(roomId)) {
      response.statusCode = 404;
      response.end('Room not found');
      return;
    }
    sockets.handleUpgrade(request, request.socket, Buffer.alloc(0), (socket) => {
      connectChat(socket, `${request.url}&room=${encodeURIComponent(roomId)}`, user);
    });
    return;
  }
  response.statusCode = 426;
  response.end('WebSocket upgrade required');
}
