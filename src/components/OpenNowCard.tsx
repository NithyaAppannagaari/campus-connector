import { Building, World, fmtClock } from "../game/world";

interface Props {
  world: World;
  onSelect: (id: string) => void;
  onGo: (b: Building) => void;
}

type Status = "open" | "closing" | "closed";

function statusOf(world: World, b: Building): Status {
  if (!world.isOpen(b)) return "closed";
  const left = world.minutesToClose(b);
  return left !== null && left <= 45 ? "closing" : "open";
}

const STATUS_LABEL: Record<Status, string> = {
  open: "open",
  closing: "closing soon",
  closed: "closed",
};

export default function OpenNowCard({ world, onSelect, onGo }: Props) {
  const spots = world.buildings
    .filter((b) => b.dropIn)
    .map((b) => ({ b, status: statusOf(world, b) }))
    .sort((a, z) => {
      const rank: Record<Status, number> = { open: 0, closing: 1, closed: 2 };
      return rank[a.status] - rank[z.status];
    });

  return (
    <div className="card open-now-card">
      <div className="card-title">
        OPEN NOW <span className="clock-inline">{fmtClock(world.clockMin)}</span>
      </div>
      <div className="spot-list">
        {spots.map(({ b, status }) => {
          const friends = world.friendsInside(b.id).length;
          const left = world.minutesToClose(b);
          return (
            <div key={b.id} className={`spot-row ${status}`} onClick={() => onSelect(b.id)}>
              <span className={`dot ${status}`} />
              <span className="spot-name">{b.emoji} {b.name}</span>
              <span className="spot-meta">
                {status === "closed"
                  ? `opens ${fmtClock(b.openMin)}`
                  : [
                      b.openSpots !== null ? `${b.openSpots} spots` : null,
                      friends > 0 ? `${friends} friend${friends > 1 ? "s" : ""}` : null,
                      status === "closing" && left !== null ? `${left}m left` : null,
                    ]
                      .filter(Boolean)
                      .join(" \u{00B7} ") || STATUS_LABEL[status]}
              </span>
              {status !== "closed" && (() => {
                const here = world.player.state === "inside" && world.player.buildingId === b.id;
                const enRoute = world.player.state === "walking" && world.player.buildingId === b.id;
                return (
                  <button
                    className="go-btn"
                    disabled={here || enRoute}
                    onClick={(e) => {
                      e.stopPropagation();
                      onGo(b);
                    }}
                  >
                    {here ? "\u2713" : enRoute ? "\u2026" : "GO"}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
