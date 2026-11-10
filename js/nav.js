const PAGINAS = [["index.html", "Control"], ["monitoreo.html", "Monitoreo"], ["admin.html", "Administración"]];

// Menú desplegable lateral compartido por las tres páginas (rutas relativas: valen en GitHub Pages).
export function montarMenu() {
  const actual = location.pathname.split("/").pop() || "index.html";
  const btn = document.createElement("button");
  btn.id = "menu-btn"; btn.type = "button"; btn.textContent = "☰";
  btn.setAttribute("aria-label", "Abrir menú"); btn.setAttribute("aria-expanded", "false");
  const nav = document.createElement("nav"); nav.id = "menu"; nav.setAttribute("aria-label", "Navegación principal");
  PAGINAS.forEach(([href, texto]) => {
    const a = document.createElement("a"); a.href = href; a.textContent = texto;
    if (href === actual) a.setAttribute("aria-current", "page");
    nav.appendChild(a);
  });
  const velo = document.createElement("div"); velo.id = "velo";
  const alternar = (abrir) => { nav.classList.toggle("abierto", abrir); velo.classList.toggle("abierto", abrir); btn.setAttribute("aria-expanded", String(abrir)); };
  btn.onclick = () => alternar(!nav.classList.contains("abierto"));
  velo.onclick = () => alternar(false);
  addEventListener("keydown", (e) => e.key === "Escape" && alternar(false));
  (document.querySelector(".top") || document.body).prepend(btn);
  document.body.append(velo, nav);
}
