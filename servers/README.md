# Mango Chat WebSocket server

Standalone WebSocket chat server for mobile and other clients. The native app is not modified.

## Local development

```sh
cd servers
npm install
npm run dev
```

Connect a WebSocket client to `ws://localhost:3000/ws?room=general&name=Guest`. Health check: `http://localhost:3000/health`.

## Protocol

On connect, the server sends `connected`, `history` (up to 100 recent messages), then `presence`. Send JSON messages:

```json
{"type":"message","text":"Hello"}
```

Heartbeat request: `{"type":"ping"}`. The server responds with `pong`. Messages are broadcast to everyone in that room, including the sender. Rooms use alphanumeric characters, `_`, or `-`, up to 80 characters. Text is limited to 2,000 characters.

## Deploy on Vercel

Vercel Functions now support WebSockets in public beta on all plans. Copy this `servers` directory as the Vercel project root, then run `npx vercel login` and `npx vercel --prod` from that directory. Connect mobile clients to `wss://<deployment-host>/api/ws?room=general&name=Guest`.

Each connection can last up to the function's configured duration (300 seconds on Hobby), so clients must reconnect and request history after reconnecting. This starter stores history and room membership in process memory. Vercel may route different clients to different function instances, and deploys/restarts lose memory; for shared rooms across instances, add a shared datastore/pub-sub service such as Redis before production. The WebSocket Functions feature is currently beta; verify current Vercel terms and limits before deployment.

## Security and production notes

This MVP allows unauthenticated room joins. The display name is user supplied and is not an identity. Add token-based authentication, authorization for private rooms, rate limits, and shared persistent storage before handling private or sensitive messages. The Vercel Hobby plan may not be suitable for unrestricted production usage.
