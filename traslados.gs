// =====================================================
// APP DIST - TRASLADOS.GS
// Módulo de traslados de materiales
// =====================================================

var ID_BD_TRASLADOS = "1t_krcD7gh1U4vm-dlKtxkRkU1S_8ZJIom_aV5AbK3oU";

// Hojas esperadas en ID_BD_TRASLADOS:
// traslados: col0 a col23
// materialestraslado: col0 ID_TRASLADO, col1 CODIGOMATERIAL, col2 NOMBREMATERIAL, col3 UNIDAD, col4 CANTIDAD

function consultarStockMaterialTraslado(d) {
  try {
    var sector = String(d.sector || "").trim();
    var codigo = String(d.codigo || "").trim();
    var idCuadrillaEntrega = String(d.idCuadrillaEntrega || "48").trim();

    if (sector === "") throw new Error("Sector vacío");
    if (codigo === "") throw new Error("Código material vacío");
    if (idCuadrillaEntrega === "") throw new Error("ID cuadrilla entrega vacío");

    var ssStock = SpreadsheetApp.openById(ID_STOCK_MATERIALES);
    var sheet = ssStock.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    var existencia = 0;

    var sectorNorm = normalizarTraslado_(sector);
    var codigoNorm = normalizarTraslado_(codigo);
    var cuadrillaNorm = normalizarTraslado_(idCuadrillaEntrega);

    for (var i = 1; i < data.length; i++) {
      var grupo = String(data[i][2] || "").trim();
      var cod = String(data[i][4] || "").trim();
      var cant = Number(data[i][6]) || 0;
      var sec = String(data[i][8] || "").trim();

      if (normalizarTraslado_(grupo) === cuadrillaNorm && normalizarTraslado_(cod) === codigoNorm && normalizarTraslado_(sec) === sectorNorm) {
        existencia += cant;
      }
    }

    return { status: "Éxito", existencia: existencia };
  } catch (error) {
    return { status: "Error", message: error.message, existencia: 0 };
  }
}

function guardarTraslado(d) {
  try {
    var ss = SpreadsheetApp.openById(ID_BD_TRASLADOS);
    var sheetT = ss.getSheetByName("traslados");
    var sheetM = ss.getSheetByName("materialestraslado");

    if (!sheetT) throw new Error("No existe la hoja traslados");
    if (!sheetM) throw new Error("No existe la hoja materialestraslado");

    var traslado = d.traslado || {};
    var materiales = d.materiales || [];
    var tipoUsuario = String(d.tipo_usuario || d.tipoUsuario || "").trim();
    var id = String(traslado.col_0 || "").trim();
    var estado = normalizarTraslado_(traslado.col_3 || "");

    if (id === "") throw new Error("ID_TRASLADO vacío");
    if (materiales.length === 0) throw new Error("Debe agregar al menos un material");

    validarPermisoGuardarTraslado_(tipoUsuario, estado);

    var fila = [];
    for (var i = 0; i <= 23; i++) fila.push(traslado["col_" + i] || "");

    fila[3] = normalizarEstadoTrasladoSalida_(fila[3]);

    var filaExistente = buscarFilaTrasladoPorId_(sheetT, id, 1);

    if (filaExistente > 0) {
      var estadoActual = normalizarTraslado_(sheetT.getRange(filaExistente, 4).getValue());
      if (estadoActual === "RECIBIDO" || estadoActual === "TERMINADO" || estadoActual === "AUDITADO") {
        throw new Error("No se puede editar un traslado en estado " + sheetT.getRange(filaExistente, 4).getValue());
      }
      sheetT.getRange(filaExistente, 1, 1, fila.length).setValues([fila]);
    } else {
      sheetT.appendRow(fila);
    }

    eliminarFilasTrasladoPorId_(sheetM, id, 1);

    materiales.forEach(function(m) {
      sheetM.appendRow([
        id,
        m.codigo || "",
        m.nombre || "",
        m.unidad || "",
        m.cantidad || ""
      ]);
    });

    return {
      status: "Éxito",
      id: id,
      modo: filaExistente > 0 ? "actualizado" : "creado",
      message: "Traslado guardado correctamente"
    };
  } catch (error) {
    return { status: "Error", message: error.message };
  }
}

function obtenerListaTraslados(d) {
  try {
    var sectorLogin = normalizarTraslado_(d.sector || "");
    var tipoUsuario = String(d.tipo_usuario || d.tipoUsuario || "").trim();
    var numeroCuadrilla = normalizarTraslado_(d.numero_cuadrilla || d.numeroCuadrilla || d.cuadrilla || "");

    if (sectorLogin === "") throw new Error("Sector vacío");

    var ss = SpreadsheetApp.openById(ID_BD_TRASLADOS);
    var sheet = ss.getSheetByName("traslados");
    if (!sheet) throw new Error("No existe la hoja traslados");

    var data = sheet.getDataRange().getValues();
    var lista = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var id = String(row[0] || "").trim();
      if (id === "") continue;

      var sector = String(row[1] || "").trim();
      var idRecibe = String(row[7] || "").trim();

      if (normalizarTraslado_(sector) !== sectorLogin) continue;

      // Tipo 3 solo ve traslados donde su cuadrilla recibe.
      if (tipoUsuario === "3" && normalizarTraslado_(idRecibe) !== numeroCuadrilla) continue;

      lista.push(objTrasladoLista_(row));
    }

    lista.sort(function(a, b) { return (b.fecha_orden || 0) - (a.fecha_orden || 0); });
    return { status: "Éxito", traslados: lista };
  } catch (error) {
    return { status: "Error", message: error.message, traslados: [] };
  }
}

function obtenerTrasladoPorId(d) {
  try {
    var id = String(d.idTraslado || d.id || "").trim();
    var sectorLogin = normalizarTraslado_(d.sector || "");
    var tipoUsuario = String(d.tipo_usuario || d.tipoUsuario || "").trim();
    var numeroCuadrilla = normalizarTraslado_(d.numero_cuadrilla || d.numeroCuadrilla || d.cuadrilla || "");

    if (id === "") throw new Error("ID traslado vacío");

    var ss = SpreadsheetApp.openById(ID_BD_TRASLADOS);
    var sheetT = ss.getSheetByName("traslados");
    var sheetM = ss.getSheetByName("materialestraslado");

    if (!sheetT) throw new Error("No existe la hoja traslados");
    if (!sheetM) throw new Error("No existe la hoja materialestraslado");

    var data = sheetT.getDataRange().getValues();
    var fila = null;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || "").trim() === id) {
        fila = data[i];
        break;
      }
    }

    if (!fila) throw new Error("No se encontró el traslado: " + id);

    if (sectorLogin && normalizarTraslado_(fila[1]) !== sectorLogin) throw new Error("No puede consultar traslados de otro sector");

    if (tipoUsuario === "3" && normalizarTraslado_(fila[7]) !== numeroCuadrilla) {
      throw new Error("No puede editar este traslado porque no pertenece a su cuadrilla");
    }

    var traslado = {};
    for (var c = 0; c <= 23; c++) traslado["col_" + c] = formatearValorTrasladoSalida_(fila[c]);

    return {
      status: "Éxito",
      traslado: traslado,
      materiales: obtenerMaterialesTraslado_(sheetM, id)
    };
  } catch (error) {
    return { status: "Error", message: error.message };
  }
}

function obtenerPanelTraslados(d) {
  try {
    var sectorLogin = normalizarTraslado_(d.sector || "");
    var tipoUsuario = String(d.tipo_usuario || d.tipoUsuario || "").trim();

    if (tipoUsuario !== "1" && tipoUsuario !== "2") throw new Error("No cuentas con permisos para ingresar al Panel Traslados");
    if (sectorLogin === "") throw new Error("Sector vacío");

    var ss = SpreadsheetApp.openById(ID_BD_TRASLADOS);
    var sheet = ss.getSheetByName("traslados");
    if (!sheet) throw new Error("No existe la hoja traslados");

    var data = sheet.getDataRange().getValues();
    var lista = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      if (normalizarTraslado_(row[1]) !== sectorLogin) continue;
      lista.push(objTrasladoLista_(row));
    }

    lista.sort(function(a, b) { return (b.fecha_orden || 0) - (a.fecha_orden || 0); });
    return { status: "Éxito", traslados: lista };
  } catch (error) {
    return { status: "Error", message: error.message, traslados: [] };
  }
}

function guardarControlTrasladoEnergis(d) {
  try {
    var id = String(d.idTraslado || "").trim();
    var tipoUsuario = String(d.tipo_usuario || d.tipoUsuario || "").trim();
    var fechaEnergis = String(d.fechaEnergis || "").trim();
    var idEnergis = String(d.idEnergis || "").trim();
    var usuario = String(d.usuario || "").trim();

    if (tipoUsuario !== "1" && tipoUsuario !== "2") throw new Error("No tiene permisos para actualizar control ENERGIS");
    if (id === "") throw new Error("ID traslado vacío");

    var ss = SpreadsheetApp.openById(ID_BD_TRASLADOS);
    var sheet = ss.getSheetByName("traslados");
    if (!sheet) throw new Error("No existe la hoja traslados");

    var fila = buscarFilaTrasladoPorId_(sheet, id, 1);
    if (fila < 1) throw new Error("No se encontró el traslado: " + id);

    sheet.getRange(fila, 21).setValue(fechaEnergis); // col20
    sheet.getRange(fila, 22).setValue(idEnergis);    // col21
    sheet.getRange(fila, 23).setValue(usuario);      // col22 USUARIO_ENERGIS

    var estadoFinal = String(sheet.getRange(fila, 4).getValue() || "").trim();
    if (fechaEnergis !== "" && idEnergis !== "") {
      estadoFinal = "Terminado";
      sheet.getRange(fila, 4).setValue(estadoFinal);
    }

    return { status: "Éxito", id: id, estado: estadoFinal, message: "Control ENERGIS actualizado" };
  } catch (error) {
    return { status: "Error", message: error.message };
  }
}

function guardarAuditoriaTraslado(d) {
  try {
    var id = String(d.idTraslado || "").trim();
    var usuario = String(d.usuario || "").trim();
    var tipoUsuario = String(d.tipo_usuario || d.tipoUsuario || "").trim();
    var errores = String(d.errores || "").trim();
    var observaciones = String(d.observaciones || "").trim();

    if (tipoUsuario !== "1") throw new Error("No cuentas con permisos para auditar");
    if (id === "") throw new Error("ID traslado vacío");

    var ss = SpreadsheetApp.openById(ID_BD_TRASLADOS);
    var sheet = ss.getSheetByName("traslados");
    if (!sheet) throw new Error("No existe la hoja traslados");

    var fila = buscarFilaTrasladoPorId_(sheet, id, 1);
    if (fila < 1) throw new Error("No se encontró el traslado: " + id);

    sheet.getRange(fila, 4).setValue("Auditado");
    sheet.getRange(fila, 18, 1, 3).setValues([[usuario, errores, observaciones]]); // col17-col19

    return { status: "Éxito", id: id, estado: "Auditado", message: "Auditoría guardada" };
  } catch (error) {
    return { status: "Error", message: error.message };
  }
}

function eliminarTraslado(d) {
  try {
    var id = String(d.idTraslado || "").trim();
    var tipoUsuario = String(d.tipo_usuario || d.tipoUsuario || "").trim();

    if (tipoUsuario !== "1") throw new Error("No cuentas con permisos para eliminar");
    if (id === "") throw new Error("ID traslado vacío");

    var ss = SpreadsheetApp.openById(ID_BD_TRASLADOS);
    var sheetT = ss.getSheetByName("traslados");
    var sheetM = ss.getSheetByName("materialestraslado");

    if (!sheetT) throw new Error("No existe la hoja traslados");
    if (!sheetM) throw new Error("No existe la hoja materialestraslado");

    eliminarFilasTrasladoPorId_(sheetM, id, 1);
    eliminarFilasTrasladoPorId_(sheetT, id, 1);

    return { status: "Éxito", id: id, message: "Traslado eliminado" };
  } catch (error) {
    return { status: "Error", message: error.message };
  }
}

function obtenerMaterialesTraslado_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  var materiales = [];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim() !== id) continue;
    materiales.push({
      codigo: String(data[i][1] || "").trim(),
      nombre: String(data[i][2] || "").trim(),
      unidad: String(data[i][3] || "").trim(),
      cantidad: String(data[i][4] || "").trim()
    });
  }

  return materiales;
}

function objTrasladoLista_(row) {
  var obj = {};
  for (var c = 0; c <= 23; c++) obj["col_" + c] = formatearValorTrasladoSalida_(row[c]);
  obj.fecha_iso = formatearFechaISOTraslado_(row[8]);
  obj.fecha_orden = obtenerTiempoFechaTraslado_(row[8]);
  return obj;
}

function validarPermisoGuardarTraslado_(tipoUsuario, estadoNorm) {
  if (["SOLICITADO", "PREPARADO", "RECIBIDO", "TERMINADO", "AUDITADO"].indexOf(estadoNorm) === -1) {
    throw new Error("Estado no válido");
  }

  if (tipoUsuario === "3") {
    // Tipo 3 puede crear solicitado o recibir preparado.
    if (estadoNorm !== "SOLICITADO" && estadoNorm !== "RECIBIDO") {
      throw new Error("Usuario tipo 3 solo puede guardar Solicitado o Recibido");
    }
  }

  if (tipoUsuario === "2" && estadoNorm === "AUDITADO") {
    throw new Error("Usuario tipo 2 no puede auditar");
  }
}

function normalizarEstadoTrasladoSalida_(estado) {
  var e = normalizarTraslado_(estado);
  if (e === "PREPARADO") return "Preparado";
  if (e === "RECIBIDO") return "Recibido";
  if (e === "TERMINADO") return "Terminado";
  if (e === "AUDITADO") return "Auditado";
  return "Solicitado";
}

function normalizarTraslado_(valor) {
  return String(valor || "").trim().toUpperCase();
}

function buscarFilaTrasladoPorId_(sheet, id, columna) {
  var data = sheet.getDataRange().getValues();
  var idx = columna - 1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx] || "").trim() === String(id || "").trim()) return i + 1;
  }
  return -1;
}

function eliminarFilasTrasladoPorId_(sheet, id, columna) {
  var data = sheet.getDataRange().getValues();
  var idx = columna - 1;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idx] || "").trim() === String(id || "").trim()) sheet.deleteRow(i + 1);
  }
}

function formatearValorTrasladoSalida_(valor) {
  if (valor === undefined || valor === null) return "";
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(valor);
}

function formatearFechaISOTraslado_(valor) {
  if (!valor) return "";
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var texto = String(valor || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.substring(0, 10);
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(texto)) {
    var p = texto.substring(0, 10).split("/");
    return p[2] + "-" + ("0" + p[1]).slice(-2) + "-" + ("0" + p[0]).slice(-2);
  }
  return "";
}

function obtenerTiempoFechaTraslado_(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]") return valor.getTime();
  var iso = formatearFechaISOTraslado_(valor);
  if (!iso) return 0;
  var d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? 0 : d.getTime();
}
