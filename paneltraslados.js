let registros = [];
let erroresSeleccionados = [];

const usuario = sessionStorage.getItem("usuario") || "";
const sector = sessionStorage.getItem("sector") || "";
const tipo = String(sessionStorage.getItem("tipo_usuario") || "").trim();

const erroresBase = ["ID traslado", "Materiales", "Firmas", "PDF", "ENERGIS", "Cuadrillas", "Tipo"];

const TIPOS_TRASLADO = ["OPERACIONES", "INCIDENCIAS", "MANTENIMIENTO"];

document.addEventListener("DOMContentLoaded", function() {
  if (!usuario) {
    window.location.href = "index.html";
    return;
  }

  if (tipo !== "1" && tipo !== "2") {
    alert("No cuentas con permisos para ingresar al Panel Traslados.");
    window.location.href = "menu.html";
    return;
  }

  document.getElementById("nombreUsuario").textContent = usuario;
  document.getElementById("nombreSector").textContent = sector;
  cargarPanel();
});

function cerrarSesion() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

async function cargarPanel() {
  const tb = document.getElementById("tablaTraslados");
  tb.innerHTML = '<tr><td colspan="9"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>';

  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "obtenerPanelTraslados",
        usuario: usuario,
        tipo_usuario: tipo,
        sector: sector
      })
    });

    const data = await res.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo cargar.");

    registros = data.traslados || [];
    actualizarResumen();
    renderizarTabla();
  } catch (e) {
    tb.innerHTML = '<tr><td colspan="9" style="color:#ff8a8a">Error: ' + esc(e.message) + '</td></tr>';
  }
}

function actualizarResumen() {
  const resumen = {
    recibidos: { OPERACIONES: 0, INCIDENCIAS: 0, MANTENIMIENTO: 0 },
    terminados: { OPERACIONES: 0, INCIDENCIAS: 0, MANTENIMIENTO: 0 }
  };

  registros.forEach(function(r) {
    const estado = norm(r.col_3 || "");
    const tipoRegistro = normalizarTipo(r.col_23 || "");
    if (!tipoRegistro) return;

    if (estado === "RECIBIDO") resumen.recibidos[tipoRegistro]++;
    if (estado === "TERMINADO" || estado === "AUDITADO") resumen.terminados[tipoRegistro]++;
  });

  set("recOperaciones", resumen.recibidos.OPERACIONES);
  set("recIncidencias", resumen.recibidos.INCIDENCIAS);
  set("recMantenimiento", resumen.recibidos.MANTENIMIENTO);
  set("termOperaciones", resumen.terminados.OPERACIONES);
  set("termIncidencias", resumen.terminados.INCIDENCIAS);
  set("termMantenimiento", resumen.terminados.MANTENIMIENTO);
}

function set(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function datosFiltrados() {
  const estado = document.getElementById("filtroEstado").value;
  const tipoFiltro = document.getElementById("filtroTipo").value;
  const desde = document.getElementById("fechaDesde").value;
  const hasta = document.getElementById("fechaHasta").value;
  const id = norm(document.getElementById("buscadorID").value);
  const recibe = norm(document.getElementById("buscadorRecibe").value);
  const energis = norm(document.getElementById("buscadorEnergis").value);

  return registros.filter(function(r) {
    if (estado !== "ALL" && norm(r.col_3) !== norm(estado)) return false;
    if (tipoFiltro !== "ALL" && normalizarTipo(r.col_23) !== normalizarTipo(tipoFiltro)) return false;

    const f = String(r.fecha_iso || "");
    if (desde && f && f < desde) return false;
    if (hasta && f && f > hasta) return false;

    if (id && !norm(r.col_0).includes(id)) return false;
    if (recibe && !norm(r.col_6).includes(recibe)) return false;
    if (energis && !norm(r.col_21).includes(energis)) return false;

    return true;
  });
}

function renderizarTabla() {
  const tb = document.getElementById("tablaTraslados");
  const limit = document.getElementById("limitSelector").value;
  let data = datosFiltrados();

  data.sort((a, b) => (Number(b.fecha_orden) || 0) - (Number(a.fecha_orden) || 0));
  if (limit !== "ALL") data = data.slice(0, Number(limit));

  tb.innerHTML = "";

  if (!data.length) {
    tb.innerHTML = '<tr><td colspan="9">No hay traslados.</td></tr>';
    return;
  }

  data.forEach(function(r) {
    const url = String(r.col_16 || "").trim();
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><b>${esc(r.col_0)}</b></td>
      <td><span class="badge ${clase(r.col_3)}">${esc(r.col_3 || "Solicitado")}</span></td>
      <td>${esc(r.col_23 || "")}</td>
      <td>${esc(r.col_13 || "")}</td>
      <td>${esc(r.col_6 || "")}<br><small>ID ${esc(r.col_7 || "")}</small></td>
      <td>${esc(r.col_20 || "")}</td>
      <td>${esc(r.col_21 || "")}</td>
      <td>${esc(r.col_22 || "")}</td>
      <td>
        <div class="acciones">
          <button class="btn ${url ? "btn-ver" : "btn-pdf"}" onclick="${url ? `verPDF('${atr(url)}')` : `crearPDF('${atr(r.col_0)}')`}">
            ${url ? "Ver PDF" : "Crear PDF"}
          </button>
          <button class="btn btn-control" onclick="abrirControl('${atr(r.col_0)}')">Control</button>
          <button class="btn btn-auditar" ${tipo === "1" ? "" : "disabled"} onclick="abrirAuditoria('${atr(r.col_0)}')">Auditar</button>
          <button class="btn btn-eliminar" ${tipo === "1" ? "" : "disabled"} onclick="eliminarTraslado('${atr(r.col_0)}')">Eliminar</button>
        </div>
      </td>`;

    tb.appendChild(tr);
  });
}

function limpiarFiltros() {
  ["fechaDesde", "fechaHasta", "buscadorID", "buscadorRecibe", "buscadorEnergis"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("filtroEstado").value = "ALL";
  document.getElementById("filtroTipo").value = "ALL";
  document.getElementById("limitSelector").value = "10";
  renderizarTabla();
}

function buscar(id) {
  return registros.find(r => String(r.col_0).trim() === String(id).trim());
}

function abrirControl(id) {
  const r = buscar(id);
  if (!r) {
    alert("No encontrado");
    return;
  }

  document.getElementById("ctrl_id").value = id;
  document.getElementById("ctrl_id_text").value = id;
  document.getElementById("ctrl_fecha_recibido").value = r.col_13 || "";
  document.getElementById("ctrl_fecha_energis").value = r.col_20 || "";
  document.getElementById("ctrl_id_energis").value = r.col_21 || "";
  document.getElementById("ctrl_usuario_energis").value = r.col_22 || usuario;

  aplicarModoSoloLecturaControlTraslado(r);

  document.getElementById("modalControl").style.display = "flex";
}

function aplicarModoSoloLecturaControlTraslado(r) {
  const estado = norm(r.col_3 || "");
  const soloLectura = estado === "Terminado" || estado === "Auditado";

  const campos = [
    "ctrl_fecha_energis",
    "ctrl_id_energis"
  ];

  campos.forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.disabled = soloLectura;
  });

  const btnGuardar = document.getElementById("btnGuardarControl");
  if (btnGuardar) {
    btnGuardar.style.display = soloLectura ? "none" : "inline-flex";
  }
}

function cerrarControl() {
  document.getElementById("modalControl").style.display = "none";
}

async function guardarControl() {
  const id = document.getElementById("ctrl_id").value;
  const fecha = document.getElementById("ctrl_fecha_energis").value;
  const idEner = document.getElementById("ctrl_id_energis").value.trim();

  const rActual = buscar(id);
  if (rActual) {
    const estadoActual = norm(rActual.col_3 || "");
    if (estadoActual === "Terminado" || estadoActual === "Auditado") {
      alert("Este traslado ya está " + rActual.col_3 + " y solo puede visualizarse.");
      cerrarControl();
      return;
    }
  }

  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "guardarControlTrasladoEnergis",
        idTraslado: id,
        fechaEnergis: fecha,
        idEnergis: idEner,
        usuario: usuario,
        tipo_usuario: tipo
      })
    });

    const data = await res.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo guardar.");

    const r = buscar(id);
    if (r) {
      r.col_20 = fecha;
      r.col_21 = idEner;
      r.col_22 = usuario;
      if (fecha && idEner) r.col_3 = "Terminado";
    }

    cerrarControl();
    actualizarResumen();
    renderizarTabla();
    alert("Control ENERGIS guardado correctamente.");
  } catch (e) {
    alert("Error: " + e.message);
  }
}
async function crearPDF(id) {
  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({ action: "generarPDFTraslado", idTraslado: id })
    });
    const data = await res.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo generar PDF.");
    const r = buscar(id);
    if (r) r.col_16 = data.url;
    renderizarTabla();
    window.open(data.url, "_blank", "noopener");
  } catch (e) {
    alert("Error PDF: " + e.message);
  }
}

function verPDF(url) {
  window.open(url, "_blank", "noopener");
}

function abrirAuditoria(id) {
  if (tipo !== "1") {
    alert("No tienes permiso para auditar.");
    return;
  }

  const r = buscar(id);
  if (!r) return;

  document.getElementById("audit_id").value = id;
  document.getElementById("audit_usuario").value = usuario;
  document.getElementById("audit_obs").value = r.col_19 || "";
  erroresSeleccionados = String(r.col_18 || "").split(",").map(x => x.trim()).filter(Boolean);
  renderErrores();
  document.getElementById("modalAuditoria").style.display = "flex";
}

function cerrarAuditoria() {
  document.getElementById("modalAuditoria").style.display = "none";
}

function renderErrores() {
  const g = document.getElementById("audit_grid");
  g.innerHTML = "";

  erroresBase.forEach(function(e) {
    const d = document.createElement("div");
    d.className = "error-op" + (erroresSeleccionados.includes(e) ? " activo" : "");
    d.textContent = e;
    d.onclick = function() {
      const i = erroresSeleccionados.indexOf(e);
      if (i >= 0) erroresSeleccionados.splice(i, 1);
      else erroresSeleccionados.push(e);
      renderErrores();
    };
    g.appendChild(d);
  });

  document.getElementById("audit_errores").value = erroresSeleccionados.join(", ");
}

async function guardarAuditoria() {
  const id = document.getElementById("audit_id").value;
  const obs = document.getElementById("audit_obs").value;
  const errores = erroresSeleccionados.join(", ");

  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "guardarAuditoriaTraslado",
        idTraslado: id,
        usuario: usuario,
        tipo_usuario: tipo,
        errores: errores,
        observaciones: obs
      })
    });

    const data = await res.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo auditar.");

    const r = buscar(id);
    if (r) {
      r.col_3 = "Auditado";
      r.col_17 = usuario;
      r.col_18 = errores;
      r.col_19 = obs;
    }

    cerrarAuditoria();
    actualizarResumen();
    renderizarTabla();
    alert("Auditoría guardada correctamente.");
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function eliminarTraslado(id) {
  if (tipo !== "1") {
    alert("No tienes permiso para eliminar.");
    return;
  }

  if (!confirm("¿Desea eliminar el traslado " + id + " y sus materiales?")) return;

  try {
    const res = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "eliminarTraslado",
        idTraslado: id,
        usuario: usuario,
        tipo_usuario: tipo
      })
    });

    const data = await res.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo eliminar.");

    registros = registros.filter(r => r.col_0 !== id);
    actualizarResumen();
    renderizarTabla();
    alert("Traslado eliminado.");
  } catch (e) {
    alert("Error: " + e.message);
  }
}

function normalizarTipo(v) {
  const t = norm(v);
  if (t === "OPERACIONES") return "OPERACIONES";
  if (t === "INCIDENCIAS" || t === "INCIDENCIA") return "INCIDENCIAS";
  if (t === "MANTENIMIENTO") return "MANTENIMIENTO";
  return "";
}

function clase(e) {
  e = norm(e);
  if (e === "PREPARADO") return "prep";
  if (e === "RECIBIDO") return "rec";
  if (e === "TERMINADO") return "term";
  if (e === "AUDITADO") return "aud";
  return "sol";
}

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

function esc(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function atr(v) {
  return esc(v).replace(/`/g, "&#096;");
}
