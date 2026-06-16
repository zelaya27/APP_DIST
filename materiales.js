let materialesBD = [];
let categoriasBD = [];
let tipoMaterialActual = "";

let stockCache = {
  cuadrilla: {},
  supervisor: {}
};

let stockCargado = {
  cuadrilla: false,
  supervisor: false
};

let materialSeleccionadoActual = null;

// =====================================================
// CARGAR BASE DE MATERIALES Y CATEGORÍAS
// =====================================================

async function cargarDatosMateriales() {
  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({ action: "obtenerDatosMateriales" })
    });

    const data = await response.json();

    if (data.status === "Éxito") {
      materialesBD = data.materiales || [];
      categoriasBD = data.categorias || [];
    } else {
      alert("Error cargando materiales: " + data.message);
    }

  } catch (error) {
    console.error(error);
    alert("Error de conexión cargando materiales.");
  }
}

// =====================================================
// CARGAR STOCK EN MEMORIA
// Step 2 = número cuadrilla col_34 contra Stockmateriales Col2
// Step 3 = grupo supervisor contra Stockmateriales Col2
// =====================================================

async function cargarStockContexto(tipo) {
  const sector = sessionStorage.getItem("sector") || "";
  const numeroCuadrilla = document.getElementById("col_34") ? document.getElementById("col_34").value.trim() : "";

  if (tipo === "cuadrilla" && !numeroCuadrilla) {
    stockCache.cuadrilla = {};
    stockCargado.cuadrilla = false;
    return false;
  }

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "obtenerStockContexto",
        tipo: tipo,
        sector: sector,
        numeroCuadrilla: numeroCuadrilla,
        cuadrilla: numeroCuadrilla
      })
    });

    const data = await response.json();

    if (data.status === "Éxito") {
      stockCache[tipo] = data.stock || {};
      stockCargado[tipo] = true;
      return true;
    } else {
      stockCache[tipo] = {};
      stockCargado[tipo] = false;
      console.warn("No se pudo cargar stock:", data.message);
      return false;
    }

  } catch (error) {
    console.error("Error cargando stock:", error);
    stockCache[tipo] = {};
    stockCargado[tipo] = false;
    return false;
  }
}

// =====================================================
// FILTROS LOCALES
// =====================================================

function obtenerMaterialesFiltradosPorCategoria() {
  const categoria = document.getElementById("mat_categoria").value.trim();

  if (!categoria) return materialesBD;

  return materialesBD.filter(m => normalizarLocal(m.categoria) === normalizarLocal(categoria));
}

// =====================================================
// SELECTORES CON BUSCADOR
// =====================================================

function abrirSelectorCategoriaMaterial() {
  const items = [{ texto: "Todas", data: "" }].concat(
    categoriasBD.map(cat => ({ texto: cat, data: cat }))
  );

  abrirSelectorGlobal("Seleccionar categoría", items, function(item) {
    document.getElementById("mat_categoria").value = item.data || "";
    limpiarCamposMaterialSeleccionado(false);
  });
}

function abrirSelectorNombreMaterial() {
  const lista = obtenerMaterialesFiltradosPorCategoria();

  const items = lista.map(m => ({
    texto: m.nombre,
    subtexto: m.codigo + (m.categoria ? " | " + m.categoria : ""),
    data: m
  }));

  abrirSelectorGlobal("Seleccionar material", items, function(item) {
    llenarMaterialSeleccionado(item.data);
  });
}

function abrirSelectorCodigoMaterial() {
  const lista = obtenerMaterialesFiltradosPorCategoria();

  const items = lista.map(m => ({
    texto: m.codigo,
    subtexto: m.nombre,
    data: m
  }));

  abrirSelectorGlobal("Seleccionar código", items, function(item) {
    llenarMaterialSeleccionado(item.data);
  });
}

// =====================================================
// COMPATIBILIDAD CON FUNCIONES ANTERIORES
// =====================================================

function llenarCategorias() {}
function llenarListasMateriales(lista) {}

function filtrarMaterialesPorCategoria() {
  limpiarCamposMaterialSeleccionado(false);
}

function buscarMaterialPorNombreEnVivo() {}
function buscarMaterialPorCodigoEnVivo() {}
function validarMaterialPorNombre() {}
function validarMaterialPorCodigo() {}

// =====================================================
// ABRIR MODAL MATERIAL
// =====================================================

async function abrirModalMaterial(tipo) {
  tipoMaterialActual = tipo;

  const numeroCuadrilla = document.getElementById("col_34") ? document.getElementById("col_34").value.trim() : "";

  if (tipo === "cuadrilla" && !numeroCuadrilla) {
    alert("Debe seleccionar una cuadrilla en el Step 1 antes de agregar materiales.");
    return;
  }

  limpiarModalMaterial();

  const titulo = tipo === "cuadrilla"
    ? "Agregar Material - Cuadrilla"
    : "Agregar Material - Supervisor";

  document.getElementById("tituloModalMaterial").innerHTML = '<i class="fas fa-box"></i> ' + titulo;
  document.getElementById("modalMaterialBg").style.display = "flex";

  if (!stockCargado[tipo]) {
    document.getElementById("mat_existencia").value = "Cargando stock...";
    await cargarStockContexto(tipo);
    document.getElementById("mat_existencia").value = "";
    actualizarColorExistencia(null);
  }
}

function cerrarModalMaterial() {
  document.getElementById("modalMaterialBg").style.display = "none";
}

// =====================================================
// LIMPIAR MODAL
// =====================================================

function limpiarModalMaterial() {
  limpiarSeleccionMaterialCompleta();
}

function limpiarCamposMaterialSeleccionado(limpiarCategoria) {
  const categoriaActual = document.getElementById("mat_categoria").value;

  limpiarSeleccionMaterialCompleta();

  if (!limpiarCategoria) {
    document.getElementById("mat_categoria").value = categoriaActual;
  }
}

function limpiarSeleccionMaterialCompleta() {
  materialSeleccionadoActual = null;

  document.getElementById("mat_categoria").value = "";
  document.getElementById("mat_nombre").value = "";
  document.getElementById("mat_codigo").value = "";
  document.getElementById("mat_unidad").value = "";
  document.getElementById("mat_existencia").value = "";
  document.getElementById("mat_cantidad").value = "";
  document.getElementById("mat_observaciones").value = "";
  document.getElementById("mat_imagen_box").innerHTML = "Sin imagen disponible";
  actualizarColorExistencia(null);
}

// =====================================================
// LLENAR DATOS DEL MATERIAL SELECCIONADO
// =====================================================

function llenarMaterialSeleccionado(material) {
  materialSeleccionadoActual = material;

  document.getElementById("mat_codigo").value = material.codigo || "";
  document.getElementById("mat_nombre").value = material.nombre || "";
  document.getElementById("mat_categoria").value = material.categoria || "";
  document.getElementById("mat_unidad").value = material.unidad || "";
  document.getElementById("mat_observaciones").value = material.observaciones || "";

  mostrarImagenMaterial(material.imagen || "");

  const existencia = obtenerExistenciaLocal(material.codigo);
  document.getElementById("mat_existencia").value = existencia;
  actualizarColorExistencia(existencia);
}

// =====================================================
// CONSULTA DE EXISTENCIA LOCAL
// =====================================================

function obtenerExistenciaLocal(codigo) {
  if (!tipoMaterialActual || !codigo) return 0;

  const stock = stockCache[tipoMaterialActual] || {};
  const existencia = Number(stock[String(codigo).trim()]) || 0;

  return existencia;
}

function actualizarColorExistencia(existencia) {
  const campo = document.getElementById("mat_existencia");
  if (!campo) return;

  campo.classList.remove("stock-positivo", "stock-cero-negativo");

  if (existencia === null || existencia === undefined || existencia === "") return;

  const valor = Number(existencia);

  if (valor <= 0) {
    campo.classList.add("stock-cero-negativo");
  } else {
    campo.classList.add("stock-positivo");
  }
}

// =====================================================
// MOSTRAR IMAGEN
// =====================================================

function mostrarImagenMaterial(url) {
  const box = document.getElementById("mat_imagen_box");

  if (!url) {
    box.innerHTML = "Sin imagen disponible";
    return;
  }

  const urlFinal = convertirDriveUrl(url);

  box.innerHTML = `
    <img src="${urlFinal}" style="max-width:100%;max-height:180px;border-radius:8px;background:white;">
  `;
}

function convertirDriveUrl(url) {
  url = String(url || "").trim();

  let id = "";

  if (url.includes("drive.google.com/file/d/")) {
    id = url.split("/d/")[1].split("/")[0];
  } else if (url.includes("open?id=")) {
    id = url.split("open?id=")[1].split("&")[0];
  } else if (url.includes("uc?id=")) {
    id = url.split("uc?id=")[1].split("&")[0];
  } else if (url.includes("id=")) {
    id = url.split("id=")[1].split("&")[0];
  }

  if (id) {
    return "https://drive.google.com/thumbnail?id=" + id + "&sz=w1000";
  }

  return url;
}
// =====================================================
// AGREGAR MATERIAL DESDE MODAL
// =====================================================

function agregarMaterialDesdeModal() {
  const codigo = document.getElementById("mat_codigo").value.trim();
  const nombre = document.getElementById("mat_nombre").value.trim();
  const unidad = document.getElementById("mat_unidad").value.trim();
  const cantidad = Number(document.getElementById("mat_cantidad").value);
  const existencia = Number(document.getElementById("mat_existencia").value);

  if (!materialSeleccionadoActual) {
    alert("Debe seleccionar un material válido de la lista.");
    return;
  }

  if (!codigo || !nombre) {
    alert("Debe seleccionar un material.");
    return;
  }

  if (!cantidad || cantidad <= 0) {
    alert("Debe ingresar una cantidad válida.");
    return;
  }

  if (cantidad > existencia) {
    alert(
      "La cantidad ingresada supera el stock disponible.\n\n" +
      "Stock actual: " + existencia + "\n" +
      "Cantidad solicitada: " + cantidad + "\n\n" +
      "Se permitirá agregarlo, pero queda como consumo superior al stock."
    );
  }

  agregarMaterialATabla(tipoMaterialActual, {
    codigo: codigo,
    nombre: nombre,
    unidad: unidad,
    cantidad: cantidad
  });

  if (typeof marcarFormularioSucio === "function") marcarFormularioSucio();
  cerrarModalMaterial();
}

// =====================================================
// AGREGAR MATERIAL A TABLA COMPACTA
// =====================================================

function agregarMaterialATabla(tipo, material) {
  const contenedor = tipo === "cuadrilla"
    ? document.getElementById("listaCuadrilla")
    : document.getElementById("listaSupervisor");

  let tabla = contenedor.querySelector(".material-table");

  if (!tabla) {
    tabla = document.createElement("table");
    tabla.className = "material-table";

    tabla.innerHTML = `
      <thead>
        <tr>
          <th>Código</th>
          <th>Material</th>
          <th>Cant.</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    contenedor.appendChild(tabla);
  }

  const tbody = tabla.querySelector("tbody");
  const tr = document.createElement("tr");
  tr.className = "material-card material-row";

  tr.innerHTML = `
    <td class="material-col-codigo">
      ${escaparHTML(material.codigo)}
      <input type="hidden" class="codigo-material" value="${escaparHTML(material.codigo)}">
    </td>

    <td class="material-col-nombre">
      ${escaparHTML(material.nombre)}
      <input type="hidden" class="nombre-material" value="${escaparHTML(material.nombre)}">
      <input type="hidden" class="unidad-material" value="${escaparHTML(material.unidad)}">
    </td>

    <td class="material-col-cantidad">
      ${escaparHTML(material.cantidad)}
      <input type="hidden" class="cantidad-material" value="${escaparHTML(material.cantidad)}">
    </td>

    <td class="material-col-accion">
      <button type="button" class="btn-trash-mini" onclick="eliminarFilaMaterial(this)">
        <i class="fas fa-trash"></i>
      </button>
    </td>
  `;

  tbody.appendChild(tr);
}

function eliminarFilaMaterial(btn) {
  const fila = btn.closest("tr");
  const tabla = btn.closest("table");
  const tbody = tabla.querySelector("tbody");

  fila.remove();
  if (typeof marcarFormularioSucio === "function") marcarFormularioSucio();

  if (tbody.children.length === 0) {
    tabla.remove();
  }
}
