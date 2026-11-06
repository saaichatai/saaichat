'use strict';

// URL de tu función de Supabase.
const FUNCTION_URL =
  'https://kmrcsazduxipbffbjgfx.supabase.co/functions/v1/saaichat';

const inicio = document.getElementById('inicio');
const pantallaChat = document.getElementById('pantallaChat');
const bienvenida = document.getElementById('bienvenida');
const mensajes = document.getElementById('mensajes');
const formulario = document.getElementById('formulario');
const entrada = document.getElementById('entrada');
const enviar = document.getElementById('enviar');
const nuevaSesion = document.getElementById('nuevaSesion');
const abrirBarraBtn = document.getElementById('abrirBarra');
const cerrarBarraBtn = document.getElementById('cerrarBarra');
const fondoBarra = document.getElementById('fondoBarra');
const listaRecientes = document.getElementById('listaRecientes');
const sinRecientes = document.getElementById('sinRecientes');

const CLAVE = 'saaichat_recientes';

let historial = [];
let esperando = false;
let sesion = 0;
let controlador = null;
let conversaciones = [];
let idActual = null;

// --------------------------------------------------
// LOADER DEL BÚHO PROFIBÚ (todo vive en este archivo)
// --------------------------------------------------
//
// Se crea solo: no necesita cambios en index.html ni en styles.css.
// - Se centra sobre el área de la conversación (el campo de texto
//   siempre queda visible).
// - La animación solo corre mientras el loader está en pantalla.
// - Si el sistema pide "reducir movimiento", el búho se muestra quieto.

const Buho = (function () {
  const P = 4; // tamaño de cada "pixel" del dibujo

  const C = {
    ink: '#2a2036', br: '#9a5b3c', brD: '#7a4430', brL: '#c98a60',
    face: '#e2b98a', cream: '#fff1d5', creamD: '#e6cfa4', white: '#ffffff',
    navy: '#3a4a78', navyL: '#5a6ca0', gold: '#f2b943', goldL: '#ffe08a',
    goldD: '#c98a1e', red: '#c4474f', redL: '#ee8a85',
    cap: '#35304a', capL: '#524b70', shadow: 'rgba(60,40,80,.22)'
  };

  // Poses que se alternan mientras carga
  const POSES = ['read', 'talk', 'walk'];
  const CAMBIO_POSE_MS = 2600;

  // ---------- Estilos ----------
  const estilo = document.createElement('style');

  estilo.textContent = `
    .zona {
      flex: 1;
      min-height: 0;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .cargador {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(255, 255, 255, .94);
      -webkit-backdrop-filter: blur(3px);
      backdrop-filter: blur(3px);
      animation: cargadorEntrada .25s ease both;
    }

    .cargador__buho {
      width: clamp(120px, min(46vw, 34dvh), 230px);
      height: auto;
      aspect-ratio: 1;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }

    /* Texto solo para lectores de pantalla (no se ve en pantalla) */
    .cargador__sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    @keyframes cargadorEntrada {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;

  document.head.appendChild(estilo);

  // ---------- Estructura ----------
  // Envuelve bienvenida + mensajes en .zona y agrega el loader encima.
  const zona = document.createElement('div');
  zona.className = 'zona';
  bienvenida.before(zona);

  const cargador = document.createElement('div');
  cargador.className = 'cargador';
  cargador.hidden = true;
  cargador.setAttribute('role', 'status');
  cargador.setAttribute('aria-live', 'polite');

  const canvas = document.createElement('canvas');
  canvas.className = 'cargador__buho';
  canvas.width = 192;
  canvas.height = 192;
  canvas.setAttribute('aria-hidden', 'true');

  const soloLectores = document.createElement('span');
  soloLectores.className = 'cargador__sr';
  soloLectores.textContent = 'Preparando tu respuesta';

  cargador.append(canvas, soloLectores);
  zona.append(bienvenida, mensajes, cargador);

  const ctx = canvas.getContext('2d');
  let raf = null;
  let inicioT = 0;

  // ---------- Dibujo en pixel art ----------
  function px(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x * P, y * P, w * P, h * P);
  }

  // Elipse hecha de pixeles: redonda, limpia y simétrica
  function ell(cx, cy, rx, ry, c) {
    ctx.fillStyle = c;

    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const a = (x + .5 - cx) / rx;
        const b = (y + .5 - cy) / ry;

        if (a * a + b * b <= 1) {
          ctx.fillRect(x * P, y * P, P, P);
        }
      }
    }
  }

  function oe(cx, cy, rx, ry, relleno) {
    ell(cx, cy, rx + 1, ry + 1, C.ink);
    ell(cx, cy, rx, ry, relleno);
  }

  function ala(cx, cy, arriba) {
    const y = arriba ? cy - 9 : cy;

    oe(cx, y, 3.6, arriba ? 8 : 8.5, C.br);
    ell(cx + (cx < 24 ? 1 : -1), y - 1, 1.2, 5.5, C.brL);

    for (let i = 0; i < 3; i++) {
      px(cx - 2 + i * 2, y + (arriba ? 6 : 7), 1, 2, C.brD);
    }
  }

  function dibujar(t, pose) {
    ctx.clearRect(0, 0, 192, 192);

    const walk = pose === 'walk';
    const talk = pose === 'talk';
    const read = pose === 'read';

    const bob = walk
      ? Math.abs(Math.sin(t * .012)) * 1.5
      : Math.sin(t * .003) * .6;

    const dy = Math.round(bob);
    const sw = walk ? Math.round(Math.sin(t * .006)) : 0;

    const ciclo = t % 3800;
    const parpadeo = ciclo > 3600 && ciclo < 3700;
    const abierto = talk && Math.sin(t * .018) > 0;

    const lx = read ? 0 : Math.round(Math.sin(t * .0014));
    const ly = read ? 1 : 0;

    const alaDerArriba = talk && Math.sin(t * .007) > .2;

    // Sombra y patas
    ell(24, 46, 12, 1.5, C.shadow);

    const paso = walk ? Math.sin(t * .012) * 2 : 0;

    [[17, Math.max(0, paso)], [26, Math.max(0, -paso)]].forEach(function (p) {
      const x = p[0];
      const y = 44 - Math.round(p[1]);

      px(x + sw, y, 6, 2, C.ink);
      px(x + 1 + sw, y, 4, 1, C.gold);
      px(x + 1 + sw, y + 1, 1, 1, C.goldD);
      px(x + 4 + sw, y + 1, 1, 1, C.goldD);
    });

    // Cuerpo, chaleco y vientre con plumas
    const o = sw;

    oe(24 + o, 33 + dy, 13, 10, C.br);
    ell(24 + o, 34 + dy, 8, 8, C.cream);
    ell(17 + o, 34 + dy, 3, 7, C.navy);
    ell(31 + o, 34 + dy, 3, 7, C.navy);
    px(16 + o, 30 + dy, 1, 6, C.navyL);
    px(31 + o, 30 + dy, 1, 6, C.navyL);

    for (let y = 29; y < 41; y += 3) {
      for (let x = 21; x < 28; x += 3) {
        const xx = x + (((y / 3) | 0) % 2 ? 1 : 0);

        px(xx + o, y + dy, 1, 1, C.creamD);
        px(xx + 1 + o, y + 1 + dy, 1, 1, C.creamD);
      }
    }

    [31, 35, 39].forEach(function (y) {
      px(24 + o, y + dy, 1, 1, C.gold);
    });

    // Orejas (plumas) y cabeza
    oe(12 + o, 8 + dy, 2.5, 3.5, C.brD);
    oe(36 + o, 8 + dy, 2.5, 3.5, C.brD);
    oe(24 + o, 16 + dy, 15, 11, C.br);
    ell(24 + o, 19 + dy, 12.5, 7.5, C.face);
    ell(24 + o, 9 + dy, 8, 2.5, C.brL);

    // Ojos con gafas: pupilas que miran y parpadeo
    [17, 31].forEach(function (cx) {
      const X = cx + o;
      const Y = 17 + dy;

      ell(X, Y, 6.6, 6.6, C.gold);
      ell(X, Y, 5.6, 5.6, C.ink);
      ell(X, Y, 4.6, 4.6, C.white);

      if (parpadeo) {
        ell(X, Y, 4.6, 4.6, C.face);
        px(X - 4, Y + 1, 9, 1, C.ink);
      } else {
        px(X - 1 + lx, Y - 1 + ly, 3, 3, C.ink);
        px(X - 1 + lx, Y - 1 + ly, 1, 1, C.white);
        px(X + lx, Y + ly, 2, 2, C.ink);
      }

      px(X - 4, Y - 5, 3, 1, C.goldL);
    });

    px(23 + o, 16 + dy, 2, 1, C.gold);
    px(23 + o, 17 + dy, 2, 1, C.ink);

    // Pico
    ell(24 + o, 21.5 + dy, 3, 3, C.ink);
    ell(24 + o, 21.5 + dy, 2, 2, C.gold);
    px(23 + o, 20 + dy, 1, 1, C.goldL);

    if (abierto) {
      px(22 + o, 24 + dy, 4, 2, C.ink);
      px(23 + o, 24 + dy, 2, 1, C.red);
      px(23 + o, 25 + dy, 2, 1, C.gold);
    }

    // Birrete
    px(17 + o, 7 + dy, 14, 4, C.ink);
    px(18 + o, 7 + dy, 12, 3, C.cap);

    for (let y = 0; y < 9; y++) {
      const hw = 17 * (1 - Math.abs(y + .5 - 4.5) / 4.5);

      if (hw < 1) continue;

      px(Math.round(24 - hw) + o, y + dy, Math.round(hw * 2), 1, C.ink);

      const iw = hw - 1.5;

      if (iw > 1 && y > 0 && y < 8) {
        px(
          Math.round(24 - iw) + o,
          y + dy,
          Math.round(iw * 2),
          1,
          y < 4 ? C.capL : C.cap
        );
      }
    }

    px(23 + o, 4 + dy, 2, 2, C.gold);

    const ts = Math.round(Math.sin(t * .005) * (walk ? 1.5 : .7));

    px(39 + o, 5 + dy, 1, 7, C.gold);
    px(38 + o + ts, 12 + dy, 3, 3, C.goldL);
    px(38 + o + ts, 14 + dy, 3, 1, C.goldD);

    // Pajarita
    px(20 + o, 26 + dy, 4, 3, C.red);
    px(25 + o, 26 + dy, 4, 3, C.red);
    px(23 + o, 26 + dy, 2, 3, C.redL);

    // Alas
    ala(10 + o, 33 + dy, false);
    ala(38 + o, 33 + dy, alaDerArriba);

    if (read) {
      // Libro abierto al frente
      px(14 + o, 30 + dy, 21, 11, C.ink);
      px(15 + o, 31 + dy, 9, 9, C.white);
      px(25 + o, 31 + dy, 9, 9, C.white);
      px(24 + o, 31 + dy, 1, 9, C.ink);

      for (let i = 0; i < 4; i++) {
        px(16 + o, 33 + i * 2 + dy, 7, 1, C.brL);
        px(26 + o, 33 + i * 2 + dy, 7, 1, C.brL);
      }

      px(15 + o, 40 + dy, 19, 1, C.red);
      ell(14 + o, 37 + dy, 2, 2.5, C.br);
      ell(35 + o, 37 + dy, 2, 2.5, C.br);
    } else {
      // Libro pequeño y puntero
      px(4 + o, 34 + dy, 10, 9, C.ink);
      px(5 + o, 35 + dy, 8, 7, C.red);
      px(12 + o, 35 + dy, 1, 7, C.white);
      px(5 + o, 35 + dy, 8, 1, C.redL);
      px(5 + o, 40 + dy, 8, 1, C.gold);

      const tilt = talk ? Math.round(Math.sin(t * .01) * 2) : 0;

      for (let i = 0; i < 19; i++) {
        const x = Math.round(40 + o + i * (.15 + tilt * .04));

        px(x, 41 + dy - i, 1, 1, C.brD);
      }

      px(41 + o + Math.round(18 * (.15 + tilt * .04)), 22 + dy, 1, 2, C.gold);
    }
  }

  // ---------- Animación ----------
  function cuadro(ahora) {
    const t = ahora - inicioT;
    const pose = POSES[Math.floor(t / CAMBIO_POSE_MS) % POSES.length];

    dibujar(t, pose);
    raf = requestAnimationFrame(cuadro);
  }

  function mostrar() {
    cargador.hidden = false;

    if (raf) return;

    // Si la persona prefiere menos movimiento: búho quieto
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dibujar(1000, 'talk');
      return;
    }

    inicioT = performance.now();
    raf = requestAnimationFrame(cuadro);
  }

  function ocultar() {
    cargador.hidden = true;

    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  return { mostrar: mostrar, ocultar: ocultar };
})();

// --------------------------------------------------
// NAVEGACIÓN
// --------------------------------------------------

// Los enlaces #chat abren el chat directamente.
// No se realiza ningún registro o inicio de sesión.
function mostrarPantalla() {
  const abrirChat = window.location.hash === '#chat';

  inicio.hidden = abrirChat;
  pantallaChat.hidden = !abrirChat;

  window.scrollTo(0, 0);

  if (abrirChat) {
    entrada.focus();
  }
}

window.addEventListener('hashchange', mostrarPantalla);

mostrarPantalla();

// --------------------------------------------------
// MENSAJES
// --------------------------------------------------

function desplazarAlFinal() {
  mensajes.scrollTop = mensajes.scrollHeight;
}

function agregarMensaje(rol, texto, esError = false) {
  const articulo = document.createElement('article');

  articulo.className =
    'mensaje' +
    (rol === 'usuario' ? ' mensaje--usuario' : '') +
    (esError ? ' mensaje--error' : '');

  const autor = document.createElement('p');

  autor.className = 'mensaje__autor';
  autor.textContent = rol === 'usuario' ? 'Tú' : 'SaaiChat';

  const contenido = document.createElement('div');

  contenido.className = 'mensaje__texto';

  const puedeUsarFormato =
    rol === 'asistente' &&
    !esError &&
    window.marked &&
    window.DOMPurify;

  if (puedeUsarFormato) {
    contenido.innerHTML = window.DOMPurify.sanitize(
      window.marked.parse(texto, { breaks: true })
    );
  } else {
    contenido.classList.add('texto-plano');
    contenido.textContent = texto;
  }

  articulo.append(autor, contenido);
  mensajes.appendChild(articulo);

  desplazarAlFinal();

  return articulo;
}

function ajustarEntrada() {
  entrada.style.height = 'auto';

  entrada.style.height =
    Math.min(entrada.scrollHeight, 180) + 'px';
}

function cambiarEspera(valor) {
  esperando = valor;
  enviar.disabled = valor;

  enviar.setAttribute(
    'aria-label',
    valor ? 'Esperando respuesta' : 'Enviar mensaje'
  );
}

// --------------------------------------------------
// CONEXIÓN CON SUPABASE
// --------------------------------------------------

async function consultarIA(texto, signal) {
  const respuesta = await fetch(FUNCTION_URL, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      action: 'chat',
      message: texto,
      history: historial
    }),

    signal: signal
  });

  const resultado = await respuesta.json().catch(function () {
    return null;
  });

  const datos =
    resultado &&
    typeof resultado === 'object' &&
    !Array.isArray(resultado)
      ? resultado
      : {};

  if (!respuesta.ok) {
    const detalle =
      datos.error ||
      datos.message ||
      datos.msg ||
      'No se pudo obtener una respuesta.';

    throw new Error(
      'Error ' + respuesta.status + ': ' + detalle
    );
  }

  if (
    typeof datos.reply !== 'string' ||
    !datos.reply.trim()
  ) {
    throw new Error(
      'El servidor no devolvió una respuesta de texto.'
    );
  }

  return datos;
}

// --------------------------------------------------
// ENVIAR MENSAJE
// --------------------------------------------------

formulario.addEventListener('submit', async function (evento) {
  evento.preventDefault();

  const texto = entrada.value.trim();

  if (!texto || esperando) {
    return;
  }

  bienvenida.hidden = true;
  mensajes.hidden = false;

  agregarMensaje('usuario', texto);

  let conv = conversaciones.find(function (c) { return c.id === idActual; });

  if (!conv) {
    conv = {
      id: String(Date.now()),
      titulo: texto.slice(0, 45),
      mensajes: [],
      historial: []
    };
    conversaciones.unshift(conv);
    idActual = conv.id;
  }

  conv.mensajes.push({ rol: 'usuario', texto: texto });
  guardarConversaciones();
  pintarRecientes();

  entrada.value = '';
  ajustarEntrada();

  cambiarEspera(true);

  const sesionActual = sesion;
  const peticion = new AbortController();

  controlador = peticion;

  // El búho aparece en el centro mientras llega la respuesta.
  Buho.mostrar();

  try {
    const datos = await consultarIA(
      texto,
      peticion.signal
    );

    // Evita mostrar respuestas de una sesión anterior.
    if (sesionActual !== sesion) {
      return;
    }

    Buho.ocultar();

    agregarMensaje('asistente', datos.reply);
    conv.mensajes.push({ rol: 'asistente', texto: datos.reply });

    if (datos.trained) {
      historial.push(
        { role: 'user', text: texto },
        { role: 'model', text: datos.reply }
      );
      conv.historial = historial.slice();
    }

    guardarConversaciones();
  } catch (error) {
    if (
      sesionActual !== sesion ||
      error.name === 'AbortError'
    ) {
      return;
    }

    Buho.ocultar();

    const detalle =
      error instanceof TypeError
        ? 'No pude conectar con Supabase. Revisa tu conexión y la configuración de tu función.'
        : error.message;

    agregarMensaje('asistente', detalle, true);
  } finally {
    if (sesionActual === sesion) {
      controlador = null;

      cambiarEspera(false);

      if (!pantallaChat.hidden) {
        entrada.focus();
      }
    }
  }
});

// --------------------------------------------------
// CAMPO DE TEXTO
// --------------------------------------------------

entrada.addEventListener('input', ajustarEntrada);

entrada.addEventListener('keydown', function (evento) {
  if (
    evento.key === 'Enter' &&
    !evento.shiftKey &&
    !evento.isComposing
  ) {
    evento.preventDefault();

    formulario.requestSubmit();
  }
});

// --------------------------------------------------
// SIDEBAR Y RECIENTES
// --------------------------------------------------

function esMovil() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function abrirBarra() {
  pantallaChat.classList.add('barra-abierta');
  abrirBarraBtn.setAttribute('aria-expanded', 'true');
}

function cerrarBarra() {
  pantallaChat.classList.remove('barra-abierta');
  abrirBarraBtn.setAttribute('aria-expanded', 'false');
}

function cargarConversaciones() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE));
    conversaciones = Array.isArray(datos) ? datos : [];
  } catch (e) {
    conversaciones = [];
  }
}

function guardarConversaciones() {
  try {
    localStorage.setItem(
      CLAVE,
      JSON.stringify(conversaciones.slice(0, 30))
    );
  } catch (e) {}
}

// Cancela la petición en curso y quita el búho si estaba cargando.
function detenerPeticion() {
  sesion++;

  if (controlador) {
    controlador.abort();
    controlador = null;
  }

  Buho.ocultar();
}

function pintarRecientes() {
  listaRecientes.replaceChildren();
  sinRecientes.hidden = conversaciones.length > 0;

  conversaciones.forEach(function (conv) {
    const item = document.createElement('li');

    item.className =
      'reciente' + (conv.id === idActual ? ' reciente--activa' : '');

    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.className = 'reciente__titulo';
    abrir.textContent = conv.titulo;
    abrir.addEventListener('click', function () {
      abrirConversacion(conv.id);
    });

    const borrar = document.createElement('button');
    borrar.type = 'button';
    borrar.className = 'reciente__borrar';
    borrar.textContent = '×';
    borrar.setAttribute('aria-label', 'Eliminar conversación');
    borrar.addEventListener('click', function () {
      eliminarConversacion(conv.id);
    });

    item.append(abrir, borrar);
    listaRecientes.appendChild(item);
  });
}

function abrirConversacion(id) {
  const conv = conversaciones.find(function (c) { return c.id === id; });

  if (!conv) {
    return;
  }

  detenerPeticion();

  idActual = id;
  historial = (conv.historial || []).slice();

  mensajes.replaceChildren();

  conv.mensajes.forEach(function (m) {
    agregarMensaje(m.rol, m.texto);
  });

  bienvenida.hidden = true;
  mensajes.hidden = false;

  cambiarEspera(false);
  pintarRecientes();

  if (esMovil()) {
    cerrarBarra();
  }

  entrada.focus();
}

function eliminarConversacion(id) {
  conversaciones = conversaciones.filter(function (c) {
    return c.id !== id;
  });

  guardarConversaciones();

  if (id === idActual) {
    iniciarSesion();
  } else {
    pintarRecientes();
  }
}

function iniciarSesion() {
  detenerPeticion();

  idActual = null;
  historial = [];

  mensajes.replaceChildren();
  mensajes.hidden = true;
  bienvenida.hidden = false;

  entrada.value = '';
  ajustarEntrada();
  cambiarEspera(false);
  pintarRecientes();

  if (esMovil()) {
    cerrarBarra();
  }

  entrada.focus();
}

nuevaSesion.addEventListener('click', iniciarSesion);
abrirBarraBtn.addEventListener('click', abrirBarra);
cerrarBarraBtn.addEventListener('click', cerrarBarra);
fondoBarra.addEventListener('click', cerrarBarra);

// --------------------------------------------------
// MENÚ DE CUENTA
// --------------------------------------------------

const cuentaBtn = document.getElementById('cuentaBtn');
const cuentaMenu = document.getElementById('cuentaMenu');

function alternarCuenta(abrir) {
  cuentaMenu.hidden = !abrir;
  cuentaBtn.setAttribute('aria-expanded', String(abrir));
}

cuentaBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  alternarCuenta(cuentaMenu.hidden);
});

document.addEventListener('click', function (e) {
  if (!e.target.closest('#cuenta')) alternarCuenta(false);
});

// "Cerrar sesión" navega a #inicio (ya lo maneja hashchange)
document.getElementById('cerrarSesion').addEventListener('click', function () {
  alternarCuenta(false);
  cerrarBarra();
});

// --------------------------------------------------
// INICIO
// --------------------------------------------------

cargarConversaciones();
pintarRecientes();

if (!esMovil()) {
  abrirBarra();
}