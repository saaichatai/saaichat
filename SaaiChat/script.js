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

  const indicador = agregarMensaje(
    'asistente',
    'Preparando tu respuesta…'
  );

  indicador.setAttribute('role', 'status');

  try {
    const datos = await consultarIA(
      texto,
      peticion.signal
    );

    // Evita mostrar respuestas de una sesión anterior.
    if (sesionActual !== sesion) {
      return;
    }

    indicador.remove();

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

    indicador.remove();

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
// NUEVA SESIÓN
// --------------------------------------------------

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

function detenerPeticion() {
  sesion++;

  if (controlador) {
    controlador.abort();
    controlador = null;
  }
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
  historial = conv.historial.slice();

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

// Inicio
cargarConversaciones();
pintarRecientes();

if (!esMovil()) {
  abrirBarra();
}