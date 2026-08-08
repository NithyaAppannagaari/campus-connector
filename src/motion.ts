import { gsap } from "gsap";
import { RefObject, useEffect } from "react";

const reduced = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Sprite animation advances frame by frame rather than easing continuously.
 * Stepping the tweens keeps the UI moving like the pixel world it sits in.
 */
const STEPS = "steps(5)";

/** Entrance for a freshly mounted element. Skipped entirely under reduced motion. */
export function useEnter(
  ref: RefObject<HTMLElement>,
  vars: gsap.TweenVars,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    const tween = gsap.from(el, { duration: 0.28, ease: STEPS, ...vars });
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: "all" });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** A menu window popping open over the world, the way a game menu snaps in. */
export function openMenu(el: HTMLElement | null) {
  if (!el || reduced()) return;
  gsap.fromTo(
    el,
    { scale: 0.9, opacity: 0, y: 10 },
    { scale: 1, opacity: 1, y: 0, duration: 0.24, ease: STEPS, clearProps: "all" },
  );
}

/** Staggered entrance for the newest children of a list container. */
export function enterChildren(container: HTMLElement | null, selector: string, count: number) {
  if (!container || reduced() || count <= 0) return;
  const nodes = Array.from(container.querySelectorAll(selector)).slice(-count);
  if (nodes.length === 0) return;
  gsap.from(nodes, {
    duration: 0.24,
    x: -8,
    opacity: 0,
    ease: STEPS,
    stagger: 0.05,
    clearProps: "all",
  });
}

/** Brief attention flash used when a pop-up goes live, like an LCD refresh. */
export function flash(el: HTMLElement | null) {
  if (!el || reduced()) return;
  gsap.fromTo(
    el,
    { filter: "invert(1)" },
    { filter: "invert(0)", duration: 0.12, repeat: 3, ease: STEPS, clearProps: "filter" },
  );
}
