import { $, textElement } from '../../shared/dom.js';
const labels = { solicitado: 'Enviando', aceptado: 'API aceptada', evento: 'Servidor', error: 'Error' };
export function mostrarMensaje(type, text) {
  const row = textElement('li', `${new Date().toLocaleTimeString()} · ${labels[type]} · ${text}`, type === 'error' ? 'err' : '');
  $('mensaje').prepend(row);
  while ($('mensaje').children.length > 5) $('mensaje').lastChild.remove();
}
export function setIndicador(id, state, text) {
  const el = $('ind-' + id); el.dataset.state = state;
  el.querySelector('strong').textContent = text;
}
export function pintarFunciones(state) {
  const map = { encendido: ['power', 'Encendido', 'Apagado'], sonido: ['sound', 'Sonido activado', 'Sonido desactivado'], luces: ['lights', 'Luces activadas', 'Luces desactivadas'] };
  for (const [key, [id, on, off]] of Object.entries(map)) {
    const button = $(id); button.classList.toggle('is-on', state[key]);
    button.setAttribute('aria-pressed', String(state[key]));
    button.querySelector('.function-status').textContent = state[key] ? on : off;
  }
}
export function montarBotones(ctl) {
  for (const [id, name] of [['power', 'ENCENDER_APAGAR'], ['sound', 'SONIDO'], ['lights', 'LUCES']]) {
    const button = $(id);
    button.disabled = !ctl.tiene(name);
    if (button.disabled) button.title = 'Este comando no está disponible en el catálogo del servidor';
    button.addEventListener('click', async () => {
      button.disabled = true; button.classList.add('is-pending'); button.setAttribute('aria-busy', 'true');
      try { await ctl.iniciar(name); }
      finally { button.disabled = !ctl.tiene(name); button.classList.remove('is-pending'); button.setAttribute('aria-busy', 'false'); }
    });
  }
  pintarFunciones(ctl.funciones);
}
export function bloquearDemo(active) {
  $('demo').disabled = active;
  $('demo-run').disabled = active || !$('demo').value;
  $('demo-cancel').disabled = !active;
  $('demo-state').textContent = active ? 'EN EJECUCIÓN' : 'SECUENCIA AUTOMÁTICA';
}
