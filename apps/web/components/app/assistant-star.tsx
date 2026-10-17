"use client";

import { useEffect, useId, useRef } from "react";

export type AssistantStarProps = {
  background?: boolean;
  color?: "blue" | "orange";
  followPointer?: boolean;
  className?: string;
  label?: string;
};

const PUFFS = [
  { cx: 115, cy: 93, r: 43 },
  { cx: 163, cy: 111, r: 39 },
  { cx: 156, cy: 155, r: 31 },
  { cx: 107, cy: 155, r: 35 },
  { cx: 72, cy: 126, r: 34 },
];
const CORE = { x: 80, y: 100, width: 80, height: 65 };
const EYES = { y: 106, w: 18, h: 31, left: 96.5, right: 127.5 };
const CX = 120;
const CY = 120;
const BOTTOM = 180;

const GLANCES = [
  { x: 0, y: 0 },
  { x: -1, y: 0.05 },
  { x: 1, y: -0.05 },
  { x: 0, y: 0 },
  { x: 0.65, y: -0.55 },
  { x: -0.7, y: 0.35 },
];

const about = (x: number, y: number, t: string) => `translate(${x} ${y}) ${t} translate(${-x} ${-y})`;
const Stop = ({ offset, color, opacity }: { offset: number; color: string; opacity?: number }) => (
  <stop offset={offset} style={{ stopColor: `var(--ui-star-${color})`, stopOpacity: opacity }} />
);

export function AssistantStar({
  background = true,
  color = "orange",
  followPointer = true,
  className,
  label = "A yellow star with eyes that floats, looks around and blinks",
}: AssistantStarProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `as${uid}-${name}`;

  const root = useRef<HTMLDivElement>(null);
  const floatRef = useRef<SVGGElement>(null);
  const turnRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const leftEye = useRef<SVGGElement>(null);
  const rightEye = useRef<SVGGElement>(null);
  const shineRef = useRef<SVGEllipseElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const look = { x: 0, y: 0, vx: 0, vy: 0 };
    const target = { x: 0, y: 0 };
    const squish = { p: 0, v: 0 };
    let pointer = false;
    let nextGlance = 1.2;
    let nextBlink = 1.8;
    let blinkAt = -1;
    let blinkTwice = false;
    let winkAt = -1;
    let frame = 0;
    let last = 0;
    let time = 0;

    const blinkScale = (since: number, length = 0.16) => (since < 0 || since > length ? 1 : 1 - 0.9 * Math.sin((since / length) * Math.PI));

    const draw = () => {
      const float = still ? 0 : Math.sin(time * 1.1) * 5;
      const breathe = still ? 0 : Math.sin(time * 1.1 + Math.PI / 2) * 0.012;
      const sy = 1 + breathe - squish.p * 0.12;
      const sx = 1 - breathe + squish.p * 0.1;
      floatRef.current?.setAttribute("transform", `translate(0 ${float.toFixed(2)}) ${about(CX, BOTTOM, `scale(${sx.toFixed(4)} ${sy.toFixed(4)})`)}`);
      turnRef.current?.setAttribute("transform", `translate(${(look.x * 4).toFixed(2)} ${(look.y * 2).toFixed(2)}) ${about(CX, CY, `rotate(${(look.x * 2.5).toFixed(2)}) scale(${(1 - Math.abs(look.x) * 0.025).toFixed(4)} 1)`)}`);
      eyesRef.current?.setAttribute("transform", `translate(${(look.x * 12).toFixed(2)} ${(look.y * 7).toFixed(2)})`);
      shineRef.current?.setAttribute("transform", `translate(${(-look.x * 7).toFixed(2)} ${(-look.y * 3).toFixed(2)})`);
      const both = blinkAt < 0 ? 1 : Math.min(blinkScale(time - blinkAt), blinkTwice ? blinkScale(time - blinkAt - 0.26) : 1);
      const wink = blinkScale(time - winkAt, 0.34);
      const eyeY = EYES.y + EYES.h / 2;
      leftEye.current?.setAttribute("transform", about(EYES.left + EYES.w / 2, eyeY, `scale(1 ${both.toFixed(3)})`));
      rightEye.current?.setAttribute("transform", about(EYES.right + EYES.w / 2, eyeY, `scale(1 ${Math.min(both, wink).toFixed(3)})`));
      const lift = (float + 5) / 10;
      shadowRef.current?.setAttribute("transform", about(CX, 210, `scale(${(1 - lift * 0.12).toFixed(3)} 1)`));
      shadowRef.current?.setAttribute("opacity", (0.34 - lift * 0.1).toFixed(3));
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      time += dt;

      if (!pointer && time > nextGlance) {
        const g = GLANCES[Math.floor(Math.random() * GLANCES.length)];
        target.x = g.x;
        target.y = g.y;
        nextGlance = time + 1.4 + Math.random() * 2.2;
      }
      if (time > nextBlink) {
        blinkAt = time;
        blinkTwice = Math.random() < 0.25;
        nextBlink = time + 2.4 + Math.random() * 3;
      }

      look.vx += ((target.x - look.x) * 70 - look.vx * 13) * dt;
      look.vy += ((target.y - look.y) * 70 - look.vy * 13) * dt;
      look.x += look.vx * dt;
      look.y += look.vy * dt;
      squish.v += (-squish.p * 220 - squish.v * 9) * dt;
      squish.p += squish.v * dt;

      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (frame || still) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
    io.observe(el);

    const onMove = (e: PointerEvent) => {
      if (!followPointer) return;
      const r = el.getBoundingClientRect();
      pointer = true;
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2.4));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2.4));
    };
    const onLeave = () => {
      pointer = false;
      target.x = 0;
      target.y = 0;
      nextGlance = time + 1.2;
    };
    const onDown = () => {
      squish.p = 0.9;
      squish.v = 0;
      winkAt = time + 0.12;
      if (still) {
        start();
        window.setTimeout(stop, 1200);
      }
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    draw();

    return () => {
      stop();
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
    };
  }, [followPointer]);

  const puffs = PUFFS.map((p, i) => <circle key={i} {...p} />);
  const eye = (x: number, ref: typeof leftEye, side: string) => {
    const pill = { x, y: EYES.y, width: EYES.w, height: EYES.h, rx: EYES.w / 2 };
    return (
      <g ref={ref}>
        <rect {...pill} x={x - 1.5} y={EYES.y - 1} width={EYES.w + 3} height={EYES.h + 3} rx={EYES.w / 2 + 1.5} className="ui-star__eye-drop" filter={`url(#${id("edge")})`} />
        <rect {...pill} fill={`url(#${id("hole")})`} />
        <clipPath id={id(`clip-${side}`)}>
          <rect {...pill} />
        </clipPath>
        <rect {...pill} y={EYES.y + 2.5} className="ui-star__eye-shade" fill="none" strokeWidth="5" filter={`url(#${id("edge")})`} clipPath={`url(#${id(`clip-${side}`)})`} />
      </g>
    );
  };

  return (
    <div
      ref={root}
      className={["ui-star", className].filter(Boolean).join(" ")}
      data-bg={background || undefined}
      data-color={color}
      role="img"
      aria-label={label}
    >
      <style href="ui-assistant-star" precedence="default">
        {css}
      </style>
      <svg viewBox="0 0 240 240" aria-hidden="true">
        <defs>
          <filter id={id("goo")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="3.5" />
            <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12" />
          </filter>
          <filter id={id("soft")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id={id("halo")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id={id("edge")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <filter id={id("shade")} x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <g id={id("shape")} filter={`url(#${id("goo")})`}>
            {puffs}
            <rect {...CORE} />
          </g>
          <mask id={id("mask")} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240">
            <use href={`#${id("shape")}`} fill="#fff" />
          </mask>
          <linearGradient id={id("frost")} x1="0" y1="50" x2="0" y2="192" gradientUnits="userSpaceOnUse">
            <Stop offset={0} color="white" />
            <Stop offset={1} color="frost" opacity={0.97} />
          </linearGradient>
          <linearGradient id={id("hole")} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} color="hole-1" />
            <Stop offset={1} color="hole-2" />
          </linearGradient>
        </defs>

        <ellipse ref={shadowRef} className="ui-star__shadow" cx={CX} cy="210" rx="54" ry="7" filter={`url(#${id("shade")})`} />

        <g ref={floatRef}>
          <g ref={turnRef}>
            <use href={`#${id("shape")}`} className="ui-star__halo" filter={`url(#${id("halo")})`} />
            <use href={`#${id("shape")}`} className="ui-star__edge" filter={`url(#${id("edge")})`} />
            <g mask={`url(#${id("mask")})`}>
              <rect width="240" height="240" fill={`url(#${id("frost")})`} />
              <g filter={`url(#${id("soft")})`} className="ui-star__tint" transform={`translate(-6 18) ${about(CX, CY, "scale(0.84 0.78)")}`}>
                {puffs}
                <rect {...CORE} />
              </g>
              <ellipse ref={shineRef} cx="108" cy="78" rx="34" ry="14" fill="#fff" opacity="0.75" filter={`url(#${id("shade")})`} />
            </g>
            <g ref={eyesRef}>
              {eye(EYES.left, leftEye, "l")}
              {eye(EYES.right, rightEye, "r")}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

const css = `
.ui-star {
  --ui-star-sky-top: #2475ea;
  --ui-star-sky-bottom: #4ac8f5;
  --ui-star-sky-light: rgba(110, 225, 255, 0.55);
  --ui-star-white: #ffffff;
  --ui-star-frost: #eef8ff;
  --ui-star-tint: rgba(70, 165, 235, 0.2);
  --ui-star-hole-1: #3aaef2;
  --ui-star-hole-2: #62cdfa;
  --ui-star-eye-drop: rgba(40, 130, 210, 0.1);
  --ui-star-eye-shade: rgba(10, 90, 190, 0.24);
  --ui-star-halo: rgba(30, 150, 255, 0.2);
  --ui-star-edge: rgba(20, 120, 240, 0.4);
  --ui-star-shadow: rgba(10, 90, 200, 0.55);
  --ui-star-ground: rgba(10, 80, 190, 0.4);
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.ui-star[data-color="orange"] {
  --ui-star-sky-top: #e94135;
  --ui-star-sky-bottom: #fa9842;
  --ui-star-sky-light: rgba(255, 205, 150, 0.5);
  --ui-star-frost: #fff5f0;
  --ui-star-tint: rgba(235, 110, 70, 0.2);
  --ui-star-hole-1: #f05f42;
  --ui-star-hole-2: #fba05b;
  --ui-star-eye-drop: rgba(200, 70, 40, 0.1);
  --ui-star-eye-shade: rgba(170, 40, 20, 0.24);
  --ui-star-halo: rgba(240, 100, 60, 0.2);
  --ui-star-edge: rgba(220, 80, 40, 0.4);
  --ui-star-shadow: rgba(170, 50, 20, 0.5);
  --ui-star-ground: rgba(150, 30, 10, 0.36);
}
.ui-star svg { display: block; width: 100%; max-width: 320px; overflow: visible; }
.ui-star__halo { fill: var(--ui-star-halo); }
.ui-star__edge { fill: var(--ui-star-edge); }
.ui-star__shadow { fill: var(--ui-star-shadow); }
.ui-star__tint { fill: var(--ui-star-tint); }
.ui-star__eye-drop { fill: var(--ui-star-eye-drop); }
.ui-star__eye-shade { stroke: var(--ui-star-eye-shade); }

.ui-star[data-bg] {
  --ui-star-halo: rgba(255, 255, 255, 0.75);
  --ui-star-edge: rgba(255, 255, 255, 0.5);
  --ui-star-shadow: var(--ui-star-ground);
  background:
    radial-gradient(60% 55% at 62% 42%, var(--ui-star-sky-light), transparent 70%),
    linear-gradient(180deg, var(--ui-star-sky-top), var(--ui-star-sky-bottom));
}

:where(.dark, [data-theme="dark"]) .ui-star {
  --ui-star-sky-top: #1659c8;
  --ui-star-sky-bottom: #2aa6e6;
  --ui-star-sky-light: rgba(90, 205, 255, 0.45);
  --ui-star-ground: rgba(5, 50, 140, 0.5);
}
:where(.dark, [data-theme="dark"]) .ui-star[data-color="orange"] {
  --ui-star-sky-top: #bf2722;
  --ui-star-sky-bottom: #ed701d;
  --ui-star-sky-light: rgba(255, 175, 120, 0.42);
  --ui-star-ground: rgba(110, 15, 5, 0.5);
}
:where(.dark, [data-theme="dark"]) .ui-star:not([data-bg]) {
  --ui-star-halo: rgba(255, 255, 255, 0.35);
  --ui-star-edge: rgba(255, 255, 255, 0.25);
}
`;
