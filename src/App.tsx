import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { draw } from "./game/render";
import { Building, H, TILE, W, World, buildingById } from "./game/world";
import PhonePanel, { CreatorPrefill } from "./messages/PhonePanel";
import { CANDIDATES, HISTORY } from "./messages/history";
import { createRealEvent, fetchEvent, Mutual, PartifulEvent } from "./messages/partiful";
import { names, recommend } from "./messages/recommend";
import {
  AppNotification, CreatorCategory, EventCategory, EventSource,
  LiveEvent, Recommendation, Thread,
} from "./messages/types";

interface Toast {
  id: string;
  text: string;
  expiresAt: number;
}

interface Ticker {
  text: string;
  until: number;
}

const VIBE_TO_CREATOR: Record<string, CreatorCategory> = {
  gym: "sports",
  study: "hangout",
  food: "hangout",
  chaos: "party",
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) worldRef.current = new World(performance.now());
  const world = worldRef.current;

  const [now, setNow] = useState(Date.now());
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState(false);
  const [creatorPrefill, setCreatorPrefill] = useState<CreatorPrefill | null>(null);
  const [focusThread, setFocusThread] = useState<{ id: string; nonce: number } | null>(null);

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const idRef = useRef(1);
  const uid = useCallback(() => String(idRef.current++), []);
  // quick-action handlers live outside React state; dispatcher passes the notif id back in
  const handlersRef = useRef<Record<string, (actionId: string, notifId: string) => void>>({});

  // ---- notification bus --------------------------------------------------

  const toast = useCallback((text: string, ttl = 6000) => {
    const id = uid();
    setToasts((t) => [...t, { id, text, expiresAt: Date.now() + ttl }]);
  }, [uid]);

  const say = useCallback((text: string, ms = 4500) => {
    setTicker({ text, until: Date.now() + ms });
  }, []);

  const notify = useCallback(
    (
      n: Omit<AppNotification, "id">,
      opts?: { toast?: boolean; onAction?: (actionId: string, notifId: string) => void },
    ) => {
      const id = uid();
      setNotifs((list) => [...list, { ...n, id }]);
      if (opts?.onAction) handlersRef.current[id] = opts.onAction;
      if (opts?.toast) toast(`${n.title}: ${n.body}`.slice(0, 90));
      return id;
    },
    [uid, toast],
  );

  const dismissNotif = useCallback((id: string) => {
    setNotifs((list) => list.filter((n) => n.id !== id));
    delete handlersRef.current[id];
  }, []);

  // ---- threads -------------------------------------------------------------

  const ensureThread = useCallback(
    (id: string, title: string, category: EventCategory, source?: EventSource) => {
      setThreads((ts) =>
        ts.some((t) => t.id === id)
          ? ts
          : [...ts, { id, title, category, source, messages: [], receipts: [], typing: null }],
      );
    },
    [],
  );

  const setTyping = useCallback((threadId: string, name: string | null) => {
    setThreads((ts) => ts.map((t) => (t.id === threadId ? { ...t, typing: name } : t)));
  }, []);

  const addMsg = useCallback((threadId: string, from: string, text: string) => {
    const outgoing = from === "agent" || from === "you";
    const msgId = idRef.current++;
    setThreads((ts) =>
      ts.map((t) => {
        if (t.id !== threadId) return t;
        // a friend reply means your earlier messages were read
        const messages = outgoing
          ? t.messages
          : t.messages.map((m) => (m.status ? { ...m, status: "read" as const } : m));
        return {
          ...t,
          typing: outgoing ? t.typing : null,
          messages: [
            ...messages,
            { id: msgId, from, text, at: Date.now(), status: outgoing ? "sent" : undefined },
          ],
        };
      }),
    );
    if (outgoing) {
      setTimeout(() => {
        setThreads((ts) =>
          ts.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === msgId && m.status === "sent" ? { ...m, status: "delivered" } : m,
                  ),
                }
              : t,
          ),
        );
      }, 900);
    }
  }, []);

  const addReceipt = useCallback((threadId: string, label: string) => {
    setThreads((ts) =>
      ts.map((t) =>
        t.id === threadId
          ? { ...t, receipts: [...t.receipts, { id: idRef.current++, label }] }
          : t,
      ),
    );
  }, []);

  const setLive = useCallback((threadId: string, patch: Partial<LiveEvent>) => {
    setThreads((ts) =>
      ts.map((t) =>
        t.id === threadId && t.live ? { ...t, live: { ...t.live, ...patch } } : t,
      ),
    );
  }, []);

  // ---- live Partiful event tracking (real, confirmed read endpoints) --------

  const pollTimers = useRef<Record<string, number>>({});

  const applyEvent = useCallback(
    (threadId: string, e: PartifulEvent) => {
      setThreads((ts) =>
        ts.map((t) =>
          t.id === threadId
            ? {
                ...t,
                live: {
                  url: e.url, eventId: e.eventId, title: e.title, when: e.when,
                  going: e.going, maybe: e.maybe, invited: e.invited,
                  guests: e.guests, updatedAt: Date.now(), loading: false,
                },
              }
            : t,
        ),
      );
    },
    [],
  );

  const connectEvent = useCallback(
    (threadId: string, urlOrId: string) => {
      setThreads((ts) =>
        ts.map((t) =>
          t.id === threadId
            ? {
                ...t,
                live: {
                  url: urlOrId, eventId: "", title: t.title, when: null,
                  going: 0, maybe: 0, invited: 0, guests: [],
                  updatedAt: 0, loading: true,
                },
              }
            : t,
        ),
      );
      const run = () =>
        fetchEvent(urlOrId).then((e) => {
          if (e) applyEvent(threadId, e);
          else setLive(threadId, { loading: false, error: "Couldn't load this event. Is the proxy connected to Partiful?" });
        });
      run();
      window.clearInterval(pollTimers.current[threadId]);
      pollTimers.current[threadId] = window.setInterval(run, 5000);
    },
    [applyEvent, setLive],
  );

  useEffect(() => {
    const timers = pollTimers.current;
    return () => Object.values(timers).forEach((id) => window.clearInterval(id));
  }, []);

  /** One event = one thread: staged bubbles, typing indicators, receipt chips. */
  const stageThread = useCallback(
    (
      threadId: string,
      msgs: { delay: number; from: string; text: string }[],
      receipts: { delay: number; label: string }[] = [],
    ) => {
      let prevDelay = 0;
      for (const m of msgs) {
        const isFriend = m.from !== "agent" && m.from !== "you";
        if (isFriend) {
          // show "typing..." dots before the reply lands
          const typingAt = Math.max(prevDelay + 150, m.delay - 1300);
          setTimeout(() => setTyping(threadId, m.from), typingAt);
        }
        setTimeout(() => addMsg(threadId, m.from, m.text), m.delay);
        prevDelay = m.delay;
      }
      for (const r of receipts) setTimeout(() => addReceipt(threadId, r.label), r.delay);
    },
    [addMsg, addReceipt, setTyping],
  );

  // ---- recommendation engine over imported history -------------------------

  const recs = useMemo(() => recommend(HISTORY, CANDIDATES), []);
  const digest = useMemo(() => recs.filter((r) => r.decision === "digest"), [recs]);
  const muted = useMemo(() => recs.filter((r) => r.decision === "silent"), [recs]);

  const acceptInvite = useCallback(
    (rec: Recommendation, notifId: string) => {
      dismissNotif(notifId);
      const e = rec.event;
      ensureThread(e.id, e.title, e.category, e.source);
      setFocusThread({ id: e.id, nonce: Date.now() });
      say("RSVPing on Partiful + inviting your crew...");
      const crew = names(rec.autoInvite);
      stageThread(
        e.id,
        [
          { delay: 200, from: "agent", text: `RSVP'd you on Partiful for "${e.title}" (${e.when}).` },
          { delay: 1300, from: "agent", text: `Auto-invited your watch-party crew: ${crew} — they co-attended your last ${rec.autoInvite.length}+ parties.` },
          { delay: 2800, from: "Maya", text: "YESSS ok locking in snacks" },
          { delay: 4000, from: "Sam", text: "bringing the projector \u{1F525}" },
        ],
        [
          { delay: 600, label: "Partiful RSVP" },
          { delay: 1600, label: `Crew invited (${rec.autoInvite.length})` },
          { delay: 3400, label: "GCal" },
        ],
      );
      toast(`You're in — ${e.title}`);
    },
    [dismissNotif, ensureThread, say, stageThread, toast],
  );

  const joinQuorum = useCallback(
    (rec: Recommendation, notifId: string) => {
      dismissNotif(notifId);
      const e = rec.event;
      ensureThread(e.id, e.title, e.category, e.source);
      setFocusThread({ id: e.id, nonce: Date.now() });
      say("Locking your spot + pinging the roster...");
      stageThread(
        e.id,
        [
          { delay: 200, from: "agent", text: `You're in — roster is now full (4/4). Told ${names(rec.autoInvite)}.` },
          { delay: 1600, from: "Dev", text: "ez. bringing paddles" },
          { delay: 2800, from: "Jordan", text: "loser buys celsius" },
        ],
        [
          { delay: 600, label: "Doorlist spot" },
          { delay: 1800, label: "Roster 4/4" },
          { delay: 3000, label: "GCal" },
        ],
      );
      toast("Pickleball roster filled — 5 PM");
    },
    [dismissNotif, ensureThread, say, stageThread, toast],
  );

  const claimDrop = useCallback(
    (rec: Recommendation, notifId: string) => {
      dismissNotif(notifId);
      const e = rec.event;
      ensureThread(e.id, e.title, e.category, e.source);
      setFocusThread({ id: e.id, nonce: Date.now() });
      say("Claiming before it vanishes...");
      stageThread(
        e.id,
        [
          { delay: 200, from: "agent", text: `Claimed. Sam is already at Sproul — you have ~15 min.` },
          { delay: 1500, from: "Sam", text: "grabbed u a peach vibe one" },
        ],
        [{ delay: 700, label: "Spot held" }],
      );
      toast("Celsius claimed — Sproul steps");
    },
    [dismissNotif, ensureThread, say, stageThread, toast],
  );

  const pushRec = useCallback(
    (rec: Recommendation) => {
      const e = rec.event;
      if (e.category === "party") {
        notify(
          {
            kind: "invite",
            title: "Partiful invite",
            body: `${e.title} \u{00B7} ${e.when} — ${rec.reason}`,
            source: e.source,
            category: e.category,
            actions: [
              { id: "accept", label: "I'M IN" },
              { id: "skip", label: "SKIP" },
            ],
          },
          {
            toast: true,
            onAction: (a, nid) => {
              if (a === "accept") acceptInvite(rec, nid);
              else dismissNotif(nid);
            },
          },
        );
      } else if (e.category === "sports") {
        notify(
          {
            kind: "quorum",
            title: `Needs ${e.spotsNeeded ?? 1} more`,
            body: `${e.title} \u{00B7} ${e.when} — ${names(e.friendsGoing)} already in`,
            source: e.source,
            category: e.category,
            actions: [{ id: "join", label: "FILL IT" }],
          },
          {
            toast: true,
            onAction: (a, nid) => {
              if (a === "join") joinQuorum(rec, nid);
            },
          },
        );
      } else {
        // pop-ups and brand drops: time-boxed push
        notify(
          {
            kind: "popup",
            title: e.category === "brand" ? "Brand drop nearby" : "Pop-up nearby",
            body: `${e.title} \u{00B7} ${e.when} — ${rec.reason}`,
            source: e.source,
            category: e.category,
            expiresAt: Date.now() + (e.expiresInSec ?? 60) * 1000,
            ttlMs: (e.expiresInSec ?? 60) * 1000,
            actions: [{ id: "claim", label: "CLAIM" }],
          },
          {
            toast: true,
            onAction: (a, nid) => {
              if (a === "claim") claimDrop(rec, nid);
            },
          },
        );
      }
    },
    [notify, acceptInvite, joinQuorum, claimDrop, dismissNotif],
  );

  // ---- game loop -----------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      world.tick(dt, t);
      for (const ev of world.drainEvents()) {
        if (ev.type === "arrive") {
          const f = world.friends.find((x) => x.id === ev.friendId)!;
          const b = buildingById(ev.buildingId);
          const others = world.friendsInside(b.id).filter((x) => x.id !== f.id).length;
          const extra = others > 0 ? ` — ${others} other${others > 1 ? "s" : ""} from your circle there` : "";
          notify(
            { kind: "presence", title: `${f.name} checked in`, body: `${b.name}${extra}` },
            { toast: true },
          );
        } else if (ev.type === "playerArrive") {
          toast(`You checked in at ${buildingById(ev.buildingId).name}`);
        }
      }
      draw(ctx, world, t, selectedRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world, notify, toast]);

  // ---- 1s pulse: clock, countdowns, expiry ----------------------------------

  useEffect(() => {
    const iv = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setToasts((list) => list.filter((x) => x.expiresAt > t));
      setTicker((tk) => (tk && tk.until > t ? tk : null));
      setNotifs((list) => {
        const expired = list.filter((n) => n.expiresAt && n.expiresAt <= t);
        for (const n of expired) {
          delete handlersRef.current[n.id];
          toast(`\u{1F4A8} Gone: ${n.body.split("\u{00B7}")[0].trim()}`);
        }
        return list.filter((n) => !n.expiresAt || n.expiresAt > t);
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [toast]);

  // ---- demo schedule ---------------------------------------------------------

  useEffect(() => {
    const timers: number[] = [];
    for (const rec of recs) {
      if (rec.decision !== "push") continue;
      timers.push(window.setTimeout(() => pushRec(rec), rec.event.demoAt));
    }
    // serendipity: vanishing micro-event
    timers.push(
      window.setTimeout(() => {
        notify(
          {
            kind: "popup",
            title: "Serendipity",
            body: "3 people free near the fountain \u{00B7} 20-min window",
            category: "popup",
            expiresAt: Date.now() + 60000,
            ttlMs: 60000,
            actions: [{ id: "accept", label: "ACCEPT" }],
          },
          {
            toast: true,
            onAction: (_a, nid) => {
              dismissNotif(nid);
              ensureThread("serendipity", "Fountain serendipity", "popup");
              setFocusThread({ id: "serendipity", nonce: Date.now() });
              stageThread(
                "serendipity",
                [{ delay: 200, from: "agent", text: "Locked it. Fountain in 5 — telling the other 3." }],
                [{ delay: 800, label: "GCal (20 min)" }],
              );
              toast("Serendipity accepted — fountain in 5");
            },
          },
        );
      }, 36000),
    );
    return () => timers.forEach(clearTimeout);
  }, [recs, pushRec, notify, dismissNotif, ensureThread, stageThread, toast]);

  // ---- map interactions --------------------------------------------------------

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
    const buddy = world.friendsInside(b.id)[0]?.name ?? "your circle";
    say(`Walking you to ${b.name} \u{00B7} DMing ${buddy}...`, 6000);
    const threadId = `join-${b.id}`;
    ensureThread(threadId, `${b.name} w/ ${buddy}`, b.vibe === "gym" ? "gym" : b.vibe === "study" ? "hobby" : "party");
    const msgs = [
      { delay: 300, from: "agent", text: `Heading to ${b.name} — told ${buddy} you're 5 min out.` },
      { delay: 1800, from: buddy, text: "yess come thru \u{1F525}" },
    ];
    const receipts = [{ delay: 2600, label: "GCal 6:30\u{2013}7:30" }];
    if (b.vibe === "study") receipts.push({ delay: 3400, label: "Table held 25 min" });
    if (b.vibe === "chaos" || b.vibe === "food") receipts.push({ delay: 3400, label: "Luma RSVP" });
    stageThread(threadId, msgs, receipts);
  };

  const openCreator = (b: Building) => {
    setCreatorPrefill({
      title: `Pickup @ ${b.name}`,
      category: VIBE_TO_CREATOR[b.vibe] ?? "hangout",
      nonce: Date.now(),
    });
  };

  const createEvent = (
    title: string,
    category: CreatorCategory,
    invitees: Mutual[],
    when: string,
    location: string,
    eventUrl?: string,
  ) => {
    const inviteeNames = invitees.map((m) => m.name);
    const threadId = `create-${idRef.current++}`;
    const cat: EventCategory =
      category === "party" ? "party" : category === "sports" ? "sports" : category === "popup" ? "popup" : "hobby";
    ensureThread(threadId, title, cat, "partiful");
    setThreads((ts) =>
      ts.map((t) => (t.id === threadId ? { ...t, invitees: inviteeNames } : t)),
    );
    setFocusThread({ id: threadId, nonce: Date.now() });

    if (eventUrl && eventUrl.trim()) {
      say("Connecting your existing Partiful...", 5000);
      connectEvent(threadId, eventUrl.trim());
      addMsg(
        threadId,
        "agent",
        "Connected your real Partiful link — tracking RSVPs live. Existing-event mode does not resend invites.",
      );
    } else {
      say("Creating a real Partiful + sending invites...", 8000);
      addMsg(
        threadId,
        "agent",
        `Creating on Partiful for ${new Date(when).toLocaleString()} at ${location}. Inviting ${inviteeNames.length}: ${inviteeNames.join(", ") || "no one selected"}.`,
      );
      createRealEvent(
        title,
        when,
        location,
        invitees.map((m) => m.id),
      ).then((e) => {
        if (e) {
          applyEvent(threadId, e);
          addReceipt(threadId, "Real Partiful created");
          addReceipt(threadId, `Real invites sent (${invitees.length})`);
          addMsg(
            threadId,
            "agent",
            `Done. Your real link is ${e.url}. Live RSVPs will update below every 5 seconds.`,
          );
          connectEvent(threadId, e.url);
          toast(`Real Partiful created · ${invitees.length} invited`);
        } else {
          addMsg(
            threadId,
            "agent",
            "Partiful rejected event creation. No event or invites were sent. Paste an existing Partiful link above to continue.",
          );
          toast("Partiful creation failed — nothing was sent");
        }
      });
    }
  };

  const toggleGhost = () => {
    const g = !ghost;
    setGhost(g);
    world.player.ghost = g;
    notify({
      kind: "system",
      title: g ? "Ghost mode ON" : "Ghost mode OFF",
      body: g
        ? "Invisible on the map. Alerts still on. This session won't train your preference graph."
        : "Back on the map.",
    });
  };

  const onNotifAction = (notifId: string, actionId: string) => {
    handlersRef.current[notifId]?.(actionId, notifId);
  };

  /** Demo/testing control: re-fire every push-tier recommendation. */
  const replayPushes = () => {
    for (const rec of recs) {
      if (rec.decision === "push") pushRec(rec);
    }
    say("Replaying incoming pushes...");
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
          <canvas ref={canvasRef} width={W} height={H} onClick={onCanvasClick} className="map-canvas" />
          <div className="toasts">
            {toasts.map((t) => (
              <div key={t.id} className="toast">
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`ticker ${ticker ? "live" : ""}`}>
          {"\u{1F916}"} {ticker ? ticker.text : "watching the map \u{00B7} pings only when it matters"}
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
          <div className="card-title">PREFERENCE GRAPH</div>
          <p>Deep work Mon AM · social Thu PM · never gym after 9.</p>
          <p className="pref-read">Tonight's read: 🎲 board-game energy</p>
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
              <button className="btn create" onClick={() => openCreator(selected)}>CREATE</button>
              <button className="btn" onClick={() => setSelectedId(null)}>CLOSE</button>
            </div>
          </div>
        ) : (
          <div className="card hint-card">
            <p>Click a vibe bubble to join or create. Everything else lands on the phone — invites, quorums, drops.</p>
          </div>
        )}

        <PhonePanel
          notifs={notifs}
          digest={digest}
          muted={muted}
          threads={threads}
          now={now}
          onAction={onNotifAction}
          onDismiss={dismissNotif}
          onCreate={createEvent}
          onConnectEvent={connectEvent}
          creatorPrefill={creatorPrefill}
          focusThread={focusThread}
          onReplay={replayPushes}
        />
      </aside>
    </div>
  );
}
