"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Search } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Product Tour / Spotlight Walkthrough                                       */
/*  Deps: react 19, react-dom, framer-motion, tailwindcss.                     */
/*                                                                             */
/*  <ProductTour open={open} steps={steps} onClose={(reason) => setOpen(false)} /> */
/*  A step's `target` is a CSS selector or a getter: () => ref.current         */
/*  Omit `target` for a centered welcome / goodbye step.                       */
/* -------------------------------------------------------------------------- */

export type TourPlacement = "auto" | "top" | "bottom" | "left" | "right";
export type TourTarget = string | (() => HTMLElement | null);

export type TourStep = {
  target?: TourTarget;
  title: string;
  body: ReactNode;
  placement?: TourPlacement;
  /** Space between the element and the cutout edge (default 8) */
  padding?: number;
  /** Cutout corner radius. Defaults to the element's own radius + padding */
  radius?: number;
  /** Set false to never auto-scroll to this target */
  scroll?: boolean;
};

export type TourCloseReason = "done" | "skip" | "dismiss";

export interface ProductTourProps {
  steps: TourStep[];
  open: boolean;
  onClose: (reason: TourCloseReason) => void;
  onStepChange?: (index: number) => void;
  startAt?: number;
  closeOnOverlayClick?: boolean;
}

type Rect = { x: number; y: number; w: number; h: number; r: number };

const CARD_W = 340;
const SHEET_W = 440; // docked bottom-sheet max width on small screens
const SMALL = 640; // below this width the card docks to the bottom
const cardWidth = (vw: number) => (vw < SMALL ? Math.min(SHEET_W, vw - 24) : CARD_W);
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const SPOT = { type: "spring", stiffness: 380, damping: 38, mass: 0.9 } as const;
const CARD = { type: "spring", stiffness: 320, damping: 34, mass: 0.9 } as const;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/* ------------------------------ DOM helpers -------------------------------- */

function resolve(t?: TourTarget): HTMLElement | null {
  if (!t) return null;
  return typeof t === "string" ? document.querySelector<HTMLElement>(t) : t();
}

function rectOf(el: HTMLElement, s: TourStep): Rect {
  const b = el.getBoundingClientRect();
  const p = s.padding ?? 8;
  const w = b.width + p * 2;
  const h = b.height + p * 2;
  const cs = getComputedStyle(el).borderTopLeftRadius;
  let br = parseFloat(cs) || 0;
  if (cs.includes("%")) br = (br / 100) * Math.min(b.width, b.height);
  const r = s.radius ?? Math.min(Math.max(br + p, 8), Math.min(w, h) / 2);
  return { x: b.left - p, y: b.top - p, w, h, r };
}

// Find the element (it may mount late), scroll it into view, wait for scrolling to settle
async function prepare(s: TourStep, instant: boolean, bottomInset = 0) {
  if (!s.target) return null;
  let el = resolve(s.target);
  for (let i = 0; !el && i < 36; i++) {
    await frame();
    el = resolve(s.target);
  }
  if (!el) return null;

  const b = el.getBoundingClientRect();
  const M = 24;
  const visible =
    b.top >= M && b.bottom <= window.innerHeight - M - bottomInset && b.left >= 0 && b.right <= window.innerWidth;
  if (s.scroll !== false && !visible) {
    // scroll-margin makes "center" land the element in the area ABOVE the docked card
    const prevMargin = el.style.scrollMarginBottom;
    if (bottomInset) el.style.scrollMarginBottom = `${bottomInset}px`;
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: instant ? "auto" : "smooth" });
    let last = el.getBoundingClientRect().top;
    let still = 0;
    const t0 = performance.now();
    while (still < 6 && performance.now() - t0 < 1000) {
      await frame();
      const top = el.getBoundingClientRect().top;
      still = Math.abs(top - last) < 0.5 ? still + 1 : 0;
      last = top;
    }
    el.style.scrollMarginBottom = prevMargin;
  }
  return el;
}

// Pick the side with room (preferred first), then clamp inside the viewport
function place(r: Rect | null, cw: number, ch: number, vw: number, vh: number, pref: TourPlacement = "auto", dock?: number) {
  const M = 16;
  const G = 14;
  if (!r) return { x: (vw - cw) / 2, y: (vh - ch) / 2 };
  // small screens: a sheet at the bottom, or at the top when the thing it points at is in the lower half (the nav and the player are)
  if (dock !== undefined) return { x: (vw - cw) / 2, y: r.y + r.h / 2 > vh / 2 ? 12 : Math.max(12, vh - ch - dock) };

  const room = {
    bottom: vh - (r.y + r.h) - M - ch - G,
    top: r.y - M - ch - G,
    right: vw - (r.x + r.w) - M - cw - G,
    left: r.x - M - cw - G,
  };
  const all = ["bottom", "top", "right", "left"] as const;
  const order = pref === "auto" ? all : [pref, ...all.filter((s) => s !== pref)];
  const side = order.find((s) => room[s] >= 0) ?? all.reduce((a, b) => (room[a] > room[b] ? a : b));

  let x = r.x + r.w / 2 - cw / 2;
  let y = r.y + r.h / 2 - ch / 2;
  if (side === "bottom") y = r.y + r.h + G;
  if (side === "top") y = r.y - G - ch;
  if (side === "right") x = r.x + r.w + G;
  if (side === "left") x = r.x - G - cw;

  return { x: clamp(x, M, Math.max(M, vw - cw - M)), y: clamp(y, M, Math.max(M, vh - ch - M)) };
}

/* -------------------------------- Component -------------------------------- */

const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 20 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -20 }),
};

export function ProductTour({
  steps,
  open,
  onClose,
  onStepChange,
  startAt = 0,
  closeOnOverlayClick = false,
}: ProductTourProps) {
  const uid = useId().replace(/:/g, "");
  const reduce = useReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(startAt);
  const [ready, setReady] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setIndex(clamp(startAt, 0, steps.length - 1));
    else setReady(false);
  }

  // Spotlight cutout + card, all driven imperatively through motion values
  const sx = useMotionValue(0);
  const sy = useMotionValue(0);
  const sw = useMotionValue(0);
  const sh = useMotionValue(0);
  const sr = useMotionValue(0);
  const cx = useMotionValue(0);
  const cy = useMotionValue(0);
  const regionH = useMotionValue(0);

  // SVG <rect> strictly forbids negative width, height, and rx
  const safeW = useTransform(sw, (v) => Math.max(0, v));
  const safeH = useTransform(sh, (v) => Math.max(0, v));
  const safeR = useTransform(sr, (v) => Math.max(0, v));

  const rectRef = useRef<Rect | null>(null);
  const elRef = useRef<HTMLElement | null>(null);
  const cardHRef = useRef(0);
  const firstRef = useRef(true);
  const preparingRef = useRef(false);
  const movingRef = useRef(false);
  const dirRef = useRef(1);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const roRef = useRef<ResizeObserver | null>(null);
  const prevFocus = useRef<Element | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const contentEl = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const safeRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  const stepRef = useRef(step);
  stepRef.current = step;

  const move = (mv: MotionValue<number>, to: number, mode: "spring" | "instant", spring: typeof SPOT | typeof CARD = SPOT) => {
    if (mode === "instant" || reduce) {
      mv.stop();
      mv.set(to);
    } else animate(mv, to, spring);
  };

  const layoutCut = (mode: "spring" | "instant", intro = false) => {
    const r = rectRef.current;
    const c = r ?? { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 0, h: 0, r: 0 };
    if (intro && !reduce && r) {
      // hole starts wide and closes in on the target
      sx.set(c.x - 48);
      sy.set(c.y - 48);
      sw.set(Math.max(0, c.w + 96));
      sh.set(Math.max(0, c.h + 96));
      sr.set(Math.max(0, c.r + 16));
    }
    move(sx, c.x, mode);
    move(sy, c.y, mode);
    move(sw, Math.max(0, c.w), mode);
    move(sh, Math.max(0, c.h), mode);
    move(sr, Math.max(0, c.r), mode);
  };

  const layoutCard = (mode: "spring" | "instant") => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = cardWidth(vw);
    const safe = parseFloat(getComputedStyle(safeRef.current ?? document.body).paddingBottom) || 0;
    const dock = vw < SMALL ? 12 + safe : undefined;
    const p = place(rectRef.current, cw, cardHRef.current, vw, vh, stepRef.current.placement, dock);
    move(cx, p.x, mode, CARD);
    move(cy, p.y, mode, CARD);
  };

  const go = (i: number) => {
    if (i < 0) return;
    if (i >= steps.length) return onClose("done");
    dirRef.current = i > index ? 1 : -1;
    setIndex(i);
    onStepChange?.(i);
  };

  useEffect(() => setMounted(true), []);

  // 1) Step change: find target → scroll → measure → spring the cutout over
  useEffect(() => {
    if (!open || !mounted) return;
    let cancelled = false;
    preparingRef.current = true;
    (async () => {
      const s = steps[index];
      const compact = window.innerWidth < SMALL;
      if (compact) await frame(); // let the new card content report its height first
      if (cancelled) return;
      const safe = parseFloat(getComputedStyle(safeRef.current ?? document.body).paddingBottom) || 0;
      const inset = compact ? Math.max(cardHRef.current, 200) + 12 + safe + 12 : 0;
      const el = await prepare(s, !!reduce, inset);
      if (cancelled) return;
      elRef.current = el;
      rectRef.current = el ? rectOf(el, s) : null;
      roRef.current?.disconnect();
      if (el) roRef.current?.observe(el);
      preparingRef.current = false;

      movingRef.current = true; // while "moving", scroll/resize retarget the spring instead of snapping
      clearTimeout(moveTimer.current);
      moveTimer.current = setTimeout(() => (movingRef.current = false), 700);

      const intro = firstRef.current;
      firstRef.current = false;
      layoutCut("spring", intro);
      layoutCard(intro ? "instant" : "spring");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, mounted]);

  // 2) Measure the card content so the card can animate its height and be placed correctly
  useEffect(() => {
    if (!open || !mounted) return;
    const el = contentEl.current;
    if (!el) return;
    const report = () => {
      const card = cardRef.current;
      const region = regionRef.current;
      if (!card || !region) return;
      const vh = window.innerHeight;
      const cap = window.innerWidth < SMALL ? vh * 0.4 : vh - 160; // long copy scrolls inside the card
      const contentH = Math.min(el.offsetHeight, Math.max(96, cap));
      const chrome = card.offsetHeight - region.offsetHeight; // header + footer
      const first = cardHRef.current === 0;
      cardHRef.current = contentH + chrome;
      move(regionH, contentH, first ? "instant" : "spring", CARD);
      if (!preparingRef.current) layoutCard(first ? "instant" : "spring");
      setReady(true);
    };
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, mounted]);

  // 3) Keep the cutout glued to the target on scroll / resize
  useEffect(() => {
    if (!open || !mounted) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (preparingRef.current) return;
        const s = stepRef.current;
        const el = elRef.current?.isConnected ? elRef.current : resolve(s.target);
        if (el) {
          elRef.current = el;
          rectRef.current = rectOf(el, s);
        }
        const mode = movingRef.current ? "spring" : "instant";
        layoutCut(mode);
        layoutCard(mode);
      });
    };
    roRef.current = new ResizeObserver(update);
    if (elRef.current) roRef.current.observe(elRef.current);
    window.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update); // mobile toolbars / zoom
    return () => {
      cancelAnimationFrame(raf);
      window.visualViewport?.removeEventListener("resize", update);
      roRef.current?.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  // Lock user scrolling (programmatic scrollIntoView still works) + reset on close
  useEffect(() => {
    if (!open) {
      firstRef.current = true;
      cardHRef.current = 0;
      rectRef.current = null;
      elRef.current = null;
      return;
    }
    const stop = (e: Event) => {
      if (cardRef.current?.contains(e.target as Node)) return; // card copy may scroll
      e.preventDefault();
    };
    window.addEventListener("wheel", stop, { passive: false });
    window.addEventListener("touchmove", stop, { passive: false });
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
    };
  }, [open]);

  // Keyboard: ← → navigate, Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose("dismiss");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  // Focus: into the card when ready, back to where it was on close
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement;
    return () => (prevFocus.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (open && ready) nextRef.current?.focus({ preventScroll: true });
  }, [open, ready]);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const f = cardRef.current?.querySelectorAll<HTMLElement>("button");
    if (!f?.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;
  const isLast = index === steps.length - 1;
  const btn = "inline-flex min-h-11 items-center px-4 [-webkit-tap-highlight-color:transparent] text-[13px] font-semibold uppercase tracking-[0.08em] outline-none transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-signal sm:min-h-9";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[9999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
          {/* Dim layer with a springy cutout (blocks interaction with the page) */}
          <svg
            className="absolute inset-0 h-full w-full"
            aria-hidden
            onClick={closeOnOverlayClick ? () => onClose("dismiss") : undefined}
          >
            <defs>
              <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
                <rect width="100%" height="100%" fill="white" />
                <motion.rect x={sx} y={sy} width={safeW} height={safeH} rx={safeR} fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" className="fill-ground" fillOpacity={0.78} mask={`url(#${uid}-mask)`} />
            <motion.rect
              x={sx}
              y={sy}
              width={safeW}
              height={safeH}
              rx={safeR}
              fill="none"
              className="stroke-signal"
              strokeWidth={2}
            />
            <motion.rect x={sx} y={sy} width={safeW} height={safeH} rx={safeR} fill="none" className="tour-ping stroke-signal" strokeWidth={2} />
          </svg>

          {/* Reads env(safe-area-inset-bottom) so the docked card clears the home indicator */}
          <div ref={safeRef} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />

          {/* Tooltip card rides along */}
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label="Product tour"
            onKeyDown={trapTab}
            className="absolute left-0 top-0 w-[calc(100vw-24px)] max-w-[440px] overflow-hidden rounded-2xl border border-ink/40 bg-ground text-ink sm:w-[340px] sm:max-w-none"
            style={{ x: cx, y: cy }}
            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
            animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.9, rotate: ready ? 0 : -2 }}
            transition={{ type: "spring", stiffness: 420, damping: 24, opacity: { duration: 0.15 } }}
          >
            <div className="flex items-center justify-between pl-4 pr-1 pt-1 text-[11px] uppercase tracking-[0.12em] tabular-nums text-ink-3">
              <span>
                {index + 1} of {steps.length}
              </span>
              <button
                type="button"
                onClick={() => onClose("skip")}
                className="min-h-11 px-3 text-[11px] uppercase tracking-[0.12em] outline-none transition-colors duration-150 [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-signal [@media(hover:hover)]:hover:text-ink sm:min-h-9"
              >
                Skip
              </button>
            </div>

            <motion.div ref={regionRef} className="relative overflow-y-auto overflow-x-hidden overscroll-contain" style={{ height: regionH }} aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false} custom={dirRef.current}>
                <motion.div
                  key={index}
                  ref={(el) => {
                    if (el) contentEl.current = el;
                  }}
                  custom={dirRef.current}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="px-4 pb-1 pt-2"
                >
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                    {step.title}
                  </h2>
                  <div className="mt-1 text-[13px] leading-relaxed text-ink-2">{step.body}</div>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-2">
              <div className="flex items-center gap-[5px]" aria-hidden>
                {steps.map((_, i) => (
                  <span key={i} className={`block h-1.5 transition-[width,background-color] duration-200 ease-out ${i === index ? "w-4 bg-signal" : "w-1.5 bg-ink/30"}`} />
                ))}
              </div>
              <div className="flex gap-1.5">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => go(index - 1)}
                    className={`${btn} border border-ink/30 text-ink [@media(hover:hover)]:hover:bg-ink/10`}
                  >
                    Back
                  </button>
                )}
                <button
                  ref={nextRef}
                  type="button"
                  onClick={() => go(index + 1)}
                  className={`${btn} bg-signal text-on-signal`}
                >
                  {isLast ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------------------------------- Demo ----------------------------------- */

export function ProductTourDemo() {
  const [open, setOpen] = useState(false);

  const steps: TourStep[] = [
    { title: "Welcome aboard", body: "A 30-second tour of the essentials. Tap Next to move around (← → and Esc work too)." },
    { target: '[data-tour="search"]', title: "Search anything", body: "Jump to any project, person or setting from one place.", placement: "bottom" },
    { target: '[data-tour="new"]', title: "Start something new", body: "Projects live here. Create your first one in a click.", placement: "left" },
    { target: '[data-tour="stats"]', title: "Numbers at a glance", body: "Revenue, active users and churn update in real time.", placement: "bottom" },
    { target: '[data-tour="activity"]', title: "Stay in the loop", body: "Everything your team does lands in this feed. The page scrolled here on its own." },
  ];

  const card = "rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900";

  return (
    <div className="min-h-dvh bg-neutral-50 p-4 sm:p-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="mx-auto flex max-w-4xl items-center gap-2.5 sm:gap-3">
        <div
          data-tour="search"
          className="flex h-10 flex-1 min-w-0 items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <Search className="size-4 shrink-0 text-neutral-400" />
          <span className="hidden sm:inline">Search…</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 rounded-xl border border-neutral-200 px-4 text-sm font-medium transition-transform active:scale-[0.97] dark:border-neutral-800 cursor-pointer"
        >
          Start tour
        </button>
        <button
          type="button"
          data-tour="new"
          className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          New project
        </button>
      </header>

      <main className="mx-auto mt-6 max-w-4xl">
        <div data-tour="stats" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {["Revenue", "Active users", "Churn"].map((l, i) => (
            <div key={l} className={card}>
              <p className="text-[13px] text-neutral-500">{l}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{["$48.2k", "2,841", "1.9%"][i]}</p>
            </div>
          ))}
        </div>
        <div className="h-[70svh]" />
        <div data-tour="activity" className={`${card} h-40`}>
          <p className="text-sm font-medium">Activity</p>
          <p className="mt-1 text-[13px] text-neutral-500">Nothing yet — your team’s updates will show up here.</p>
        </div>
        <div className="h-24" />
      </main>

      <ProductTour open={open} steps={steps} onClose={() => setOpen(false)} />
    </div>
  );
}

export default ProductTour;
