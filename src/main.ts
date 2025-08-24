import cards from "./cards.json";
import { fsrs45Next, ReviewState } from "./fsrs";
import { loadState, saveState, resetState, AppState } from "./state";

type Card = { id: string; front: string; back: string; };

const $ = <T extends Element = Element>(sel: string) => document.querySelector<T>(sel)!;
const nowMs = () => Date.now();
const fmtDate = (ms: number) => new Date(ms).toLocaleString();

// DOM
const front = $('#front') as HTMLElement;
const back  = $('#back') as HTMLElement;
const revealBtn = $('#reveal-btn') as HTMLButtonElement;
const showRow = $('#show-row') as HTMLElement;
const aheadRow = $('#ahead-row') as HTMLElement;
const aheadBtn = $('#ahead-btn') as HTMLButtonElement;
const rateRow = $('#rate-row') as HTMLElement;
const duePill = $('#due-pill') as HTMLElement;
const newPill = $('#new-pill') as HTMLElement;
const metaId = $('#meta-id') as HTMLElement;
const metaNext = $('#meta-next') as HTMLElement;
const metaStats = $('#meta-stats') as HTMLElement;

let STATE: AppState = loadState();
let CARDS: Card[] = cards;

type Item = { card: Card; st: ReviewState };
let QUEUE: { due: Item[]; unseen: Item[]; future: Item[] } = { due: [], unseen: [], future: [] };
let current: Item | null = null;
let allowAhead = false;

function buildQueue(cards: Card[], state: AppState, now: number) {
  const items: Item[] = cards.map(c => ({ card: c, st: state.cards[c.id] || {} }));
  const due: Item[] = [], future: Item[] = [], unseen: Item[] = [];
  for (const it of items) {
    const dueMs = isFinite((it.st as any).due) ? (it.st as any).due : -Infinity;
    if (!isFinite((it.st as any).S) || !isFinite((it.st as any).D)) unseen.push(it);
    else if (dueMs <= now) due.push(it);
    else future.push(it);
  }
  due.sort((a,b) => ((a.st as any).due ?? 0) - ((b.st as any).due ?? 0));
  return { due, unseen, future };
}

function updatePills() {
  const now = nowMs();
  const q = buildQueue(CARDS, STATE, now);
  duePill.textContent = `Due: ${q.due.length}`;
  newPill.textContent = `New: ${q.unseen.length}`;
}

function pickNext() {
  const now = nowMs();
  QUEUE = buildQueue(CARDS, STATE, now);
  current = QUEUE.due[0] || (allowAhead ? (QUEUE.unseen[0] || QUEUE.future[0]) : null);

  if (!current) {
    if (QUEUE.due.length === 0 && !allowAhead && (QUEUE.unseen.length || QUEUE.future.length)) {
      front.textContent = "All due cards are finished — 🎉";
      back.textContent = "Press \"Study ahead\" to review cards early.";
      back.classList.remove('hidden');
      showRow.classList.add('hidden');
      rateRow.classList.add('hidden');
      aheadRow.classList.remove('hidden');
    } else {
      front.textContent = "All done for now — 🎉";
      back.textContent = "Come back later when cards are due.";
      back.classList.remove('hidden');
      showRow.classList.add('hidden');
      rateRow.classList.add('hidden');
      aheadRow.classList.add('hidden');
    }
    metaId.textContent = "";
    metaNext.textContent = "";
    metaStats.textContent = "";
    updatePills();
    return;
  }

  front.textContent = current.card.front;
  back.textContent = current.card.back;
  back.classList.add('hidden');
  showRow.classList.remove('hidden');
  rateRow.classList.add('hidden');
  aheadRow.classList.add('hidden');

  const st = current.st || {};
  metaId.textContent = `#${current.card.id}`;
  const due = isFinite((st as any).due) ? `due ${fmtDate((st as any).due)}` : 'new';
  metaNext.textContent = `• ${due}`;
  const reps = (st as any).reps || 0, lapses = (st as any).lapses || 0;
  const S = (st as any).S ? (st as any).S.toFixed(2) : '-';
  const D = (st as any).D ? (st as any).D.toFixed(2) : '-';
  metaStats.textContent = `• S=${S} D=${D} • reps=${reps} lapses=${lapses}`;
  updatePills();
}

function reveal() {
  back.classList.remove('hidden');
  showRow.classList.add('hidden');
  rateRow.classList.remove('hidden');
}

function rate(grade: 1|2|3|4) {
  if (!current) return;
  const id = current.card.id;
  const prev = STATE.cards[id] || {};
  const next = fsrs45Next({
    S: +prev.S, D: +prev.D,
    last: +prev.last || nowMs(),
    due: +prev.due  || nowMs(),
    reps: +prev.reps || 0,
    lapses: +prev.lapses || 0
  }, grade, nowMs());

  STATE.cards[id] = next;
  saveState(STATE);
  pickNext();
}

// Buttons
revealBtn.addEventListener('click', reveal);
rateRow.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => rate(parseInt((btn as HTMLButtonElement).dataset.grade!, 10) as 1|2|3|4));
});
aheadBtn.addEventListener('click', () => {
  allowAhead = true;
  pickNext();
});

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    if (!rateRow.classList.contains('hidden')) return; // already showing answer
    reveal();
  } else if (["1","2","3","4"].includes(e.key)) {
    rate(parseInt(e.key, 10) as 1|2|3|4);
  }
});

// Export / Import / Reset
$('#export-btn')!.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'fsrs_state.json' });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

$('#import-input')!.addEventListener('change', (ev: Event) => {
  const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result as string);
      if (obj && typeof obj === 'object' && obj.cards) {
        STATE = obj; saveState(STATE); pickNext(); updatePills();
      } else alert('Invalid file.');
    } catch { alert('Could not parse JSON.'); }
  };
  reader.readAsText(file);
});

$('#reset-btn')!.addEventListener('click', () => {
  if (!confirm('Reset progress for this deck? This only clears learning state (not the cards JSON).')) return;
  STATE = resetState(); pickNext(); updatePills();
});

$('#help-btn')!.addEventListener('click', () => {
  const d = document.getElementById('help') as HTMLDetailsElement; if (d) d.open = !d.open;
});

// Initial render
pickNext();
