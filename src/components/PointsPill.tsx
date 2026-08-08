import { useState } from "react";
import { RewardsState } from "../rewards";

export default function PointsPill({ rewards }: { rewards: RewardsState }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="points-wrap">
      <button className="points-pill" onClick={() => setOpen((o) => !o)}>
        {"\u26A1"} {rewards.points}
        {rewards.streak > 1 && <span className="streak"> {"\u{1F525}"}{rewards.streak}</span>}
      </button>
      {open && (
        <div className="points-pop">
          <div className="points-pop-row"><span>Points</span><b>{rewards.points}</b></div>
          <div className="points-pop-row"><span>Streak</span><b>{rewards.streak}</b></div>
          <div className="points-pop-row"><span>New people met</span><b>{rewards.met.length}</b></div>
          {rewards.lastGain && <div className="points-pop-last">{rewards.lastGain}</div>}
          <div className="points-pop-hint">Earn points by accepting serendipity hangouts — bonus for meeting new people.</div>
        </div>
      )}
    </div>
  );
}
