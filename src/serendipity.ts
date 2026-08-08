// Serendipity engine: matches you with nearby non-circle students who share
// an interest, for a short hangout window with bonus points.

import { World } from "./game/world";

export interface Persona {
  id: string;
  name: string;
  hobbies: string[];
}

export const PERSONAS: Persona[] = [
  { id: "alex", name: "Alex", hobbies: ["climbing", "coffee"] },
  { id: "june", name: "June", hobbies: ["board games", "photography"] },
  { id: "theo", name: "Theo", hobbies: ["basketball", "pickleball"] },
  { id: "nia", name: "Nia", hobbies: ["climbing", "board games"] },
  { id: "marco", name: "Marco", hobbies: ["coffee", "photography"] },
  { id: "wren", name: "Wren", hobbies: ["board games", "coffee"] },
  { id: "ivan", name: "Ivan", hobbies: ["basketball", "climbing"] },
  { id: "lila", name: "Lila", hobbies: ["pickleball", "photography"] },
];

export interface SerendipityEvent {
  buildingId: string;
  hobby: string;
  people: Persona[];
  windowMin: number; // how long the hangout window lasts, in campus minutes
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a serendipity hangout: an open public building + 2-3 people who
 * share one of the user's interests. Returns null if nothing matches.
 */
export function generateSerendipity(world: World, hobbies: string[]): SerendipityEvent | null {
  if (hobbies.length === 0) return null;
  const spots = world.buildings.filter((b) => b.isPublic && world.isOpen(b));
  if (spots.length === 0) return null;

  // prefer hobbies that at least 2 personas share
  const viable = hobbies.filter(
    (h) => PERSONAS.filter((p) => p.hobbies.includes(h)).length >= 2,
  );
  if (viable.length === 0) return null;
  const hobby = pick(viable);
  const candidates = PERSONAS.filter((p) => p.hobbies.includes(hobby));
  const people = candidates.sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 2 : 3);

  return {
    buildingId: pick(spots).id,
    hobby,
    people,
    windowMin: 15 + Math.floor(Math.random() * 3) * 5,
  };
}

export function describeSerendipity(ev: SerendipityEvent, buildingName: string): string {
  const names = ev.people.map((p) => p.name).join(" & ");
  return `\u{26A1} Serendipity: ${names} (also into ${ev.hobby}) are at ${buildingName} for the next ${ev.windowMin} min`;
}
