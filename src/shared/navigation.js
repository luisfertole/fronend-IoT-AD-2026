const pages = [['index.html', '01', 'Control'], ['monitoreo.html', '02', 'Monitoreo'], ['admin.html', '03', 'Administración']];
export function montarMenu() {
  const current = location.pathname.split('/').pop() || 'index.html';
  const nav = document.querySelector('#navigation');
  for (const [href, number, title] of pages) {
    const a = document.createElement('a'); a.href = href;
    const small = document.createElement('span'); small.textContent = number; a.append(small, document.createTextNode(title));
    if (current === href) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
}
