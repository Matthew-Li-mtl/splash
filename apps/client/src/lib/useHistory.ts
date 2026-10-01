import { useReducer, useRef } from "react";

type Updater<T> = T | ((prev: T) => T);

/**
 * Undo/redo for editor state. `commit` records one step. `live` changes the
 * value without recording (e.g. while dragging); `end` then records the whole
 * gesture as a single step. The returned functions are stable across renders.
 */
export function useHistory<T>(initial: T) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const state = useRef({ past: [] as T[], present: initial, future: [] as T[] });
  const gestureStart = useRef<T | null>(null);

  const api = useRef({
    commit(next: Updater<T>) {
      const s = state.current;
      const value = typeof next === "function" ? (next as (p: T) => T)(s.present) : next;
      state.current = { past: [...s.past.slice(-80), s.present], present: value, future: [] };
      rerender();
    },
    live(next: Updater<T>) {
      const s = state.current;
      if (gestureStart.current === null) gestureStart.current = s.present;
      const value = typeof next === "function" ? (next as (p: T) => T)(s.present) : next;
      state.current = { ...s, present: value };
      rerender();
    },
    end() {
      const start = gestureStart.current;
      gestureStart.current = null;
      const s = state.current;
      if (start !== null && start !== s.present) {
        state.current = { past: [...s.past.slice(-80), start], present: s.present, future: [] };
        rerender();
      }
    },
    undo() {
      const s = state.current;
      if (!s.past.length) return;
      state.current = { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] };
      rerender();
    },
    redo() {
      const s = state.current;
      if (!s.future.length) return;
      state.current = { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) };
      rerender();
    },
    get: () => state.current.present,
  }).current;

  return {
    ...api,
    value: state.current.present,
    canUndo: state.current.past.length > 0,
    canRedo: state.current.future.length > 0,
  };
}
