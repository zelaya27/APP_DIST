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
// Se carga una sola vez al abrir la ODT
// =====================================================

async function cargarDatosMateriales() {
  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "obtenerDatosMateriales"
      })
    });

    const data = await response.json();

    if (data.status === "Éxito") {
      materialesBD = data.materiales || [];
      categoriasBD = data.categorias || [];

      llenarCategorias();
      llenarListasMateriales(materialesBD);
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
// Step 2 = cuadrilla
// Step 3 = supervisor
// =====================================================

async function cargarStockContexto(tipo) {
  const sector = sessionStorage.getItem("sector") || "";
  const cuadrilla = document.getElementById("col_4") ? document.getElementById("col_4").value : "";

  if (tipo === "cuadrilla" && !cuadrilla) {
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
        cuadrilla: cuadrilla
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
// LLENAR CATEGORÍAS
// =====================================================

function llenarCategorias() {
  const select = document.getElementById("mat_categoria");
  if (!select) return;

  select.innerHTML = '<option value="">Todas</option>';

  categoriasBD.forEach(cat => {
    if (cat) {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    }
  });
}


// =====================================================
// LLENAR LISTAS DE NOMBRES Y CÓDIGOS
// =====================================================

function llenarListasMateriales(lista) {
  const listaNombres = document.getElementById("lista_nombres_materiales");
  const listaCodigos = document.getElementById("lista_codigos_materiales");

  if (!listaNombres || !listaCodigos) return;

  listaNombres.innerHTML = "";
  listaCodigos.innerHTML = "";

  lista.forEach(m => {
    const optNombre = document.createElement("option");
    optNombre.value = m.nombre;
    listaNombres.appendChild(optNombre);

    const optCodigo = document.createElement("option");
    optCodigo.value = m.codigo;
    listaCodigos.appendChild(optCodigo);
  });
}


// =====================================================
// FILTRAR POR CATEGORÍA
// =====================================================

function filtrarMaterialesPorCategoria() {
  const categoria = document.getElementById("mat_categoria").value;

  limpiarCamposMaterialSeleccionado(false);

  if (!categoria) {
    llenarListasMateriales(materialesBD);
    return;
  }

  const filtrados = materialesBD.filter(m =>
    String(m.categoria).trim() === String(categoria).trim()
  );

  llenarListasMateriales(filtrados);
}


// =====================================================
// ABRIR MODAL MATERIAL
// =====================================================

async function abrirModalMaterial(tipo) {
  tipoMaterialActual = tipo;

  const cuadrilla = document.getElementById("col_4") ? document.getElementById("col_4").value : "";

  if (tipo === "cuadrilla" && !cuadrilla) {
    alert("Debe seleccionar una cuadrilla en el Step 1 antes de agregar materiales.");
    return;
  }

  limpiarModalMaterial();

  const titulo = tipo === "cuadrilla"
    ? "Agregar Material - Cuadrilla"
    : "Agregar Material - Supervisor";

  document.getElementById("tituloModalMaterial").innerHTML =
    '<i class="fas fa-box"></i> ' + titulo;

  document.getElementById("modalMaterialBg").style.display = "flex";

  if (!stockCargado[tipo]) {
    document.getElementById("mat_existencia").value = "Cargando stock...";
    await cargarStockContexto(tipo);
    document.getElementById("mat_existencia").value = "";
  }
}

function cerrarModalMaterial() {
  document.getElementById("modalMaterialBg").style.display = "none";
}


// =====================================================
// LIMPIAR MODAL
// =====================================================

function limpiarModalMaterial() {
  materialSeleccionadoActual = null;

  document.getElementById("mat_categoria").value = "";
  document.getElementById("mat_nombre").value = "";
  document.getElementById("mat_codigo").value = "";
  document.getElementById("mat_unidad").value = "";
  document.getElementById("mat_existencia").value = "";
  document.getElementById("mat_cantidad").value = "";
  document.getElementById("mat_observaciones").value = "";
  document.getElementById("mat_imagen_box").innerHTML = "Sin imagen disponible";

  llenarListasMateriales(materialesBD);
}

function limpiarCamposMaterialSeleccionado(limpiarCategoria) {
  materialSeleccionadoActual = null;

  document.getElementById("mat_nombre").value = "";
  document.getElementById("mat_codigo").value = "";
  document.getElementById("mat_unidad").value = "";
  document.getElementById("mat_existencia").value = "";
  document.getElementById("mat_observaciones").value = "";
  document.getElementById("mat_imagen_box").innerHTML = "Sin imagen disponible";

  if (limpiarCategoria) {
    document.getElementById("mat_categoria").value = "";
  }
}


// =====================================================
// BÚSQUEDA EN VIVO
// Si encuentra coincidencia exacta, llena datos al instante
// =====================================================

function buscarMaterialPorNombreEnVivo() {
  const nombre = document.getElementById("mat_nombre").value.trim();

  const material = materialesBD.find(m =>
    String(m.nombre).trim().toUpperCase() === nombre.toUpperCase()
  );

  if (material) {
    llenarMaterialSeleccionado(material);
  }
}

function buscarMaterialPorCodigoEnVivo() {
  const codigo = document.getElementById("mat_codigo").value.trim();

  const material = materialesBD.find(m =>
    String(m.codigo).trim() === codigo
  );

  if (material) {
    llenarMaterialSeleccionado(material);
  }
}


// =====================================================
// VALIDAR MATERIAL POR NOMBRE
// No permite nombres fuera de la lista
// =====================================================

function validarMaterialPorNombre() {
  const nombre = document.getElementById("mat_nombre").value.trim();

  if (!nombre) return;

  const material = materialesBD.find(m =>
    String(m.nombre).trim().toUpperCase() === nombre.toUpperCase()
  );

  if (!material) {
    alert("Debe seleccionar un material válido de la lista.");
    limpiarCamposMaterialSeleccionado(true);
    return;
  }

  llenarMaterialSeleccionado(material);
}


// =====================================================
// VALIDAR MATERIAL POR CÓDIGO
// No permite códigos fuera de la lista
// =====================================================

function validarMaterialPorCodigo() {
  const codigo = document.getElementById("mat_codigo").value.trim();

  if (!codigo) return;

  const material = materialesBD.find(m =>
    String(m.codigo).trim() === codigo
  );

  if (!material) {
    alert("Debe seleccionar un código válido de la lista.");
    limpiarCamposMaterialSeleccionado(true);
    return;
  }

  llenarMaterialSeleccionado(material);
}


// =====================================================
// LLENAR DATOS DEL MATERIAL SELECCIONADO
// Se hace localmente desde memoria, sin consultar Apps Script
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
}


// =====================================================
// CONSULTA DE EXISTENCIA LOCAL
// Ya no consulta Apps Script cada vez que cambia material
// =====================================================

function obtenerExistenciaLocal(codigo) {
  if (!tipoMaterialActual || !codigo) return 0;

  const stock = stockCache[tipoMaterialActual] || {};
  const existencia = Number(stock[String(codigo).trim()]) || 0;

  return existencia;
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
  if (url.includes("drive.google.com/file/d/")) {
    const id = url.split("/d/")[1].split("/")[0];
    return "https://drive.google.com/uc?export=view&id=" + id;
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
      ${material.codigo}
      <input type="hidden" class="codigo-material" value="${material.codigo}">
    </td>

    <td class="material-col-nombre">
      ${material.nombre}
      <input type="hidden" class="nombre-material" value="${material.nombre}">
      <input type="hidden" class="unidad-material" value="${material.unidad}">
    </td>

    <td class="material-col-cantidad">
      ${material.cantidad}
      <input type="hidden" class="cantidad-material" value="${material.cantidad}">
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

  if (tbody.children.length === 0) {
    tabla.remove();
  }
}
