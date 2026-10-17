"use client";

import { useEffect, useRef } from "react";

export type AssistantStarProps = {
  followPointer?: boolean;
  busy?: boolean;
  hop?: number;
  className?: string;
};

const STAR = "M120.0 34.0 L150.0 84.7 L207.5 97.6 L168.5 141.8 L174.1 200.4 L120.0 177.0 L65.9 200.4 L71.5 141.8 L32.5 97.6 L90.0 84.7 Z";
const EYES = { y: 122, rx: 9, ry: 15.5, left: 102, right: 138 };
const CX = 120;
const CY = 126;
const BOTTOM = 200;
const SHADOW_Y = 228;

const GLANCES = [
  { x: 0, y: 0 },
  { x: -1, y: 0.05 },
  { x: 1, y: -0.05 },
  { x: 0, y: 0 },
  { x: 0.65, y: -0.55 },
  { x: -0.7, y: 0.35 },
];

const about = (x: number, y: number, t: string) => `translate(${x} ${y}) ${t} translate(${-x} ${-y})`;

export function AssistantStar({ followPointer = true, busy = false, hop = 0, className }: AssistantStarProps) {
  const root = useRef<HTMLDivElement>(null);
  const floatRef = useRef<SVGGElement>(null);
  const turnRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const leftEye = useRef<SVGGElement>(null);
  const rightEye = useRef<SVGGElement>(null);
  const shineRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const busyRef = useRef(busy);
  const hopRef = useRef(hop);

  useEffect(() => {
    busyRef.current = busy;
    hopRef.current = hop;
  });

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
    let hopAt = -1;
    let seenHop = hopRef.current;

    const blinkScale = (since: number, length = 0.16) => (since < 0 || since > length ? 1 : 1 - 0.9 * Math.sin((since / length) * Math.PI));

    const draw = () => {
      const hopT = (time - hopAt) / 0.5;
      const jump = hopAt < 0 || hopT > 1 ? 0 : Math.sin(hopT * Math.PI) * 14;
      const float = still ? 0 : Math.sin(time * 1.1) * 5 - jump;
      const breathe = still ? 0 : Math.sin(time * 1.1 + Math.PI / 2) * 0.012;
      const sy = 1 + breathe - squish.p * 0.12;
      const sx = 1 - breathe + squish.p * 0.1;
      floatRef.current?.setAttribute("transform", `translate(0 ${float.toFixed(2)}) ${about(CX, BOTTOM, `scale(${sx.toFixed(4)} ${sy.toFixed(4)})`)}`);
      turnRef.current?.setAttribute("transform", `translate(${(look.x * 4).toFixed(2)} ${(look.y * 2).toFixed(2)}) ${about(CX, CY, `rotate(${(look.x * 2.5 + (busyRef.current ? Math.sin((time * Math.PI * 2) / 1.2) * 7 : 0)).toFixed(2)}) scale(${(1 - Math.abs(look.x) * 0.025).toFixed(4)} 1)`)}`);
      eyesRef.current?.setAttribute("transform", `translate(${(look.x * 12).toFixed(2)} ${(look.y * 7).toFixed(2)})`);
      shineRef.current?.setAttribute("transform", `translate(${(-look.x * 7).toFixed(2)} ${(-look.y * 3).toFixed(2)})`);
      const both = blinkAt < 0 ? 1 : Math.min(blinkScale(time - blinkAt), blinkTwice ? blinkScale(time - blinkAt - 0.26) : 1);
      const wink = blinkScale(time - winkAt, 0.34);
      leftEye.current?.setAttribute("transform", about(EYES.left, EYES.y, `scale(1 ${both.toFixed(3)})`));
      rightEye.current?.setAttribute("transform", about(EYES.right, EYES.y, `scale(1 ${Math.min(both, wink).toFixed(3)})`));
      const lift = Math.min(1, Math.max(0, (float + 5) / 10));
      shadowRef.current?.setAttribute("transform", about(CX, SHADOW_Y, `scale(${(1 - lift * 0.12).toFixed(3)} 1)`));
      shadowRef.current?.setAttribute("opacity", (0.9 - lift * 0.3).toFixed(3));
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      time += dt;

      if (hopRef.current !== seenHop) {
        seenHop = hopRef.current;
        hopAt = time;
        winkAt = time + 0.15;
      }
      if (busyRef.current) {
        target.x = -1;
        target.y = -0.7;
      } else if (!pointer && time > nextGlance) {
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

  const eye = (x: number, ref: typeof leftEye) => (
    <g ref={ref}>
      <ellipse cx={x} cy={EYES.y} rx={EYES.rx} ry={EYES.ry} fill="var(--star-eye)" />
      <circle cx={x - 2.5} cy={EYES.y - 6.5} r="3.2" fill="var(--star-glint)" />
    </g>
  );

  return (
    <div
      ref={root}
      className={["relative grid aspect-square w-full select-none place-items-center", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 240" className="block w-full overflow-visible">
        <defs>
          <linearGradient id="assistant-star-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--star-top)" }} />
            <stop offset="1" style={{ stopColor: "var(--star-bottom)" }} />
          </linearGradient>
        </defs>
        <ellipse ref={shadowRef} cx={CX} cy={SHADOW_Y} rx="40" ry="6.5" fill="var(--star-shadow)" style={{ filter: "blur(2px)" }} />
        <g ref={floatRef}>
          <g ref={turnRef}>
            <path d={STAR} fill="var(--star-edge)" stroke="var(--star-edge)" strokeWidth="22" strokeLinejoin="round" />
            <path d={STAR} fill="url(#assistant-star-body)" stroke="url(#assistant-star-body)" strokeWidth="14" strokeLinejoin="round" />
            <g ref={shineRef}>
              <ellipse cx="94" cy="80" rx="19" ry="8" transform="rotate(-32 94 80)" fill="#fff" opacity="0.5" />
            </g>
            <g ref={eyesRef}>
              {eye(EYES.left, leftEye)}
              {eye(EYES.right, rightEye)}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
