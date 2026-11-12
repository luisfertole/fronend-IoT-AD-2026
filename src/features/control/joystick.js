import { $ } from '../../shared/dom.js';

export function crearJoystick(ctl, id, mapa) {
  const joy = $(id), knob = joy.querySelector('.joystick-knob'), status = $(id + '-status');
  let pointer = null, direction = null;
  const change = next => {
    if (direction === next) return;
    direction = next; joy.dataset.direction = next || '';
    status.textContent = next ? mapa[next].replaceAll('_', ' ') : 'EN REPOSO';
    document.querySelectorAll(`[data-joystick="${id}"]`).forEach(el => el.classList.toggle('selected', el.dataset.direction === next));
    if (next) ctl.iniciar(mapa[next]); else ctl.detener();
  };
  const reset = () => { pointer = null; knob.style.transform = ''; change(null); };
  const calculate = event => {
    const r = joy.getBoundingClientRect(), max = r.width * .29;
    let x = event.clientX - r.left - r.width / 2, y = event.clientY - r.top - r.height / 2;
    const length = Math.hypot(x, y);
    if (length > max) { x *= max / length; y *= max / length; }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    change(length < max * .35 ? null : Math.abs(x) > Math.abs(y) ? x > 0 ? 'derecha' : 'izquierda' : y > 0 ? 'abajo' : 'arriba');
  };
  joy.addEventListener('pointerdown', event => {
    if (pointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointer = event.pointerId; joy.setPointerCapture(pointer); calculate(event);
  });
  joy.addEventListener('pointermove', event => { if (event.pointerId === pointer) calculate(event); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => joy.addEventListener(type, event => { if (event.pointerId === pointer) reset(); }));
  const keys = { ArrowUp: 'arriba', ArrowDown: 'abajo', ArrowLeft: 'izquierda', ArrowRight: 'derecha' };
  joy.addEventListener('keydown', event => { if (keys[event.key]) { event.preventDefault(); if (!event.repeat) change(keys[event.key]); } });
  joy.addEventListener('keyup', event => { if (keys[event.key]) { event.preventDefault(); if (direction === keys[event.key]) reset(); } });
  joy.addEventListener('focusout', event => { if (!joy.contains(event.relatedTarget)) reset(); });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  // Los controles de dirección también funcionan por clic y teclado sin arrastrar.
  document.querySelectorAll(`[data-joystick="${id}"]`).forEach(button => {
    const start = () => change(button.dataset.direction);
    const end = () => { if (direction === button.dataset.direction) reset(); };
    button.addEventListener('pointerdown', event => { event.stopPropagation(); button.setPointerCapture(event.pointerId); start(); });
    ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach(type => button.addEventListener(type, end));
    button.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) start(); } });
    button.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) end(); });
    button.setAttribute('aria-label', `${button.querySelector('.joy-label').textContent.trim()}. Mantén presionado para mover; suelta para detener.`);
  });
  return reset;
}
