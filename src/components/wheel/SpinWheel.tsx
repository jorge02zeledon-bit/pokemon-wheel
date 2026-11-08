"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef, useMemo } from "react";
import type { Rarity } from "@prisma/client";
import { buildSlices, easeOutQuart, pickLandingBps, targetRotation } from "@/lib/wheel-layout";
import { formatBps } from "@/lib/money";

/**
 * Canvas prize wheel.
 *
 * The wheel never decides anything. It spins at a constant speed while the
 * server is asked for a result, then eases to a stop with the server-chosen
 * tier under the pointer. Slice arcs are exactly proportional to the odds
 * (see src/lib/wheel-layout.ts).
 *
 * Imperative API (via ref):
 *   startSpinning()           begin the "waiting for server" spin
 *   settleOn(tierId): Promise resolves when the wheel has stopped on that tier
 *   abort(): Promise          decelerate to a stop (request failed)
 */
export interface WheelTier {
  id: string;
  name: string;
  rarity: Rarity;
  oddsBps: number;
  color: string;
}

export interface SpinWheelHandle {
  startSpinning(): void;
  settleOn(tierId: string): Promise<void>;
  abort(): Promise<void>;
}

interface Props {
  tiers: WheelTier[];
  accentColor: string;
  centerLabel?: string;
  size?: number;
}

const IDLE_SPEED = 14; // rad/s while waiting for the server
const SPINUP_MS = 350;
const SETTLE_MS = 5200;
const ABORT_MS = 900;

export const SpinWheel = forwardRef<SpinWheelHandle, Props>(function SpinWheel(
  { tiers, accentColor, centerLabel, size = 440 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slices = useMemo(() => buildSlices(tiers), [tiers]);
  const tierById = useMemo(() => new Map(tiers.map((t) => [t.id, t])), [tiers]);

  // Animation state lives in refs so re-renders never interrupt a spin.
  const rotation = useRef(0);
  const raf = useRef<number | null>(null);
  const phase = useRef<"idle" | "spinup" | "spinning" | "settling" | "aborting">("idle");
  const phaseStart = useRef(0);
  const settleFrom = useRef(0);
  const settleTo = useRef(0);
  const resolver = useRef<(() => void) | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // ----- drawing -----------------------------------------------------------
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssSize = canvas.clientWidth || size;
    if (canvas.width !== cssSize * dpr) {
      canvas.width = cssSize * dpr;
      canvas.height = cssSize * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const cx = cssSize / 2;
    const cy = cssSize / 2;
    const R = cssSize / 2 - 6;
    const fontFamily = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    const pointerAngle = -Math.PI / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation.current);

    // Slices
    for (const s of slices) {
      const tier = tierById.get(s.tierId)!;
      const a0 = pointerAngle + (s.startBps / 10_000) * Math.PI * 2;
      const a1 = pointerAngle + (s.endBps / 10_000) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = shade(tier.color, s.indexInTier % 2 === 0 ? 0 : -0.12);
      if (tier.rarity === "CHASE") {
        ctx.shadowColor = tier.color;
        ctx.shadowBlur = 24;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(11,15,25,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label when the slice is wide enough (>= 4%); otherwise a short tag.
      const widthBps = s.endBps - s.startBps;
      const mid = (a0 + a1) / 2;
      // Keep labels readable: on the left half of the wheel (in screen space)
      // flip the text 180° so it never renders upside down.
      const screenAngle = mid + rotation.current;
      const flipped = Math.cos(screenAngle) < 0;
      ctx.save();
      ctx.rotate(mid + (flipped ? Math.PI : 0));
      ctx.textAlign = flipped ? "left" : "right";
      ctx.textBaseline = "middle";
      const edge = flipped ? -(R - 14) : R - 14;
      const lineGap = Math.max(12, cssSize * 0.034);
      ctx.fillStyle = tier.rarity === "COMMON" ? "rgba(230,233,242,0.92)" : "#0b0f19";
      if (widthBps >= 400) {
        ctx.font = `700 ${Math.max(11, cssSize * 0.032)}px ${fontFamily}`;
        ctx.fillText(tier.name, edge, 0);
        ctx.font = `500 ${Math.max(10, cssSize * 0.026)}px ${fontFamily}`;
        ctx.fillStyle = tier.rarity === "COMMON" ? "rgba(230,233,242,0.7)" : "rgba(11,15,25,0.75)";
        ctx.fillText(formatBps(tier.oddsBps), edge, flipped ? -lineGap : lineGap);
      } else if (widthBps >= 150) {
        ctx.font = `700 ${Math.max(9, cssSize * 0.024)}px ${fontFamily}`;
        ctx.fillText(formatBps(tier.oddsBps), flipped ? -(R - 10) : R - 10, 0);
      }
      ctx.restore();
    }

    // Hub
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0f19";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = accentColor;
    ctx.stroke();
    ctx.restore();

    // Hub label (not rotated)
    if (centerLabel) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e6e9f2";
      ctx.font = `800 ${Math.max(12, cssSize * 0.045)}px ${fontFamily}`;
      ctx.fillText(centerLabel, 0, 0);
      ctx.restore();
    }

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(37,48,80,1)";
    ctx.stroke();
  };

  // ----- animation loop -----------------------------------------------------
  const tick = (now: number) => {
    const p = phase.current;
    const elapsed = now - phaseStart.current;
    if (p === "spinup") {
      const t = Math.min(1, elapsed / SPINUP_MS);
      rotation.current += IDLE_SPEED * t * (1 / 60);
      if (t >= 1) {
        phase.current = "spinning";
        phaseStart.current = now;
      }
    } else if (p === "spinning") {
      rotation.current += IDLE_SPEED / 60;
    } else if (p === "settling") {
      const dur = reducedMotion.current ? 900 : SETTLE_MS;
      const t = Math.min(1, elapsed / dur);
      rotation.current = settleFrom.current + (settleTo.current - settleFrom.current) * easeOutQuart(t);
      if (t >= 1) {
        rotation.current = settleTo.current;
        finish();
      }
    } else if (p === "aborting") {
      const t = Math.min(1, elapsed / ABORT_MS);
      rotation.current += (IDLE_SPEED / 60) * (1 - easeOutQuart(t));
      if (t >= 1) finish();
    }
    draw();
    if (phase.current !== "idle") raf.current = requestAnimationFrame(tick);
    else raf.current = null;
  };

  const ensureLoop = () => {
    if (raf.current === null) {
      phaseStart.current = performance.now();
      raf.current = requestAnimationFrame(tick);
    }
  };

  const finish = () => {
    phase.current = "idle";
    const r = resolver.current;
    resolver.current = null;
    r?.();
  };

  useImperativeHandle(ref, () => ({
    startSpinning() {
      if (phase.current !== "idle") return;
      phase.current = reducedMotion.current ? "spinning" : "spinup";
      phaseStart.current = performance.now();
      ensureLoop();
    },
    settleOn(tierId: string) {
      return new Promise<void>((resolve) => {
        resolver.current = resolve;
        const landing = pickLandingBps(slices, tierId);
        settleFrom.current = rotation.current;
        settleTo.current = targetRotation(rotation.current, landing, reducedMotion.current ? 1 : 4);
        phase.current = "settling";
        phaseStart.current = performance.now();
        ensureLoop();
      });
    },
    abort() {
      return new Promise<void>((resolve) => {
        if (phase.current === "idle") return resolve();
        resolver.current = resolve;
        phase.current = "aborting";
        phaseStart.current = performance.now();
        ensureLoop();
      });
    },
  }));

  // Initial draw and redraw on resize.
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => {
      ro.disconnect();
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slices, accentColor, centerLabel]);

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: size }}>
      {/* Pointer */}
      <div
        aria-hidden
        className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 -translate-y-1"
        style={{
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderTop: `28px solid ${accentColor}`,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
        }}
      />
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Prize wheel with ${tiers.length} tiers: ${tiers.map((t) => `${t.name} ${formatBps(t.oddsBps)}`).join(", ")}`}
        className="aspect-square w-full rounded-full"
        style={{ boxShadow: `0 0 60px -20px ${accentColor}` }}
      />
    </div>
  );
});

/** Lighten (positive) or darken (negative) a hex colour by a fraction. */
function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amount < 0 ? v * amount : (255 - v) * amount))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}
