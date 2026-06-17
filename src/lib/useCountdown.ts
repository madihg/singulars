"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useCountdown(totalSeconds, running)
 *
 * Lightweight 1Hz countdown extracted from /timer for reuse by the
 * recover.exe stage + control. Returns {timeLeft, isRunning, start, pause,
 * reset, setTimeLeft}. Pure client-side — for cross-device sync, the parent
 * is responsible for syncing the initial timeLeft via the API.
 */
export function useCountdown(totalSeconds: number, autoStart = false) {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current || timeLeft === 0) return;
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [timeLeft, clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setIsRunning(false);
  }, [clearTimer]);

  const reset = useCallback(
    (newTotal?: number) => {
      clearTimer();
      setIsRunning(false);
      setTimeLeft(newTotal ?? totalSeconds);
    },
    [clearTimer, totalSeconds],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { timeLeft, isRunning, start, pause, reset, setTimeLeft };
}

export function formatMMSS(totalSeconds: number): string {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.max(0, totalSeconds) % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
