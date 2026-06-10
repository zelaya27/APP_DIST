// =====================================================
// APP DIST - PANEL ODT
// Pantalla de escritorio para gestión, controles y auditoría
// =====================================================

let registrosPanel = [];
let erroresSeleccionados = [];

const usuarioSesion = sessionStorage.getItem("usuario") || "";
const sectorSesion = sessionStorage.getItem("sector") || "";
const tipoUsuarioSesion = String(sessionStorage.getItem("tipo_usuario") || "").trim();

const opcionesErroresAuditoria = [
  "Hija",
  "ODT",
  "Reporte",
  "Evento",
  "Requisa",
  "Actividad",
  "ID de traslado"
];

document.addEventListener("DOMContentLoaded", function() {
  if (!usuarioSesion) {
    window.location.href = "index.html";
    return;
  }

  if (tipoUsuarioSesion === "3") {
    alert("No cuentas con permisos para ingresar al Panel ODT.");
    window.location.href = "menu.html";
    return;
  }

  document.getElementById("nombreUsuario").textContent = usuarioSesion || "Usuario";
  document.getElementById("nombreSector").textContent = sectorSesion || "Sector";

  cargarPanelODT();
});

function cerrarSesion() {
  sessionStorage.clear();
  window.location.href = "index.html";
}

// =====================================================
// CARGA PRINCIPAL
// =====================================================

async function cargarPanelODT() {
  const tbody = document.getElementById("tablaODT");
  tbody.innerHTML = '<tr><td colspan="7" class="mensaje-tabla"><i class="fas fa-spinner fa-spin"></i> Cargando ODT...</td></tr>';

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "obtenerPanelODT",
        usuario: usuarioSesion,
        tipo_usuario: tipoUsuarioSesion,
        sector: sectorSesion
      })
    });

    const data = await response.json();

    if (data.status !== "Éxito") {
      throw new Error(data.message || "No se pudo cargar el panel ODT.");
    }

    registrosPanel = data.odts || [];
    actualizarResumen();
    renderizarTabla();

  } catch (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="7" class="mensaje-tabla mensaje-error"><i class="fas fa-exclamation-triangle"></i> Error cargando Panel ODT: ' + escaparHTML(error.message) + '</td></tr>';
  }
}

// =====================================================
// RESUMEN SUPERIOR
// =====================================================

function actualizarResumen() {
  const resumen = {
    pendiente: { INCIDENCIAS: 0, MANTENIMIENTO: 0, OPERACIONES: 0 },
    ejecutada: { INCIDENCIAS: 0, MANTENIMIENTO: 0, OPERACIONES: 0 }
  };

  registrosPanel.forEach(function(row) {
    const estado = normalizarTexto(row.col_3 || "Pendiente");
    const razon = normalizarTexto(row.col_8 || "");

    if (!resumen.pendiente.hasOwnProperty(razon)) return;

    if (estado === "PENDIENTE") {
      resumen.pendiente[razon]++;
    }

    if (estado === "TERMINADO" || estado === "AUDITADO") {
      resumen.ejecutada[razon]++;
    }
  });

  setTexto("pendIncidencias", resumen.pendiente.INCIDENCIAS);
  setTexto("pendMantenimiento", resumen.pendiente.MANTENIMIENTO);
  setTexto("pendOperaciones", resumen.pendiente.OPERACIONES);

  setTexto("ejecIncidencias", resumen.ejecutada.INCIDENCIAS);
  setTexto("ejecMantenimiento", resumen.ejecutada.MANTENIMIENTO);
  setTexto("ejecOperaciones", resumen.ejecutada.OPERACIONES);
}

function setTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

// =====================================================
// FILTROS Y TABLA
// =====================================================

function obtenerDatosFiltrados() {
  const estado = document.getElementById("filtroEstado").value;
  const razon = document.getElementById("filtroRazon").value;
  const fechaDesde = document.getElementById("fechaDesde").value;
  const fechaHasta = document.getElementById("fechaHasta").value;
  const texto = normalizarTexto(document.getElementById("buscadorTexto").value || "");
  const reporteBuscado = String(document.getElementById("buscadorReporte") ? document.getElementById("buscadorReporte").value : "").trim();

  let datos = registrosPanel.slice();

  datos = datos.filter(function(row) {
    const estadoFila = normalizarTexto(row.col_3 || "Pendiente");
    const razonFila = normalizarTexto(row.col_8 || "");
    const fechaISO = String(row.fecha_iso || "").trim();

    if (estado !== "ALL" && estadoFila !== estado) return false;
    if (razon !== "ALL" && razonFila !== razon) return false;
    if (fechaDesde && fechaISO && fechaISO < fechaDesde) return false;
    if (fechaHasta && fechaISO && fechaISO > fechaHasta) return false;

    if (texto) {
      const idODT = normalizarTexto(row.col_0 || "");
      if (!idODT.includes(texto)) return false;
    }

    if (reporteBuscado) {
      const reporteFila = String(row.col_26 || "").trim();
      if (!reporteFila.includes(reporteBuscado)) return false;
    }

    return true;
  });

  return datos;
}

function renderizarTabla() {
  const tbody = document.getElementById("tablaODT");
  const limitSelector = document.getElementById("limitSelector");
  const odtBuscada = String(document.getElementById("buscadorTexto").value || "").trim();
  const reporteBuscado = String(document.getElementById("buscadorReporte") ? document.getElementById("buscadorReporte").value : "").trim();

  let datos = obtenerDatosFiltrados();

  datos.sort(function(a, b) {
    return (Number(b.fecha_orden) || 0) - (Number(a.fecha_orden) || 0);
  });

  if (limitSelector.value !== "ALL") {
    datos = datos.slice(0, parseInt(limitSelector.value, 10));
  }

  tbody.innerHTML = "";

  if (datos.length === 0) {
    let mensaje = "No hay ODT para mostrar con los filtros seleccionados.";

    if (reporteBuscado) {
      mensaje = "No se encontró el reporte.";
    } else if (odtBuscada) {
      mensaje = "No se encontró la ODT.";
    }

    tbody.innerHTML = '<tr><td colspan="7" class="mensaje-tabla">' + escaparHTML(mensaje) + '</td></tr>';
    return;
  }

  datos.forEach(function(row) {
    const tr = document.createElement("tr");
    const id = String(row.col_0 || "").trim();
    const estado = String(row.col_3 || "Pendiente").trim();

    tr.innerHTML = `
      <td class="col-id"><strong>${escaparHTML(id)}</strong></td>
      <td class="col-estado">${crearSelectEstado(row)}</td>
      <td class="col-fecha">${escaparHTML(row.col_5 || "")}</td>
      <td class="col-cuadrilla">${escaparHTML(row.col_4 || "")}</td>
      <td class="col-razon">${escaparHTML(row.col_8 || "")}</td>
      <td class="col-reporte">${escaparHTML(row.col_26 || "")}</td>
      <td class="col-acciones">
        <div class="acciones-td">
          <button class="btn-icon btn-controles btn-control-grande" title="Datos de control" onclick="abrirControles('${escaparAtributo(id)}')">
            <i class="fas fa-sliders"></i> Control
          </button>
          <button class="btn-icon btn-pdf" title="Ver PDF" onclick="verPDF('${escaparAtributo(id)}')">
            <i class="fas fa-file-pdf"></i> PDF
          </button>
          ${crearBotonEditar(row)}
          <button class="btn-icon btn-auditar" title="Auditar" onclick="abrirAuditoria('${escaparAtributo(id)}')">
            <i class="fas fa-magnifying-glass"></i> Auditar
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function crearSelectEstado(row) {
  const id = escaparAtributo(row.col_0 || "");
  const estado = String(row.col_3 || "Pendiente").trim();
  const estadoNorm = normalizarTexto(estado);
  const clase = obtenerClaseEstadoSelect(estado);
  const esTipo1 = tipoUsuarioSesion === "1";
  const esTipo2 = tipoUsuarioSesion === "2";

  let opciones = ["Pendiente", "Terminado"];
  if (esTipo1) opciones.push("Auditado");

  const disabled = (!esTipo1 && estadoNorm === "AUDITADO") ? "disabled" : "";

  let html = `<select class="estado-select ${clase}" ${disabled} onchange="cambiarEstadoDesdeTabla('${id}', this)">`;
  opciones.forEach(function(op) {
    const selected = normalizarTexto(op) === estadoNorm ? "selected" : "";
    html += `<option value="${op}" ${selected}>${op}</option>`;
  });

  // Si es tipo 2 y ya está auditado, debe visualizar Auditado aunque no pueda cambiarlo.
  if (!esTipo1 && estadoNorm === "AUDITADO") {
    html += `<option value="Auditado" selected>Auditado</option>`;
  }

  html += "</select>";
  return html;
}

function obtenerClaseEstadoSelect(estado) {
  const e = normalizarTexto(estado);
  if (e === "TERMINADO") return "estado-terminado";
  if (e === "AUDITADO") return "estado-auditado";
  return "estado-pendiente";
}

function limpiarFiltros() {
  document.getElementById("limitSelector").value = "10";
  document.getElementById("filtroEstado").value = "ALL";
  document.getElementById("filtroRazon").value = "ALL";
  document.getElementById("fechaDesde").value = "";
  document.getElementById("fechaHasta").value = "";
  document.getElementById("buscadorTexto").value = "";
  if (document.getElementById("buscadorReporte")) document.getElementById("buscadorReporte").value = "";
  renderizarTabla();
}

// =====================================================
// CAMBIO DE ESTADO DESDE TABLA
// =====================================================

async function cambiarEstadoDesdeTabla(idODT, select) {
  const nuevoEstado = select.value;
  const registro = buscarRegistro(idODT);
  const estadoAnterior = registro ? String(registro.col_3 || "Pendiente") : "Pendiente";

  if (tipoUsuarioSesion !== "1" && normalizarTexto(nuevoEstado) === "AUDITADO") {
    alert("No cuentas con los permisos para cambiar a estado Auditado.");
    select.value = estadoAnterior;
    return;
  }

  if (tipoUsuarioSesion !== "1" && normalizarTexto(estadoAnterior) === "AUDITADO") {
    alert("No cuentas con los permisos para modificar una ODT auditada.");
    select.value = estadoAnterior;
    return;
  }

  const confirmar = confirm("¿Desea cambiar el estado de la ODT " + idODT + " a " + nuevoEstado + "?");
  if (!confirmar) {
    select.value = estadoAnterior;
    return;
  }

  select.disabled = true;

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "cambiarEstadoODT",
        idODT: idODT,
        estado: nuevoEstado,
        usuario: usuarioSesion,
        tipo_usuario: tipoUsuarioSesion
      })
    });

    const data = await response.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo cambiar el estado.");

    if (registro) registro.col_3 = nuevoEstado;
    actualizarResumen();
    renderizarTabla();

  } catch (error) {
    console.error(error);
    alert("Error cambiando estado: " + error.message);
    select.value = estadoAnterior;
    select.disabled = false;
  }
}

// =====================================================
// EDICIÓN Y FILTRO DE REPORTE
// =====================================================

function crearBotonEditar(row) {
  const id = escaparAtributo(row.col_0 || "");
  const estado = normalizarTexto(row.col_3 || "Pendiente");

  if (estado === "PENDIENTE") {
    return `
      <button class="btn-icon btn-editar" title="Editar ODT" onclick="editarODT('${id}')">
        <i class="fas fa-pen"></i> Editar
      </button>
    `;
  }

  return `
    <button class="btn-icon btn-editar-bloqueado" title="Solo se puede editar en estado Pendiente" onclick="alert('Esta ODT no puede editarse porque no está en estado Pendiente.')">
      <i class="fas fa-lock"></i> Editar
    </button>
  `;
}

function editarODT(idODT) {
  const registro = buscarRegistro(idODT);

  if (!registro) {
    alert("No se encontró la ODT seleccionada.");
    return;
  }

  if (normalizarTexto(registro.col_3 || "") !== "PENDIENTE") {
    alert("Esta ODT no puede editarse porque no está en estado Pendiente.");
    return;
  }

  window.location.href = "odt.html?id=" + encodeURIComponent(idODT) + "&modo=editar&origen=panel";
}

function filtrarSoloNumerosReporte(input) {
  input.value = String(input.value || "").replace(/\D/g, "");
}

// =====================================================
// PDF
// =====================================================

function verPDF(idODT) {
  const registro = buscarRegistro(idODT);
  const url = registro ? String(registro.col_35 || "").trim() : "";

  if (!url) {
    alert("Esta ODT aún no tiene PDF generado.");
    return;
  }

  window.open(url, "_blank", "noopener");
}

// =====================================================
// MODAL CONTROLES
// =====================================================

function abrirControles(idODT) {
  const row = buscarRegistro(idODT);
  if (!row) {
    alert("No se encontró la ODT seleccionada.");
    return;
  }

  document.getElementById("ctrl_idODT").value = idODT;
  prepararSelectEstadoControl(row);

  document.getElementById("ctrl_reporte").value = row.col_26 || "";
  document.getElementById("ctrl_odtPadre").value = row.col_27 || "";
  document.getElementById("ctrl_hija").value = row.col_28 || "";
  document.getElementById("ctrl_evento").value = row.col_29 || "";
  document.getElementById("ctrl_actividad").value = row.col_30 || "";
  document.getElementById("ctrl_requisa").value = row.col_31 || "";
  document.getElementById("ctrl_traslado").value = row.col_32 || "";
  document.getElementById("ctrl_gestionadoPor").value = usuarioSesion;

  document.getElementById("modalControlesBg").style.display = "flex";
}

function prepararSelectEstadoControl(row) {
  const select = document.getElementById("ctrl_estado");
  const estadoActual = String(row.col_3 || "Pendiente").trim();
  const estadoNorm = normalizarTexto(estadoActual);
  const esTipo1 = tipoUsuarioSesion === "1";

  select.innerHTML = "";

  let opciones = ["Pendiente", "Terminado"];
  if (esTipo1) opciones.push("Auditado");

  opciones.forEach(function(op) {
    const option = document.createElement("option");
    option.value = op;
    option.textContent = op;
    if (normalizarTexto(op) === estadoNorm) option.selected = true;
    select.appendChild(option);
  });

  if (!esTipo1 && estadoNorm === "AUDITADO") {
    const option = document.createElement("option");
    option.value = "Auditado";
    option.textContent = "Auditado";
    option.selected = true;
    select.appendChild(option);
    select.disabled = true;
  } else {
    select.disabled = false;
  }
}

function cerrarModalControles() {
  document.getElementById("modalControlesBg").style.display = "none";
}

async function guardarControles() {
  const idODT = document.getElementById("ctrl_idODT").value;
  const estado = document.getElementById("ctrl_estado").value;

  if (!idODT) {
    alert("ID ODT no válido.");
    return;
  }

  const datos = {
    action: "guardarControlesODT",
    idODT: idODT,
    usuario: usuarioSesion,
    tipo_usuario: tipoUsuarioSesion,
    estado: estado,
    reporte: document.getElementById("ctrl_reporte").value,
    odtPadre: document.getElementById("ctrl_odtPadre").value,
    hija: document.getElementById("ctrl_hija").value,
    evento: document.getElementById("ctrl_evento").value,
    actividad: document.getElementById("ctrl_actividad").value,
    requisa: document.getElementById("ctrl_requisa").value,
    traslado: document.getElementById("ctrl_traslado").value
  };

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(datos)
    });

    const data = await response.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo guardar controles.");

    const row = buscarRegistro(idODT);
    if (row) {
      row.col_3 = estado;
      row.col_26 = datos.reporte;
      row.col_27 = datos.odtPadre;
      row.col_28 = datos.hija;
      row.col_29 = datos.evento;
      row.col_30 = datos.actividad;
      row.col_31 = datos.requisa;
      row.col_32 = datos.traslado;
      row.col_33 = usuarioSesion;
    }

    cerrarModalControles();
    actualizarResumen();
    renderizarTabla();
    alert("Datos de control actualizados correctamente.");

  } catch (error) {
    console.error(error);
    alert("Error guardando controles: " + error.message);
  }
}

// =====================================================
// MODAL AUDITORÍA
// =====================================================

function abrirAuditoria(idODT) {
  if (tipoUsuarioSesion !== "1") {
    alert("No cuentas con los permisos para auditar.");
    return;
  }

  const row = buscarRegistro(idODT);
  if (!row) {
    alert("No se encontró la ODT seleccionada.");
    return;
  }

  document.getElementById("audit_idODT").value = idODT;
  document.getElementById("audit_auditadoPor").value = usuarioSesion;
  document.getElementById("audit_observaciones").value = row.col_38 || "";

  erroresSeleccionados = separarErrores(row.col_37 || "");
  renderizarOpcionesErrores();
  actualizarCampoErrores();

  document.getElementById("modalAuditoriaBg").style.display = "flex";
}

function cerrarModalAuditoria() {
  document.getElementById("modalAuditoriaBg").style.display = "none";
}

function renderizarOpcionesErrores() {
  const grid = document.getElementById("audit_errores_grid");
  grid.innerHTML = "";

  opcionesErroresAuditoria.forEach(function(opcion) {
    const div = document.createElement("div");
    div.className = "error-opcion" + (erroresSeleccionados.includes(opcion) ? " activo" : "");
    div.textContent = opcion;
    div.onclick = function() {
      toggleErrorAuditoria(opcion);
    };
    grid.appendChild(div);
  });
}

function toggleErrorAuditoria(opcion) {
  const idx = erroresSeleccionados.indexOf(opcion);
  if (idx >= 0) {
    erroresSeleccionados.splice(idx, 1);
  } else {
    erroresSeleccionados.push(opcion);
  }

  renderizarOpcionesErrores();
  actualizarCampoErrores();
}

function actualizarCampoErrores() {
  document.getElementById("audit_errores").value = erroresSeleccionados.join(", ");
}

function separarErrores(valor) {
  if (!valor) return [];
  return String(valor)
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}

async function guardarAuditoria() {
  const idODT = document.getElementById("audit_idODT").value;
  const observaciones = document.getElementById("audit_observaciones").value;
  const errores = erroresSeleccionados.join(", ");

  if (tipoUsuarioSesion !== "1") {
    alert("No cuentas con los permisos para auditar.");
    return;
  }

  if (!idODT) {
    alert("ID ODT no válido.");
    return;
  }

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "guardarAuditoriaODT",
        idODT: idODT,
        usuario: usuarioSesion,
        tipo_usuario: tipoUsuarioSesion,
        errores: errores,
        observaciones: observaciones
      })
    });

    const data = await response.json();
    if (data.status !== "Éxito") throw new Error(data.message || "No se pudo guardar auditoría.");

    const row = buscarRegistro(idODT);
    if (row) {
      row.col_3 = "Auditado";
      row.col_36 = usuarioSesion;
      row.col_37 = errores;
      row.col_38 = observaciones;
    }

    cerrarModalAuditoria();
    actualizarResumen();
    renderizarTabla();
    alert("Auditoría guardada correctamente. La ODT quedó en estado Auditado.");

  } catch (error) {
    console.error(error);
    alert("Error guardando auditoría: " + error.message);
  }
}

// =====================================================
// UTILIDADES
// =====================================================

function buscarRegistro(idODT) {
  return registrosPanel.find(function(row) {
    return String(row.col_0 || "").trim() === String(idODT || "").trim();
  });
}

function normalizarTexto(valor) {
  return String(valor || "").trim().toUpperCase();
}

function escaparHTML(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escaparAtributo(valor) {
  return escaparHTML(valor).replace(/`/g, "&#096;");
}
