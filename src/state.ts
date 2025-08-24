import { TARGET_R } from "./fsrs";

export type AppState = {
  cards: Record<string, any>;
  version: string;
  targetR: number;
};

const STORAGE_KEY = "fsrs_flashcards_v1";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { cards: {}, version: "fsrs-4.5", targetR: TARGET_R };
  } catch {
    return { cards: {}, version: "fsrs-4.5", targetR: TARGET_R };
  }
}

export function saveState(s: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function resetState(): AppState {
  const s = { cards: {}, version: "fsrs-4.5", targetR: TARGET_R };
  saveState(s);
  return s;
}
