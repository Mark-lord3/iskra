import { WebSocketServer } from 'ws';
import { URL } from 'node:url';

/**
 * The live table channel.
 *
 * A socket may only join a table it is entitled to watch, and the payload it
 * receives is built per viewer, so one player's hole cards are never written
 * to another player's socket.
 */
const HEARTBEAT_MS = 30_000;

export class RealtimeHub {
  constructor(){
    this.wss = null;
    this.rooms = new Map();       // tableId -> Set<socket>
    this.resolveViewer = async () => null;
    this.snapshot = () => null;
  }

  attach(server, { path = '/ws/poker', resolveViewer, snapshot }){
    this.resolveViewer = resolveViewer;
    this.snapshot = snapshot;
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (req, socket, head) => {
      let url;
      try { url = new URL(req.url, 'http://localhost'); } catch { return socket.destroy(); }
      if(url.pathname !== path) return;   // leave other upgrades to whoever wants them

      const tableId = url.searchParams.get('table');
      if(!tableId) return socket.destroy();

      const viewer = await this.resolveViewer(req, tableId).catch(() => null);
      if(!viewer){ socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); return socket.destroy(); }

      this.wss.handleUpgrade(req, socket, head, ws => {
        ws.viewer = viewer;
        ws.tableId = tableId;
        ws.isAlive = true;
        this.join(tableId, ws);
        this.wss.emit('connection', ws, req);
      });
    });

    this.wss.on('connection', ws => {
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', raw => this.onMessage(ws, raw));
      ws.on('close', () => this.leave(ws));
      ws.on('error', () => this.leave(ws));
      this.sendSnapshot(ws);
    });

    this.beat = setInterval(() => {
      for(const ws of this.wss.clients){
        if(!ws.isAlive){ ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
      }
    }, HEARTBEAT_MS);
    this.beat.unref?.();
    return this;
  }

  onMessage(ws, raw){
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    // The socket carries intents only; every one is re-validated server-side.
    if(msg?.type === 'ping') return ws.send(JSON.stringify({ event:'pong' }));
    if(msg?.type === 'sync') return this.sendSnapshot(ws);
    this.onIntent?.(ws, msg);
  }

  join(tableId, ws){
    if(!this.rooms.has(tableId)) this.rooms.set(tableId, new Set());
    this.rooms.get(tableId).add(ws);
    this.onPresence?.(tableId, ws.viewer, true);
  }

  leave(ws){
    const room = this.rooms.get(ws.tableId);
    if(room){ room.delete(ws); if(!room.size) this.rooms.delete(ws.tableId); }
    this.onPresence?.(ws.tableId, ws.viewer, false);
  }

  sendSnapshot(ws){
    const state = this.snapshot(ws.tableId, ws.viewer.userId);
    if(state) this.sendTo(ws, { event:'state', state });
  }

  sendTo(ws, payload){
    if(ws.readyState === 1){ try { ws.send(JSON.stringify(payload)); } catch {} }
  }

  /** Fan out to a room, rebuilding the view for every viewer individually. */
  publish(tableId, message){
    const room = this.rooms.get(String(tableId));
    if(!room) return;
    for(const ws of room){
      const state = this.snapshot(String(tableId), ws.viewer.userId);
      this.sendTo(ws, { ...message, state });
    }
  }

  close(){
    clearInterval(this.beat);
    this.wss?.clients.forEach(ws => ws.terminate());
    this.wss?.close();
  }
}

export const hub = new RealtimeHub();
