# ConnectMaxxer

A living campus map that knows your people, your prefs, and the vibe of every room — then quietly makes hangouts happen. Pokémon-style 2D map, agent that closes the loop.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL. `npm run build` produces a static bundle in `dist/` you can deploy anywhere (Vercel/Netlify/GitHub Pages).

## The 90-second demo script

1. Map loads — friends are pixel sprites, buildings have vibe bubbles (study/gym/food/chaos) that swell with occupancy. Windows light up as rooms fill. The campus clock (top bar) runs at 1 min/sec.
2. ~5s in: **Maya walks to the Rec Gym** → toast: "Maya just hit Rec Gym". Check-in pings only fire for **public spaces** — when Sam heads to the 🔒 Dorms, nothing pings anyone.
3. Open **⚙️ Settings**: master notification toggle, quiet hours on the campus clock, mute individual friends or places, and pick your interests. Suppressed pings are counted so you can see the filter working.
4. Click the gym → **JOIN**. Your sprite walks over while the agent feed closes the loop: DMs Maya → she replies → Google Calendar hold → Luma auto-RSVP.
5. Flip **GHOST** — you go translucent, your check-ins ping no one, alerts stay on, session doesn't train the preference graph.
6. ~25s in: a **serendipity event** pops with a 60s countdown — 2-3 *new* people who share one of your interests, at an open public spot. Accept → **⚡ points** (bonus per new person, streak bonus); let it vanish → streak resets. Points live in the small pill up top.
7. **OPEN NOW** panel lists every drop-in spot: open / closing soon / closed, free seats, friends there, and a GO button. Watch Study Pods flip to CLOSED at 5:00 PM campus time.
8. Buildings with ≤1 person show 💤 — lonely rooms you can go revive. **CREATE** drafts a Luma, pings the circle, and drops it on calendars.

## What's real vs. theater (MVP scope)

| Piece | Status |
| --- | --- |
| 2D game map, sprites, routing, vibe bubbles, occupancy | Real (canvas engine, no assets) |
| Friend check-in → notification loop | Real simulation (scripted signals stand in for scan/WiFi/QR check-ins) |
| Notification settings: master / quiet hours / per-friend / per-place mutes | Real — persisted to localStorage, gates every ping |
| Public vs. private spaces (private never notifies) | Real |
| Open study/public spots: hours, open/closing/closed, drop-in list | Real simulation on the campus clock |
| Serendipity matching + points/streak rewards | Real UI loop — persona pool stands in for real user matching |
| Google Calendar | Real — every "→ Google Calendar" feed line has an ADD ↗ button that opens a prefilled event on your actual calendar (no OAuth needed) |
| Agent feed: DM friend, Luma RSVP | Theater — staged messages; swap in real MCP/API calls next |
| Preference graph | Theater — static "read", becomes learned from join/skip/leave signals |

Next steps to make the theater real: QR/manual check-in endpoint per building, Google Calendar + Luma integrations behind the same feed events, and a tiny backend (or Supabase) for the friend circle.
