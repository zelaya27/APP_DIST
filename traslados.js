let pasoActual = 1;
const totalPasos = 3;
let modoEdicion = false;
let idEdicion = "";
let trasladoGuardado = false;
let cuadrillasBD = [];
let materialesBD = [];
let categoriasBD = [];
let materialSeleccionado = null;
let selectorGlobal = { items: [], onSelect: null };
let tipoFirmaActual = "";
let firmaDibujada = false;
let formularioSucio = false;

let canvasFirma = null;
let ctxFirma = null;
let firmaPointerActivo = false;

const usuarioSesion = sessionStorage.getItem("usuario") || "";
const sectorSesion = sessionStorage.getItem("sector") || "";
const tipoUsuarioSesion = String(sessionStorage.getItem("tipo_usuario") || "").trim();
const numeroCuadrillaLogin = String(sessionStorage.getItem("numero_cuadrilla") || sessionStorage.getItem("cuadrilla") || "").trim();
const ID_CUADRILLA_ENTREGA_DEFAULT = "48";

// =====================================================
// INICIO
// =====================================================

document.addEventListener("DOMContentLoaded", async function() {
  if (!usuarioSesion) {
    window.location.href = "index.html";
    return;
  }

  setTexto("nombreUsuarioHeader", usuarioSesion);
  setTexto("nombreSectorHeader", sectorSesion);

  const params = new URLSearchParams(window.location.search);
  modoEdicion = params.get("modo") === "editar" && !!params.get("id");
  idEdicion = params.get("id") || "";
  setTexto("tituloPantalla", modoEdicion ? "EDITAR TRASLADO" : "TRASLADOS");

  prepararNuevoTraslado();
  activarProteccionSalida();
  configurarCanvasFirma();

  await Promise.all([
    cargarCuadrillas(),
    cargarDatosMaterialesTraslado()
  ]);

  if (modoEdicion) {
    await cargarTrasladoEditar(idEdicion);
  } else {
    await aplicarReglasInicialesNuevo();
  }

  actualizarPermisosVisuales();
  actualizarBotones();
});

function prepararNuevoTraslado() {
  setValor("col_0", generarIDTraslado());
  setValor("col_1", sectorSesion);
  setValor("col_2", usuarioSesion);
  setValor("col_8", fechaHoy());
  setValor("col_9", usuarioSesion);

  const tipoCampo = document.getElementById("col_23");
  if (tipoCampo && !tipoCampo.value) tipoCampo.value = "Operaciones";

  if (tipoUsuarioSesion === "3") {
    setValor("col_3", "Solicitado");
  } else {
    setValor("col_3", "Preparado");
    setValor("col_10", fechaHoy());
    setValor("col_11", usuarioSesion);
  }
}

async function aplicarReglasInicialesNuevo() {
  const cuadEntrega = buscarCuadrillaPorNumero(ID_CUADRILLA_ENTREGA_DEFAULT);
  if (cuadEntrega) {
    seleccionarCuadrilla("entrega", cuadEntrega, false);
  } else {
    setValor("col_5", ID_CUADRILLA_ENTREGA_DEFAULT);
    setValor("col_4", "SUPERVISORES");
  }

  if (tipoUsuarioSesion === "3") {
    const cuadRecibe = buscarCuadrillaPorNumero(numeroCuadrillaLogin);
    if (cuadRecibe) {
      seleccionarCuadrilla("recibe", cuadRecibe, false);
    } else {
      setValor("col_7", numeroCuadrillaLogin);
      setValor("col_6", numeroCuadrillaLogin);
    }
  }
}

function generarIDTraslado() {
  return "TRA-" + Math.floor(100000 + Math.random() * 900000);
}

function fechaHoy() {
  return new Date().toISOString().split("T")[0];
}

function activarProteccionSalida() {
  const form = document.getElementById("formTraslado");
  if (form) {
    form.addEventListener("input", () => formularioSucio = true);
    form.addEventListener("change", () => formularioSucio = true);
  }

  window.addEventListener("beforeunload", function(e) {
    if (formularioSucio && !trasladoGuardado) {
      e.preventDefault();
      e.returnValue = "Tiene datos sin guardar.";
      return e.returnValue;
    }
  });
}

function volverListaSeguro() {
  if (formularioSucio && !trasladoGuardado && !confirm("Tiene datos sin guardar. ¿Desea salir?")) return;
  window.location.href = "listatraslados.html";
}

// =====================================================
// CUADRILLAS
// =====================================================

async function cargarCuadrillas() {
  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({ action: "obtenerCuadrillas", sector: sectorSesion })
    });
    const data = await res.json();
    cuadrillasBD = data.cuadrillas || [];
  } catch (error) {
    console.error(error);
    cuadrillasBD = [];
    alert("Error cargando cuadrillas.");
  }
}

function buscarCuadrillaPorNumero(numero) {
  return cuadrillasBD.find(c => norm(c.numero) === norm(numero));
}

function seleccionarCuadrilla(tipo, c, marcar = true) {
  if (tipo === "entrega") {
    setValor("col_4", c.nombre || "");
    setValor("col_5", c.numero || "");
  }

  if (tipo === "recibe") {
    setValor("col_6", c.nombre || "");
    setValor("col_7", c.numero || "");
  }

  if (marcar) formularioSucio = true;
}

function abrirSelectorCuadrillaEntrega() {
  if (tipoUsuarioSesion !== "1") return;

  abrirSelector("Cuadrilla que entrega", cuadrillasBD.map(c => ({
    texto: c.nombre,
    subtexto: "ID " + c.numero,
    data: c
  })), item => seleccionarCuadrilla("entrega", item.data));
}

function abrirSelectorCuadrillaRecibe() {
  if (tipoUsuarioSesion === "3") return;

  abrirSelector("Cuadrilla que recibe", cuadrillasBD.map(c => ({
    texto: c.nombre,
    subtexto: "ID " + c.numero,
    data: c
  })), item => seleccionarCuadrilla("recibe", item.data));
}

// =====================================================
// MATERIALES
// =====================================================

async function cargarDatosMaterialesTraslado() {
  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({ action: "obtenerDatosMateriales" })
    });
    const data = await res.json();
    materialesBD = data.materiales || [];
    categoriasBD = data.categorias || [];
  } catch (error) {
    console.error(error);
    materialesBD = [];
    categoriasBD = [];
    alert("Error cargando materiales.");
  }
}

function abrirModalMaterialTraslado() {
  if (!getValor("col_5")) {
    alert("Debe tener cuadrilla que entrega.");
    return;
  }

  limpiarModalMaterial();
  document.getElementById("modalMaterialBg").style.display = "flex";
}

function cerrarModalMaterialTraslado() {
  document.getElementById("modalMaterialBg").style.display = "none";
}

function limpiarModalMaterial() {
  materialSeleccionado = null;
  ["mat_categoria", "mat_nombre", "mat_codigo", "mat_unidad", "mat_existencia", "mat_cantidad", "mat_observaciones"].forEach(id => setValor(id, ""));
  document.getElementById("mat_imagen_box").innerHTML = "Sin imagen disponible";
  document.getElementById("mat_existencia").classList.remove("stock-low", "stock-ok");
}

function abrirSelectorCategoria() {
  const items = [{ texto: "Todas", data: "" }].concat(
    categoriasBD.map(c => ({ texto: c, data: c }))
  );

  abrirSelector("Categoría", items, item => {
    setValor("mat_categoria", item.data || "");
    materialSeleccionado = null;
    setValor("mat_nombre", "");
    setValor("mat_codigo", "");
    setValor("mat_unidad", "");
    setValor("mat_existencia", "");
    setValor("mat_observaciones", "");
    document.getElementById("mat_imagen_box").innerHTML = "Sin imagen disponible";
  });
}

function materialesFiltrados() {
  const cat = norm(getValor("mat_categoria"));
  return cat ? materialesBD.filter(m => norm(m.categoria) === cat) : materialesBD;
}

function abrirSelectorMaterialNombre() {
  const items = materialesFiltrados().map(m => ({
    texto: m.nombre,
    subtexto: m.codigo + (m.categoria ? " | " + m.categoria : ""),
    data: m
  }));

  abrirSelector("Nombre del material", items, item => llenarMaterial(item.data));
}

function abrirSelectorMaterialCodigo() {
  const items = materialesFiltrados().map(m => ({
    texto: m.codigo,
    subtexto: m.nombre,
    data: m
  }));

  abrirSelector("Código del material", items, item => llenarMaterial(item.data));
}

async function llenarMaterial(m) {
  materialSeleccionado = m;
  setValor("mat_codigo", m.codigo || "");
  setValor("mat_nombre", m.nombre || "");
  setValor("mat_categoria", m.categoria || "");
  setValor("mat_unidad", m.unidad || "");
  setValor("mat_observaciones", m.observaciones || "");

  mostrarImagenMaterial(m.imagen || "");
  await consultarStockMaterialTraslado(m.codigo);
}

function mostrarImagenMaterial(url) {
  const box = document.getElementById("mat_imagen_box");

  if (!url) {
    box.innerHTML = "Sin imagen disponible";
    return;
  }

  if (url.includes("drive.google.com/file/d/")) {
    const id = url.split("/d/")[1].split("/")[0];
    url = "https://drive.google.com/uc?export=view&id=" + id;
  }

  box.innerHTML = '<img src="' + escapeAttr(url) + '" style="max-width:100%;max-height:170px;background:white;border-radius:8px;">';
}

async function consultarStockMaterialTraslado(codigo) {
  const campo = document.getElementById("mat_existencia");
  campo.value = "Consultando...";
  campo.classList.remove("stock-low", "stock-ok");

  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "consultarStockMaterialTraslado",
        sector: sectorSesion,
        codigo: codigo,
        idCuadrillaEntrega: getValor("col_5")
      })
    });

    const data = await res.json();
    const existencia = Number(data.existencia) || 0;
    campo.value = existencia;
    campo.classList.add(existencia > 0 ? "stock-ok" : "stock-low");
  } catch (error) {
    console.error(error);
    campo.value = 0;
    campo.classList.add("stock-low");
    alert("No se pudo consultar el stock del material.");
  }
}

function agregarMaterialTraslado() {
  const codigo = getValor("mat_codigo");
  const nombre = getValor("mat_nombre");
  const unidad = getValor("mat_unidad");
  const cantidad = Number(getValor("mat_cantidad"));
  const existencia = Number(getValor("mat_existencia")) || 0;

  if (!materialSeleccionado || !codigo || !nombre) {
    alert("Debe seleccionar un material válido desde la lista.");
    return;
  }

  if (!cantidad || cantidad <= 0) {
    alert("Ingrese una cantidad válida.");
    return;
  }

  if (existencia <= 0 && !confirm("El material no tiene existencia actual. ¿Desea agregarlo de todas formas?")) return;

  if (cantidad > existencia && existencia > 0 && !confirm("La cantidad supera el stock disponible.\n\nStock actual: " + existencia + "\nCantidad: " + cantidad + "\n\n¿Desea agregarlo?")) return;

  agregarMaterialTabla({ codigo, nombre, unidad, cantidad });
  cerrarModalMaterialTraslado();
  formularioSucio = true;
}

function agregarMaterialTabla(m) {
  const cont = document.getElementById("listaMaterialesTraslado");
  let tabla = cont.querySelector("table");

  if (!tabla) {
    tabla = document.createElement("table");
    tabla.className = "material-table";
    tabla.innerHTML = "<thead><tr><th>Código</th><th>Material</th><th>Cant.</th><th></th></tr></thead><tbody></tbody>";
    cont.appendChild(tabla);
  }

  const tr = document.createElement("tr");
  tr.className = "material-row";
  tr.innerHTML = `
    <td>${escapeHTML(m.codigo)}<input type="hidden" class="codigo-material" value="${escapeAttr(m.codigo)}"></td>
    <td>${escapeHTML(m.nombre)}<input type="hidden" class="nombre-material" value="${escapeAttr(m.nombre)}"><input type="hidden" class="unidad-material" value="${escapeAttr(m.unidad)}"></td>
    <td>${escapeHTML(m.cantidad)}<input type="hidden" class="cantidad-material" value="${escapeAttr(m.cantidad)}"></td>
    <td><button type="button" class="btn-trash" onclick="eliminarMaterial(this)"><i class="fas fa-trash"></i></button></td>
  `;

  tabla.querySelector("tbody").appendChild(tr);
}

function eliminarMaterial(btn) {
  const tr = btn.closest("tr");
  const table = btn.closest("table");
  tr.remove();
  if (!table.querySelector("tbody").children.length) table.remove();
  formularioSucio = true;
}

function obtenerMateriales() {
  return Array.from(document.querySelectorAll("#listaMaterialesTraslado .material-row")).map(r => ({
    codigo: r.querySelector(".codigo-material").value,
    nombre: r.querySelector(".nombre-material").value,
    unidad: r.querySelector(".unidad-material").value,
    cantidad: r.querySelector(".cantidad-material").value
  }));
}

// =====================================================
// SELECTOR GLOBAL
// =====================================================

function abrirSelector(titulo, items, onSelect) {
  selectorGlobal = { items: items || [], onSelect: onSelect };
  document.getElementById("selectorTitulo").innerHTML = '<i class="fas fa-list"></i> ' + escapeHTML(titulo);
  document.getElementById("selectorBuscar").value = "";
  document.getElementById("selectorBg").style.display = "flex";
  renderSelector(selectorGlobal.items);

  setTimeout(() => {
    const buscador = document.getElementById("selectorBuscar");
    if (buscador) buscador.focus();
  }, 120);
}

function cerrarSelector() {
  document.getElementById("selectorBg").style.display = "none";
}

function filtrarSelector() {
  const t = norm(document.getElementById("selectorBuscar").value);
  renderSelector(selectorGlobal.items.filter(i => norm(i.texto).includes(t) || norm(i.subtexto).includes(t)));
}

function renderSelector(items) {
  const lista = document.getElementById("selectorLista");
  lista.innerHTML = "";

  if (!items.length) {
    lista.innerHTML = '<div class="selector-item">Sin resultados</div>';
    return;
  }

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "selector-item";
    div.innerHTML = escapeHTML(item.texto) + (item.subtexto ? "<br><small>" + escapeHTML(item.subtexto) + "</small>" : "");

    div.addEventListener("click", function() {
      if (typeof selectorGlobal.onSelect === "function") selectorGlobal.onSelect(item);
      cerrarSelector();
    });

    lista.appendChild(div);
  });
}

// =====================================================
// FIRMA DIGITAL MEJORADA
// Compatible con mouse y táctil
// =====================================================

function abrirModalFirma(tipo) {
  tipoFirmaActual = tipo;
  const esPrep = tipo === "preparacion";

  document.getElementById("tituloFirma").innerHTML = esPrep
    ? '<i class="fas fa-pen-nib"></i> Firma preparación'
    : '<i class="fas fa-signature"></i> Firma recibido';

  document.getElementById("labelNombreFirma").textContent = esPrep ? "Nombre de quien prepara" : "Nombre de quien recibe";
  document.getElementById("nombreFirma").value = esPrep ? (getValor("col_11") || usuarioSesion) : (getValor("col_14") || "");

  document.getElementById("modalFirmaBg").style.display = "flex";

  setTimeout(function() {
    inicializarTamanioCanvasFirma();
    limpiarFirmaCanvas();
  }, 120);
}

function cerrarModalFirma() {
  document.getElementById("modalFirmaBg").style.display = "none";
}

function configurarCanvasFirma() {
  canvasFirma = document.getElementById("canvasFirma");
  if (!canvasFirma) return;

  ctxFirma = canvasFirma.getContext("2d");

  window.addEventListener("resize", inicializarTamanioCanvasFirma);

  canvasFirma.addEventListener("pointerdown", iniciarTrazoFirma);
  canvasFirma.addEventListener("pointermove", moverTrazoFirma);
  canvasFirma.addEventListener("pointerup", terminarTrazoFirma);
  canvasFirma.addEventListener("pointercancel", terminarTrazoFirma);
  canvasFirma.addEventListener("pointerleave", terminarTrazoFirma);

  canvasFirma.addEventListener("touchstart", e => e.preventDefault(), { passive: false });
  canvasFirma.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
}

function inicializarTamanioCanvasFirma() {
  if (!canvasFirma || !ctxFirma) return;

  const rect = canvasFirma.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const ancho = Math.max(rect.width, 300);
  const alto = 220;

  canvasFirma.width = ancho * ratio;
  canvasFirma.height = alto * ratio;
  canvasFirma.style.height = alto + "px";

  ctxFirma.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctxFirma.lineWidth = 3;
  ctxFirma.lineCap = "round";
  ctxFirma.lineJoin = "round";
  ctxFirma.strokeStyle = "#111827";
  ctxFirma.fillStyle = "#ffffff";
  ctxFirma.fillRect(0, 0, ancho, alto);
  firmaDibujada = false;
}

function obtenerPosicionFirma(e) {
  const rect = canvasFirma.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function iniciarTrazoFirma(e) {
  if (!canvasFirma || !ctxFirma) return;
  e.preventDefault();

  firmaPointerActivo = true;
  firmaDibujada = true;
  canvasFirma.setPointerCapture(e.pointerId);

  const p = obtenerPosicionFirma(e);
  ctxFirma.beginPath();
  ctxFirma.moveTo(p.x, p.y);
}

function moverTrazoFirma(e) {
  if (!firmaPointerActivo || !ctxFirma) return;
  e.preventDefault();

  const p = obtenerPosicionFirma(e);
  ctxFirma.lineTo(p.x, p.y);
  ctxFirma.stroke();
}

function terminarTrazoFirma(e) {
  if (!firmaPointerActivo) return;
  firmaPointerActivo = false;
  try {
    canvasFirma.releasePointerCapture(e.pointerId);
  } catch (err) {}
}

function limpiarFirmaCanvas() {
  inicializarTamanioCanvasFirma();
}

function guardarFirmaModal() {
  const nombre = getValor("nombreFirma");

  if (!nombre) {
    alert("Debe escribir el nombre.");
    return;
  }

  if (!firmaDibujada) {
    alert("Debe firmar en el recuadro antes de guardar.");
    return;
  }

  const firma = canvasFirma.toDataURL("image/png");

  if (tipoFirmaActual === "preparacion") {
    setValor("col_10", fechaHoy());
    setValor("col_11", nombre);
    setValor("col_12", firma);
    setValor("col_3", "Preparado");
    document.getElementById("previewFirmaPrep").innerHTML = '<img src="' + firma + '" alt="Firma preparación">';
  } else {
    setValor("col_13", fechaHoy());
    setValor("col_14", nombre);
    setValor("col_15", firma);
    setValor("col_3", "Recibido");
    document.getElementById("previewFirmaRec").innerHTML = '<img src="' + firma + '" alt="Firma recibido">';
  }

  formularioSucio = true;
  cerrarModalFirma();
  actualizarPermisosVisuales();
}

// =====================================================
// PERMISOS / EDICIÓN
// =====================================================

function actualizarPermisosVisuales() {
  const estado = norm(getValor("col_3"));

  const boxPrep = document.getElementById("boxFirmaPrep");
  const boxRec = document.getElementById("boxFirmaRec");

  if (boxPrep) boxPrep.style.display = (tipoUsuarioSesion === "1" || tipoUsuarioSesion === "2") ? "block" : "none";
  if (boxRec) boxRec.style.display = (tipoUsuarioSesion === "3" && estado === "PREPARADO") ? "block" : "none";

  if (tipoUsuarioSesion !== "1") {
    const campoEntrega = document.getElementById("col_4");
    if (campoEntrega) campoEntrega.classList.remove("selector");
  }

  if (tipoUsuarioSesion === "3") {
    const campoRecibe = document.getElementById("col_6");
    if (campoRecibe) campoRecibe.classList.remove("selector");
  }

  const btn = document.getElementById("btnGuardarTraslado");
  if (btn) {
    if (["RECIBIDO", "TERMINADO", "AUDITADO"].includes(estado)) {
      btn.disabled = true;
      btn.style.opacity = .65;
    } else {
      btn.disabled = false;
      btn.style.opacity = 1;
    }
  }
}

async function cargarTrasladoEditar(id) {
  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "obtenerTrasladoPorId",
        idTraslado: id,
        tipo_usuario: tipoUsuarioSesion,
        sector: sectorSesion,
        numero_cuadrilla: numeroCuadrillaLogin
      })
    });

    const data = await res.json();
    if (data.status !== "Éxito") {
      alert(data.message || "No se pudo cargar traslado.");
      window.location.href = "listatraslados.html";
      return;
    }

    const t = data.traslado || {};
    for (let i = 0; i <= 23; i++) {
      const el = document.getElementById("col_" + i);
      if (el) el.value = t["col_" + i] || "";
    }

    (data.materiales || []).forEach(agregarMaterialTabla);

    if (getValor("col_12")) {
      document.getElementById("previewFirmaPrep").innerHTML = '<img src="' + getValor("col_12") + '" alt="Firma preparación">';
    }

    if (getValor("col_15")) {
      document.getElementById("previewFirmaRec").innerHTML = '<img src="' + getValor("col_15") + '" alt="Firma recibido">';
    }

    const url = getValor("col_16");
    if (url) mostrarBotonPDF(url);

    formularioSucio = false;
    trasladoGuardado = false;
    actualizarPermisosVisuales();
  } catch (error) {
    console.error(error);
    alert("Error cargando traslado para editar.");
    window.location.href = "listatraslados.html";
  }
}

// =====================================================
// GUARDAR / PDF
// =====================================================

function validarTraslado() {
  if (!getValor("col_4") || !getValor("col_5")) {
    alert("Debe definir la cuadrilla que entrega.");
    pasoActual = 1;
    mostrarPasoActual();
    return false;
  }

  if (!getValor("col_6") || !getValor("col_7")) {
    alert("Debe definir la cuadrilla que recibe.");
    pasoActual = 1;
    mostrarPasoActual();
    return false;
  }

  if (!getValor("col_23")) {
    alert("Debe seleccionar el tipo de traslado.");
    pasoActual = 1;
    mostrarPasoActual();
    return false;
  }

  if (obtenerMateriales().length === 0) {
    alert("Debe agregar al menos un material.");
    pasoActual = 2;
    mostrarPasoActual();
    return false;
  }

  return true;
}

async function guardarTraslado() {
  if (!validarTraslado()) return;

  const traslado = {};
  for (let i = 0; i <= 23; i++) {
    const el = document.getElementById("col_" + i);
    traslado["col_" + i] = el ? el.value : "";
  }

  const btn = document.getElementById("btnGuardarTraslado");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "guardarTraslado",
        traslado,
        materiales: obtenerMateriales(),
        usuario: usuarioSesion,
        tipo_usuario: tipoUsuarioSesion,
        sector: sectorSesion
      })
    });

    const data = await res.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo guardar.");

    trasladoGuardado = true;
    formularioSucio = false;
    document.getElementById("mensajeGuardado").style.display = "block";
    document.getElementById("mensajeGuardado").innerHTML = '<i class="fas fa-check-circle"></i> Traslado guardado correctamente: ' + escapeHTML(data.id || traslado.col_0);
    document.getElementById("btnGenerarPDF").style.display = "flex";
    alert("Traslado guardado correctamente.");
  } catch (e) {
    alert("Error guardando traslado: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Guardar traslado';
    actualizarPermisosVisuales();
  }
}

async function generarPDFTraslado() {
  const id = getValor("col_0");
  const btn = document.getElementById("btnGenerarPDF");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({ action: "generarPDFTraslado", idTraslado: id })
    });
    const data = await res.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo generar PDF.");
    setValor("col_16", data.url);
    mostrarBotonPDF(data.url);
    alert("PDF generado correctamente.");
  } catch (e) {
    alert("Error PDF: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generar PDF';
  }
}

function mostrarBotonPDF(url) {
  document.getElementById("btnGenerarPDF").style.display = "none";
  const a = document.getElementById("btnVerPDF");
  a.href = url;
  a.style.display = "flex";
}

// =====================================================
// NAVEGACIÓN
// =====================================================

function siguientePaso() {
  if (pasoActual < totalPasos) {
    pasoActual++;
    mostrarPasoActual();
  }
}

function pasoAnterior() {
  if (pasoActual > 1) {
    pasoActual--;
    mostrarPasoActual();
  }
}

function mostrarPasoActual() {
  for (let i = 1; i <= totalPasos; i++) {
    document.getElementById("step-" + i).classList.toggle("activo", i === pasoActual);
    document.getElementById("ind-" + i).classList.toggle("active", i === pasoActual);
  }
  actualizarBotones();
}

function actualizarBotones() {
  document.getElementById("btnAnterior").style.display = pasoActual === 1 ? "none" : "flex";
  document.getElementById("btnSiguiente").style.display = pasoActual === totalPasos ? "none" : "flex";
}

// =====================================================
// UTILIDADES
// =====================================================

function getValor(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || "").trim() : "";
}

function setValor(id, valor) {
  const el = document.getElementById(id);
  if (el) el.value = valor || "";
}

function setTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor || "";
}

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

function escapeHTML(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(v) {
  return escapeHTML(v).replace(/`/g, "&#096;");
}
