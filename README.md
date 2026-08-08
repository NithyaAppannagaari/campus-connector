# ConnectMaxxer

A living campus map that knows your people, your prefs, and the vibe of every room — then quietly makes hangouts happen. Pokémon-style 2D map, agent that closes the loop.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` starts both the web app (Vite, http://localhost:5173) and the Partiful proxy (http://localhost:8787). Open the printed localhost URL. `npm run dev:web` runs only the frontend. `npm run build` produces a static bundle in `dist/`.

## Real Partiful integration (optional)

Partiful has no official API, so the app can read your **real mutuals** by reusing your own browser session token. This is read-only — the app never creates events or sends invites through Partiful; those stay simulated. Without a token, the invite picker falls back to sample mutuals and shows a "demo data" badge.

To connect your real account, copy `.env.example` to `.env` and fill in three values from Chrome DevTools (Application → IndexedDB → `firebaseLocalStorageDb` → `firebaseLocalStorage`, expand the entry's `value`):

- `PARTIFUL_REFRESH_TOKEN` — `stsTokenManager.refreshToken`
- `PARTIFUL_FIREBASE_API_KEY` — `apiKey`
- `PARTIFUL_USER_ID` — `uid`

Restart `npm run dev`. In the phone's CREATE tab, YOUR PARTIFUL MUTUALS will show a green "live" badge and list your top 15 mutuals (ranked by shared events, then parties attended) to hand-pick as invitees. The token is session-scoped and expires; re-paste it when the badge flips back to "demo data". `.env` is gitignored. This is unofficial and against Partiful's ToS — use your own account.

### Legit event link + live attendee tracking

For a demo with a real, clickable Partiful link and real RSVPs:

1. Make the event on Partiful (their app, ~20 seconds) and copy its link, e.g. `https://partiful.com/e/abc123`.
2. In the phone's CREATE tab, paste it into the "LEGIT PARTIFUL LINK" field before hitting create — or open any thread and paste it into the "Paste a Partiful link" box.
3. The thread shows a LIVE ON PARTIFUL card with the real link and going/maybe/invited counts plus a guest list, refreshing every 5 seconds from Partiful's confirmed `getEventInfo` + `getGuests` endpoints. As people RSVP on the real event, the numbers move live.

Event details and the guest list are **read-only confirmed endpoints**, so this path never breaks and never sends anything. There's also a best-effort auto-create (`POST /api/create-event`) that tries Partiful's unconfirmed `createEvent`; if Partiful rejects it, the UI just falls back to the paste-a-link flow above. For a live demo, prefer pasting a link you made yourself.

## The 90-second demo script

1. Map loads — friends are pixel sprites, buildings have vibe bubbles (study/gym/food/chaos) that swell with occupancy. The phone on the right shows **TODAY'S DIGEST**: board games, a club GM, a Handshake coffee chat — plus the 11 PM frat the agent muted because it's outside your window.
2. ~5s: **Maya walks to the Rec Gym** → push notification on the phone.
3. ~10s: **Partiful invite** lands — "F1 watch party, 4 of your people in". Hit **I'M IN**: the agent RSVPs on Partiful, auto-invites your watch-party crew (computed from co-attendance history), and drops it on Google Calendar — all visible as one thread with receipt chips.
4. ~24s: **quorum push** — "Pickleball needs 1 more". Fill it, roster goes 4/4.
5. ~36s: **serendipity** with a 60s countdown; ~50s: a **Celsius brand drop** with its own timer. Accept or watch them vanish.
6. Flip to the **CREATE tab** (or hit CREATE on a building): type a title, pick party/hangout/sports/pop-up, and the agent spins up a Partiful and auto-invites the right crew. Receiver side and creator side, both on screen.
7. **GHOST** any time — invisible on the map, alerts on, session untrained.

## Event taxonomy

Eight categories with distinct notification rules: social hobbies and student clubs (digest only, never pushed), workouts (quiet pings to gym buddies, never after 9), parties (push + auto-invite the recurring crew via Partiful), sports (quorum-fill blasts), pop-ups and brand drops like Monster/Celsius (time-boxed pushes that expire), and recruiting from Handshake (personal digest lane, never invites friends).

## What's real vs. theater (MVP scope)

| Piece | Status |
| --- | --- |
| 2D game map, sprites, routing, vibe bubbles, occupancy | Real (canvas engine, no assets) |
| Friend check-in → push notification loop | Real simulation (scripted signals stand in for scan/WiFi/QR check-ins) |
| Recommendation engine (affinity scoring, auto-invite crews, push/digest/mute) | Real logic in `src/messages/recommend.ts` over mock history |
| Event history from Partiful/Luma/Doorlist/Handshake | Mock data shaped like real imports (`src/messages/history.ts`) |
| Agent actions: Partiful RSVP/create, DMs, Google Calendar | Theater — staged thread messages + receipt chips; swap in real MCP/API calls next |
| Preference graph | Theater — static "read", becomes learned from join/skip/leave signals |
| Ghost mode, serendipity, brand drops, dead zones | Real UI behavior |

Next steps to make the theater real: QR/manual check-in endpoint per building, real Partiful/Luma/Google Calendar integrations behind the same notification bus, and a tiny backend (or Supabase) for the friend circle.
