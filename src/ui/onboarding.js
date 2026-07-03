/**
 * First-run onboarding. Three slides that explain the product, then reveal the
 * app and persist a flag so it only shows once. Purely presentational; it
 * calls `onDone` to hand control back to main.
 */
import { $, $$ } from '../dom.js';
import { store } from '../store.js';

export function maybeOnboard(onDone) {
  if (store.get('onboarded', false)) { onDone(); return; }

  const onb = $('#onboarding');
  const slides = $$('.slide', onb);
  const dots = $$('.pager i', onb);
  const cta = $('#onb-cta');
  const skip = $('#onb-skip');
  let i = 0;

  onb.hidden = false;

  const show = (n) => {
    i = n;
    slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
    dots.forEach((d, idx) => d.classList.toggle('on', idx === i));
    $('.slides', onb).style.transform = `translateX(-${i * 100}%)`;
    cta.textContent = i === slides.length - 1 ? 'Get started' : 'Continue';
    skip.style.visibility = i === slides.length - 1 ? 'hidden' : 'visible';
  };

  const finish = () => {
    store.set('onboarded', true);
    onb.hidden = true;
    onDone();
  };

  cta.addEventListener('click', () => (i < slides.length - 1 ? show(i + 1) : finish()));
  skip.addEventListener('click', finish);
  show(0);
}
