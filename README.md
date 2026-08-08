# ConnectMaxxer

A living map of the Georgia Tech campus that knows your people, your prefs, and the vibe of every room — then quietly makes hangouts happen. Pokémon-style 2D map, agent that closes the loop.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL. `npm run build` produces a static bundle in `dist/` you can deploy anywhere (Vercel/Netlify/GitHub Pages).

## The 90-second demo script

1. Map loads — friends are pixel sprites, buildings have vibe bubbles (study/gym/food/chaos) that swell with occupancy. Windows light up as rooms fill.
2. ~5s in: **Maya walks to the CRC** → toast: "Maya just hit The CRC".
3. Click the CRC → **JOIN**. Your sprite walks over while the agent feed closes the loop: DMs Maya → she replies → Google Calendar hold → Luma auto-RSVP.
4. Flip **GHOST** — you go translucent on the map, alerts stay on, session doesn't train the preference graph.
5. ~35s in: a **serendipity event** pops with a 60s countdown ("3 people free near the Campanile"). Accept it or watch it vanish.
6. Buildings with ≤1 person show 💤 — lonely rooms you can go revive. **CREATE** drafts a Luma, pings the circle, and drops it on calendars.

## What's real vs. theater (MVP scope)

| Piece | Status |
| --- | --- |
| 2D game map, sprites, routing, vibe bubbles, occupancy | Real (canvas engine, no assets) |
| Friend check-in → notification loop | Real simulation (scripted signals stand in for scan/WiFi/QR check-ins) |
| Agent feed: DM friend, Luma RSVP, Google Calendar | Theater — staged messages; swap in real MCP/API calls next |
| Preference graph | Theater — static "read", becomes learned from join/skip/leave signals |
| Ghost mode, serendipity, dead zones | Real UI behavior |

Next steps to make the theater real: QR/manual check-in endpoint per building, Google Calendar + Luma integrations behind the same feed events, and a tiny backend (or Supabase) for the friend circle.
