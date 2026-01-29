import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import type {
  LeaderboardScope,
  LeaderboardState,
  WsClientMessage,
  WsServerMessage,
} from '@playmasters/types';
import { LeaderboardStore, ScoreInput } from './leaderboards/store';
import { restoreSnapshots } from './leaderboards/restore';
import { startSnapshotLoop } from './leaderboards/snapshot';

type Subscription = {
  gameId: string;
  scopes: Set<LeaderboardScope>;
  countryCode?: string;
  userId?: string;
};

const store = new LeaderboardStore();
const subscriptions = new Map<WebSocket, Subscription>();

const port = Number(process.env.REALTIME_PORT ?? 4000);
const ingestSecret = process.env.REALTIME_INGEST_SECRET;
const defaultCountry = process.env.DEFAULT_COUNTRY_CODE ?? 'GB';

const json = (res: ServerResponse, statusCode: number, payload: Record<string, unknown>) => {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const isLocalRequest = (req: IncomingMessage) => {
  const ip = req.socket.remoteAddress ?? '';
  return ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost');
};

const authorized = (req: IncomingMessage) => {
  if (ingestSecret) {
    return req.headers['x-realtime-secret'] === ingestSecret;
  }
  return isLocalRequest(req);
};

const parseBody = async (req: IncomingMessage) =>
  await new Promise<string>((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const handleScore = async (req: IncomingMessage, res: ServerResponse) => {
  if (!authorized(req)) {
    return json(res, 401, { ok: false, error: 'unauthorized' });
  }

  const body = await parseBody(req);

  let payload: Partial<ScoreInput> = {};
  try {
    payload = JSON.parse(body || '{}');
  } catch {
    return json(res, 400, { ok: false, error: 'invalid_json' });
  }

  const { gameId, userId, displayName, score, achievedAt } = payload;
  if (!gameId || !userId || !displayName || typeof score !== 'number' || !achievedAt) {
    return json(res, 400, { ok: false, error: 'invalid_payload' });
  }

  const result = store.applyScore({
    gameId,
    userId,
    displayName,
    countryCode: payload.countryCode,
    score,
    achievedAt,
  });

  if (result.changed) {
    broadcastUpdate(result);
  }

  return json(res, 200, { ok: true });
};

const handleHealth = (_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('ok');
};

const handleNotFound = (_req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
};

const routes: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void> | void> = {
  'GET:/health': handleHealth,
  'POST:/score': handleScore,
};

function dispatchHttp(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const key = `${req.method}:${url.pathname}`;
  const handler = routes[key];
  if (handler) {
    const result = handler(req, res);
    if (result instanceof Promise) {
      result.catch((err) => {
        console.error('Unhandled realtime handler error', err);
        json(res, 500, { ok: false, error: 'server_error' });
      });
    }
  } else {
    handleNotFound(req, res);
  }
}

function send(ws: WebSocket, message: WsServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function handleSubscribe(ws: WebSocket, message: Extract<WsClientMessage, { type: 'subscribe' }>) {
  const scopes = new Set<LeaderboardScope>(message.scopes ?? []);
  const subscription: Subscription = {
    gameId: message.gameId,
    scopes,
    countryCode: message.countryCode ?? defaultCountry,
    userId: message.userId,
  };

  subscriptions.set(ws, subscription);

  for (const scope of scopes) {
    const state = store.getState(
      message.gameId,
      scope,
      subscription.countryCode,
      scope === 'personal' ? message.userId : undefined
    );
    send(ws, { type: 'leaderboard:state', payload: state });
  }
}

function handleWsMessage(ws: WebSocket, raw: string) {
  let message: WsClientMessage;
  try {
    message = JSON.parse(raw) as WsClientMessage;
  } catch {
    send(ws, { type: 'error', message: 'invalid_json' });
    return;
  }

  if (message.type === 'subscribe') {
    handleSubscribe(ws, message);
    return;
  }

  if (message.type === 'unsubscribe') {
    subscriptions.delete(ws);
    return;
  }

  if (message.type === 'ping') {
    send(ws, { type: 'ready' });
  }
}

function broadcastUpdate(update: {
  global?: LeaderboardState;
  local?: LeaderboardState;
  personal?: LeaderboardState;
}) {
  for (const [ws, sub] of subscriptions.entries()) {
    if (ws.readyState !== WebSocket.OPEN) continue;

    if (update.global && sub.gameId === update.global.gameId && sub.scopes.has('global')) {
      send(ws, { type: 'leaderboard:update', payload: update.global });
    }

    if (
      update.local &&
      sub.gameId === update.local.gameId &&
      sub.scopes.has('local') &&
      (!sub.countryCode || sub.countryCode === update.local.countryCode)
    ) {
      send(ws, { type: 'leaderboard:update', payload: update.local });
    }

    const personalUser = update.personal?.entries?.[0]?.userId;
    if (
      update.personal &&
      personalUser &&
      sub.scopes.has('personal') &&
      sub.userId &&
      sub.userId === personalUser &&
      sub.gameId === update.personal.gameId
    ) {
      send(ws, { type: 'leaderboard:update', payload: update.personal });
    }
  }
}

export async function startServer() {
  const server = http.createServer(dispatchHttp);
  const wss = new WebSocketServer({ server });

  const restoreResult = await restoreSnapshots(store);
  if (restoreResult.restored) {
    console.info(`Restored ${restoreResult.restored} leaderboard snapshots`);
  }

  const stopSnapshots = startSnapshotLoop(store);

  wss.on('connection', (ws: WebSocket) => {
    send(ws, { type: 'ready' });

    ws.on('message', (data: RawData) => handleWsMessage(ws, data.toString()));
    ws.on('close', () => subscriptions.delete(ws));
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  server.listen(port, () => {
    console.log(`Realtime service listening on :${port}`);
  });

  return () => {
    stopSnapshots();
    clearInterval(heartbeat);
    server.close();
  };
}
