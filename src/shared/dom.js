export const $ = id => document.getElementById(id);
export function textElement(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function message(text, error = false) {
  $('msg').textContent = text; $('msg').classList.toggle('err', error);
}
