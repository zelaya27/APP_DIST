let pasoActual = 1;
const totalPasos = 3;

// Guarda temporalmente los campos que solo se muestran dentro del modal
const datosModalODT = {};
let cuadrillaAnterior = "";

document.addEventListener("DOMContentLoaded", function() {
  const usuario = sessionStorage.getItem("usuario");
  const sector = sessionStorage.getItem("sector");

  if (!usuario) {
    window.location.href = "index.html";
    return;
  }

  // =====================================================
  // DATOS AUTOMÁTICOS DEL STEP 1
  // =====================================================

  document.getElementById("col_0").value = generarID();
  document.getElementById("col_1").value = usuario;
  document.getElementById("col_2").value = sector;
  document.getElementById("col_3").value = "Pendiente";
  document.getElementById("col_5").value = fechaHoy();

  // =====================================================
  // CARGAS INICIALES
  // =====================================================

  cargarCuadrillas();
  cargarDatosMateriales();

  actualizarBotones();
});


// =====================================================
// GENERAR ID ÚNICO
// =====================================================

function generarID() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return "ODT-" + n;
}


// =====================================================
// FECHA ACTUAL
// =====================================================

function fechaHoy() {
  const hoy = new Date();
  return hoy.toISOString().split("T")[0];
}


// =====================================================
// CARGAR CUADRILLAS DESDE APPS SCRIPT
// Hoja: codigo_validaciones / cuadrillas / Col1
// Regla:
// - tipo_usuario 3: autocompleta cuadrilla de usuarios Col5 y bloquea
// - tipo_usuario 1 y 2: deja lista desplegable habilitada
// =====================================================

async function cargarCuadrillas() {
  const select = document.getElementById("col_4");

  if (!select) return;

  const tipoUsuario = String(sessionStorage.getItem("tipo_usuario") || "").trim();
  const cuadrillaUsuario = String(sessionStorage.getItem("cuadrilla") || "").trim();

  select.disabled = false;
  select.innerHTML = '<option value="">Cargando cuadrillas...</option>';

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "obtenerCuadrillas"
      })
    });

    const data = await response.json();

    select.innerHTML = '<option value="">Seleccione cuadrilla...</option>';

    if (data.status === "Éxito" && data.cuadrillas && data.cuadrillas.length > 0) {
      data.cuadrillas.forEach(function(cuadrilla) {
        const option = document.createElement("option");
        option.value = cuadrilla;
        option.textContent = cuadrilla;
        select.appendChild(option);
      });
    } else {
      alert("No se encontraron cuadrillas.");
    }

    if (tipoUsuario === "3") {
      if (cuadrillaUsuario) {
        asegurarOpcionSelect(select, cuadrillaUsuario);
        select.value = cuadrillaUsuario;
        cuadrillaAnterior = cuadrillaUsuario;
        await cargarStockContexto("cuadrilla");
      }

      select.disabled = true;
    } else {
      select.disabled = false;
      cuadrillaAnterior = select.value || "";
    }

  } catch (error) {
    console.error("Error cargando cuadrillas:", error);
    select.innerHTML = '<option value="">Error cargando cuadrillas</option>';
    alert("Error de conexión cargando cuadrillas.");
  }
}

function asegurarOpcionSelect(select, valor) {
  const existe = Array.from(select.options).some(opt => opt.value === valor);

  if (!existe && valor) {
    const option = document.createElement("option");
    option.value = valor;
    option.textContent = valor;
    select.appendChild(option);
  }
}

// =====================================================
// CAMBIO DE CUADRILLA
// Si ya hay materiales de cuadrilla agregados, confirma y limpia
// =====================================================

async function manejarCambioCuadrilla() {
  const select = document.getElementById("col_4");
  const nuevaCuadrilla = select ? select.value : "";
  const lista = document.getElementById("listaCuadrilla");
  const tieneMateriales = lista && lista.querySelector(".material-card");

  if (tieneMateriales && nuevaCuadrilla !== cuadrillaAnterior) {
    const confirmar = confirm(
      "Cambió la cuadrilla seleccionada.\n\n" +
      "Esto limpiará los materiales ya agregados en el Step 2 para evitar consumos con stock incorrecto.\n\n" +
      "¿Desea continuar?"
    );

    if (!confirmar) {
      select.value = cuadrillaAnterior;
      return;
    }

    lista.innerHTML = "";
  }

  cuadrillaAnterior = nuevaCuadrilla;
  stockCargado.cuadrilla = false;
  stockCache.cuadrilla = {};

  await cargarStockContexto("cuadrilla");
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
  document.getElementById("btnAnterior").style.display = pasoActual === 1 ? "none" : "block";
  document.getElementById("btnSiguiente").style.display = pasoActual === totalPasos ? "none" : "block";
  document.getElementById("btnGuardar").style.display = pasoActual === totalPasos ? "block" : "none";
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
      <input type="${type}" id="${id}" value="${escaparHTML(valor)}" oninput="guardarDatoModal('${id}', this.value)">
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
    if (campo) {
      datosModalODT[id] = campo.value || "";
    }
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
// OBTENER MATERIALES YA AGREGADOS AL STEP 2 O STEP 3
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
      materiales.push({
        codigo: codigo,
        nombre: nombre,
        unidad: unidad,
        cantidad: cantidad
      });
    }
  });

  return materiales;
}


// =====================================================
// VALIDACIONES ANTES DE GUARDAR
// =====================================================

function validarAntesGuardar() {
  const cuadrilla = document.getElementById("col_4").value.trim();
  const razonTrabajo = document.getElementById("col_8").value.trim();
  const trabajoRealizado = document.getElementById("col_9").value.trim();

  if (!cuadrilla) {
    alert("Debe seleccionar una cuadrilla.");
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
// Guarda:
// - Datos generales en hoja odt
// - Materiales cuadrilla en consumo_cuadrilla
// - Materiales supervisor en consumo_supervisor
// =====================================================

async function guardarODT() {
  if (!validarAntesGuardar()) return;

  sincronizarDatosModalAbierto();

  const btn = document.getElementById("btnGuardar");

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  // Validar / actualizar coordenadas antes de guardar
  if (document.getElementById("col_12").value.trim()) {
    convertirGpsManual();
  }

  if (document.getElementById("utm_x").value.trim() && document.getElementById("utm_y").value.trim()) {
    convertirUtmXYManual();
  }

  const odt = {};

  // Ahora la hoja odt llega de Col0 a Col33
  for (let i = 0; i <= 33; i++) {
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
      alert("ODT guardada correctamente: " + data.id);
      window.location.href = "menu.html";
    } else {
      alert("Error: " + (data.message || "No se pudo guardar."));
    }

  } catch (error) {
    console.error(error);
    alert("Error de conexión al guardar.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Guardar";
  }
}
