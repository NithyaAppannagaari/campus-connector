import { useEffect, useRef, useState } from "react";
import type { Vibe } from "../game/world";
import {
  HAIR_PALETTE,
  RHYTHM_CHIPS,
  SHIRT_PALETTE,
  UserProfile,
  VIBE_META,
  VIBE_ORDER,
  prefSummary,
  vibeRead,
} from "../profile";

const STEPS = ["WHO", "VIBES", "RHYTHMS", "PRIVACY", "READY"] as const;
const LEVEL_LABELS = ["PASS", "MEH", "YES", "LOVE"];

/** Draws the same 8x12 pixel person as the map renderer, scaled up. */
function drawPreview(canvas: HTMLCanvasElement, shirt: string, hair: string) {
  const ctx = canvas.getContext("2d")!;
  const s = canvas.width / 10; // 1px sprite pixel -> s canvas pixels
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(1, 0);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(1, 12, 6, 2);
  // hair + head
  ctx.fillStyle = hair;
  ctx.fillRect(1, 0, 6, 2);
  ctx.fillRect(0, 1, 8, 2);
  ctx.fillStyle = "#f2c99a";
  ctx.fillRect(1, 3, 6, 3);
  ctx.fillStyle = "#1a1d29";
  ctx.fillRect(2, 4, 1, 1);
  ctx.fillRect(5, 4, 1, 1);
  // body + arms
  ctx.fillStyle = shirt;
  ctx.fillRect(1, 6, 6, 4);
  ctx.fillRect(0, 7, 1, 2);
  ctx.fillRect(7, 7, 1, 2);
  // legs
  ctx.fillStyle = "#2b3a5e";
  ctx.fillRect(1, 10, 2, 2);
  ctx.fillRect(5, 10, 2, 2);
  ctx.restore();
}

export default function Onboarding({ onComplete }: { onComplete: (p: UserProfile) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [shirt, setShirt] = useState(SHIRT_PALETTE[0]);
  const [hair, setHair] = useState(HAIR_PALETTE[0]);
  const [vibeWeights, setVibeWeights] = useState<Record<Vibe, number>>({
    study: 2, gym: 1, food: 2, chaos: 2,
  });
  const [rhythms, setRhythms] = useState<string[]>([]);
  const [ghostByDefault, setGhostByDefault] = useState(false);
  const [serendipityOptIn, setSerendipityOptIn] = useState(true);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (previewRef.current) drawPreview(previewRef.current, shirt, hair);
  }, [shirt, hair, step]);

  const profile: UserProfile = {
    name: name.trim(),
    avatar: { shirt, hair },
    vibeWeights,
    rhythms,
    privacy: { ghostByDefault, serendipityOptIn },
    onboardedAt: Date.now(),
  };

  const canAdvance = step !== 0 || name.trim().length > 0;
  const last = step === STEPS.length - 1;

  const next = () => {
    if (!canAdvance) return;
    if (last) onComplete(profile);
    else setStep((s) => s + 1);
  };

  const toggleRhythm = (id: string) => {
    setRhythms((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  };

  return (
    <div
      className="onboard"
      onKeyDown={(e) => {
        if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) next();
      }}
    >
      <div className="onboard-card">
        <div className="onboard-logo">🗺 ConnectMaxxer</div>
        <div className="onboard-dots">
          {STEPS.map((s, i) => (
            <span key={s} className={`dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="onboard-step">
            <h2>WHO ARE YOU?</h2>
            <p className="onboard-sub">Your sprite walks the map. Make it yours.</p>
            <input
              className="onboard-input"
              placeholder="your name"
              value={name}
              maxLength={16}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <div className="avatar-row">
              <canvas ref={previewRef} width={100} height={140} className="avatar-preview" />
              <div className="palette-col">
                <div className="palette-label">SHIRT</div>
                <div className="palette">
                  {SHIRT_PALETTE.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${c === shirt ? "picked" : ""}`}
                      style={{ background: c }}
                      onClick={() => setShirt(c)}
                      aria-label={`shirt ${c}`}
                    />
                  ))}
                </div>
                <div className="palette-label">HAIR</div>
                <div className="palette">
                  {HAIR_PALETTE.map((c) => (
                    <button
                      key={c}
                      className={`swatch ${c === hair ? "picked" : ""}`}
                      style={{ background: c }}
                      onClick={() => setHair(c)}
                      aria-label={`hair ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onboard-step">
            <h2>PICK YOUR VIBES</h2>
            <p className="onboard-sub">How hard do you go for each? This seeds your preference graph.</p>
            {VIBE_ORDER.map((v) => (
              <div key={v} className="vibe-row">
                <span className="vibe-name">
                  {VIBE_META[v].emoji} {VIBE_META[v].label}
                </span>
                <span className="level-btns">
                  {LEVEL_LABELS.map((label, lvl) => (
                    <button
                      key={label}
                      className={`level-btn ${vibeWeights[v] === lvl ? "picked" : ""}`}
                      onClick={() => setVibeWeights((w) => ({ ...w, [v]: lvl }))}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="onboard-step">
            <h2>YOUR RHYTHMS</h2>
            <p className="onboard-sub">Pick what sounds like you. The agent plans around these.</p>
            <div className="chip-grid">
              {RHYTHM_CHIPS.map((c) => (
                <button
                  key={c.id}
                  className={`chip ${rhythms.includes(c.id) ? "picked" : ""}`}
                  onClick={() => toggleRhythm(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboard-step">
            <h2>PRIVACY</h2>
            <p className="onboard-sub">You control the map. Change these anytime.</p>
            <button
              className={`toggle-row ${ghostByDefault ? "on" : ""}`}
              onClick={() => setGhostByDefault((g) => !g)}
            >
              <span className="toggle-state">{ghostByDefault ? "ON" : "OFF"}</span>
              <span>
                <b>👻 Ghost mode by default</b>
                <small>Start invisible on the map. Alerts stay on, nothing trains your graph.</small>
              </span>
            </button>
            <button
              className={`toggle-row ${serendipityOptIn ? "on" : ""}`}
              onClick={() => setSerendipityOptIn((s) => !s)}
            >
              <span className="toggle-state">{serendipityOptIn ? "ON" : "OFF"}</span>
              <span>
                <b>⚡ Serendipity alerts</b>
                <small>Short-window pings when people are free near you.</small>
              </span>
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="onboard-step">
            <h2>YOUR PREFERENCE GRAPH</h2>
            <p className="onboard-sub">Day one read. It sharpens with every join, skip, and leave.</p>
            <div className="summary-box">
              <p className="summary-line">{prefSummary(profile)}</p>
              <p className="summary-read">Tonight's read: {vibeRead(profile)}</p>
              <p className="summary-meta">
                {ghostByDefault ? "👻 ghost by default" : "👋 visible on the map"} ·{" "}
                {serendipityOptIn ? "⚡ serendipity on" : "⚡ serendipity off"}
              </p>
            </div>
          </div>
        )}

        <div className="onboard-nav">
          {step > 0 ? (
            <button className="btn" onClick={() => setStep((s) => s - 1)}>BACK</button>
          ) : (
            <span />
          )}
          <button className="btn join onboard-next" disabled={!canAdvance} onClick={next}>
            {last ? "START ▶" : "NEXT"}
          </button>
        </div>
      </div>
    </div>
  );
}
