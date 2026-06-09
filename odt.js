let pasoActual = 1;
const totalPasos = 4;

const datosModalODT = {};
let cuadrillaAnterior = "";
let numeroCuadrillaAnterior = "";
let cuadrillasBD = [];
let formularioSucio = false;
let guardadoCorrecto = false;
let idODTGuardada = "";
let urlPDFGenerado = "";

const razonesTrabajoBD = [
  "INCIDENCIAS",
  "MANTENIMIENTO",
  "OPERACIONES"
];

let selectorGlobal = {
  titulo: "Seleccionar",
  items: [],
  onSelect: null
};

document.addEventListener("DOMContentLoaded", function() {
  const usuario = sessionStorage.getItem("usuario");
  const sector = sessionStorage.getItem("sector");

  if (!usuario) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("col_0").value = generarID();
  document.getElementById("col_1").value = usuario;
  document.getElementById("col_2").value = sector;
  document.getElementById("col_3").value = "Pendiente";
  document.getElementById("col_5").value = fechaHoy();

  cargarCuadrillas();
  cargarDatosMateriales();
  activarProteccionSalida();
  actualizarBotones();
});

// =====================================================
// PROTECCIÓN CONTRA SALIDA ACCIDENTAL
// =====================================================

function activarProteccionSalida() {
  const form = document.getElementById("formODT");
  if (form) {
    form.addEventListener("input", function() { formularioSucio = true; });
    form.addEventListener("change", function() { formularioSucio = true; });
  }

  window.addEventListener("beforeunload", function(e) {
    if (formularioSucio && !guardadoCorrecto) {
      e.preventDefault();
      e.returnValue = "Tiene datos sin guardar. ¿Desea salir?";
      return "Tiene datos sin guardar. ¿Desea salir?";
    }
  });
}

function volverMenuSeguro() {
  if (formularioSucio && !guardadoCorrecto) {
    const salir = confirm("Tiene datos sin guardar.\n\n¿Desea salir y perder la información capturada?");
    if (!salir) return;
  }
  window.location.href = "menu.html";
}

function marcarFormularioSucio() {
  formularioSucio = true;
}

// =====================================================
// GENERAR ID / FECHA
// =====================================================

function generarID() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return "ODT-" + n;
}

function fechaHoy() {
  const hoy = new Date();
  return hoy.toISOString().split("T")[0];
}

// =====================================================
// SELECTOR GLOBAL CON BUSCADOR
// =====================================================

function abrirSelectorGlobal(titulo, items, onSelect) {
  selectorGlobal = {
    titulo: titulo,
    items: items || [],
    onSelect: onSelect
  };

  document.getElementById("selectorTitulo").innerHTML = '<i class="fas fa-list"></i> ' + escaparHTML(titulo);
  document.getElementById("selectorBuscador").value = "";
  document.getElementById("selectorModalBg").style.display = "flex";

  renderizarSelectorGlobal(selectorGlobal.items);

  setTimeout(function() {
    const buscador = document.getElementById("selectorBuscador");
    if (buscador) buscador.focus();
  }, 120);
}

function cerrarSelectorGlobal() {
  document.getElementById("selectorModalBg").style.display = "none";
}

function filtrarSelectorGlobal() {
  const texto = normalizarLocal(document.getElementById("selectorBuscador").value);

  const filtrados = selectorGlobal.items.filter(function(item) {
    return normalizarLocal(item.texto).includes(texto) || normalizarLocal(item.subtexto || "").includes(texto);
  });

  renderizarSelectorGlobal(filtrados);
}

function renderizarSelectorGlobal(items) {
  const lista = document.getElementById("selectorLista");
  lista.innerHTML = "";

  if (!items || items.length === 0) {
    lista.innerHTML = '<div class="selector-empty">Sin resultados</div>';
    return;
  }

  items.forEach(function(item) {
    const div = document.createElement("div");
    div.className = "selector-item";
    div.innerHTML = escaparHTML(item.texto) + (item.subtexto ? '<br><small>' + escaparHTML(item.subtexto) + '</small>' : '');

    div.addEventListener("touchstart", function() {
      marcarFilaSelectorActiva(div);
    }, { passive: true });

    div.addEventListener("mousedown", function() {
      marcarFilaSelectorActiva(div);
    });

    div.addEventListener("click", function() {
      marcarFilaSelectorActiva(div);
      setTimeout(function() {
        if (typeof selectorGlobal.onSelect === "function") selectorGlobal.onSelect(item);
        cerrarSelectorGlobal();
        marcarFormularioSucio();
      }, 80);
    });

    lista.appendChild(div);
  });
}

function marcarFilaSelectorActiva(fila) {
  document.querySelectorAll("#selectorLista .selector-item").forEach(function(el) {
    el.classList.remove("activo");
  });
  fila.classList.add("activo");
}

function normalizarLocal(valor) {
  return String(valor || "").trim().toUpperCase();
}

// =====================================================
// CUADRILLAS
// =====================================================

async function cargarCuadrillas() {
  const campoNombre = document.getElementById("col_4");
  const campoNumero = document.getElementById("col_34");
  if (!campoNombre || !campoNumero) return;

  const tipoUsuario = String(sessionStorage.getItem("tipo_usuario") || "").trim();
  const numeroCuadrillaUsuario = String(sessionStorage.getItem("numero_cuadrilla") || sessionStorage.getItem("cuadrilla") || "").trim();
  const sector = String(sessionStorage.getItem("sector") || "").trim();

  campoNombre.value = "Cargando cuadrillas...";
  campoNumero.value = "";

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({ action: "obtenerCuadrillas", sector: sector })
    });

    const data = await response.json();

    if (data.status === "Éxito" && data.cuadrillas && data.cuadrillas.length > 0) {
      cuadrillasBD = data.cuadrillas;
    } else {
      cuadrillasBD = [];
      alert("No se encontraron cuadrillas para el sector.");
    }

    campoNombre.value = "";

    if (tipoUsuario === "3") {
      const encontrada = cuadrillasBD.find(c => normalizarLocal(c.numero) === normalizarLocal(numeroCuadrillaUsuario));

      campoNumero.value = numeroCuadrillaUsuario;
      campoNombre.value = encontrada ? encontrada.nombre : numeroCuadrillaUsuario;
      campoNombre.classList.remove("campo-selector");
      campoNombre.onclick = null;
      campoNombre.setAttribute("readonly", "readonly");

      cuadrillaAnterior = campoNombre.value;
      numeroCuadrillaAnterior = campoNumero.value;
      await cargarStockContexto("cuadrilla");
    } else {
      campoNombre.classList.add("campo-selector");
      campoNombre.onclick = abrirSelectorCuadrilla;
      cuadrillaAnterior = campoNombre.value || "";
      numeroCuadrillaAnterior = campoNumero.value || "";
    }

  } catch (error) {
    console.error("Error cargando cuadrillas:", error);
    campoNombre.value = "";
    alert("Error de conexión cargando cuadrillas.");
  }
}

function abrirSelectorCuadrilla() {
  const tipoUsuario = String(sessionStorage.getItem("tipo_usuario") || "").trim();
  if (tipoUsuario === "3") return;

  const items = cuadrillasBD.map(function(c) {
    return { texto: c.nombre, subtexto: c.numero ? "N° " + c.numero : "", data: c };
  });

  abrirSelectorGlobal("Seleccionar cuadrilla", items, async function(item) {
    await seleccionarCuadrilla(item.data);
  });
}

async function seleccionarCuadrilla(cuadrilla) {
  const campoNombre = document.getElementById("col_4");
  const campoNumero = document.getElementById("col_34");
  const nuevoNombre = cuadrilla.nombre || "";
  const nuevoNumero = cuadrilla.numero || "";

  const lista = document.getElementById("listaCuadrilla");
  const tieneMateriales = lista && lista.querySelector(".material-card");

  if (tieneMateriales && nuevoNumero !== numeroCuadrillaAnterior) {
    const confirmar = confirm(
      "Cambió la cuadrilla seleccionada.\n\n" +
      "Esto limpiará los materiales ya agregados en el Step 2 para evitar consumos con stock incorrecto.\n\n" +
      "¿Desea continuar?"
    );

    if (!confirmar) return;
    lista.innerHTML = "";
  }

  campoNombre.value = nuevoNombre;
  campoNumero.value = nuevoNumero;
  cuadrillaAnterior = nuevoNombre;
  numeroCuadrillaAnterior = nuevoNumero;

  stockCargado.cuadrilla = false;
  stockCache.cuadrilla = {};

  await cargarStockContexto("cuadrilla");
}

async function manejarCambioCuadrilla() {
  const encontrada = cuadrillasBD.find(c => c.nombre === document.getElementById("col_4").value);
  if (encontrada) await seleccionarCuadrilla(encontrada);
}

// =====================================================
// RAZÓN DE TRABAJO
// =====================================================

function abrirSelectorRazonTrabajo() {
  const items = razonesTrabajoBD.map(function(r) {
    return { texto: r, data: r };
  });

  abrirSelectorGlobal("Razón de trabajo", items, function(item) {
    document.getElementById("col_8").value = item.data;
  });
}

// =====================================================
// NAVEGACIÓN DEL WIZARD
// =====================================================

function siguientePaso() {
  if (pasoActual < totalPasos) {
    document.getElementById("step-" + pasoActual).classList.remove("activo");
    document.getElementById("ind-" + pasoActual).classList.remove("active");

    pasoActual++;

    document.getElementById("step-" + pasoActual).classList.add("activo");
    document.getElementById("ind-" + pasoActual).classList.add("active");

    actualizarBotones();
  }
}

function pasoAnterior() {
  if (pasoActual > 1) {
    document.getElementById("step-" + pasoActual).classList.remove("activo");
    document.getElementById("ind-" + pasoActual).classList.remove("active");

    pasoActual--;

    document.getElementById("step-" + pasoActual).classList.add("activo");
    document.getElementById("ind-" + pasoActual).classList.add("active");

    actualizarBotones();
  }
}

function actualizarBotones() {
  const btnAnterior = document.getElementById("btnAnterior");
  const btnSiguiente = document.getElementById("btnSiguiente");
  const btnGuardarFooter = document.getElementById("btnGuardar");

  if (btnAnterior) {
    btnAnterior.style.display = pasoActual === 1 ? "none" : "block";
  }

  // IMPORTANTE:
  // Con 4 pasos, el botón Siguiente debe verse en Step 1, Step 2 y Step 3.
  // Solo se oculta cuando ya estamos en Step 4.
  if (btnSiguiente) {
    btnSiguiente.style.display = pasoActual < totalPasos ? "block" : "none";
  }

  // El guardado ahora vive dentro del Step 4, no en la barra inferior.
  if (btnGuardarFooter) {
    btnGuardarFooter.style.display = "none";
  }
}

// =====================================================
// MODAL DATOS POSTE / TRANSFORMADOR
// =====================================================

function abrirModal(tipo) {
  const titulo = document.getElementById("modalTitulo");
  const contenido = document.getElementById("modalContenido");

  if (tipo === "poste") {
    titulo.innerHTML = '<i class="fas fa-bolt"></i> Datos Poste';
    contenido.innerHTML = `
      ${campoModal("Material Altura", "col_14")}
      ${campoModal("Estructura Primaria", "col_15")}
      ${campoModal("Estructura Secundaria", "col_16")}
      ${campoModal("Retenida", "col_17")}
    `;
  }

  if (tipo === "transformador") {
    titulo.innerHTML = '<i class="fas fa-charging-station"></i> Datos Transformador';
    contenido.innerHTML = `
      ${campoModal("KVA/KV Nuevo", "col_18")}
      ${campoModal("Serie Nuevo", "col_19")}
      ${campoModal("PP Nuevo", "col_20")}
      ${campoModal("Marca Nuevo", "col_21")}
      ${campoModal("KVA/KV Retirado", "col_22")}
      ${campoModal("Serie Retirado", "col_23")}
      ${campoModal("PP Retirado", "col_24")}
      ${campoModal("Marca Retirado", "col_25")}
    `;
  }

  document.getElementById("modalBg").style.display = "flex";
}

function campoModal(label, id, type = "text") {
  const valor = obtenerValorCampoODT(id);

  return `
    <div class="form-group" style="margin-bottom:12px;">
      <label>${label}</label>
      <input type="${type}" id="${id}" value="${escaparHTML(valor)}" oninput="guardarDatoModal('${id}', this.value); marcarFormularioSucio();">
    </div>
  `;
}

function obtenerValorCampoODT(id) {
  const campo = document.getElementById(id);
  if (campo) return campo.value || "";
  return datosModalODT[id] || "";
}

function guardarDatoModal(id, valor) {
  datosModalODT[id] = valor;
}

function sincronizarDatosModalAbierto() {
  for (let i = 14; i <= 25; i++) {
    const id = "col_" + i;
    const campo = document.getElementById(id);
    if (campo) datosModalODT[id] = campo.value || "";
  }
}

function escaparHTML(valor) {
  return String(valor || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cerrarModal() {
  sincronizarDatosModalAbierto();
  document.getElementById("modalBg").style.display = "none";
}

// =====================================================
// OBTENER MATERIALES YA AGREGADOS
// =====================================================

function obtenerMateriales(tipo) {
  const contenedor = tipo === "cuadrilla"
    ? document.querySelectorAll("#listaCuadrilla .material-card")
    : document.querySelectorAll("#listaSupervisor .material-card");

  const materiales = [];

  contenedor.forEach(card => {
    const codigo = card.querySelector(".codigo-material").value.trim();
    const nombre = card.querySelector(".nombre-material").value.trim();
    const unidad = card.querySelector(".unidad-material").value.trim();
    const cantidad = card.querySelector(".cantidad-material").value.trim();

    if (codigo || nombre || cantidad) {
      materiales.push({ codigo: codigo, nombre: nombre, unidad: unidad, cantidad: cantidad });
    }
  });

  return materiales;
}

// =====================================================
// VALIDACIONES ANTES DE GUARDAR
// =====================================================

function validarAntesGuardar() {
  const cuadrilla = document.getElementById("col_4").value.trim();
  const numeroCuadrilla = document.getElementById("col_34").value.trim();
  const razonTrabajo = document.getElementById("col_8").value.trim();
  const trabajoRealizado = document.getElementById("col_9").value.trim();

  if (!cuadrilla || !numeroCuadrilla) {
    alert("Debe seleccionar una cuadrilla válida.");
    pasoActual = 1;
    mostrarPasoActual();
    document.getElementById("col_4").focus();
    return false;
  }

  if (!razonTrabajo) {
    alert("Debe seleccionar la razón de trabajo.");
    pasoActual = 1;
    mostrarPasoActual();
    document.getElementById("col_8").focus();
    return false;
  }

  if (!trabajoRealizado) {
    alert("Debe ingresar el trabajo realizado.");
    pasoActual = 1;
    mostrarPasoActual();
    document.getElementById("col_9").focus();
    return false;
  }

  return true;
}

function mostrarPasoActual() {
  for (let i = 1; i <= totalPasos; i++) {
    document.getElementById("step-" + i).classList.toggle("activo", i === pasoActual);
    document.getElementById("ind-" + i).classList.toggle("active", i === pasoActual);
  }
  actualizarBotones();
}

// =====================================================
// GUARDAR ODT COMPLETA
// =====================================================

async function guardarODT() {
  if (!validarAntesGuardar()) return;

  sincronizarDatosModalAbierto();

  const btn = document.getElementById("btnGuardarStep4") || document.getElementById("btnGuardar");
  const mensaje = document.getElementById("mensajeGuardadoStep4");
  const btnPDF = document.getElementById("btnDescargarPDF");
  const linkPDF = document.getElementById("linkPDFGenerado");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  }

  if (mensaje) mensaje.style.display = "none";
  if (btnPDF) btnPDF.style.display = "none";
  if (linkPDF) linkPDF.style.display = "none";

  if (document.getElementById("col_12").value.trim()) convertirGpsManual();

  if (document.getElementById("utm_x").value.trim() && document.getElementById("utm_y").value.trim()) {
    convertirUtmXYManual();
  }

  const odt = {};

  for (let i = 0; i <= 35; i++) {
    const campo = document.getElementById("col_" + i);
    odt["col_" + i] = campo ? campo.value : (datosModalODT["col_" + i] || "");
  }

  const datos = {
    action: "guardarODT",
    odt: odt,
    consumo_cuadrilla: obtenerMateriales("cuadrilla"),
    consumo_supervisor: obtenerMateriales("supervisor")
  };

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(datos)
    });

    const data = await response.json();

    if (data.status === "Éxito") {
      guardadoCorrecto = true;
      formularioSucio = false;
      idODTGuardada = data.id || document.getElementById("col_0").value;

      if (mensaje) {
        mensaje.innerHTML = '<i class="fas fa-check-circle"></i> ODT guardada correctamente: ' + escaparHTML(idODTGuardada);
        mensaje.style.display = "block";
      }

      if (btnPDF) btnPDF.style.display = "block";
      alert("ODT guardada correctamente: " + idODTGuardada);
      pasoActual = 4;
      mostrarPasoActual();
    } else {
      alert("Error: " + (data.message || "No se pudo guardar."));
    }

  } catch (error) {
    console.error(error);
    alert("Error de conexión al guardar.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Guardar datos';
    }
  }
}


// =====================================================
// GENERAR / DESCARGAR PDF ODT
// Se abre por acción directa del usuario para evitar bloqueo del navegador
// =====================================================

async function generarPDFODT() {
  const idODT = idODTGuardada || document.getElementById("col_0").value.trim();
  const btn = document.getElementById("btnDescargarPDF");
  const linkPDF = document.getElementById("linkPDFGenerado");

  if (!guardadoCorrecto || !idODT) {
    alert("Primero debe guardar la ODT correctamente.");
    return;
  }

  // Se abre inmediatamente por el toque del usuario. Luego se asigna la URL real.
  const ventanaPDF = window.open("about:blank", "_blank");
  if (ventanaPDF) {
    ventanaPDF.document.write("<p style='font-family:Arial;padding:20px;'>Generando PDF, por favor espere...</p>");
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando PDF...';
  }

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "generarPDFODT",
        idODT: idODT
      })
    });

    const data = await response.json();

    if (data.status === "Éxito" && data.url) {
      urlPDFGenerado = data.url;
      const campoPDF = document.getElementById("col_35");
      if (campoPDF) campoPDF.value = data.url;

      if (linkPDF) {
        linkPDF.href = data.url;
        linkPDF.style.display = "block";
        linkPDF.innerHTML = '<i class="fas fa-up-right-from-square"></i> Abrir PDF generado';
      }

      if (ventanaPDF) {
        ventanaPDF.location.href = data.url;
      } else {
        alert("PDF generado correctamente. Use el enlace 'Abrir PDF generado'.");
      }
    } else {
      if (ventanaPDF) ventanaPDF.close();
      alert("Error generando PDF: " + (data.message || "No se pudo generar."));
    }

  } catch (error) {
    console.error(error);
    if (ventanaPDF) ventanaPDF.close();
    alert("Error de conexión al generar PDF.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-file-pdf"></i> Descargar PDF';
    }
  }
}
