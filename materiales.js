let materialesBD = [];
let categoriasBD = [];
let tipoMaterialActual = "";

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

function filtrarMaterialesPorCategoria() {
  const categoria = document.getElementById("mat_categoria").value;

  if (!categoria) {
    llenarListasMateriales(materialesBD);
    return;
  }

  const filtrados = materialesBD.filter(m => String(m.categoria).trim() === String(categoria).trim());
  llenarListasMateriales(filtrados);
}

function abrirModalMaterial(tipo) {
  tipoMaterialActual = tipo;

  limpiarModalMaterial();

  const titulo = tipo === "cuadrilla"
    ? "Agregar Material - Cuadrilla"
    : "Agregar Material - Supervisor";

  document.getElementById("tituloModalMaterial").innerHTML =
    '<i class="fas fa-box"></i> ' + titulo;

  document.getElementById("modalMaterialBg").style.display = "flex";
}

function cerrarModalMaterial() {
  document.getElementById("modalMaterialBg").style.display = "none";
}

function limpiarModalMaterial() {
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

function seleccionarMaterialPorCodigo() {
  const codigo = document.getElementById("mat_codigo").value.trim();

  const material = materialesBD.find(m =>
    String(m.codigo).trim() === String(codigo).trim()
  );

  if (material) {
    llenarMaterialSeleccionado(material);
  }
}

function seleccionarMaterialPorNombre() {
  const nombre = document.getElementById("mat_nombre").value.trim();

  const material = materialesBD.find(m =>
    String(m.nombre).trim().toUpperCase() === String(nombre).trim().toUpperCase()
  );

  if (material) {
    llenarMaterialSeleccionado(material);
  }
}

async function llenarMaterialSeleccionado(material) {
  document.getElementById("mat_codigo").value = material.codigo || "";
  document.getElementById("mat_nombre").value = material.nombre || "";
  document.getElementById("mat_categoria").value = material.categoria || "";
  document.getElementById("mat_unidad").value = material.unidad || "";
  document.getElementById("mat_observaciones").value = material.observaciones || "";

  mostrarImagenMaterial(material.imagen || "");

  await consultarExistenciaMaterial(material.codigo);
}

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

async function consultarExistenciaMaterial(codigo) {
  const cuadrilla = document.getElementById("col_4") ? document.getElementById("col_4").value : "";
  const sector = sessionStorage.getItem("sector") || "";

  if (!codigo) return;

  if (tipoMaterialActual === "cuadrilla" && !cuadrilla) {
    alert("Debe seleccionar una cuadrilla en el Step 1 para consultar existencia.");
    return;
  }

  try {
    const response = await fetch(CONFIG.URL_APPS_SCRIPT, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "consultarStockMaterial",
        tipo: tipoMaterialActual,
        codigo: codigo,
        cuadrilla: cuadrilla,
        sector: sector
      })
    });

    const data = await response.json();

    if (data.status === "Éxito") {
      document.getElementById("mat_existencia").value = data.existencia;
    } else {
      document.getElementById("mat_existencia").value = "0";
    }

  } catch (error) {
    console.error(error);
    document.getElementById("mat_existencia").value = "0";
  }
}

function agregarMaterialDesdeModal() {
  const codigo = document.getElementById("mat_codigo").value.trim();
  const nombre = document.getElementById("mat_nombre").value.trim();
  const unidad = document.getElementById("mat_unidad").value.trim();
  const cantidad = Number(document.getElementById("mat_cantidad").value);
  const existencia = Number(document.getElementById("mat_existencia").value);

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

function agregarMaterialATabla(tipo, material) {
  const contenedor = tipo === "cuadrilla"
    ? document.getElementById("listaCuadrilla")
    : document.getElementById("listaSupervisor");

  const div = document.createElement("div");
  div.className = "material-card";

  div.innerHTML = `
    <p><strong>Código:</strong> ${material.codigo}</p>
    <p><strong>Material:</strong> ${material.nombre}</p>
    <p><strong>Unidad:</strong> ${material.unidad}</p>
    <p><strong>Cantidad:</strong> ${material.cantidad}</p>

    <input type="hidden" class="codigo-material" value="${material.codigo}">
    <input type="hidden" class="nombre-material" value="${material.nombre}">
    <input type="hidden" class="unidad-material" value="${material.unidad}">
    <input type="hidden" class="cantidad-material" value="${material.cantidad}">

    <button type="button" class="btn-delete" onclick="this.parentElement.remove()">
      <i class="fas fa-trash"></i> Eliminar
    </button>
  `;

  contenedor.appendChild(div);
}
