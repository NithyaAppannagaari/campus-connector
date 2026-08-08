import { FormEvent, useEffect, useRef, useState } from "react";
import { Building, Club, HOBBIES, Hobby, PopUp, buildingById } from "../game/world";

export interface ClubDraft {
  name: string;
  hobby: Hobby;
  email: string;
}

export interface PopUpDraft {
  clubId: string;
  buildingId: string;
  title: string;
  perk: string;
  minutes: number;
}

interface Props {
  clubs: Club[];
  buildings: Building[];
  livePopUps: PopUp[];
  playerEmail: string;
  onPlayerEmail: (email: string) => void;
  onSignUpClub: (draft: ClubDraft) => void;
  onPostPopUp: (draft: PopUpDraft) => void;
}

const PERK_CHIPS = ["Free Monster", "Celsius sampling", "Recruiting booth", "Free pizza"];

export function ClubPortal({
  clubs, buildings, livePopUps, playerEmail, onPlayerEmail, onSignUpClub, onPostPopUp,
}: Props) {
  const [name, setName] = useState("");
  const [hobby, setHobby] = useState<Hobby>("climbing");
  const [email, setEmail] = useState("");

  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [perk, setPerk] = useState("");
  const [minutes, setMinutes] = useState(60);

  // A club you just listed is almost always the one you want to run a pop-up for.
  const clubCount = useRef(clubs.length);
  useEffect(() => {
    if (clubs.length > clubCount.current) setClubId(clubs[clubs.length - 1].id);
    clubCount.current = clubs.length;
  }, [clubs]);

  const submitClub = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onSignUpClub({ name: name.trim(), hobby, email: email.trim() });
    setName("");
    setEmail("");
  };

  const submitPopUp = (e: FormEvent) => {
    e.preventDefault();
    if (!clubId || !title.trim()) return;
    onPostPopUp({ clubId, buildingId, title: title.trim(), perk: perk.trim(), minutes });
    setTitle("");
    setPerk("");
  };

  return (
    <div className="portal">
      <section className="panel-block">
        <h2>Where invites land</h2>
        <label className="field">
          <span>Your email</span>
          <input
            type="email"
            value={playerEmail}
            placeholder="you@campus.edu"
            onChange={(e) => onPlayerEmail(e.target.value)}
          />
        </label>
        <p className="note">
          Every invite you accept is emailed to you and to the friend you pulled in.
        </p>
      </section>

      <section className="panel-block">
        <h2>List your club</h2>
        <form onSubmit={submitClub}>
          <label className="field">
            <span>Club name</span>
            <input
              value={name}
              placeholder="Sunrise Run Club"
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <fieldset className="chips">
            <legend>Hobby</legend>
            {HOBBIES.map((h) => (
              <button
                key={h}
                type="button"
                className={`chip ${hobby === h ? "on" : ""}`}
                aria-pressed={hobby === h}
                onClick={() => setHobby(h)}
              >
                {h}
              </button>
            ))}
          </fieldset>
          <label className="field">
            <span>Officer email</span>
            <input
              type="email"
              value={email}
              placeholder="officers@campus.edu"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="btn gold wide" type="submit">Add club to the map</button>
        </form>
      </section>

      <section className="panel-block">
        <h2>Run a pop-up</h2>
        <form onSubmit={submitPopUp}>
          <div className="field-row">
            <label className="field">
              <span>Host</span>
              <select value={clubId} onChange={(e) => setClubId(e.target.value)}>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Spot</span>
              <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>What is it</span>
            <input
              value={title}
              placeholder="Boulder jam + sign-ups"
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Perk on the table</span>
            <input
              value={perk}
              placeholder="Free cans, stickers, first-20 tickets"
              onChange={(e) => setPerk(e.target.value)}
            />
          </label>
          <div className="chips">
            {PERK_CHIPS.map((p) => (
              <button key={p} type="button" className="chip" onClick={() => setPerk(p)}>{p}</button>
            ))}
          </div>
          <fieldset className="chips">
            <legend>Runs for</legend>
            {[30, 60, 120].map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${minutes === m ? "on" : ""}`}
                aria-pressed={minutes === m}
                onClick={() => setMinutes(m)}
              >
                {m} min
              </button>
            ))}
          </fieldset>
          <button className="btn gold wide" type="submit">Go live and email the circle</button>
        </form>
      </section>

      <section className="panel-block">
        <h2>Live right now</h2>
        {livePopUps.length === 0 ? (
          <p className="note">Nothing is running. Post one and it lands on the map instantly.</p>
        ) : (
          <ul className="popup-list">
            {livePopUps.map((p) => (
              <li key={p.id} className="popup-row">
                <span className="popup-dot" style={{ background: p.color }} aria-hidden="true" />
                <span className="popup-copy">
                  <strong>{p.title}</strong>
                  <span>{p.hostName} · {buildingById(p.buildingId).name}</span>
                </span>
                <span className="popup-count">{p.rsvps.length} in</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
