// Minimal FSRS-4.5 implementation (constants based on the FSRS wiki defaults)
export const DECAY = -0.5;
export const FACTOR = 19 / 81; // ensures R(S,S) ~ 0.9
export const TARGET_R = 0.90;

const W = [
  0.4872, 1.4003, 3.7145, 13.8206,
  5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461, 2.1072,
  0.0793, 0.3246, 1.587, 0.2272,
  2.8755
];

export type ReviewState = {
  S?: number; D?: number; last?: number; due?: number; reps?: number; lapses?: number;
};

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const daysBetween = (t2: number, t1: number) => (t2 - t1) / 86400000;

export const R_of_tS = (t: number, S: number) => {
  if (!isFinite(S) || S <= 0) return 0;
  return Math.pow(1 + FACTOR * (t / S), DECAY);
};

export const I_of_rS = (r: number, S: number) => {
  const term = Math.pow(r, 1 / DECAY) - 1;
  return (S / FACTOR) * term;
};

const S0 = (G: number) => W[G - 1];
const D0 = (G: number) => W[4] - (G - 3) * W[5];

const D_next = (D: number, G: number) => {
  const Dprime = D - W[6] * (G - 3);
  return W[7] * W[4] + (1 - W[7]) * Dprime;
};

const S_after_success = (D: number, S: number, R: number, G: number) => {
  const base = Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1);
  const hardMul = (G === 2) ? W[15] : 1;
  const easyMul = (G === 4) ? W[16] : 1;
  const SInc = base * hardMul * easyMul + 1;
  return S * Math.max(1, SInc);
};

const S_after_lapse = (D: number, S: number, R: number) => {
  return W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
};

export function fsrs45Next(prev: ReviewState, grade: 1|2|3|4, now: number): Required<ReviewState> {
  const isFirst = !isFinite(prev.S!) || !isFinite(prev.D!);
  if (isFirst) {
    const S = S0(grade);
    const D = clamp(D0(grade), 1, 10);
    const I = Math.max(0.01, I_of_rS(TARGET_R, S));
    return { S, D, last: now, due: now + I * 86400000, reps: 1, lapses: grade === 1 ? 1 : 0 };
  }

  const t = Math.max(0, daysBetween(now, prev.last!));
  const R = clamp(R_of_tS(t, prev.S!), 0, 1);
  const Dn = clamp(D_next(prev.D!, grade), 1, 10);
  const Sn = (grade >= 3) ? S_after_success(Dn, prev.S!, R, grade) : S_after_lapse(Dn, prev.S!, R);
  const I = Math.max(0.01, I_of_rS(TARGET_R, Sn));

  return {
    S: Sn, D: Dn, last: now, due: now + I * 86400000,
    reps: (prev.reps || 0) + 1,
    lapses: (prev.lapses || 0) + (grade === 1 ? 1 : 0)
  };
}
