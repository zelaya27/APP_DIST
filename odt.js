let pasoActual = 1;
const totalPasos = 3;

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
  document.getElementById("col_4").value = fechaHoy();

 cargarDatosMateriales();
  
  actualizarBotones();
  
});

function generarID() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return "ODT-" + n;
}

function fechaHoy() {
  const hoy = new Date();
  return hoy.toISOString().split("T")[0];
}

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

function abrirModal(tipo) {
  const titulo = document.getElementById("modalTitulo");
  const contenido = document.getElementById("modalContenido");

  if (tipo === "poste") {
    titulo.innerHTML = '<i class="fas fa-bolt"></i> Datos Poste';
    contenido.innerHTML = `
      ${campoModal("Material Altura", "col_13")}
      ${campoModal("Estructura Primaria", "col_14")}
      ${campoModal("Estructura Secundaria", "col_15")}
      ${campoModal("Retenida", "col_16")}
    `;
  }

  if (tipo === "transformador") {
    titulo.innerHTML = '<i class="fas fa-charging-station"></i> Datos Transformador';
    contenido.innerHTML = `
      ${campoModal("KVA/KV Nuevo", "col_17")}
      ${campoModal("Serie Nuevo", "col_18")}
      ${campoModal("PP Nuevo", "col_19")}
      ${campoModal("Marca Nuevo", "col_20")}
      ${campoModal("KVA/KV Retirado", "col_21")}
      ${campoModal("Serie Retirado", "col_22")}
      ${campoModal("PP Retirado", "col_23")}
      ${campoModal("Marca Retirado", "col_24")}
    `;
  }

  document.getElementById("modalBg").style.display = "flex";
}

function campoModal(label, id, type = "text") {
  const valor = document.getElementById(id) ? document.getElementById(id).value : "";

  return `
    <div class="form-group" style="margin-bottom:12px;">
      <label>${label}</label>
      <input type="${type}" id="${id}" value="${valor}">
    </div>
  `;
}

function cerrarModal() {
  document.getElementById("modalBg").style.display = "none";
}



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

async function guardarODT() {
  const btn = document.getElementById("btnGuardar");

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  if (document.getElementById("col_11").value.trim()) {
    convertirGpsManual();
  }

  if (document.getElementById("utm_x").value.trim() && document.getElementById("utm_y").value.trim()) {
    convertirUtmXYManual();
  }

  const odt = {};

  for (let i = 0; i <= 32; i++) {
    const campo = document.getElementById("col_" + i);
    odt["col_" + i] = campo ? campo.value : "";
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
