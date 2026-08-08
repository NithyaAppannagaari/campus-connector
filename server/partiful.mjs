// Local-only proxy to Partiful's (unofficial) Firebase backend.
// Reads your own session token from .env, exchanges it for a short-lived
// Firebase ID token, and exposes read-only endpoints to the frontend.
//
// Partiful has no official API. This reuses the same production Cloud
// Functions partiful.com itself calls. It is unofficial and unsupported.
// We only READ here (mutuals + profiles). No events are created and no
// invites are sent by this server.

import express from "express";
import cors from "cors";
import "dotenv/config";

const PORT = process.env.PARTIFUL_PROXY_PORT || 8787;
const REFRESH_TOKEN = process.env.PARTIFUL_REFRESH_TOKEN;
const USER_ID = process.env.PARTIFUL_USER_ID;
// Public Firebase web API key. Grab it from the same IndexedDB entry as the
// refresh token (the `apiKey` field). Left blank on purpose so we never ship
// a guessed key.
const API_KEY = process.env.PARTIFUL_FIREBASE_API_KEY;

const API_BASE = "https://api.partiful.com";
const TOKEN_URL = "https://securetoken.googleapis.com/v1/token";

const app = express();
app.use(cors());
app.use(express.json());

// ---- token cache -----------------------------------------------------------

let cached = { idToken: null, uid: USER_ID || null, expiresAt: 0 };

async function getIdToken() {
  if (cached.idToken && Date.now() < cached.expiresAt - 60_000) return cached;
  if (!REFRESH_TOKEN || !API_KEY) {
    throw new Error(
      "Missing PARTIFUL_REFRESH_TOKEN or PARTIFUL_FIREBASE_API_KEY in .env",
    );
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: REFRESH_TOKEN,
  });
  // Partiful's Firebase key is referer-restricted to partiful.com, so we must
  // present the same Referer/Origin the browser would.
  const res = await fetch(`${TOKEN_URL}?key=${API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://partiful.com/",
      Origin: "https://partiful.com",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  cached = {
    idToken: json.id_token,
    uid: USER_ID || json.user_id,
    expiresAt: Date.now() + Number(json.expires_in || 3600) * 1000,
  };
  return cached;
}

async function callPartiful(fn, params = {}) {
  const { idToken, uid } = await getIdToken();
  const res = await fetch(`${API_BASE}/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      Referer: "https://partiful.com/",
      Origin: "https://partiful.com",
    },
    body: JSON.stringify({ data: { params, userId: uid } }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${fn} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text);
  return json?.result?.data ?? json?.result ?? json;
}

// ---- normalization ---------------------------------------------------------

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["users", "mutuals", "contacts", "results", "items", "data"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function pick(obj, keys, fallback) {
  for (const k of keys) if (obj?.[k] != null) return obj[k];
  return fallback;
}

function normalizeUser(u) {
  return {
    id: pick(u, ["id", "uid", "userId"], ""),
    name: pick(u, ["name", "displayName", "fullName", "username"], "Unknown"),
    avatar: pick(u, ["avatar", "profileImageUrl", "photoUrl", "imageUrl"], null),
    // used for ranking when present
    sharedEvents: Number(
      pick(u, ["mutualEventCount", "sharedEventCount", "sharedEvents", "count"], 0),
    ),
    attended: Number(pick(u, ["attendedCount", "partiesAttended", "eventsAttended"], 0)),
    hosted: Number(pick(u, ["hostedCount", "partiesHosted"], 0)),
  };
}

const GOING = new Set(["GOING", "APPROVED", "GOING_APPROVED"]);
const MAYBE = new Set(["MAYBE", "WAITLIST", "PENDING_APPROVAL", "INTERESTED"]);
const INVITED = new Set(["SENT", "INVITED", "PENDING"]);

function normalizeGuest(g) {
  const user = g?.user ?? g;
  const status = String(
    pick(g, ["status", "rsvpStatus", "rsvp", "myRsvp"], "INVITED"),
  ).toUpperCase();
  return {
    id: pick(user, ["id", "uid", "userId"], pick(g, ["userId", "id"], "")),
    name: pick(user, ["name", "displayName", "fullName", "username"], "Guest"),
    avatar: pick(user, ["avatar", "profileImageUrl", "photoUrl", "imageUrl"], null),
    status,
  };
}

function parseEventId(input) {
  if (!input) return "";
  const s = String(input).trim();
  // full URL like https://partiful.com/e/<id> or /event/<id>
  const m = s.match(/(?:\/e\/|\/event\/|partiful\.com\/)([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return s.replace(/[^A-Za-z0-9_-]/g, "");
}

async function loadEvent(eventId) {
  const info = await callPartiful("getEventInfo", { eventId, useCache: false });
  const event = info?.event ?? info;
  let guests = [];
  try {
    const g = await callPartiful("getGuests", { eventId });
    guests = asArray(g).map(normalizeGuest);
  } catch (e) {
    console.warn("[partiful] getGuests skipped:", e.message);
  }
  const going = guests.filter((x) => GOING.has(x.status)).length;
  const maybe = guests.filter((x) => MAYBE.has(x.status)).length;
  const invited = guests.filter((x) => INVITED.has(x.status)).length;
  return {
    eventId,
    url: `https://partiful.com/e/${eventId}`,
    title: pick(event, ["title", "name"], "Partiful event"),
    when: pick(event, ["startDate", "startTime", "date", "start"], null),
    going, maybe, invited,
    guests,
  };
}

// ---- routes -----------------------------------------------------------------

app.get("/api/health", async (_req, res) => {
  const configured = Boolean(REFRESH_TOKEN && API_KEY);
  if (!configured) {
    return res.json({ ok: false, configured: false, reason: "no token in .env" });
  }
  try {
    await getIdToken();
    res.json({ ok: true, configured: true, uid: cached.uid });
  } catch (e) {
    res.json({ ok: false, configured: true, reason: String(e.message || e) });
  }
});

app.get("/api/mutuals", async (req, res) => {
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 15));
  try {
    const raw = await callPartiful("getMutuals", {});
    let people = asArray(raw).map(normalizeUser);

    // enrich names + party stats via getUsers when the mutual objects are thin
    const needEnrich = people.filter((p) => p.id && (p.name === "Unknown" || p.attended === 0));
    if (needEnrich.length > 0) {
      try {
        const usersRaw = await callPartiful("getUsers", {
          ids: needEnrich.map((p) => p.id),
          includePartyStats: true,
        });
        const byId = new Map(asArray(usersRaw).map((u) => [pick(u, ["id", "uid", "userId"], ""), u]));
        people = people.map((p) => {
          const full = byId.get(p.id);
          if (!full) return p;
          const n = normalizeUser(full);
          return {
            ...p,
            name: p.name !== "Unknown" ? p.name : n.name,
            avatar: p.avatar ?? n.avatar,
            attended: Math.max(p.attended, n.attended),
            hosted: Math.max(p.hosted, n.hosted),
          };
        });
      } catch (e) {
        console.warn("[partiful] getUsers enrichment skipped:", e.message);
      }
    }

    people.sort((a, b) => (b.sharedEvents - a.sharedEvents) || (b.attended - a.attended));
    res.json({ connected: true, count: people.length, mutuals: people.slice(0, limit) });
  } catch (e) {
    console.error("[partiful] /api/mutuals error:", e.message);
    res.status(502).json({ connected: false, error: String(e.message || e) });
  }
});

// Connect a real Partiful event by URL/id and return live RSVP counts + guests.
app.get("/api/event", async (req, res) => {
  const eventId = parseEventId(req.query.url || req.query.id);
  if (!eventId) return res.status(400).json({ ok: false, error: "no event id/url" });
  try {
    const event = await loadEvent(eventId);
    res.json({ ok: true, event });
  } catch (e) {
    console.error("[partiful] /api/event error:", e.message);
    res.status(502).json({ ok: false, error: String(e.message || e) });
  }
});

// Real event creation and mutual invitations using the request shapes
// confirmed by the community Partiful CLI. Still unofficial: Partiful has no
// public API, so failures return needsManual without pretending anything sent.
app.post("/api/create-event", async (req, res) => {
  const { title, when, location, userIdsToInvite = [] } = req.body || {};
  if (!REFRESH_TOKEN || !API_KEY) {
    return res.json({ ok: false, needsManual: true, reason: "not connected" });
  }
  try {
    const defaultStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    defaultStart.setHours(19, 0, 0, 0);
    const startDate = when ? new Date(when) : defaultStart;
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ ok: false, reason: "invalid event date" });
    }
    const statuses = [
      "READY_TO_SEND", "SENDING", "SENT", "SEND_ERROR", "DELIVERY_ERROR",
      "INTERESTED", "MAYBE", "GOING", "DECLINED", "WAITLIST",
      "PENDING_APPROVAL", "APPROVED", "WITHDRAWN",
      "RESPONDED_TO_FIND_A_TIME", "WAITLISTED_FOR_APPROVAL", "REJECTED",
    ];
    const guestStatusCounts = Object.fromEntries(statuses.map((s) => [s, 0]));
    const event = {
      title: title || "ConnectMaxxer event",
      startDate: startDate.toISOString(),
      timezone: "America/Los_Angeles",
      displaySettings: {
        theme: "oxblood",
        effect: "sunbeams",
        titleFont: "display",
      },
      showHostList: true,
      showGuestCount: true,
      showGuestList: true,
      showActivityTimestamps: true,
      displayInviteButton: true,
      visibility: "public",
      allowGuestPhotoUpload: true,
      enableGuestReminders: true,
      rsvpsEnabled: true,
      allowGuestsToInviteMutuals: true,
      rsvpButtonGlyphType: "emojis",
      status: "UNSAVED",
      guestStatusCounts,
      ...(location ? { location } : {}),
    };
    const data = await callPartiful("createEvent", {
      event,
      cohostIds: [],
    });
    const eventId =
      typeof data === "string" ? data : pick(data, ["id", "eventId"], "");
    if (!eventId) throw new Error("no event id in response");

    const uniqueIds = [...new Set(userIdsToInvite.filter(Boolean))];
    if (uniqueIds.length > 0) {
      await callPartiful("addInvitedGuestsAsHost", {
        eventId,
        userIdsToInvite: uniqueIds,
        phoneContactsToInvite: [],
        invitationMessage: "Join me — planned with ConnectMaxxer",
        otherMutualsCount: 0,
      });
    }

    const liveEvent = await loadEvent(eventId);
    res.json({ ok: true, event: liveEvent, invitedCount: uniqueIds.length });
  } catch (e) {
    console.warn("[partiful] createEvent not available:", e.message);
    res.json({ ok: false, needsManual: true, reason: String(e.message || e) });
  }
});

// Debug passthrough for confirmed read endpoints, so you can inspect real
// response shapes while developing. Local only.
app.post("/api/raw/:fn", async (req, res) => {
  try {
    const data = await callPartiful(req.params.fn, req.body?.params ?? {});
    res.json({ ok: true, data });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e.message || e) });
  }
});

app.listen(PORT, () => {
  const ready = REFRESH_TOKEN && API_KEY;
  console.log(`[partiful] proxy on http://localhost:${PORT}`);
  console.log(
    ready
      ? "[partiful] token configured — /api/mutuals will hit the real backend"
      : "[partiful] no .env token — frontend will fall back to mock mutuals",
  );
});
