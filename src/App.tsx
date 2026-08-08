import { useCallback, useEffect, useRef, useState } from "react";
import { draw } from "./game/render";
import { Building, H, TILE, W, World, buildingById } from "./game/world";
import Onboarding from "./onboarding/Onboarding";
import {
  UserProfile,
  clearProfile,
  loadProfile,
  prefSummary,
  saveProfile,
  socialRhythm,
  topVibe,
  vibeRead,
} from "./profile";

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
  serendipity?: boolean;
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
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile());

  if (!profile) {
    return (
      <Onboarding
        onComplete={(p) => {
          saveProfile(p);
          setProfile(p);
        }}
      />
    );
  }

  return (
    <MapApp
      key={profile.onboardedAt}
      profile={profile}
      onRedo={() => {
        clearProfile();
        setProfile(null);
      }}
    />
  );
}

function MapApp({ profile, onRedo }: { profile: UserProfile; onRedo: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) {
    worldRef.current = new World(performance.now());
    worldRef.current.player.shirt = profile.avatar.shirt;
    worldRef.current.player.hair = profile.avatar.hair;
    worldRef.current.player.ghost = profile.privacy.ghostByDefault;
  }
  const world = worldRef.current;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState(profile.privacy.ghostByDefault);
  const [, setPulse] = useState(0); // 1s re-render for live counts / countdowns
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const feedEndRef = useRef<HTMLDivElement>(null);

  const pushFeed = useCallback((kind: FeedKind, text: string) => {
    setFeed((f) => [...f, { id: nextId++, kind, text, at: timeLabel() }]);
  }, []);

  const pushStaged = useCallback(
    (items: { delay: number; kind: FeedKind; text: string }[]) => {
      for (const it of items) {
        setTimeout(() => pushFeed(it.kind, it.text), it.delay);
      }
    },
    [pushFeed],
  );

  const pushToast = useCallback((text: string, ttl = 6000, serendipity = false) => {
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
          const others = world.friendsInside(b.id).filter((x) => x.id !== f.id).length;
          const extra = others > 0 ? ` — ${others} other${others > 1 ? "s" : ""} from your circle there` : "";
          pushToast(`${f.name} just hit ${b.name}${extra}`);
          pushFeed("alert", `${f.name} checked in at ${b.name}${extra}.`);
        } else if (ev.type === "playerArrive") {
          const b = buildingById(ev.buildingId);
          pushToast(`You checked in at ${b.name}`);
        }
      }
      draw(ctx, world, now, selectedRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world, pushFeed, pushToast]);

  // 1s pulse: refresh counts, expire toasts
  useEffect(() => {
    const iv = setInterval(() => {
      setPulse((p) => p + 1);
      setToasts((t) => {
        const now = Date.now();
        const expired = t.filter((x) => x.expiresAt <= now);
        for (const e of expired) {
          if (e.serendipity) {
            pushFeed("system", "\u{1F4A8} The fountain window vanished. Next one tomorrow.");
          }
        }
        return t.filter((x) => x.expiresAt > now);
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [pushFeed]);

  // opening beats + serendipity event, personalized from the onboarding profile
  useEffect(() => {
    const firstName = profile.name.split(" ")[0];
    const favorite = topVibe(profile);
    const spotHint: Record<string, string> = {
      study: "Moffitt 3rd has open tables",
      gym: "Rec Gym is quiet right now",
      food: "Dining Hall is filling up",
      chaos: "Luma open mic at Union tonight",
    };
    pushStaged([
      {
        delay: 400, kind: "agent",
        text: `Morning read for ${firstName}: 2 friends free after 6, ${spotHint[favorite]}.`,
      },
      { delay: 1600, kind: "agent", text: `Tonight's vibe forecast: ${vibeRead(profile)}.` },
    ]);
    if (!profile.privacy.serendipityOptIn) return;
    const t = setTimeout(() => {
      pushToast(
        "\u{26A1} Serendipity: 3 people free near the fountain, 20-min window",
        60000,
        true,
      );
    }, 35000);
    return () => clearTimeout(t);
  }, [profile, pushStaged, pushToast]);

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
    world.sendPlayerTo(b.id);
    const friends = world.friendsInside(b.id);
    const buddy = friends[0]?.name ?? "your circle";
    pushFeed("agent", `On it. Heading to ${b.name} — closing the loop for you.`);
    const stages: { delay: number; kind: FeedKind; text: string }[] = [
      { delay: 1200, kind: "agent", text: `DM \u{2192} ${buddy}: "Heading to ${b.name}, meet in 10?"` },
      { delay: 2600, kind: "friend", text: `${buddy}: "yess come thru \u{1F525}"` },
      { delay: 4000, kind: "cal", text: `"${b.name} w/ ${buddy}" \u{2192} Google Calendar, 6:30\u{2013}7:30 PM \u{2713}` },
    ];
    if (b.vibe === "chaos" || b.vibe === "food") {
      const social = socialRhythm(profile);
      const why = social ? `matches your "${social.label}" pref` : "looks like your kind of night";
      stages.push({
        delay: 5400, kind: "luma",
        text: `Luma: 'Open Mic @ Union, 8 PM' ${why} \u{2014} auto-RSVP'd \u{2713}`,
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

  const acceptSerendipity = (id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    pushStaged([
      { delay: 0, kind: "agent", text: "Locked it. \u{26F2} Fountain hang in 5 — telling the other 3." },
      { delay: 1400, kind: "cal", text: `"Fountain serendipity" \u{2192} Google Calendar, 20 min \u{2713}` },
    ]);
    pushToast("Serendipity accepted — see you at the fountain");
  };

  const selected = selectedId ? buildingById(selectedId) : null;
  const selectedFriends = selected ? world.friendsInside(selected.id) : [];
  const selectedOcc = selected ? world.displayOccupancy(selected) : 0;

  return (
    <div className="app">
      <div className="map-col">
        <header className="topbar">
          <span className="logo">🗺 ConnectMaxxer</span>
          <span className="tagline">the campus map that texts your friends for you</span>
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
                    <button onClick={() => acceptSerendipity(t.id)}>ACCEPT</button>
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
          <span className="legend-hint">click a building · 💤 = dead zone, go start something</span>
        </div>
      </div>

      <aside className="sidebar">
        <div className="card pref-card">
          <div className="pref-head">
            <div className="card-title">{profile.name.toUpperCase()}'S PREFERENCE GRAPH</div>
            <button className="pref-edit" onClick={onRedo}>EDIT</button>
          </div>
          <p>{prefSummary(profile)}</p>
          <p className="pref-read">Tonight's read: {vibeRead(profile)}</p>
        </div>

        {selected ? (
          <div className="card building-card">
            <div className="card-title">
              {selected.emoji} {selected.name.toUpperCase()}
            </div>
            <p>
              {selectedOcc} inside
              {selected.openSpots !== null && <> · {selected.openSpots} open tables</>}
              {selectedOcc <= 1 && <> · 💤 dead zone</>}
            </p>
            <p className="friends-line">
              {selectedFriends.length > 0
                ? `Your people: ${selectedFriends.map((f) => f.name).join(", ")}`
                : "No one from your circle here yet."}
            </p>
            <div className="btn-row">
              <button className="btn join" onClick={() => joinBuilding(selected)}>JOIN</button>
              <button className="btn create" onClick={() => createEvent(selected)}>CREATE</button>
              <button className="btn" onClick={() => setSelectedId(null)}>CLOSE</button>
            </div>
          </div>
        ) : (
          <div className="card hint-card">
            <p>Click a vibe bubble on the map. The agent handles the rest — DMs, Luma, calendar.</p>
          </div>
        )}

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
    </div>
  );
}
