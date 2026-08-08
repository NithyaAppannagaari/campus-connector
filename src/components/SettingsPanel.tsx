import { Building, Friend, fmtClock } from "../game/world";
import { ALL_HOBBIES, Settings, inQuietHours } from "../settings";

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  ghost: boolean;
  onToggleGhost: () => void;
  friends: Friend[];
  buildings: Building[];
  clockMin: number;
  mutedCount: number;
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      className={`switch ${on ? "on" : ""}`}
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
    >
      <span className="knob" />
    </button>
  );
}

function TimeSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select className="time-select" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h * 60}>
          {fmtClock(h * 60)}
        </option>
      ))}
    </select>
  );
}

export default function SettingsPanel({
  settings, onChange, onClose, ghost, onToggleGhost, friends, buildings, clockMin, mutedCount,
}: Props) {
  const s = settings;
  const set = (patch: Partial<Settings>) => onChange({ ...s, ...patch });
  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const publicSpots = buildings.filter((b) => b.isPublic);
  const quietNow = inQuietHours(clockMin, s.quiet);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <span className="card-title" style={{ marginBottom: 0 }}>SETTINGS</span>
          <button className="btn" onClick={onClose}>CLOSE</button>
        </div>

        <section>
          <div className="setting-row">
            <div>
              <div className="setting-label">Check-in notifications</div>
              <div className="setting-sub">
                Pings when friends check in at public spots.
                {mutedCount > 0 && ` ${mutedCount} muted this session.`}
              </div>
            </div>
            <Toggle on={s.notifsOn} onClick={() => set({ notifsOn: !s.notifsOn })} label="notifications" />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Quiet hours {quietNow && <em className="quiet-now">active now</em>}</div>
              <div className="setting-sub">No pings during this window (campus time).</div>
              {s.quiet.on && (
                <div className="quiet-times">
                  <TimeSelect
                    value={s.quiet.startMin}
                    onChange={(v) => set({ quiet: { ...s.quiet, startMin: v } })}
                  />
                  <span>to</span>
                  <TimeSelect
                    value={s.quiet.endMin}
                    onChange={(v) => set({ quiet: { ...s.quiet, endMin: v } })}
                  />
                </div>
              )}
            </div>
            <Toggle
              on={s.quiet.on}
              onClick={() => set({ quiet: { ...s.quiet, on: !s.quiet.on } })}
              label="quiet hours"
            />
          </div>

          <div className="setting-row">
            <div>
              <div className="setting-label">Incognito (ghost mode)</div>
              <div className="setting-sub">
                Invisible on the map, your check-ins ping no one, session doesn't train your
                preference graph. You still get your own alerts.
              </div>
            </div>
            <Toggle on={ghost} onClick={onToggleGhost} label="ghost mode" />
          </div>
        </section>

        <section>
          <div className="setting-label">Muted friends</div>
          <div className="setting-sub">Never ping me about these people.</div>
          <div className="chips">
            {friends.map((f) => (
              <button
                key={f.id}
                className={`chip ${s.mutedFriends.includes(f.id) ? "muted" : ""}`}
                onClick={() => set({ mutedFriends: toggleIn(s.mutedFriends, f.id) })}
              >
                {s.mutedFriends.includes(f.id) ? "\u{1F507} " : ""}{f.name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="setting-label">Muted places</div>
          <div className="setting-sub">
            No pings from these spots. Private spaces (like Dorms) never notify anyone.
          </div>
          <div className="chips">
            {publicSpots.map((b) => (
              <button
                key={b.id}
                className={`chip ${s.mutedPlaces.includes(b.id) ? "muted" : ""}`}
                onClick={() => set({ mutedPlaces: toggleIn(s.mutedPlaces, b.id) })}
              >
                {s.mutedPlaces.includes(b.id) ? "\u{1F507} " : ""}{b.emoji} {b.name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="setting-label">Your interests</div>
          <div className="setting-sub">
            Serendipity matches you with new people who share these. Bonus points for showing up.
          </div>
          <div className="chips">
            {ALL_HOBBIES.map((h) => (
              <button
                key={h}
                className={`chip ${s.hobbies.includes(h) ? "active" : ""}`}
                onClick={() => set({ hobbies: toggleIn(s.hobbies, h) })}
              >
                {h}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
