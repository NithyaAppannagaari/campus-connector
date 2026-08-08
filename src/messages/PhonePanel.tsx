import { useEffect, useRef, useState } from "react";
import { NAME_COLOR } from "./history";
import { fetchMutuals, Mutual } from "./partiful";
import {
  AppNotification, CATEGORY_META, CREATOR_META, CreatorCategory,
  Recommendation, SOURCE_META, Thread, ThreadMessage,
} from "./types";

export interface CreatorPrefill {
  title: string;
  category: CreatorCategory;
  nonce: number;
}

interface Props {
  notifs: AppNotification[];
  digest: Recommendation[];
  muted: Recommendation[];
  threads: Thread[];
  now: number;
  onAction: (notifId: string, actionId: string) => void;
  onDismiss: (notifId: string) => void;
  onCreate: (
    title: string,
    category: CreatorCategory,
    invitees: Mutual[],
    when: string,
    location: string,
    eventUrl?: string,
  ) => void;
  onConnectEvent: (threadId: string, url: string) => void;
  creatorPrefill: CreatorPrefill | null;
  focusThread: { id: string; nonce: number } | null;
  onReplay: () => void;
}

type Tab = "pings" | "chats" | "create";

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Avatar({ name }: { name: string }) {
  if (name === "agent") {
    return <span className="avatar agent-avatar">{"\u{1F916}"}</span>;
  }
  const color = NAME_COLOR[name] ?? "#6f7fd6";
  return (
    <span className="avatar" style={{ background: color }}>
      {name[0]}
    </span>
  );
}

function Ticks({ m }: { m: ThreadMessage }) {
  if (!m.status) return null;
  return (
    <span className={`ticks ${m.status}`}>
      {m.status === "sent" ? "\u2713" : "\u2713\u2713"}
    </span>
  );
}

export default function PhonePanel({
  notifs, digest, muted, threads, now,
  onAction, onDismiss, onCreate, onConnectEvent, creatorPrefill, focusThread, onReplay,
}: Props) {
  const [tab, setTab] = useState<Tab>("pings");
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CreatorCategory>("party");
  const [eventUrl, setEventUrl] = useState("");
  const [connectUrl, setConnectUrl] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setHours(19, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState("Student Union");
  const bubblesEndRef = useRef<HTMLDivElement>(null);

  // real (or mock) Partiful mutuals for the invite picker
  const [mutuals, setMutuals] = useState<Mutual[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loadingMutuals, setLoadingMutuals] = useState(false);
  const loadedRef = useRef(false);

  const loadMutuals = () => {
    setLoadingMutuals(true);
    fetchMutuals(15).then((r) => {
      setMutuals(r.mutuals);
      setConnected(r.connected);
      // pre-check your top 5 mutuals
      setPicked(new Set(r.mutuals.slice(0, 5).map((m) => m.id)));
      setLoadingMutuals(false);
    });
  };

  useEffect(() => {
    if (tab === "create" && !loadedRef.current) {
      loadedRef.current = true;
      loadMutuals();
    }
  }, [tab]);

  // building CREATE button routes here with a prefill
  useEffect(() => {
    if (creatorPrefill) {
      setTab("create");
      setTitle(creatorPrefill.title);
      setCategory(creatorPrefill.category);
    }
  }, [creatorPrefill]);

  // accepting an invite / creating an event jumps straight into that thread
  useEffect(() => {
    if (focusThread) {
      setTab("chats");
      setOpenThreadId(focusThread.id);
    }
  }, [focusThread]);

  const openThread = threads.find((t) => t.id === openThreadId) ?? null;

  // mark open thread as read + keep it scrolled to the newest bubble
  useEffect(() => {
    if (openThread) {
      setSeen((s) =>
        s[openThread.id] === openThread.messages.length
          ? s
          : { ...s, [openThread.id]: openThread.messages.length },
      );
      bubblesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [openThread, openThread?.messages.length, openThread?.typing]);

  const unreadFor = (t: Thread) => Math.max(0, t.messages.length - (seen[t.id] ?? 0));
  const totalUnread = threads.reduce((s, t) => s + unreadFor(t), 0);
  const pickedMutuals = mutuals.filter((m) => picked.has(m.id));

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = () => {
    if (!title.trim()) return;
    onCreate(
      title.trim(),
      category,
      pickedMutuals,
      when,
      location.trim(),
      eventUrl.trim() || undefined,
    );
    setTitle("");
    setEventUrl("");
  };

  return (
    <div className="phone">
      <div className="phone-top">
        <span className="phone-signal">
          <i /><i /><i /><i className="dim" />
        </span>
        <span className="phone-brand">MESSAGES</span>
        <span className="phone-right">
          <button className="replay-btn" title="Replay incoming pushes (demo)" onClick={onReplay}>
            {"\u21BB"}
          </button>
          <span className="phone-clock">
            {new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </span>
      </div>

      <div className="phone-tabs">
        <button className={tab === "pings" ? "on" : ""} onClick={() => setTab("pings")}>
          PINGS{notifs.length > 0 && <i>{notifs.length}</i>}
        </button>
        <button
          className={tab === "chats" ? "on" : ""}
          onClick={() => { setTab("chats"); setOpenThreadId(null); }}
        >
          CHATS{totalUnread > 0 && <i>{totalUnread}</i>}
        </button>
        <button className={tab === "create" ? "on" : ""} onClick={() => setTab("create")}>
          CREATE
        </button>
      </div>

      <div className="phone-body">
        {tab === "pings" && (
          <div className="pings">
            {digest.length > 0 && (
              <div className="digest">
                <div className="digest-title">TODAY'S DIGEST</div>
                {digest.map((r) => (
                  <div key={r.event.id} className="digest-row">
                    <span>{CATEGORY_META[r.event.category].icon}</span>
                    <span className="digest-main">
                      {r.event.title} <em>{r.event.when}</em>
                      <small>{r.reason}</small>
                    </span>
                    <span className="src-dot" style={{ background: SOURCE_META[r.event.source].color }} />
                  </div>
                ))}
                {muted.map((r) => (
                  <div key={r.event.id} className="digest-row muted">
                    <span>{"\u{1F507}"}</span>
                    <span className="digest-main">
                      {r.event.title}
                      <small>muted: {r.reason}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {notifs.length === 0 && digest.length === 0 && (
              <p className="phone-empty">Quiet for now. The agent pings you only when it matters.</p>
            )}

            {[...notifs].reverse().map((n) => (
              <div key={n.id} className={`notif ${n.kind}`}>
                <div className="notif-head">
                  <span className="notif-title">{n.title}</span>
                  {n.source && (
                    <span className="src-badge" style={{ background: SOURCE_META[n.source].color }}>
                      {SOURCE_META[n.source].label}
                    </span>
                  )}
                  <button className="notif-x" onClick={() => onDismiss(n.id)}>{"\u00D7"}</button>
                </div>
                <div className="notif-body">{n.body}</div>
                {n.expiresAt && n.ttlMs && (
                  <div className="notif-timer">
                    <div
                      className="notif-timer-fill"
                      style={{ width: `${Math.max(0, Math.min(100, ((n.expiresAt - now) / n.ttlMs) * 100))}%` }}
                    />
                  </div>
                )}
                <div className="notif-foot">
                  {n.expiresAt && (
                    <span className="notif-countdown">
                      {Math.max(0, Math.ceil((n.expiresAt - now) / 1000))}s
                    </span>
                  )}
                  {n.actions?.map((a) => (
                    <button key={a.id} className="notif-action" onClick={() => onAction(n.id, a.id)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "chats" && !openThread && (
          <div className="thread-list">
            {threads.length === 0 && (
              <p className="phone-empty">No threads yet. Accept an invite or create something.</p>
            )}
            {[...threads].reverse().map((t) => {
              const unread = unreadFor(t);
              const last = t.messages[t.messages.length - 1];
              return (
                <button key={t.id} className="thread-item" onClick={() => setOpenThreadId(t.id)}>
                  {t.source && (
                    <span className="src-dot" style={{ background: SOURCE_META[t.source].color }} />
                  )}
                  <span className={`thread-title ${unread > 0 ? "unread" : ""}`}>
                    {CATEGORY_META[t.category].icon} {t.title}
                    <small>
                      {t.typing
                        ? `${t.typing} is typing\u2026`
                        : last
                          ? `${last.from === "agent" ? "Agent" : last.from === "you" ? "You" : last.from}: ${last.text}`
                          : ""}
                    </small>
                  </span>
                  <span className="thread-meta">
                    {last && <small>{fmtTime(last.at)}</small>}
                    {unread > 0 && <b className="unread-pill">{unread}</b>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === "chats" && openThread && (
          <div className="thread-view">
            <div className="thread-head">
              <button className="thread-back" onClick={() => setOpenThreadId(null)}>{"\u2190"}</button>
              <span className="thread-title">{openThread.title}</span>
              {openThread.source && (
                <span className="src-badge" style={{ background: SOURCE_META[openThread.source].color }}>
                  via {SOURCE_META[openThread.source].label}
                </span>
              )}
            </div>
            {openThread.receipts.length > 0 && (
              <div className="receipts">
                {openThread.receipts.map((r) => (
                  <span key={r.id} className="receipt">{r.label} {"\u2713"}</span>
                ))}
              </div>
            )}
            {openThread.invitees && openThread.invitees.length > 0 && (
              <div className="thread-invitees">
                <span className="crew-label">
                  SELECTED FROM YOUR REAL PARTIFUL MUTUALS
                </span>
                <div>
                  {openThread.invitees.map((name) => (
                    <span key={name} className="selected-person">{name}</span>
                  ))}
                </div>
              </div>
            )}

            {openThread.live ? (
              <div className="live-event">
                <div className="live-head">
                  <span className="live-dot" />
                  <span className="live-label">LIVE ON PARTIFUL</span>
                  <span className="live-updated">
                    {openThread.live.loading
                      ? "syncing\u2026"
                      : openThread.live.updatedAt
                        ? `updated ${Math.max(0, Math.round((now - openThread.live.updatedAt) / 1000))}s ago`
                        : ""}
                  </span>
                </div>
                {openThread.live.error ? (
                  <p className="live-error">{openThread.live.error}</p>
                ) : (
                  <>
                    <a className="live-link" href={openThread.live.url} target="_blank" rel="noreferrer">
                      {openThread.live.url.replace("https://", "")} {"\u2197"}
                    </a>
                    <div className="live-counts">
                      <span className="lc going"><b>{openThread.live.going}</b> going</span>
                      <span className="lc maybe"><b>{openThread.live.maybe}</b> maybe</span>
                      <span className="lc invited"><b>{openThread.live.invited}</b> invited</span>
                    </div>
                    {openThread.live.guests.length > 0 && (
                      <div className="live-guests">
                        {openThread.live.guests.slice(0, 12).map((g) => (
                          <span key={g.id || g.name} className={`guest ${g.status.toLowerCase()}`}>
                            <span className="guest-avatar">
                              {g.avatar ? <img src={g.avatar} alt="" /> : g.name[0]}
                            </span>
                            {g.name}
                          </span>
                        ))}
                        {openThread.live.guests.length > 12 && (
                          <span className="guest more">+{openThread.live.guests.length - 12}</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="connect-event">
                <input
                  className="connect-input"
                  placeholder="Paste a Partiful link to track RSVPs live…"
                  value={connectUrl}
                  onChange={(e) => setConnectUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && connectUrl.trim()) {
                      onConnectEvent(openThread.id, connectUrl.trim());
                      setConnectUrl("");
                    }
                  }}
                />
                <button
                  className="connect-go"
                  disabled={!connectUrl.trim()}
                  onClick={() => {
                    onConnectEvent(openThread.id, connectUrl.trim());
                    setConnectUrl("");
                  }}
                >
                  CONNECT
                </button>
              </div>
            )}

            <div className="bubbles">
              {openThread.messages.map((m) => {
                const mine = m.from === "you";
                const isAgent = m.from === "agent";
                return (
                  <div key={m.id} className={`msg-row ${mine ? "mine" : ""}`}>
                    {!mine && <Avatar name={m.from} />}
                    <div className={`bubble ${isAgent ? "agent" : mine ? "you" : "friend"}`}>
                      {!mine && !isAgent && <b>{m.from}</b>}
                      {isAgent && <b className="agent-tag">AGENT</b>}
                      {m.text}
                      <span className="msg-meta">
                        {fmtTime(m.at)} <Ticks m={m} />
                      </span>
                    </div>
                  </div>
                );
              })}
              {openThread.typing && (
                <div className="msg-row">
                  <Avatar name={openThread.typing} />
                  <div className="bubble friend typing-bubble">
                    <span className="typing-dots"><i /><i /><i /></span>
                    <span className="typing-label">{openThread.typing} is typing</span>
                  </div>
                </div>
              )}
              <div ref={bubblesEndRef} />
            </div>
          </div>
        )}

        {tab === "create" && (
          <div className="creator">
            <div className="creator-title">
              SPIN UP A <span className="partiful-word">PARTIFUL</span>
            </div>
            <div className="creator-why">
              <b>WHY HERE, NOT PARTIFUL?</b>
              <span>We know who is free, nearby, and actually joins this kind of event.</span>
              <span>One tap creates the invite, picks the right crew, and tracks the meetup on the campus map.</span>
            </div>
            <input
              className="creator-input"
              placeholder="what's the move?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div className="creator-cats">
              {(Object.keys(CREATOR_META) as CreatorCategory[]).map((c) => (
                <button
                  key={c}
                  className={`cat-chip ${c === category ? "on" : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {CREATOR_META[c].icon} {CREATOR_META[c].label}
                </button>
              ))}
            </div>
            <div className="creator-fields">
              <label>
                WHEN
                <input
                  className="creator-input small"
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
              </label>
              <label>
                WHERE
                <input
                  className="creator-input small"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
            </div>
            <div className="creator-crew">
              <span className="crew-label">
                AUTO-INVITE CREW · {pickedMutuals.length} SELECTED
              </span>
              <span className="crew-names">
                {pickedMutuals.length > 0
                  ? pickedMutuals.map((m) => m.name).join(", ")
                  : "Select people from your real Partiful mutuals below"}
              </span>
              <small>your top 5 are preselected from shared-event history; edit before sending</small>
            </div>

            <div className="mutuals">
              <div className="mutuals-head">
                <span className="crew-label">
                  YOUR PARTIFUL MUTUALS
                  {connected === true && <em className="conn live">live</em>}
                  {connected === false && <em className="conn mock">demo data</em>}
                </span>
                <button className="mutuals-refresh" onClick={loadMutuals} title="Refresh">
                  {"\u21BB"}
                </button>
              </div>
              {connected === false && (
                <p className="mutuals-hint">
                  Not connected to Partiful. Add your token to <code>.env</code> to load your
                  real top 15. Showing sample mutuals so you can test the picker.
                </p>
              )}
              {loadingMutuals ? (
                <p className="mutuals-hint">Loading your mutuals…</p>
              ) : (
                <div className="mutuals-list">
                  {mutuals.map((m, i) => (
                    <button
                      key={m.id}
                      className={`mutual ${picked.has(m.id) ? "on" : ""}`}
                      onClick={() => togglePick(m.id)}
                    >
                      <span className="mutual-rank">{i + 1}</span>
                      <span className="mutual-avatar">
                        {m.avatar
                          ? <img src={m.avatar} alt="" />
                          : m.name[0]}
                      </span>
                      <span className="mutual-main">
                        {m.name}
                        <small>{m.sharedEvents} shared · {m.attended} attended</small>
                      </span>
                      <span className="mutual-check">{picked.has(m.id) ? "\u2713" : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="creator-link">
              <span className="crew-label">OR CONNECT AN EXISTING PARTIFUL</span>
              <input
                className="creator-input small"
                placeholder="paste partiful.com/e/… instead of making a new one"
                value={eventUrl}
                onChange={(e) => setEventUrl(e.target.value)}
              />
              <small>leave blank to create a real Partiful now; paste a link to track an event you already made</small>
            </div>

            <button
              className="creator-go"
              onClick={submit}
              disabled={!title.trim() || !when || !location.trim()}
            >
              {eventUrl.trim() ? "CONNECT PARTIFUL" : "CREATE REAL PARTIFUL"} · INVITE {picked.size}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
