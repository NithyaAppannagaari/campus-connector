import { useCallback, useEffect, useRef, useState } from "react";
import { draw } from "./game/render";
import { Building, H, TILE, W, World, buildingById, fmtClock } from "./game/world";
import { Settings, checkNotify, inQuietHours, loadSettings, saveSettings } from "./settings";
import { awardAccept, breakStreak, loadRewards, saveRewards } from "./rewards";
import { SerendipityEvent, describeSerendipity, generateSerendipity } from "./serendipity";
import SettingsPanel from "./components/SettingsPanel";
import OpenNowCard from "./components/OpenNowCard";
import PointsPill from "./components/PointsPill";

type FeedKind = "agent" | "friend" | "cal" | "luma" | "alert" | "system";
interface FeedItem {
  id: number;
  kind: FeedKind;
  text: string;
  at: string;
}
interface Toast {
  id: number;
  text: string;
  expiresAt: number;
  serendipity?: SerendipityEvent;
}

const KIND_ICON: Record<FeedKind, string> = {
  agent: "\u{1F916}",
  friend: "\u{1F4AC}",
  cal: "\u{1F4C5}",
  luma: "\u{1F39F}\u{FE0F}",
  alert: "\u{26A1}",
  system: "\u{1F47B}",
};

let nextId = 1;

function timeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) worldRef.current = new World(performance.now());
  const world = worldRef.current;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [rewards, setRewards] = useState(loadRewards);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mutedCount, setMutedCount] = useState(0);
  const [, setPulse] = useState(0); // 1s re-render for live counts / countdowns
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveRewards(rewards), [rewards]);

  const pushFeed = useCallback((kind: FeedKind, text: string) => {
    setFeed((f) => [...f, { id: nextId++, kind, text, at: timeLabel() }]);
  }, []);

  const pushStaged = useCallback(
    (items: { delay: number; kind: FeedKind; text: string }[]) => {
      const timers = items.map((it) => window.setTimeout(() => pushFeed(it.kind, it.text), it.delay));
      return () => timers.forEach(clearTimeout);
    },
    [pushFeed],
  );

  const pushToast = useCallback((text: string, ttl = 6000, serendipity?: SerendipityEvent) => {
    const id = nextId++;
    setToasts((t) => [...t, { id, text, expiresAt: Date.now() + ttl, serendipity }]);
    return id;
  }, []);

  // game loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      world.tick(dt, now);
      for (const ev of world.drainEvents()) {
        if (ev.type === "arrive") {
          const f = world.friends.find((x) => x.id === ev.friendId)!;
          const b = buildingById(ev.buildingId);
          const decision = checkNotify(settingsRef.current, world.clockMin, f.id, b);
          if (decision.ok) {
            const others = world.friendsInside(b.id).filter((x) => x.id !== f.id).length;
            const extra = others > 0 ? ` — ${others} other${others > 1 ? "s" : ""} from your circle there` : "";
            pushToast(`${f.name} just hit ${b.name}${extra}`);
            pushFeed("alert", `${f.name} checked in at ${b.name}${extra}.`);
          } else if (decision.reason !== "private-space") {
            // suppressed by your settings; counted so you can see the filter working
            setMutedCount((c) => c + 1);
          }
        } else if (ev.type === "playerArrive") {
          const b = buildingById(ev.buildingId);
          if (!b.isPublic) {
            pushToast(`You checked in at ${b.name} — private space, no one was pinged`);
          } else if (world.player.ghost) {
            pushToast(`You checked in at ${b.name} — ghost mode, no one was pinged`);
          } else {
            pushToast(`You checked in at ${b.name}`);
          }
        }
      }
      draw(ctx, world, now, selectedRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world, pushFeed, pushToast]);

  // 1s pulse: refresh counts, expire toasts (an expired serendipity breaks your streak)
  useEffect(() => {
    const iv = setInterval(() => {
      setPulse((p) => p + 1);
      setToasts((t) => {
        const now = Date.now();
        const expired = t.filter((x) => x.expiresAt <= now);
        for (const e of expired) {
          if (e.serendipity) {
            pushFeed("system", "\u{1F4A8} The window vanished. Streak reset — next one soon.");
            setRewards((r) => breakStreak(r));
          }
        }
        return t.filter((x) => x.expiresAt > now);
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [pushFeed]);

  // opening beats (cancel on unmount so StrictMode's double-mount doesn't duplicate them)
  useEffect(() => {
    return pushStaged([
      { delay: 400, kind: "agent", text: "Morning read: 2 friends free after 6, Moffitt 3rd has open tables, Luma open mic at Union tonight." },
      { delay: 1600, kind: "agent", text: "Tonight's vibe forecast: \u{1F3B2} board-game energy, not leetcode." },
    ]);
  }, [pushStaged]);

  // serendipity engine: recurring matched hangouts with people who share your interests
  useEffect(() => {
    let timer = 0;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        const s = settingsRef.current;
        if (s.notifsOn && !inQuietHours(world.clockMin, s.quiet)) {
          const ev = generateSerendipity(world, s.hobbies);
          if (ev) {
            pushToast(describeSerendipity(ev, buildingById(ev.buildingId).name), 60000, ev);
          }
        }
        schedule(55000 + Math.random() * 30000);
      }, delay);
    };
    schedule(25000);
    return () => clearTimeout(timer);
  }, [world, pushToast]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feed]);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const hit = world.buildings.find(
      (b) =>
        x >= b.x * TILE - 4 && x <= (b.x + b.w) * TILE + 4 &&
        y >= b.y * TILE - 30 && y <= (b.y + b.h) * TILE + 4,
    );
    setSelectedId(hit ? hit.id : null);
  };

  const joinBuilding = (b: Building) => {
    const alreadyHere = world.player.state === "inside" && world.player.buildingId === b.id;
    world.sendPlayerTo(b.id);
    const friends = world.friendsInside(b.id);
    const buddy = friends[0]?.name ?? "your circle";
    pushFeed(
      "agent",
      alreadyHere
        ? `You're already at ${b.name} — looping in your circle.`
        : `On it. Heading to ${b.name} — closing the loop for you.`,
    );
    const stages: { delay: number; kind: FeedKind; text: string }[] = [
      { delay: 1200, kind: "agent", text: `DM \u{2192} ${buddy}: "Heading to ${b.name}, meet in 10?"` },
      { delay: 2600, kind: "friend", text: `${buddy}: "yess come thru \u{1F525}"` },
      { delay: 4000, kind: "cal", text: `"${b.name} w/ ${buddy}" \u{2192} Google Calendar, 6:30\u{2013}7:30 PM \u{2713}` },
    ];
    if (b.vibe === "chaos" || b.vibe === "food") {
      stages.push({
        delay: 5400, kind: "luma",
        text: "Luma: 'Open Mic @ Union, 8 PM' matches your Thu-social pref \u{2014} auto-RSVP'd \u{2713}",
      });
    } else if (b.vibe === "study") {
      stages.push({
        delay: 5400, kind: "agent",
        text: `Held a table on ${b.name} for 25 min. Releases automatically if you no-show.`,
      });
    }
    pushStaged(stages);
  };

  const createEvent = (b: Building) => {
    pushFeed("agent", `Drafting a pickup event at ${b.name}...`);
    pushStaged([
      { delay: 1300, kind: "luma", text: `Created Luma: "Pickup @ ${b.name}, 7 PM" \u{2014} invite sent to your circle \u{2713}` },
      { delay: 2600, kind: "friend", text: `Priya: "omg yes" \u{00B7} Dev: "in \u{1F44D}"` },
      { delay: 3900, kind: "cal", text: `Added to Google Calendar + 2 friends' calendars \u{2713}` },
    ]);
    pushToast(`Event drafted at ${b.name} — circle pinged`);
  };

  const toggleGhost = () => {
    const g = !ghost;
    setGhost(g);
    world.player.ghost = g;
    pushFeed(
      "system",
      g
        ? "Ghost mode ON. You're invisible on the map, alerts still on, nothing trains your preference graph."
        : "Ghost mode OFF. Back on the map.",
    );
  };

  const acceptSerendipity = (t: Toast) => {
    const ev = t.serendipity!;
    setToasts((ts) => ts.filter((x) => x.id !== t.id));
    const b = buildingById(ev.buildingId);
    world.sendPlayerTo(b.id);
    const { next, gained, newPeople } = awardAccept(rewards, ev.people.map((p) => p.id));
    setRewards(next);
    const names = ev.people.map((p) => p.name).join(" & ");
    pushToast(
      `+${gained} \u{26A1}${newPeople > 0 ? ` — you're meeting ${newPeople} new ${newPeople === 1 ? "person" : "people"}` : ""}`,
    );
    pushStaged([
      { delay: 0, kind: "agent", text: `Locked it. Telling ${names} you're coming — intros handled.` },
      { delay: 1400, kind: "cal", text: `"${ev.hobby} hang @ ${b.name}" \u{2192} Google Calendar, ${ev.windowMin} min \u{2713}` },
    ]);
  };

  const togglePlaceMute = (b: Building) => {
    setSettings((s) => ({
      ...s,
      mutedPlaces: s.mutedPlaces.includes(b.id)
        ? s.mutedPlaces.filter((x) => x !== b.id)
        : [...s.mutedPlaces, b.id],
    }));
  };

  const selected = selectedId ? buildingById(selectedId) : null;
  const selectedFriends = selected ? world.friendsInside(selected.id) : [];
  const selectedOcc = selected ? world.displayOccupancy(selected) : 0;
  const selectedOpen = selected ? world.isOpen(selected) : false;
  const playerHere = !!selected && world.player.state === "inside" && world.player.buildingId === selected.id;
  const playerEnRoute = !!selected && world.player.state === "walking" && world.player.buildingId === selected.id;

  return (
    <div className="app">
      <div className="map-col">
        <header className="topbar">
          <span className="logo">🗺 ConnectMaxxer</span>
          <span className="tagline">the campus map that texts your friends for you</span>
          <span className="clock">🕓 {fmtClock(world.clockMin)}</span>
          <PointsPill rewards={rewards} />
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="settings">
            {"\u{2699}\u{FE0F}"}
          </button>
          <button className={`ghost-btn ${ghost ? "on" : ""}`} onClick={toggleGhost}>
            {ghost ? "\u{1F47B} GHOST ON" : "\u{1F47B} GHOST OFF"}
          </button>
        </header>

        <div className="map-wrap">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onClick={onCanvasClick}
            className="map-canvas"
          />
          <div className="toasts">
            {toasts.map((t) => (
              <div key={t.id} className={`toast ${t.serendipity ? "serendipity" : ""}`}>
                <span>{t.text}</span>
                {t.serendipity && (
                  <span className="toast-actions">
                    <b>{Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 1000))}s</b>
                    <button onClick={() => acceptSerendipity(t)}>ACCEPT</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="legend">
          <span><i style={{ background: "#4a7fd6" }} /> study</span>
          <span><i style={{ background: "#e04a4a" }} /> gym</span>
          <span><i style={{ background: "#e0913f" }} /> food</span>
          <span><i style={{ background: "#c94ad6" }} /> chaos</span>
          <span>🔒 private</span>
          <span className="legend-hint">click a building · 💤 = dead zone, go start something</span>
        </div>
      </div>

      <aside className="sidebar">
        <div className="card pref-card">
          <div className="card-title">PREFERENCE GRAPH</div>
          <p>Deep work Mon AM · social Thu PM · never gym after 9.</p>
          <p className="pref-read">Tonight's read: 🎲 board-game energy</p>
        </div>

        {selected ? (
          <div className="card building-card">
            <div className="card-title">
              {selected.emoji} {selected.name.toUpperCase()}
            </div>
            <p className="status-line">
              {selected.isPublic ? (
                selectedOpen ? (
                  <>🟢 Open · closes {fmtClock(selected.closeMin)} · public</>
                ) : (
                  <>🔴 Closed · opens {fmtClock(selected.openMin)}</>
                )
              ) : (
                <>🔒 Private space — check-ins here never notify anyone</>
              )}
            </p>
            <p>
              {selectedOcc} inside
              {selected.openSpots !== null && selectedOpen && <> · {selected.openSpots} open spots</>}
              {selectedOcc <= 1 && <> · 💤 dead zone</>}
            </p>
            <p className="friends-line">
              {selectedFriends.length > 0
                ? `Your people: ${selectedFriends.map((f) => f.name).join(", ")}`
                : "No one from your circle here yet."}
            </p>
            <div className="btn-row">
              <button
                className="btn join"
                onClick={() => joinBuilding(selected)}
                disabled={!selectedOpen || playerHere || playerEnRoute}
              >
                {playerHere ? "\u2713 HERE" : playerEnRoute ? "EN ROUTE\u2026" : "JOIN"}
              </button>
              <button className="btn create" onClick={() => createEvent(selected)}>CREATE</button>
              {selected.isPublic && (
                <button className="btn" onClick={() => togglePlaceMute(selected)}>
                  {settings.mutedPlaces.includes(selected.id) ? "\u{1F507} UNMUTE" : "MUTE"}
                </button>
              )}
              <button className="btn" onClick={() => setSelectedId(null)}>CLOSE</button>
            </div>
          </div>
        ) : (
          <div className="card hint-card">
            <p>Click a vibe bubble on the map. The agent handles the rest — DMs, Luma, calendar.</p>
          </div>
        )}

        <OpenNowCard
          world={world}
          onSelect={(id) => setSelectedId(id)}
          onGo={(b) => {
            setSelectedId(b.id);
            joinBuilding(b);
          }}
        />

        <div className="card feed-card">
          <div className="card-title">AGENT FEED</div>
          <div className="feed">
            {feed.map((f) => (
              <div key={f.id} className={`feed-item ${f.kind}`}>
                <span className="feed-icon">{KIND_ICON[f.kind]}</span>
                <span className="feed-text">{f.text}</span>
                <span className="feed-time">{f.at}</span>
              </div>
            ))}
            <div ref={feedEndRef} />
          </div>
        </div>
      </aside>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          ghost={ghost}
          onToggleGhost={toggleGhost}
          friends={world.friends}
          buildings={world.buildings}
          clockMin={world.clockMin}
          mutedCount={mutedCount}
        />
      )}
    </div>
  );
}
