/**
 * The address never exists as a readable string in the shipped
 * source, and no `mailto:` is ever written into the document. The
 * bytes below are XOR-masked and only assembled inside the click
 * handler, so a crawler parsing the HTML — or the JS bundle for
 * an `@` — finds nothing to harvest.
 */

const MASK = 0x5a;
const BYTES = [48, 61, 40, 63, 63, 52, 110, 106, 26, 46, 47, 60, 46, 41, 116, 63, 62, 47];

function assemble(): string {
  return BYTES.map((b) => String.fromCharCode(b ^ MASK)).join('');
}

export function wireEmail(root: ParentNode = document) {
  const btn = root.querySelector<HTMLButtonElement>('[data-email]');
  const val = root.querySelector<HTMLElement>('[data-email-val]');
  if (!btn || !val) return;

  let revealed = false;

  btn.addEventListener('click', async () => {
    const address = assemble();

    if (!revealed) {
      val.textContent = address;
      revealed = true;
      btn.setAttribute('aria-label', `Email address revealed: ${address}. Click again to copy.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      const prev = val.textContent;
      val.textContent = 'copied';
      btn.dataset.copied = '1';
      setTimeout(() => {
        val.textContent = prev;
        delete btn.dataset.copied;
      }, 1600);
    } catch {
      // Clipboard denied — opening the client is the honest fallback,
      // and by now the user has explicitly asked for the address twice.
      window.location.href = `${'mail'}${'to'}:${address}`;
    }
  });
}
