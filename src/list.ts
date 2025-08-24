import cards from "./cards.json";
import { loadState } from "./state";

const tbody = document.querySelector('#cards-table tbody') as HTMLElement;
const state = loadState();

const rows = cards.map(card => {
  const st = state.cards[card.id] || {};
  const dueMs = Number(st.due);
  const due = isFinite(dueMs) ? new Date(dueMs).toLocaleString() : 'new';
  return { ...card, dueMs: isFinite(dueMs) ? dueMs : Infinity, due };
}).sort((a, b) => a.dueMs - b.dueMs);

for (const row of rows) {
  const tr = document.createElement('tr');
  tr.className = 'border-b border-slate-700 last:border-0';
  tr.innerHTML = `<td class="py-2 pr-4">${row.id}</td><td class="py-2 pr-4">${row.front}</td><td class="py-2">${row.due}</td>`;
  tbody.appendChild(tr);
}
