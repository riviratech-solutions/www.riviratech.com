import { useCallback, useEffect, useState } from "react";

/**
 * Client-side auth throttle (defense-in-depth / UX only).
 *
 * NOTE: This is NOT a substitute for real rate limiting. Supabase already
 * enforces server-side rate limits on the auth endpoints, and those cannot be
 * bypassed. This hook only prevents rapid repeated attempts from the *same
 * browser* and gives the user clear feedback via a lockout countdown. It is
 * intentionally easy to reset (clearing localStorage / a new browser) because
 * the authoritative limit lives on the server.
 */

const MAX_ATTEMPTS = 5;
// Failed attempts are only counted if they happen within this rolling window.
const WINDOW_MS = 15 * 60 * 1000;
// Escalating lockout durations each time the attempt limit is hit again.
const LOCK_STEPS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000];

interface RateState {
  attempts: number;
  windowStart: number;
  lockedUntil: number;
  lockLevel: number;
}

const EMPTY: RateState = { attempts: 0, windowStart: 0, lockedUntil: 0, lockLevel: 0 };

function storageKey(action: string) {
  return `kkr_rl_${action}`;
}

function read(key: string): RateState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    /* localStorage unavailable / corrupt — fall through to defaults */
  }
  return { ...EMPTY };
}

function write(key: string, state: RateState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore write failures (private mode, quota, etc.) */
  }
}

function secondsUntil(ts: number) {
  return Math.max(0, Math.ceil((ts - Date.now()) / 1000));
}

export function useAuthRateLimit(action: string) {
  const key = storageKey(action);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(read(key).lockedUntil));

  // Live countdown while locked.
  useEffect(() => {
    const update = () => setSecondsLeft(secondsUntil(read(key).lockedUntil));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [key]);

  /** Record a failed attempt; may trigger (or extend) a lockout. */
  const recordFailure = useCallback(() => {
    const now = Date.now();
    const state = read(key);

    // Reset the counting window if it has expired.
    if (state.windowStart === 0 || now - state.windowStart > WINDOW_MS) {
      state.attempts = 0;
      state.windowStart = now;
    }

    state.attempts += 1;

    if (state.attempts >= MAX_ATTEMPTS) {
      const step = LOCK_STEPS_MS[Math.min(state.lockLevel, LOCK_STEPS_MS.length - 1)];
      state.lockedUntil = now + step;
      state.lockLevel += 1;
      state.attempts = 0;
      state.windowStart = now;
    }

    write(key, state);
    setSecondsLeft(secondsUntil(state.lockedUntil));
  }, [key]);

  /** Clear all throttle state — call on a successful auth. */
  const reset = useCallback(() => {
    write(key, { ...EMPTY });
    setSecondsLeft(0);
  }, [key]);

  /** Fresh read of remaining lock seconds (use inside submit handlers). */
  const check = useCallback(() => secondsUntil(read(key).lockedUntil), [key]);

  return { secondsLeft, isLocked: secondsLeft > 0, recordFailure, reset, check };
}

/** Format a seconds count as a short human string (e.g. "45s", "2m 05s"). */
export function formatLockCountdown(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}
