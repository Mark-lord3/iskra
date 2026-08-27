import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { QrZoneScanner } from "../components/QrZoneScanner";
import { useCompassHeading } from "../hooks/useCompassHeading";
import { api, ApiError, SOCKET_ROOT } from "../lib/api";

type Freshness = { state: "live" | "aging" | "stale" | "unknown"; seconds: number | null };
type Zone = { _id: string; name: string; floor: number; x: number; y: number };
type CompassState = {
  matchId: string;
  status: "idle" | "requested" | "active" | "declined" | "found" | "stopped";
  requestedByMe?: boolean;
  acceptedByMe?: boolean;
  expiresAt?: string;
  pattern?: "ember" | "plasma" | "signal";
  peer: { name: string; photo: string | null };
  ownZone?: Zone | null;
  peerZone?: Zone | null;
  ownFreshness?: Freshness;
  peerFreshness?: Freshness;
  sameFloor?: boolean;
  bearing?: number | null;
  proximity?: "same area" | "very close" | "nearby" | "across the venue" | "unknown";
  foundByMe?: boolean;
  zones: Zone[];
};

const post = <T,>(matchId: string, action: string, body?: object) => api<T>(`/compass/${matchId}/${action}`, {
  method: "POST",
  body: body ? JSON.stringify(body) : undefined
});

function relativeDirection(bearing: number | null | undefined, heading: number | null) {
  if (bearing == null) return null;
  const turn = heading == null ? bearing : ((bearing - heading + 540) % 360) - 180;
  const absolute = Math.abs(turn);
  if (absolute < 22) return "Straight ahead";
  if (absolute > 158) return "Behind you";
  return turn > 0 ? "Turn right" : "Turn left";
}

function formatFreshness(value?: Freshness) {
  if (!value || value.state === "unknown") return "Waiting for their area";
  if (value.state === "stale") return "Location needs a refresh";
  if ((value.seconds || 0) < 15) return "Updated just now";
  return `Updated ${value.seconds}s ago`;
}

export function CompassPage() {
  const { matchId = "" } = useParams();
  const queryClient = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const { heading, permission, enable } = useCompassHeading();
  const queryKey = ["compass", matchId];
  const compass = useQuery({
    queryKey,
    queryFn: () => api<CompassState>(`/compass/${matchId}`),
    enabled: Boolean(matchId),
    refetchInterval: 15_000
  });
  const state = compass.data;

  useEffect(() => {
    if (!matchId) return;
    const socket = io(SOCKET_ROOT, { withCredentials: true, transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("compass:join", { matchId }));
    const refresh = () => queryClient.invalidateQueries({ queryKey });
    const events = ["compass:requested", "compass:accepted", "compass:declined", "compass:zone", "compass:stopped", "compass:found"];
    events.forEach((event) => socket.on(event, refresh));
    socket.on("compass:wave", () => {
      setNotice("Your match is waving. Look for the same pulse.");
      navigator.vibrate?.([120, 70, 120]);
      window.setTimeout(() => setNotice(""), 5000);
    });
    return () => {
      socket.disconnect();
    };
  }, [matchId, queryClient]);

  const action = useMutation({
    mutationFn: ({ name, body }: { name: string; body?: object }) => post<CompassState>(matchId, name, body),
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
    onError: (error) => setNotice(error instanceof Error ? error.message : "Please try again.")
  });
  const signal = useMutation({
    mutationFn: (name: "wave" | "stop" | "found") => post<{ ok: true }>(matchId, name),
    onSuccess: (_, name) => {
      if (name === "wave") setNotice("Wave sent. Your phones now share the same pulse pattern.");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Please try again.")
  });

  const rotation = useMemo(() => {
    if (state?.bearing == null) return 0;
    return heading == null ? state.bearing : ((state.bearing - heading + 540) % 360) - 180;
  }, [heading, state?.bearing]);
  const guidance = relativeDirection(state?.bearing, heading);
  const active = state?.status === "active";
  const directional = active && state.sameFloor && state.bearing != null && state.peerFreshness?.state !== "stale";

  function updateZone(zoneId: string, token?: string) {
    setScannerOpen(false);
    action.mutate({ name: "zone", body: { zoneId, token } });
  }

  if (compass.isLoading) return <CompassShell><div className="compass-loading">CALIBRATING THE ROOM...</div></CompassShell>;
  if (compass.isError) {
    const unauthorized = compass.error instanceof ApiError && compass.error.status === 401;
    return (
      <CompassShell>
        <section className="compass-error">
          <p>RADAR OFFLINE</p>
          <h1>{unauthorized ? "Sign in to find your match." : compass.error.message}</h1>
          <Link to="/">Return to ISKRA</Link>
        </section>
      </CompassShell>
    );
  }
  if (!state) return null;

  return (
    <CompassShell>
      <header className="compass-header">
        <Link to="/" className="compass-back" aria-label="Back to matches">←</Link>
        <div>
          <span>FIND MY MATCH</span>
          <strong>Approximate venue guidance</strong>
        </div>
        <div className={`live-dot live-dot--${state.peerFreshness?.state || "unknown"}`}><i /> LIVE</div>
      </header>

      <main className={`compass-stage compass-stage--${state.pattern || "ember"}`}>
        <div className="compass-peer">
          {state.peer.photo ? <img src={state.peer.photo} alt="" /> : <div>{state.peer.name.slice(0, 1)}</div>}
          <p><span>MATCHED WITH</span>{state.peer.name}</p>
        </div>

        {state.status === "idle" && (
          <motion.section className="consent-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
            <p className="eyebrow">MUTUAL OPT-IN ONLY</p>
            <h1>Find each other in the room.</h1>
            <p>Share temporary venue areas with {state.peer.name}. ISKRA never exposes exact coordinates, and either person can stop at any time.</p>
            <button className="primary-action" onClick={() => action.mutate({ name: "request" })} disabled={action.isPending}>Ask to connect</button>
          </motion.section>
        )}

        {state.status === "requested" && (
          <motion.section className="consent-panel" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <p className="eyebrow">PRIVATE COMPASS REQUEST</p>
            <h1>{state.requestedByMe ? `Waiting for ${state.peer.name}` : `${state.peer.name} wants to find you`}</h1>
            <p>Both people must agree. Your guidance uses broad venue areas, not live GPS.</p>
            {!state.requestedByMe && <div className="consent-actions"><button className="primary-action" onClick={() => action.mutate({ name: "respond", body: { accepted: true } })}>Accept</button><button onClick={() => action.mutate({ name: "respond", body: { accepted: false } })}>Not now</button></div>}
            {state.requestedByMe && <div className="waiting-pulse"><i /><i /><i /></div>}
          </motion.section>
        )}

        {active && (
          <>
            <section className="radar-panel" aria-live="polite">
              <div className="radar-rings" aria-hidden="true"><i /><i /><i /></div>
              {directional ? (
                <motion.div className="compass-arrow" animate={{ rotate: rotation }} transition={{ type: "spring", stiffness: 55, damping: 18 }} aria-hidden="true">
                  <svg viewBox="0 0 120 190"><path d="M60 3 112 126 60 105 8 126Z" fill="currentColor"/><path d="M60 105 60 187" stroke="currentColor" strokeWidth="12" strokeLinecap="round"/></svg>
                </motion.div>
              ) : <div className="radar-waiting">···</div>}
              <div className="radar-copy">
                <p>{directional ? guidance : state.sameFloor === false && state.peerZone ? `GO TO FLOOR ${state.peerZone.floor}` : "UPDATE YOUR AREAS"}</p>
                <h1>{state.peerZone?.name || "Waiting for a zone"}</h1>
                <span>{state.proximity === "unknown" ? "Direction appears after both select an area" : state.proximity}</span>
              </div>
            </section>

            <div className="freshness-strip">
              <span><i className={`status-${state.peerFreshness?.state}`} />{formatFreshness(state.peerFreshness)}</span>
              <button type="button" onClick={() => setScannerOpen(true)}>Scan zone QR</button>
            </div>

            <section className="zone-picker">
              <label htmlFor="current-zone">I am near</label>
              <select id="current-zone" value={state.ownZone?._id || ""} onChange={(event) => event.target.value && updateZone(event.target.value)}>
                <option value="">Choose an approximate area</option>
                {state.zones.map((zone) => <option key={zone._id} value={zone._id}>Floor {zone.floor} · {zone.name}</option>)}
              </select>
              <p>Only the area name is shared. Exact position is never collected.</p>
            </section>

            {permission !== "granted" && <button className="motion-permission" onClick={enable}>Enable phone compass</button>}
            {permission === "unsupported" && <p className="permission-note">Motion sensors are unavailable here. Follow the area guidance above.</p>}
            {permission === "denied" && <p className="permission-note">Motion access is off. You can still use area guidance.</p>}

            <div className="compass-actions">
              <button className="wave-action" onClick={() => signal.mutate("wave")}><span>⌁</span> Wave to match</button>
              <button className="found-action" onClick={() => signal.mutate("found")}>We found each other</button>
              <button className="stop-action" onClick={() => signal.mutate("stop")}>Stop sharing</button>
            </div>
          </>
        )}

        {["declined", "stopped", "found"].includes(state.status) && (
          <section className="consent-panel">
            <p className="eyebrow">SESSION CLOSED</p>
            <h1>{state.status === "found" ? "You found the spark." : "Location sharing has stopped."}</h1>
            <p>No more venue updates are being shared. Your temporary session will be deleted automatically.</p>
            <Link className="primary-action" to="/">Back to matches</Link>
          </section>
        )}

        <AnimatePresence>{notice && <motion.div className="compass-toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{notice}</motion.div>}</AnimatePresence>
      </main>
      {scannerOpen && <QrZoneScanner onScan={updateZone} onClose={() => setScannerOpen(false)} />}
    </CompassShell>
  );
}

function CompassShell({ children }: { children: React.ReactNode }) {
  return <div className="compass-shell">{children}</div>;
}
