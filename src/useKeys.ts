import { useCallback, useEffect } from "react";

export type GameAction =
  | "prev" | "next" | "up" | "down" | "confirm" | "cancel" | "ghost";

const KEY_MAP: Record<string, GameAction> = {
  ArrowLeft: "prev",
  ArrowRight: "next",
  ArrowUp: "up",
  ArrowDown: "down",
  Enter: "confirm",
  " ": "confirm",
  Escape: "cancel",
  g: "ghost",
  G: "ghost",
};

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Keyboard controls for the map. Keys are ignored while a form field has focus,
 * otherwise typing a club name would walk the selection cursor. Escape is the
 * exception: it steps out of the field first.
 */
export function useKeys(handle: (action: GameAction) => void) {
  const stable = useCallback(handle, [handle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const action = KEY_MAP[e.key];
      if (!action) return;
      if (isTyping(e.target)) {
        if (action !== "cancel") return;
        (e.target as HTMLElement).blur();
        return;
      }
      e.preventDefault();
      stable(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stable]);
}
