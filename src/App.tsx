import { useCallback, useEffect, useRef, useState } from "react";
import { ClubDraft, ClubPortal, PopUpDraft } from "./components/ClubPortal";
import OpenNowCard from "./components/OpenNowCard";
import PointsPill from "./components/PointsPill";
import SettingsPanel from "./components/SettingsPanel";
import { draw } from "./game/render";
import { Building, Friend, H, PopUp, TILE, W, World, buildingById, fmtClock } from "./game/world";
import { enterChildren, flash, useEnter, openMenu } from "./motion";
import { NotifyRequest, Recipient, mailStatus, sendNotification } from "./notify";
import { awardAccept, breakStreak, loadRewards, saveRewards } from "./rewards";
import { describeSerendipity, generateSerendipity } from "./serendipity";
import { Settings, checkNotify, inQuietHours, loadSettings, saveSettings } from "./settings";
import { GameAction, useKeys } from "./useKeys";

type FeedKind = "agent" | "friend" | "cal" | "luma" | "alert" | "system" | "mail";

/**
 * Entries sharing a group key collapse into one journal row when they land
 * back to back. Anything without a key always stands on its own.
 */
type GroupKey = "checkin" | "mail-sim" | "mail-sent" | "mail-fail" | "packup";

interface FeedItem {
  id: number;
  kind: FeedKind;
  text: string;
  at: string;
  group?: GroupKey;
  /** The person an entry is about, used to name a collapsed group. */
  who?: string;
}

interface FeedGroup {
  id: number;
  kind: FeedKind;
  at: string;
  group?: GroupKey;
  items: FeedItem[];
}

function groupFeed(items: FeedItem[]): FeedGroup[] {
  const out: FeedGroup[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && item.group && last.group === item.group) {
      last.items.push(item);
      last.at = item.at;
    } else {
      out.push({ id: item.id, kind: item.kind, at: item.at, group: item.group, items: [item] });
    }
  }
  return out;
}

function groupNames(items: FeedItem[]): string {
  const unique = [...new Set(items.map((i) => i.who).filter(Boolean) as string[])];
  if (unique.length <= 2) return unique.join(" and ");
  return `${unique.slice(0, 2).join(", ")} and ${unique.length - 2} more`;
}

/** The one line a collapsed group shows in place of its entries. */
function summarize(g: FeedGroup): string {
  const n = g.items.length;
  switch (g.group) {
    case "checkin":
      return `${groupNames(g.items)} moved around campus — ${n} check-ins`;
    case "mail-sim":
      return `${n} emails composed but not sent — add RESEND_API_KEY to .env.`;
    case "mail-sent":
      return `${n} emails delivered.`;
    case "mail-fail":
      return `${n} emails failed to send.`;
    case "packup":
      return `${n} pop-ups packed up.`;
    case undefined:
      return g.items[0].text;
    default: {
      const never: never = g.group;
      throw new Error(`Unhandled group: ${never}`);
    }
  }
}

type ToastTone = "info" | "serendipity" | "invite";
interface Toast {
  id: number;
  text: string;
  expiresAt: number;
  tone: ToastTone;
  accept?: { label: string; run: () => void };
}

type Screen = "map" | "feed" | "clubs" | "open";
type MailStatus = "checking" | "live" | "simulated" | "offline";

const SCREENS: Screen[] = ["map", "feed", "clubs", "open"];

const SCREEN_LABEL: Record<Screen, string> = {
  map: "Map",
  feed: "Journal",
  clubs: "Clubs",
  open: "Open now",
};

const KIND_TAG: Record<FeedKind, string> = {
  agent: "AGENT",
  friend: "FRIEND",
  cal: "CAL",
  luma: "EVENT",
  alert: "MAP",
  system: "SYS",
  mail: "MAIL",
};

const MAIL_LABEL: Record<MailStatus, string> = {
  checking: "connecting",
  live: "mail live",
  simulated: "no API key",
  offline: "mail offline",
};

/** Demo time runs fast: a 60-minute pop-up occupies three minutes on screen. */
const MINUTE = 3000;
const MAX_TOASTS = 3;

let nextId = 1;

function timeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ToastRow({ toast, now }: { toast: Toast; now: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEnter(ref, { x: 16, opacity: 0 });
  const left = Math.max(0, Math.ceil((toast.expiresAt - now) / 1000));

  return (
    <div ref={ref} className={`toast ${toast.tone}`} role="status">
      <span className="toast-text">{toast.text}</span>
      {toast.accept && (
        <span className="toast-actions">
          <b>{left}s</b>
          <button className="btn gold sm" onClick={toast.accept.run}>{toast.accept.label}</button>
        </span>
      )}
    </div>
  );
}

function JournalRow({ group }: { group: FeedGroup }) {
  const [open, setOpen] = useState(false);
  const count = group.items.length;

  return (
    <article className={`feed-item ${group.kind}`}>
      <span className="feed-tag">{KIND_TAG[group.kind]}</span>
      <span className="feed-text">
        {count > 1 ? summarize(group) : group.items[0].text}
        {count > 1 && (
          <>
            <button className="feed-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? "Hide" : `Show all ${count}`}
            </button>
            {open && (
              <span className="feed-sub">
                {group.items.map((i) => (
                  <span key={i.id}>
                    {i.text} <em>{i.at}</em>
                  </span>
                ))}
              </span>
            )}
          </>
        )}
      </span>
      <span className="feed-time">{group.at}</span>
    </article>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) worldRef.current = new World(performance.now());
  const world = worldRef.current;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState(false);
  const [screen, setScreen] = useState<Screen>("map");
  const [playerEmail, setPlayerEmail] = useState("");
  const [mail, setMail] = useState<MailStatus>("checking");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [rewards, setRewards] = useState(loadRewards);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mutedCount, setMutedCount] = useState(0);
  const [, bump] = useState(0); // forces a re-render for live counts and countdowns

  const toastsRef = useRef<Toast[]>([]);
  toastsRef.current = toasts;
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const ghostRef = useRef(false);
  ghostRef.current = ghost;
  const emailRef = useRef("");
  emailRef.current = playerEmail;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const feedRef = useRef<HTMLDivElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const feedCountRef = useRef(0);
  const openedRef = useRef(false); // StrictMode remounts effects; the intro plays once

  const groups = groupFeed(feed);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveRewards(rewards), [rewards]);

  const pushFeed = useCallback(
    (kind: FeedKind, text: string, meta?: { group?: GroupKey; who?: string }) => {
      setFeed((f) => [...f, { id: nextId++, kind, text, at: timeLabel(), ...meta }]);
    },
    [],
  );

  const pushStaged = useCallback(
    (items: { delay: number; kind: FeedKind; text: string }[]) => {
      for (const it of items) setTimeout(() => pushFeed(it.kind, it.text), it.delay);
    },
    [pushFeed],
  );

  const pushToast = useCallback(
    (
      text: string,
      ttl = 6000,
      tone: ToastTone = "info",
      makeAccept?: (id: number) => Toast["accept"],
    ) => {
      const id = nextId++;
      const accept = makeAccept?.(id);
      setToasts((t) => {
        const next = [...t, { id, text, expiresAt: Date.now() + ttl, tone, accept }];
        // Keep the map readable: drop the oldest passive toast once the stack is full.
        while (next.length > MAX_TOASTS) {
          const drop = next.findIndex((x) => !x.accept);
          next.splice(drop === -1 ? 0 : drop, 1);
        }
        return next;
      });
      return id;
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  /** Who gets a copy: the named recipients, plus you unless ghost mode is on. */
  const audience = useCallback((people: Recipient[]): Recipient[] => {
    const mine = emailRef.current.trim();
    if (!mine || ghostRef.current) return people;
    return [...people, { name: "You", email: mine }];
  }, []);

  const sendMail = useCallback(
    async (req: NotifyRequest) => {
      if (req.to.length === 0) return;
      const names = req.to.map((r) => r.name).join(", ");
      const res = await sendNotification(req);
      if (res.simulated) {
        pushFeed("mail", `Email for ${names} composed but not sent \u{2014} add RESEND_API_KEY to .env.`, { group: "mail-sim" });
      } else if (res.ok) {
        pushFeed("mail", `Emailed ${names} \u{2014} "${res.subject}" delivered.`, { group: "mail-sent" });
      } else {
        pushFeed("mail", `Email to ${names} failed: ${res.error ?? "mail server error"}.`, { group: "mail-fail" });
      }
    },
    [pushFeed],
  );

  const invite = useCallback(
    (f: Friend, p: PopUp) => {
      if (!p.rsvps.includes(f.id)) p.rsvps.push(f.id);
      const b = buildingById(p.buildingId);
      pushFeed("agent", `${f.name} is in for ${p.title}. Sending both of you the details.`);
      pushToast(`${f.name} is in — ${b.name}`);
      void sendMail({
        kind: "invite",
        to: audience([{ name: f.name, email: f.email }]),
        title: p.title,
        host: p.hostName,
        place: b.name,
        perk: p.perk,
        window: "starting now",
        note: `${f.name} is already standing there. Walk over before the table packs up.`,
      });
    },
    [audience, pushFeed, pushToast, sendMail],
  );

  const announce = useCallback(
    (p: PopUp) => {
      const b = buildingById(p.buildingId);
      const matched = world.friends.filter((f) => f.hobbies.includes(p.hobby));
      const crowd = matched.length > 0 ? matched : world.friends;
      void sendMail({
        kind: "popup",
        to: audience(crowd.map((f) => ({ name: f.name, email: f.email }))),
        title: p.title,
        host: p.hostName,
        place: b.name,
        perk: p.perk,
        window: `${Math.round((p.endsAt - p.startsAt) / MINUTE)} min`,
        note: `Matched to your ${p.hobby} interest. ${world.friendsNear(p).length} people from the circle are nearby.`,
      });
    },
    [audience, sendMail, world],
  );

  // game loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      world.tick(dt, now);

      for (const ev of world.drainEvents()) {
        switch (ev.type) {
          case "arrive": {
            const f = world.friends.find((x) => x.id === ev.friendId)!;
            const b = buildingById(ev.buildingId);
            const decision = checkNotify(settingsRef.current, world.clockMin, f.id, b);
            if (!decision.ok) {
              if (decision.reason !== "private-space") setMutedCount((c) => c + 1);
              break;
            }
            const others = world.friendsInside(b.id).filter((x) => x.id !== f.id).length;
            const extra = others > 0 ? ` — ${others} other${others > 1 ? "s" : ""} from your circle there` : "";
            pushToast(`${f.name} just hit ${b.name}${extra}`);
            pushFeed("alert", `${f.name} checked in at ${b.name}${extra}.`, {
              group: "checkin",
              who: f.name,
            });
            break;
          }
          case "playerArrive": {
            const b = buildingById(ev.buildingId);
            const privacy = !b.isPublic
              ? " — private space, no one was pinged"
              : world.player.ghost
                ? " — ghost mode, no one was pinged"
                : "";
            pushToast(`You checked in at ${b.name}${privacy}`);
            break;
          }
          case "popupStart": {
            const p = world.popUps.find((x) => x.id === ev.popUpId)!;
            const b = buildingById(p.buildingId);
            flash(stageRef.current);
            pushToast(`${p.hostName} is live at ${b.name}`, 8000);
            pushFeed("luma", `${p.title} opened at ${b.name}. ${p.perk || "No perk listed."}`);
            announce(p);
            break;
          }
          case "popupEnd": {
            const p = world.popUps.find((x) => x.id === ev.popUpId)!;
            pushFeed("system", `${p.hostName} packed up at ${buildingById(p.buildingId).name}.`, {
              group: "packup",
            });
            break;
          }
          case "nearby": {
            const f = world.friends.find((x) => x.id === ev.friendId)!;
            const p = world.popUps.find((x) => x.id === ev.popUpId)!;
            if (p.rsvps.includes(f.id)) break;
            const b = buildingById(p.buildingId);
            pushToast(
              `${f.name} is at ${b.name} where ${p.hostName} is handing out ${p.perk || p.title}`,
              45000,
              "invite",
              (id) => ({
                label: `Invite ${f.name}`,
                run: () => { dismissToast(id); invite(f, p); },
              }),
            );
            break;
          }
          case "depart":
            break;
          default: {
            const never: never = ev;
            throw new Error(`Unhandled world event: ${JSON.stringify(never)}`);
          }
        }
      }

      const canvas = canvasRef.current;
      if (canvas) draw(canvas.getContext("2d")!, world, now, selectedRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [world, announce, dismissToast, invite, pushFeed, pushToast]);

  // 1s pulse: refresh counts, expire toasts
  useEffect(() => {
    const iv = setInterval(() => {
      bump((p) => p + 1);
      const at = Date.now();
      const expired = toastsRef.current.filter((x) => x.expiresAt <= at);
      if (expired.length === 0) return;
      for (const e of expired) {
        if (e.tone === "serendipity") {
          pushFeed("system", "The serendipity window vanished. Streak reset — next one soon.");
          setRewards((r) => breakStreak(r));
        }
      }
      setToasts((t) => t.filter((x) => x.expiresAt > at));
    }, 1000);
    return () => clearInterval(iv);
  }, [pushFeed]);

  useEffect(() => {
    void mailStatus().then((s) => setMail(s));
  }, []);

  // opening beats
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    pushStaged([
      { delay: 400, kind: "agent", text: "Morning read: 2 friends free after 6, Moffitt 3rd has open tables, three pop-ups scheduled on the quad." },
      { delay: 1600, kind: "agent", text: "Tonight's vibe forecast: board-game energy, not leetcode." },
    ]);
  }, [pushStaged]);

  // Recurring interest-matched hangouts from the incoming serendipity engine.
  useEffect(() => {
    let timer = 0;
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        const s = settingsRef.current;
        if (s.notifsOn && !inQuietHours(world.clockMin, s.quiet)) {
          const event = generateSerendipity(world, s.hobbies);
          if (event) {
            const building = buildingById(event.buildingId);
            pushToast(
              describeSerendipity(event, building.name),
              60000,
              "serendipity",
              (id) => ({
                label: "Accept",
                run: () => {
                  dismissToast(id);
                  world.sendPlayerTo(building.id);
                  setRewards((current) => awardAccept(
                    current,
                    event.people.map((person) => person.id),
                  ).next);
                  const people = event.people.map((person) => person.name).join(" & ");
                  pushFeed("agent", `Locked it. Telling ${people} you're coming — intros handled.`);
                  pushToast(`Serendipity accepted — heading to ${building.name}`);
                },
              }),
            );
          }
        }
        schedule(55000 + Math.random() * 30000);
      }, delay);
    };
    schedule(25000);
    return () => clearTimeout(timer);
  }, [dismissToast, pushFeed, pushToast, world]);

  // Only brand-new rows animate; entries folded into an existing group do not.
  useEffect(() => {
    const added = groups.length - feedCountRef.current;
    feedCountRef.current = groups.length;
    if (screen !== "feed" || added <= 0) return;
    enterChildren(feedRef.current, ".feed-item", added);
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groups.length, screen]);

  useEffect(() => {
    if (screen !== "map") openMenu(menuRef.current);
  }, [screen]);

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

  const joinBuilding = useCallback((b: Building) => {
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
      { delay: 2600, kind: "friend", text: `${buddy}: "yess come thru"` },
      { delay: 4000, kind: "cal", text: `"${b.name} w/ ${buddy}" \u{2192} Google Calendar, 6:30\u{2013}7:30 PM` },
    ];
    if (b.vibe === "study") {
      stages.push({ delay: 5400, kind: "agent", text: `Held a table at ${b.name} for 25 min. Releases automatically if you no-show.` });
    }
    pushStaged(stages);

    const p = world.popUpAt(b.id);
    if (p) {
      pushFeed("luma", `${p.hostName} is still set up there — ${p.perk || p.title}.`);
      for (const f of friends) invite(f, p);
    }
  }, [invite, pushFeed, pushStaged, world]);

  const createEvent = (b: Building) => {
    pushFeed("agent", `Drafting a pickup event at ${b.name}...`);
    pushStaged([
      { delay: 1300, kind: "luma", text: `Created Luma: "Pickup @ ${b.name}, 7 PM" — invite sent to your circle` },
      { delay: 2600, kind: "friend", text: `Priya: "omg yes" \u{00B7} Dev: "in"` },
      { delay: 3900, kind: "cal", text: "Added to Google Calendar + 2 friends' calendars" },
    ]);
    pushToast(`Event drafted at ${b.name} — circle pinged`);
  };

  const toggleGhost = useCallback(() => {
    const g = !ghostRef.current;
    setGhost(g);
    world.player.ghost = g;
    pushFeed(
      "system",
      g
        ? "Ghost mode ON. You're off the map and off the email list. Alerts still reach you here."
        : "Ghost mode OFF. Back on the map, invites route to your inbox again.",
    );
  }, [pushFeed, world]);

  const togglePlaceMute = (building: Building) => {
    setSettings((current) => ({
      ...current,
      mutedPlaces: current.mutedPlaces.includes(building.id)
        ? current.mutedPlaces.filter((id) => id !== building.id)
        : [...current.mutedPlaces, building.id],
    }));
  };

  const signUpClub = (draft: ClubDraft) => {
    const club = world.addClub(draft);
    bump((p) => p + 1);
    pushFeed("agent", `${club.name} is on the map under ${club.hobby}.`);
    pushToast(`${club.name} listed`);
    void sendMail({
      kind: "club-signup",
      to: [{ name: club.name, email: club.email }],
      title: club.name,
      host: club.name,
      place: "Campus map",
      note: `Students who follow ${club.hobby} now see you when you run a pop-up. Post one from the club portal and everyone nearby gets an email.`,
    });
  };

  const postPopUp = (draft: PopUpDraft) => {
    const club = world.clubs.find((c) => c.id === draft.clubId)!;
    const now = performance.now();
    world.schedulePopUp({
      hostId: club.id,
      hostName: club.name,
      kind: "club",
      title: draft.title,
      perk: draft.perk,
      buildingId: draft.buildingId,
      emoji: club.emoji,
      color: club.color,
      hobby: club.hobby,
      startsAt: now,
      endsAt: now + draft.minutes * MINUTE,
    });
    bump((p) => p + 1);
    pushFeed("agent", `${club.name} pop-up queued at ${buildingById(draft.buildingId).name}.`);
  };

  const handleAction = useCallback(
    (action: GameAction) => {
      const step = (delta: number) =>
        setScreen((s) => SCREENS[(SCREENS.indexOf(s) + delta + SCREENS.length) % SCREENS.length]);

      switch (action) {
        case "prev":
          step(-1);
          break;
        case "next":
          step(1);
          break;
        case "up":
        case "down": {
          const dir = action === "up" ? -1 : 1;
          if (screen === "map") {
            // Walk the selection cursor around the buildings.
            setSelectedId((cur) => {
              const ids = world.buildings.map((b) => b.id);
              if (cur === null) return dir > 0 ? ids[0] : ids[ids.length - 1];
              return ids[(ids.indexOf(cur) + dir + ids.length) % ids.length];
            });
          } else {
            menuRef.current?.querySelector(".scroll")?.scrollBy({ top: dir * 140, behavior: "smooth" });
          }
          break;
        }
        case "confirm": {
          const actionable = toastsRef.current.find((t) => t.accept);
          if (actionable) actionable.accept!.run();
          else if (screen === "map" && selectedRef.current) {
            joinBuilding(buildingById(selectedRef.current));
          }
          break;
        }
        case "cancel": {
          if (screen !== "map") setScreen("map");
          else if (selectedRef.current) setSelectedId(null);
          else {
            const top = toastsRef.current[toastsRef.current.length - 1];
            if (top) dismissToast(top.id);
          }
          break;
        }
        case "ghost":
          toggleGhost();
          break;
        default: {
          const never: never = action;
          throw new Error(`Unhandled action: ${never}`);
        }
      }
    },
    [dismissToast, joinBuilding, screen, toggleGhost, world],
  );

  useKeys(handleAction);

  const selected = selectedId ? buildingById(selectedId) : null;
  const selectedFriends = selected ? world.friendsInside(selected.id) : [];
  const selectedOcc = selected ? world.displayOccupancy(selected) : 0;
  const selectedPopUp = selected ? world.popUpAt(selected.id) : undefined;
  const selectedOpen = selected ? world.isOpen(selected) : false;
  const playerHere = !!selected && world.player.state === "inside" && world.player.buildingId === selected.id;
  const playerEnRoute = !!selected && world.player.state === "walking" && world.player.buildingId === selected.id;
  const live = world.livePopUps();
  const now = Date.now();

  /*
   * Invites expire in 45 seconds, so the stack follows you: it floats over the
   * map, and docks inside a menu window rather than hiding behind it.
   */
  const toastStack = (
    <div className={`toasts ${screen === "map" ? "" : "docked"}`}>
      {toasts.map((toast) => <ToastRow key={toast.id} toast={toast} now={now} />)}
    </div>
  );

  return (
    <div className="game">
      <div className="stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={onCanvasClick}
          className="map-canvas"
        />

        {screen === "map" && toastStack}

        {selected && screen === "map" && (
          <div className="dialogue">
            <h2>{selected.name}</h2>
            <p className="place-status">
              {selected.isPublic
                ? selectedOpen
                  ? `Open · closes ${fmtClock(selected.closeMin)}`
                  : `Closed · opens ${fmtClock(selected.openMin)}`
                : "Private space — check-ins never notify anyone"}
            </p>
            <p>
              {selectedOcc} inside
              {selected.openSpots !== null && selectedOpen && <> · {selected.openSpots} open spots</>}
              {selectedOcc <= 1 && <> · quiet right now</>}
            </p>
            <p>
              {selectedFriends.length > 0
                ? `Your people: ${selectedFriends.map((f) => f.name).join(", ")}`
                : "No one from your circle here yet."}
            </p>
            {selectedPopUp && (
              <p className="dialogue-perk">
                {selectedPopUp.hostName} — {selectedPopUp.perk || selectedPopUp.title}
              </p>
            )}
            <div className="dialogue-actions">
              <button
                className="btn gold"
                onClick={() => joinBuilding(selected)}
                disabled={!selectedOpen || playerHere || playerEnRoute}
              >
                {playerHere ? "You're here" : playerEnRoute ? "En route…" : "Walk over"} <kbd>Enter</kbd>
              </button>
              <button className="btn" onClick={() => createEvent(selected)}>Start something</button>
              {selected.isPublic && (
                <button className="btn quiet" onClick={() => togglePlaceMute(selected)}>
                  {settings.mutedPlaces.includes(selected.id) ? "Unmute place" : "Mute place"}
                </button>
              )}
              <button className="btn quiet" onClick={() => setSelectedId(null)}>
                Close <kbd>Esc</kbd>
              </button>
            </div>
          </div>
        )}

        {screen !== "map" && (
          <>
            <button
              className="scrim"
              aria-label="Close menu"
              onClick={() => setScreen("map")}
            />
            <section className="menu" ref={menuRef} aria-label={SCREEN_LABEL[screen]}>
              <header className="menu-head">
                <h2>
                  {screen === "feed" ? "Journal" : screen === "clubs" ? "Club board" : "Open now"}
                </h2>
                <button className="btn quiet sm" onClick={() => setScreen("map")}>
                  Close <kbd>Esc</kbd>
                </button>
              </header>

              {toasts.length > 0 && toastStack}

              {screen === "feed" && (
                <div className="scroll" ref={feedRef}>
                  {groups.length === 0 ? (
                    <p className="empty">Nothing in the journal yet.</p>
                  ) : (
                    groups.map((g) => <JournalRow key={g.id} group={g} />)
                  )}
                  <div ref={feedEndRef} />
                </div>
              )}

              {screen === "clubs" && (
                <div className="scroll">
                  <ClubPortal
                    clubs={world.clubs}
                    buildings={world.buildings}
                    livePopUps={live}
                    playerEmail={playerEmail}
                    onPlayerEmail={setPlayerEmail}
                    onSignUpClub={signUpClub}
                    onPostPopUp={postPopUp}
                  />
                </div>
              )}

              {screen === "open" && (
                <div className="scroll">
                  <OpenNowCard
                    world={world}
                    onSelect={(id) => {
                      setSelectedId(id);
                      setScreen("map");
                    }}
                    onGo={(building) => {
                      setSelectedId(building.id);
                      setScreen("map");
                      joinBuilding(building);
                    }}
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <footer className="toolbar">
        <span className="sign">ConnectMaxxer</span>

        <nav className="slots" aria-label="Screens">
          {SCREENS.map((s) => (
            <button
              key={s}
              className={`slot ${screen === s ? "on" : ""}`}
              aria-current={screen === s ? "page" : undefined}
              onClick={() => setScreen(s)}
            >
              {SCREEN_LABEL[s]}
              {s === "feed" && groups.length > 0 && <b className="badge">{groups.length}</b>}
              {s === "clubs" && live.length > 0 && <b className="badge">{live.length}</b>}
            </button>
          ))}
        </nav>

        <div className="status">
          <span className="clock">{fmtClock(world.clockMin)}</span>
          <PointsPill rewards={rewards} />
          <button className="btn quiet sm" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button
            className={`btn quiet sm ${ghost ? "on" : ""}`}
            aria-pressed={ghost}
            onClick={toggleGhost}
          >
            Ghost <kbd>G</kbd>
          </button>
          <span className={`lamp ${mail}`} title={MAIL_LABEL[mail]}>
            <i aria-hidden="true" />
            {MAIL_LABEL[mail]}
          </span>
        </div>
      </footer>

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
