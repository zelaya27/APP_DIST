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
let dibujandoFirma = false;
let formularioSucio = false;

const usuarioSesion = sessionStorage.getItem("usuario") || "";
const sectorSesion = sessionStorage.getItem("sector") || "";
const tipoUsuarioSesion = String(sessionStorage.getItem("tipo_usuario") || "").trim();
const numeroCuadrillaLogin = String(sessionStorage.getItem("numero_cuadrilla") || sessionStorage.getItem("cuadrilla") || "").trim();
const ID_CUADRILLA_ENTREGA_DEFAULT = "48";

document.addEventListener("DOMContentLoaded", async function(){
  if (!usuarioSesion) { window.location.href = "index.html"; return; }
  document.getElementById("nombreUsuarioHeader").textContent = usuarioSesion;
  document.getElementById("nombreSectorHeader").textContent = sectorSesion;

  const params = new URLSearchParams(window.location.search);
  modoEdicion = params.get("modo") === "editar" && !!params.get("id");
  idEdicion = params.get("id") || "";
  document.getElementById("tituloPantalla").textContent = modoEdicion ? "EDITAR TRASLADO" : "TRASLADOS";

  prepararNuevoTraslado();
  activarProteccionSalida();
  configurarCanvasFirma();
  await Promise.all([cargarCuadrillas(), cargarDatosMaterialesTraslado()]);

  if (modoEdicion) await cargarTrasladoEditar(idEdicion);
  else await aplicarReglasInicialesNuevo();

  actualizarPermisosVisuales();
  actualizarBotones();
});

function prepararNuevoTraslado(){
  document.getElementById("col_0").value = generarIDTraslado();
  document.getElementById("col_1").value = sectorSesion;
  document.getElementById("col_2").value = usuarioSesion;
  document.getElementById("col_8").value = fechaHoy();
  document.getElementById("col_9").value = usuarioSesion;
  const tipoCampo = document.getElementById("col_23");
  if (tipoCampo && !tipoCampo.value) tipoCampo.value = "Incidencias";
  if (tipoUsuarioSesion === "3") {
    document.getElementById("col_3").value = "Solicitado";
  } else {
    document.getElementById("col_3").value = "Preparado";
    document.getElementById("col_10").value = fechaHoy();
    document.getElementById("col_11").value = usuarioSesion;
  }
}

async function aplicarReglasInicialesNuevo(){
  const cuadEntrega = buscarCuadrillaPorNumero(ID_CUADRILLA_ENTREGA_DEFAULT);
  if (cuadEntrega) seleccionarCuadrilla("entrega", cuadEntrega, false);
  else { document.getElementById("col_5").value = ID_CUADRILLA_ENTREGA_DEFAULT; document.getElementById("col_4").value = "SUPERVISORES"; }

  if (tipoUsuarioSesion === "3") {
    const cuadRecibe = buscarCuadrillaPorNumero(numeroCuadrillaLogin);
    if (cuadRecibe) seleccionarCuadrilla("recibe", cuadRecibe, false);
    else { document.getElementById("col_7").value = numeroCuadrillaLogin; document.getElementById("col_6").value = numeroCuadrillaLogin; }
  }
}

function generarIDTraslado(){ return "TRA-" + Math.floor(100000 + Math.random() * 900000); }
function fechaHoy(){ return new Date().toISOString().split("T")[0]; }

function activarProteccionSalida(){
  const form = document.getElementById("formTraslado");
  form.addEventListener("input",()=>formularioSucio=true);
  form.addEventListener("change",()=>formularioSucio=true);
  window.addEventListener("beforeunload",function(e){ if(formularioSucio && !trasladoGuardado){ e.preventDefault(); e.returnValue="Tiene datos sin guardar."; return e.returnValue; }});
}
function volverListaSeguro(){ if(formularioSucio && !trasladoGuardado && !confirm("Tiene datos sin guardar. ¿Desea salir?")) return; window.location.href="listatraslados.html"; }

async function cargarCuadrillas(){
  const res = await fetch(CONFIG.URL_APPS_SCRIPT,{method:"POST",mode:"cors",body:JSON.stringify({action:"obtenerCuadrillas",sector:sectorSesion})});
  const data = await res.json();
  cuadrillasBD = data.cuadrillas || [];
}
function buscarCuadrillaPorNumero(numero){ return cuadrillasBD.find(c => norm(c.numero) === norm(numero)); }
function seleccionarCuadrilla(tipo, c, marcar=true){
  if (tipo === "entrega") { document.getElementById("col_4").value = c.nombre || ""; document.getElementById("col_5").value = c.numero || ""; }
  if (tipo === "recibe") { document.getElementById("col_6").value = c.nombre || ""; document.getElementById("col_7").value = c.numero || ""; }
  if (marcar) formularioSucio = true;
}
function abrirSelectorCuadrillaEntrega(){ if (tipoUsuarioSesion !== "1") return; abrirSelector("Cuadrilla que entrega", cuadrillasBD.map(c=>({texto:c.nombre,subtexto:"ID " + c.numero,data:c})), item=>seleccionarCuadrilla("entrega",item.data)); }
function abrirSelectorCuadrillaRecibe(){ if (tipoUsuarioSesion === "3") return; abrirSelector("Cuadrilla que recibe", cuadrillasBD.map(c=>({texto:c.nombre,subtexto:"ID " + c.numero,data:c})), item=>seleccionarCuadrilla("recibe",item.data)); }

async function cargarDatosMaterialesTraslado(){
  const res = await fetch(CONFIG.URL_APPS_SCRIPT,{method:"POST",mode:"cors",body:JSON.stringify({action:"obtenerDatosMateriales"})});
  const data = await res.json();
  materialesBD = data.materiales || [];
  categoriasBD = data.categorias || [];
}

function abrirSelector(titulo, items, onSelect){
  selectorGlobal = {items:items||[], onSelect:onSelect};
  document.getElementById("selectorTitulo").innerHTML = '<i class="fas fa-list"></i> ' + escapeHTML(titulo);
  document.getElementById("selectorBuscar").value = "";
  document.getElementById("selectorBg").style.display = "flex";
  renderSelector(selectorGlobal.items);
}
function cerrarSelector(){ document.getElementById("selectorBg").style.display = "none"; }
function filtrarSelector(){ const t=norm(document.getElementById("selectorBuscar").value); renderSelector(selectorGlobal.items.filter(i=>norm(i.texto).includes(t)||norm(i.subtexto).includes(t))); }
function renderSelector(items){
  const lista=document.getElementById("selectorLista"); lista.innerHTML="";
  if(!items.length){ lista.innerHTML='<div class="selector-item">Sin resultados</div>'; return; }
  items.forEach(item=>{ const div=document.createElement("div"); div.className="selector-item"; div.innerHTML=escapeHTML(item.texto)+(item.subtexto?"<br><small>"+escapeHTML(item.subtexto)+"</small>":""); div.onclick=()=>{ if(selectorGlobal.onSelect) selectorGlobal.onSelect(item); cerrarSelector(); }; lista.appendChild(div); });
}

function abrirModalMaterialTraslado(){
  if (!document.getElementById("col_5").value.trim()) { alert("Debe tener cuadrilla que entrega."); return; }
  limpiarModalMaterial();
  document.getElementById("modalMaterialBg").style.display="flex";
}
function cerrarModalMaterialTraslado(){ document.getElementById("modalMaterialBg").style.display="none"; }
function limpiarModalMaterial(){ materialSeleccionado=null; ["mat_categoria","mat_nombre","mat_codigo","mat_unidad","mat_existencia","mat_cantidad","mat_observaciones"].forEach(id=>document.getElementById(id).value=""); document.getElementById("mat_imagen_box").innerHTML="Sin imagen disponible"; document.getElementById("mat_existencia").classList.remove("stock-low","stock-ok"); }
function abrirSelectorCategoria(){ abrirSelector("Categoría", [{texto:"Todas",data:""}].concat(categoriasBD.map(c=>({texto:c,data:c}))), item=>{ document.getElementById("mat_categoria").value=item.data||""; materialSeleccionado=null; document.getElementById("mat_nombre").value=""; document.getElementById("mat_codigo").value=""; }); }
function materialesFiltrados(){ const cat=norm(document.getElementById("mat_categoria").value); return cat?materialesBD.filter(m=>norm(m.categoria)===cat):materialesBD; }
function abrirSelectorMaterialNombre(){ abrirSelector("Material", materialesFiltrados().map(m=>({texto:m.nombre,subtexto:m.codigo+(m.categoria?" | "+m.categoria:""),data:m})), item=>llenarMaterial(item.data)); }
function abrirSelectorMaterialCodigo(){ abrirSelector("Código", materialesFiltrados().map(m=>({texto:m.codigo,subtexto:m.nombre,data:m})), item=>llenarMaterial(item.data)); }
async function llenarMaterial(m){
  materialSeleccionado=m; document.getElementById("mat_codigo").value=m.codigo||""; document.getElementById("mat_nombre").value=m.nombre||""; document.getElementById("mat_categoria").value=m.categoria||""; document.getElementById("mat_unidad").value=m.unidad||""; document.getElementById("mat_observaciones").value=m.observaciones||"";
  mostrarImagenMaterial(m.imagen||"");
  await consultarStockMaterialTraslado(m.codigo);
}
function mostrarImagenMaterial(url){ const box=document.getElementById("mat_imagen_box"); if(!url){box.innerHTML="Sin imagen disponible"; return;} if(url.includes("drive.google.com/file/d/")){ const id=url.split("/d/")[1].split("/")[0]; url="https://drive.google.com/uc?export=view&id="+id; } box.innerHTML='<img src="'+escapeAttr(url)+'" style="max-width:100%;max-height:170px;background:white;border-radius:8px;">'; }
async function consultarStockMaterialTraslado(codigo){
  const campo=document.getElementById("mat_existencia"); campo.value="Consultando...";
  const res=await fetch(CONFIG.URL_APPS_SCRIPT,{method:"POST",mode:"cors",body:JSON.stringify({action:"consultarStockMaterialTraslado",sector:sectorSesion,codigo:codigo,idCuadrillaEntrega:document.getElementById("col_5").value})});
  const data=await res.json(); const existencia=Number(data.existencia)||0; campo.value=existencia; campo.classList.remove("stock-low","stock-ok"); campo.classList.add(existencia>0?"stock-ok":"stock-low");
}
function agregarMaterialTraslado(){
  const codigo=document.getElementById("mat_codigo").value.trim(), nombre=document.getElementById("mat_nombre").value.trim(), unidad=document.getElementById("mat_unidad").value.trim();
  const cantidad=Number(document.getElementById("mat_cantidad").value), existencia=Number(document.getElementById("mat_existencia").value)||0;
  if(!materialSeleccionado||!codigo||!nombre){alert("Debe seleccionar un material válido.");return;}
  if(!cantidad||cantidad<=0){alert("Ingrese una cantidad válida.");return;}
  if(existencia<=0 && !confirm("El material no tiene existencia actual. ¿Desea agregarlo de todas formas?")) return;
  if(cantidad>existencia && existencia>0 && !confirm("La cantidad supera el stock disponible.\nStock actual: "+existencia+"\nCantidad: "+cantidad+"\n\n¿Desea agregarlo?")) return;
  agregarMaterialTabla({codigo,nombre,unidad,cantidad}); cerrarModalMaterialTraslado(); formularioSucio=true;
}
function agregarMaterialTabla(m){
  const cont=document.getElementById("listaMaterialesTraslado"); let tabla=cont.querySelector("table");
  if(!tabla){ tabla=document.createElement("table"); tabla.className="material-table"; tabla.innerHTML="<thead><tr><th>Código</th><th>Material</th><th>Cant.</th><th></th></tr></thead><tbody></tbody>"; cont.appendChild(tabla); }
  const tr=document.createElement("tr"); tr.className="material-row"; tr.innerHTML=`<td>${escapeHTML(m.codigo)}<input type="hidden" class="codigo-material" value="${escapeAttr(m.codigo)}"></td><td>${escapeHTML(m.nombre)}<input type="hidden" class="nombre-material" value="${escapeAttr(m.nombre)}"><input type="hidden" class="unidad-material" value="${escapeAttr(m.unidad)}"></td><td>${escapeHTML(m.cantidad)}<input type="hidden" class="cantidad-material" value="${escapeAttr(m.cantidad)}"></td><td><button type="button" class="btn-trash" onclick="eliminarMaterial(this)"><i class="fas fa-trash"></i></button></td>`; tabla.querySelector("tbody").appendChild(tr);
}
function eliminarMaterial(btn){ const tr=btn.closest("tr"), table=btn.closest("table"); tr.remove(); if(!table.querySelector("tbody").children.length) table.remove(); formularioSucio=true; }
function obtenerMateriales(){ return Array.from(document.querySelectorAll("#listaMaterialesTraslado .material-row")).map(r=>({codigo:r.querySelector(".codigo-material").value,nombre:r.querySelector(".nombre-material").value,unidad:r.querySelector(".unidad-material").value,cantidad:r.querySelector(".cantidad-material").value})); }

function abrirModalFirma(tipo){ tipoFirmaActual=tipo; const esPrep=tipo==="preparacion"; document.getElementById("tituloFirma").innerHTML= esPrep?'<i class="fas fa-pen-nib"></i> Firma preparación':'<i class="fas fa-signature"></i> Firma recibido'; document.getElementById("labelNombreFirma").textContent=esPrep?"Nombre de quien prepara":"Nombre de quien recibe"; document.getElementById("nombreFirma").value= esPrep?(document.getElementById("col_11").value||usuarioSesion):(document.getElementById("col_14").value||""); document.getElementById("modalFirmaBg").style.display="flex"; setTimeout(limpiarFirmaCanvas,80); }
function cerrarModalFirma(){ document.getElementById("modalFirmaBg").style.display="none"; }
function configurarCanvasFirma(){ const canvas=document.getElementById("canvasFirma"), ctx=canvas.getContext("2d"); function resize(){ const rect=canvas.getBoundingClientRect(); canvas.width=rect.width; canvas.height=190; ctx.lineWidth=2.5; ctx.lineCap="round"; ctx.strokeStyle="#111"; } window.addEventListener("resize",resize); setTimeout(resize,200); function pos(e){ const r=canvas.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return {x:t.clientX-r.left,y:t.clientY-r.top}; } function start(e){ e.preventDefault(); dibujandoFirma=true; const p=pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); } function move(e){ if(!dibujandoFirma)return; e.preventDefault(); const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); } function end(){ dibujandoFirma=false; } canvas.addEventListener("mousedown",start); canvas.addEventListener("mousemove",move); canvas.addEventListener("mouseup",end); canvas.addEventListener("mouseleave",end); canvas.addEventListener("touchstart",start,{passive:false}); canvas.addEventListener("touchmove",move,{passive:false}); canvas.addEventListener("touchend",end); }
function limpiarFirmaCanvas(){ const c=document.getElementById("canvasFirma"), ctx=c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height); }
function guardarFirmaModal(){ const nombre=document.getElementById("nombreFirma").value.trim(); if(!nombre){alert("Debe escribir el nombre.");return;} const firma=document.getElementById("canvasFirma").toDataURL("image/png"); if(tipoFirmaActual==="preparacion"){ document.getElementById("col_10").value=fechaHoy(); document.getElementById("col_11").value=nombre; document.getElementById("col_12").value=firma; document.getElementById("col_3").value="Preparado"; document.getElementById("previewFirmaPrep").innerHTML="Firma preparación capturada"; } else { document.getElementById("col_13").value=fechaHoy(); document.getElementById("col_14").value=nombre; document.getElementById("col_15").value=firma; document.getElementById("col_3").value="Recibido"; document.getElementById("previewFirmaRec").innerHTML="Firma recibido capturada"; } formularioSucio=true; cerrarModalFirma();
  actualizarPermisosVisuales();
  setTimeout(function(){
    pasoActual = 3;
    mostrarPasoActual();
  }, 100); }

function actualizarPermisosVisuales(){
  const estado = norm(document.getElementById("col_3").value);
  const btnGuardar = document.getElementById("btnGuardarTraslado");

  document.getElementById("boxFirmaPrep").style.display =
    (tipoUsuarioSesion === "1" || tipoUsuarioSesion === "2") ? "block" : "none";

  document.getElementById("boxFirmaRec").style.display =
    (tipoUsuarioSesion === "3" && estado === "PREPARADO") ? "block" : "none";

  if (tipoUsuarioSesion !== "1") {
    document.getElementById("col_4").classList.remove("selector");
  }

  if (tipoUsuarioSesion === "3") {
    document.getElementById("col_6").classList.remove("selector");
  }

  const puedeGuardarRecibidoTipo3 =
    tipoUsuarioSesion === "3" &&
    estado === "RECIBIDO" &&
    document.getElementById("col_15").value.trim() !== "";

  if (estado === "TERMINADO" || estado === "AUDITADO") {
    btnGuardar.disabled = true;
    btnGuardar.style.opacity = .65;
    return;
  }

  if (estado === "RECIBIDO" && !puedeGuardarRecibidoTipo3) {
    btnGuardar.disabled = true;
    btnGuardar.style.opacity = .65;
    return;
  }

  btnGuardar.disabled = false;
  btnGuardar.style.opacity = 1;
}

async function cargarTrasladoEditar(id){
  const res=await fetch(CONFIG.URL_APPS_SCRIPT,{method:"POST",mode:"cors",body:JSON.stringify({action:"obtenerTrasladoPorId",idTraslado:id,tipo_usuario:tipoUsuarioSesion,sector:sectorSesion,numero_cuadrilla:numeroCuadrillaLogin})});
  const data=await res.json(); if(data.status!=="Éxito"){ alert(data.message||"No se pudo cargar traslado."); window.location.href="listatraslados.html"; return; }
  const t=data.traslado||{}; for(let i=0;i<=23;i++){ const el=document.getElementById("col_"+i); if(el) el.value=t["col_"+i]||""; }
  (data.materiales||[]).forEach(agregarMaterialTabla);
  if(document.getElementById("col_12").value) document.getElementById("previewFirmaPrep").innerHTML="Firma preparación capturada";
  if(document.getElementById("col_15").value) document.getElementById("previewFirmaRec").innerHTML="Firma recibido capturada";
  const url=document.getElementById("col_16").value.trim(); if(url){ mostrarBotonPDF(url); }
  formularioSucio=false; trasladoGuardado=false;
}

function validarTraslado(){
  if(!document.getElementById("col_4").value||!document.getElementById("col_5").value){alert("Debe definir la cuadrilla que entrega."); pasoActual=1; mostrarPasoActual(); return false;}
  if(!document.getElementById("col_6").value||!document.getElementById("col_7").value){alert("Debe definir la cuadrilla que recibe."); pasoActual=1; mostrarPasoActual(); return false;}
  if(!document.getElementById("col_23").value){alert("Debe seleccionar el tipo de traslado."); pasoActual=1; mostrarPasoActual(); return false;}
  if(obtenerMateriales().length===0){alert("Debe agregar al menos un material."); pasoActual=2; mostrarPasoActual(); return false;}
  return true;
}
async function guardarTraslado(){
  if(!validarTraslado()) return;
  const traslado={}; for(let i=0;i<=23;i++){ const el=document.getElementById("col_"+i); traslado["col_"+i]=el?el.value:""; }
  const btn=document.getElementById("btnGuardarTraslado"); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Guardando...';
  try{
    const res=await fetch(CONFIG.URL_APPS_SCRIPT,{method:"POST",mode:"cors",body:JSON.stringify({action:"guardarTraslado",traslado,materiales:obtenerMateriales(),usuario:usuarioSesion,tipo_usuario:tipoUsuarioSesion,sector:sectorSesion})});
    const data=await res.json(); if(data.status!=="Éxito") throw new Error(data.message||"No se pudo guardar.");
    trasladoGuardado=true; formularioSucio=false; document.getElementById("mensajeGuardado").style.display="block"; document.getElementById("mensajeGuardado").innerHTML='<i class="fas fa-check-circle"></i> Traslado guardado correctamente: '+escapeHTML(data.id||traslado.col_0); document.getElementById("btnGenerarPDF").style.display="flex";
    alert("Traslado guardado correctamente.");
  }catch(e){alert("Error guardando traslado: "+e.message);} finally{btn.disabled=false; btn.innerHTML='<i class="fas fa-save"></i> Guardar traslado'; actualizarPermisosVisuales();}
}
async function generarPDFTraslado(){
  const id=document.getElementById("col_0").value; const btn=document.getElementById("btnGenerarPDF"); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Generando...';
  try{ const res=await fetch(CONFIG.URL_APPS_SCRIPT,{method:"POST",mode:"cors",body:JSON.stringify({action:"generarPDFTraslado",idTraslado:id})}); const data=await res.json(); if(data.status!=="Éxito") throw new Error(data.message||"No se pudo generar PDF."); document.getElementById("col_16").value=data.url; mostrarBotonPDF(data.url); alert("PDF generado correctamente."); }catch(e){alert("Error PDF: "+e.message);} finally{btn.disabled=false; btn.innerHTML='<i class="fas fa-file-pdf"></i> Generar PDF';}
}
function mostrarBotonPDF(url){ document.getElementById("btnGenerarPDF").style.display="none"; const a=document.getElementById("btnVerPDF"); a.href=url; a.style.display="flex"; }

function siguientePaso(){ if(pasoActual<totalPasos){ pasoActual++; mostrarPasoActual(); } }
function pasoAnterior(){ if(pasoActual>1){ pasoActual--; mostrarPasoActual(); } }
function mostrarPasoActual(){ for(let i=1;i<=totalPasos;i++){ document.getElementById("step-"+i).classList.toggle("activo",i===pasoActual); document.getElementById("ind-"+i).classList.toggle("active",i===pasoActual); } actualizarBotones(); }
function actualizarBotones(){ document.getElementById("btnAnterior").style.display=pasoActual===1?"none":"flex"; document.getElementById("btnSiguiente").style.display=pasoActual===totalPasos?"none":"flex"; }
function norm(v){ return String(v||"").trim().toUpperCase(); }
function escapeHTML(v){ return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
function escapeAttr(v){ return escapeHTML(v).replace(/`/g,"&#096;"); }
