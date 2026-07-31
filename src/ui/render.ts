import { publications, type Pub } from '../data/publications';

/** `**name**` → <b>name</b>, with everything else escaped. */
function bolded(cite: string): string {
  const esc = cite
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

/**
 * One publication, one channel of the recording. Each row carries a
 * hairline trace of its own, derived from the citation text so a given
 * paper always draws the same shape — an index that looks like an
 * instrument rather than a bibliography.
 */
function traceFor(p: Pub): string {
  let seed = 0;
  for (let i = 0; i < p.cite.length; i++) seed = (seed * 31 + p.cite.charCodeAt(i)) % 9973;

  const centre = 0.24 + (seed % 46) / 100;
  const pts: string[] = [];
  const N = 96;

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const jitter = (seed / 2147483648 - 0.5) * 0.07;

    // P wave, QRS complex, T wave — the real shape of one beat.
    const d = t - centre;
    const beat =
      Math.exp(-((d + 0.06) ** 2) / 0.00042) * 0.16 +
      Math.exp(-(d * d) / 0.00007) * 1.0 -
      Math.exp(-((d - 0.022) ** 2) / 0.00016) * 0.30 -
      Math.exp(-((d + 0.020) ** 2) / 0.00013) * 0.16 +
      Math.exp(-((d - 0.085) ** 2) / 0.0011) * 0.26;

    pts.push(`${(t * 100).toFixed(2)},${(50 - (beat + jitter) * 28).toFixed(2)}`);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<polyline points="${pts.join(' ')}" fill="none" stroke="#C89A4E" stroke-width="0.6"/>` +
    `</svg>`;

  // encodeURIComponent, not hand-rolled escaping: the payload contains
  // #, <, > and quotes, any one of which breaks a data URI or the
  // attribute carrying it if it slips through unencoded.
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function row(p: Pub): HTMLLIElement {
  const li = document.createElement('li');
    li.className = 'pub';
    li.dataset.kind = p.kind;
    li.tabIndex = 0;
    // Set through the CSSOM rather than an inline attribute string —
    // the value contains quotes and would close the attribute early.
    li.style.setProperty('--pub-trace', traceFor(p));

    const yr = document.createElement('span');
    yr.className = 'pub__yr';
    yr.textContent = p.year;

    const t = document.createElement('span');
    t.className = 'pub__t';
    t.innerHTML = bolded(p.cite);

    const v = document.createElement('span');
    v.className = 'pub__v';
    v.textContent = p.venue;

  li.append(yr, t, v);
  return li;
}

/**
 * Selected work first, the remainder behind a disclosure.
 *
 * Every entry is still rendered into the DOM, so the full record is present
 * for anyone — or anything — reading the page; the disclosure only decides
 * what competes for the scroll. A bibliography that runs longer than the
 * argument turns the page back into a CV, which is the thing this is not.
 */
export function renderPublications(root: ParentNode = document) {
  const list = root.querySelector<HTMLOListElement>('[data-pubs]');
  if (!list) return;

  const selected = publications.filter((p) => p.selected);
  const rest = publications.filter((p) => !p.selected);

  const frag = document.createDocumentFragment();
  for (const p of selected) frag.append(row(p));
  list.replaceChildren(frag);

  const more = root.querySelector<HTMLElement>('[data-pubs-rest]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-pubs-toggle]');
  if (!more || !toggle || !rest.length) return;

  const restFrag = document.createDocumentFragment();
  for (const p of rest) restFrag.append(row(p));
  more.replaceChildren(restFrag);

  const label = (open: boolean) =>
    open ? 'Hide the rest' : `The full record — ${publications.length} entries`;

  toggle.textContent = label(false);
  toggle.setAttribute('aria-expanded', 'false');
  more.hidden = true;

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    toggle.textContent = label(!open);
    more.hidden = open;
  });
}

export function stampYear(root: ParentNode = document) {
  const el = root.querySelector<HTMLElement>('[data-year]');
  if (el) el.textContent = String(new Date().getFullYear());
}
