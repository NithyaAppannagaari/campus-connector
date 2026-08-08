# ConnectMaxxer

A living campus map that knows your people, your prefs, and the vibe of every room — then quietly makes hangouts happen. Clubs and brands run pop-ups on the same map, and when someone from your circle is standing where one just opened, everybody involved gets a real email.

## Run it

```bash
npm install
cp .env.example .env   # optional, but needed for real email
npm run dev
```

`npm run dev` starts two processes: the Vite app on `:5173` and the notification server on `:8787`. Vite proxies `/api` to it. Without an API key the app runs fine and the agent feed says the mail was composed but not sent.

`npm run build` produces a static bundle in `dist/`. The notification server deploys separately (any Node host).

## Turning on real email

1. Create a free [Resend](https://resend.com) account and make an API key.
2. Put it in `.env` as `RESEND_API_KEY`.
3. Set `DEMO_INBOX` to your own address.

Resend only delivers to the account owner until you verify a domain, so `DEMO_INBOX` rewrites every simulated student into a plus-alias of that one address — Maya's invite arrives as `you+maya@…`, Dev's as `you+dev@…`. Real mail lands in a real inbox, and each recipient stays distinguishable. Once you verify a domain, drop `DEMO_INBOX` and mail goes to the addresses on the records themselves.

The lamp on the toolbar tells you which mode you're in: green `mail live`, amber `no API key`, or red `mail offline`.

## The 90-second demo script

1. The campus fills the screen — friends are pixel sprites, buildings have vibe bubbles that swell with occupancy, windows light up as rooms fill. Click a building (or press up/down) and a carved dialogue box opens with who's inside; *Walk over* sends you, Esc closes it.
2. ~5s in: **Maya walks to the Rec Gym** → toast: "Maya just hit Rec Gym".
3. ~9s in: **Monster Energy goes live at the Student Union**. A striped booth appears on the path and a pulsing pin drops over the roof. Everyone whose interests match gets an announcement email. Celsius follows at the gym, then a club screening at the pods.
4. When a friend walks into a building where a pop-up is running, an **invite toast** appears with a 45-second window: "Jordan is at Student Union where Monster Energy is handing out free cans". Hit *Invite Jordan* and both of you are emailed.
5. Open **Clubs** from the toolbar. List a club with a hobby and an officer email — the club is confirmed by email and lands on the map. Post a pop-up and it goes live instantly, booth and all, emailing the students who care about that hobby.
6. Hit **Ghost** (or `G`) — you drop off the map *and* off the email list. Alerts still reach you in the feed.
7. Open **Open now** for public drop-in spaces, live hours, free spots, friends, and one-click routing. Private Dorm check-ins never notify anyone.
8. Open **Settings** to control notifications, quiet hours, muted friends/places, and interests.
9. ~25s in: an interest-matched **serendipity event** pops with a 60-second countdown. Accept for points, new-person bonuses, and a streak; let it vanish and the streak resets.

## What's real vs. theater

| Piece | Status |
| --- | --- |
| Email notifications (invites, pop-up announcements, club confirmations) | **Real** — Express + Resend at `server/index.ts` |
| Clubs, pop-up events, proximity invites, RSVPs | Real logic, in-memory (`src/game/world.ts`) |
| 2D game map, sprites, routing, vibe bubbles, booths, pins | Real (canvas engine, no assets) |
| Friend check-ins | Real simulation — scripted movement stands in for scan/WiFi/QR check-ins |
| Notification settings, quiet hours, per-friend/place mutes | Real — persisted in localStorage and gates every check-in ping |
| Public/private places and live opening hours | Real simulation on the accelerated campus clock |
| Interest-matched serendipity and points/streak rewards | Real local UI loop; persona pool stands in for real users |
| Agent feed: DM friend, Luma RSVP, Google Calendar | Theater — staged messages; swap in real API calls next |
| Preference graph | Theater — static "read", becomes learned from join/skip/leave signals |

Next steps: persist clubs and pop-ups (Supabase), a QR check-in endpoint per building, and Google Calendar / Luma behind the same feed events.

## Design

It's a farming-sim interface. The pixel campus runs full-bleed with no chrome around it, a wooden toolbar sits along the bottom, and the journal and club board open as carved menu windows over the world rather than as panels beside it — the way a game menu opens over the farm.

Two materials, and only two. Wood for structure, parchment for anything you read. Every panel is the same carved frame: a dark outline, a wood band, a shaded inner lip around the page, and a hard offset shadow with zero blur. Nothing is rounded and nothing is soft. Gold is rationed to exactly one job — the single action worth taking, so *Walk over* is gold while *Start something* and *Close* are plain wood.

The toolbar reads as an inventory bar. Each screen is a beveled wooden slot, and the one you're on lights up gold like an equipped tool. Pixelify Sans carries the whole interface; the earlier arcade face was swapped out because a pixel font with rounded, readable forms suits a farm more than a Nintendo logo does.

Two details worth calling out. The map's occupancy bubbles were retuned from the loud modern hues to earthier ones, so they sit inside the world instead of on top of it. And because invites expire in 45 seconds, the toast stack follows you: it floats over the map, then docks into the top of a menu window when you open one, instead of hiding behind it.

Motion is stepped, not eased — `steps(5)` on menus and rows — because sprite animation advances frame by frame. The `prefers-reduced-motion` path drops the movement but keeps color feedback so hover, focus, and selection still confirm themselves.

Design guidance came from the `ui-ux-pro-max` and `impeccable` skills, installed under `.cursor/skills/`. Impeccable's design hook caught a colored rail down the side of each journal row, which is the single most recognizable tell of generated UI — that came out, and the stamped category tag carries the meaning instead. Contrast is measured rather than assumed: body text runs 11-13:1 on parchment, and the two values that missed AA were fixed at the source, with the input placeholder darkened to 5.0:1 and the mail tag given a deeper amber at 5.5:1 because cream on the brand gold only reached 3.3:1.

Controls: arrows move the selection and cycle screens, `Enter` walks over or accepts the top invite, `Esc` closes, `G` toggles Ghost. The key handler bails when focus is inside a form field, so typing a club name doesn't walk the map — except for `Esc`, which steps out of the field first.
