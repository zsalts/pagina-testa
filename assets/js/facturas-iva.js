import { db, storage } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

let listaCompras = [];
let listaVentas = [];
let archivoCompra = null;
let archivoVenta = null;
let tabActiva = "compra"; 

const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// ==========================================
// 1. LÓGICA DE PESTAÑAS (TABS)
// ==========================================
const btnTabCompra = document.getElementById('tab-compra');
const btnTabVenta = document.getElementById('tab-venta');
const contCompras = document.getElementById('contenedor-compras');
const contVentas = document.getElementById('contenedor-ventas');
const btnNuevaFactura = document.getElementById('btn-nueva-factura');

btnTabCompra.addEventListener('click', () => {
    tabActiva = "compra";
    btnTabCompra.className = "btn btn-add";
    btnTabVenta.className = "btn btn-secondary";
    btnTabVenta.style.background = ""; 
    btnTabVenta.style.borderColor = "";
    
    contCompras.style.display = "block";
    contVentas.style.display = "none";
    
    btnNuevaFactura.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Cargar Gasto (Compra)';
    btnNuevaFactura.style.background = "";
    btnNuevaFactura.style.borderColor = "";
});

btnTabVenta.addEventListener('click', () => {
    tabActiva = "venta";
    btnTabVenta.className = "btn btn-add";
    btnTabVenta.style.background = "#e11d48"; 
    btnTabVenta.style.borderColor = "#e11d48";
    btnTabCompra.className = "btn btn-secondary";

    contCompras.style.display = "none";
    contVentas.style.display = "block";
    
    btnNuevaFactura.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Cargar Factura Propia (Venta)';
    btnNuevaFactura.style.background = "#e11d48";
    btnNuevaFactura.style.borderColor = "#e11d48";
});

// ==========================================
// 2. ABRIR MODALES Y TOGGLES DE SEGUNDO IVA
// ==========================================
btnNuevaFactura.addEventListener('click', () => {
    const hoy = new Date();
    const mesStr = String(hoy.getMonth() + 1).padStart(2, '0');
    const anioStr = String(hoy.getFullYear());

    if (tabActiva === "compra") {
        document.getElementById('form-compra').reset();
        archivoCompra = null;
        document.getElementById('comp-name-display').innerText = "Ningún archivo seleccionado";
        document.getElementById('comp-mes').value = mesStr;
        document.getElementById('comp-anio').value = anioStr;
        
        // Resetear visibilidad del segundo IVA
        document.getElementById('box-iva2-compra').style.display = 'none'; 
        
        document.getElementById('modal-factura-compra').classList.add('active');
    } else {
        document.getElementById('form-venta').reset();
        archivoVenta = null;
        document.getElementById('vent-name-display').innerText = "Ningún archivo seleccionado";
        document.getElementById('vent-mes').value = mesStr;
        document.getElementById('vent-anio').value = anioStr;
        
        // Resetear visibilidad general y del segundo IVA
        document.getElementById('contenedor-ivas-venta').style.display = 'block';
        document.getElementById('vent-monto-iva').required = true;
        document.getElementById('box-iva2-venta').style.display = 'none';
        
        document.getElementById('modal-factura-venta').classList.add('active');
    }
});

// Botones para mostrar el segundo IVA
document.getElementById('btn-add-iva-compra')?.addEventListener('click', () => {
    document.getElementById('box-iva2-compra').style.display = 'flex';
});

document.getElementById('btn-add-iva-venta')?.addEventListener('click', () => {
    document.getElementById('box-iva2-venta').style.display = 'flex';
});

// MAGIA: Mostrar/Ocultar IVA si es Factura C
document.getElementById('vent-tipo')?.addEventListener('change', (e) => {
    const tipo = e.target.value;
    const contIvas = document.getElementById('contenedor-ivas-venta');
    const inputIva = document.getElementById('vent-monto-iva');

    if (tipo === 'C') {
        contIvas.style.display = 'none';
        inputIva.required = false;
        inputIva.value = 0; 
    } else {
        contIvas.style.display = 'block';
        inputIva.required = true;
    }
});

document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal') || e.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-factura-compra').classList.remove('active');
        document.getElementById('modal-factura-venta').classList.remove('active');
    }
});

// ==========================================
// 3. ARCHIVOS
// ==========================================
document.getElementById('comp-archivo')?.addEventListener('change', e => { if(e.target.files.length>0){ archivoCompra = e.target.files[0]; document.getElementById('comp-name-display').innerText = archivoCompra.name; document.getElementById('comp-camara').value=""; } });
document.getElementById('comp-camara')?.addEventListener('change', e => { if(e.target.files.length>0){ archivoCompra = e.target.files[0]; document.getElementById('comp-name-display').innerText = "Foto capturada"; document.getElementById('comp-archivo').value=""; } });
document.getElementById('vent-archivo')?.addEventListener('change', e => { if(e.target.files.length>0){ archivoVenta = e.target.files[0]; document.getElementById('vent-name-display').innerText = archivoVenta.name; } });

// ==========================================
// 4. GUARDAR COMPRA (Sumando IVA 1 y 2)
// ==========================================
document.getElementById('form-compra')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerText = 'Guardando...';

    try {
        let url = "";
        const anio = document.getElementById('comp-anio').value;
        const mes = document.getElementById('comp-mes').value;
        
        // Leemos IVA 1 y 2
        const iva1 = parseFloat(document.getElementById('comp-monto-iva').value) || 0;
        const porc1 = document.getElementById('comp-porcentaje').value;
        
        let iva2 = 0;
        let porc2 = null;
        // Si el contenedor 2 está visible (se usó la opción)
        if(document.getElementById('box-iva2-compra').style.display === 'flex') {
            iva2 = parseFloat(document.getElementById('comp-monto-iva2').value) || 0;
            if(iva2 > 0) porc2 = document.getElementById('comp-porcentaje2').value;
        }

        const montoIvaTotal = iva1 + iva2;
        const porcentajeFinal = porc2 ? `${porc1}% + ${porc2}%` : `${porc1}%`; // Texto para la tabla

        if (archivoCompra) {
            const ext = archivoCompra.name.split('.').pop();
            const sRef = ref(storage, `facturas_compras/${anio}/${mes}/compra_${Date.now()}.${ext}`);
            await uploadBytes(sRef, archivoCompra);
            url = await getDownloadURL(sRef);
        }

        await addDoc(collection(db, "facturas_iva"), {
            total: parseFloat(document.getElementById('comp-total').value),
            montoIva: montoIvaTotal, 
            porcentajeIva: porcentajeFinal, 
            mes: mes, anio: anio, archivoUrl: url, creadoEn: new Date().toISOString()
        });
        document.getElementById('modal-factura-compra').classList.remove('active');
    } catch (err) { alert("Error al guardar."); } finally { btn.disabled = false; btn.innerText = "Guardar Compra"; }
});

// ==========================================
// 5. GUARDAR VENTA (Sumando IVA 1 y 2)
// ==========================================
document.getElementById('form-venta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerText = 'Guardando...';

    try {
        let url = "";
        const anio = document.getElementById('vent-anio').value;
        const mes = document.getElementById('vent-mes').value;
        const tipo = document.getElementById('vent-tipo').value;
        
        let montoIvaTotal = 0;
        let porcentajeFinal = "-";

        if (tipo !== 'C') {
            const iva1 = parseFloat(document.getElementById('vent-monto-iva').value) || 0;
            const porc1 = document.getElementById('vent-porcentaje').value;
            
            let iva2 = 0;
            let porc2 = null;
            // Si el contenedor 2 está visible
            if(document.getElementById('box-iva2-venta').style.display === 'flex') {
                iva2 = parseFloat(document.getElementById('vent-monto-iva2').value) || 0;
                if(iva2 > 0) porc2 = document.getElementById('vent-porcentaje2').value;
            }
            montoIvaTotal = iva1 + iva2;
            porcentajeFinal = porc2 ? `${porc1}% + ${porc2}%` : `${porc1}%`;
        }

        if (archivoVenta) {
            const ext = archivoVenta.name.split('.').pop();
            const sRef = ref(storage, `facturas_ventas/${anio}/${mes}/venta_${Date.now()}.${ext}`);
            await uploadBytes(sRef, archivoVenta);
            url = await getDownloadURL(sRef);
        }

        await addDoc(collection(db, "facturas_ventas"), {
            tipoFactura: tipo,
            total: parseFloat(document.getElementById('vent-total').value),
            montoIva: montoIvaTotal,
            porcentajeIva: porcentajeFinal,
            mes: mes, anio: anio, archivoUrl: url, creadoEn: new Date().toISOString()
        });
        document.getElementById('modal-factura-venta').classList.remove('active');
    } catch (err) { alert("Error al guardar."); } finally { btn.disabled = false; btn.innerText = "Guardar Venta"; }
});

// ==========================================
// 6. RENDERIZADO Y CÁLCULO DE BALANCE
// ==========================================
function renderizarTodo() {
    const hoy = new Date();
    const mesActualCalculo = String(hoy.getMonth() + 1).padStart(2, '0');
    const anioActualCalculo = String(hoy.getFullYear());
    
    let ivaCompraMes = 0;
    let ivaVentaMes = 0;

    const agrupCompras = {};
    listaCompras.forEach(f => {
        if (f.anio === anioActualCalculo && f.mes === mesActualCalculo) ivaCompraMes += f.montoIva;
        if (!agrupCompras[f.anio]) agrupCompras[f.anio] = {};
        if (!agrupCompras[f.anio][f.mes]) agrupCompras[f.anio][f.mes] = [];
        agrupCompras[f.anio][f.mes].push(f);
    });
    generarHTMLAcordeones('contenedor-compras', agrupCompras, 'compra', anioActualCalculo, mesActualCalculo);

    const agrupVentas = {};
    listaVentas.forEach(f => {
        if (f.anio === anioActualCalculo && f.mes === mesActualCalculo) ivaVentaMes += f.montoIva;
        if (!agrupVentas[f.anio]) agrupVentas[f.anio] = {};
        if (!agrupVentas[f.anio][f.mes]) agrupVentas[f.anio][f.mes] = [];
        agrupVentas[f.anio][f.mes].push(f);
    });
    generarHTMLAcordeones('contenedor-ventas', agrupVentas, 'venta', anioActualCalculo, mesActualCalculo);

    document.getElementById('txt-mes-actual').innerText = `${mesesNombres[hoy.getMonth()]} ${anioActualCalculo}`;
    document.getElementById('txt-iva-compra').innerText = `$ ${ivaCompraMes.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    document.getElementById('txt-iva-venta').innerText = `$ ${ivaVentaMes.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    
    const saldo = ivaCompraMes - ivaVentaMes; 
    const cajaSaldo = document.getElementById('caja-saldo');
    const lblSaldo = document.getElementById('lbl-saldo');
    const txtSaldo = document.getElementById('txt-saldo-total');

    txtSaldo.innerText = `$ ${Math.abs(saldo).toLocaleString('es-AR', {minimumFractionDigits: 2})}`;

    if (saldo >= 0) {
        cajaSaldo.style.background = "#ecfdf5"; cajaSaldo.style.borderColor = "#d1fae5";
        lblSaldo.innerText = "Saldo a Favor (AFIP)"; lblSaldo.style.color = "#059669"; txtSaldo.style.color = "#059669";
    } else {
        cajaSaldo.style.background = "#fff1f2"; cajaSaldo.style.borderColor = "#ffe4e6";
        lblSaldo.innerText = "Saldo a Pagar a AFIP"; lblSaldo.style.color = "#e11d48"; txtSaldo.style.color = "#e11d48";
    }
}

function generarHTMLAcordeones(idContenedor, agrupar, tipo, anioActual, mesActual) {
    const contenedor = document.getElementById(idContenedor);
    contenedor.innerHTML = "";

    Object.keys(agrupar).sort((a,b) => b-a).forEach(anio => {
        const divAnio = document.createElement('div');
        divAnio.innerHTML = `<h2 style="margin: 20px 0 15px; color: var(--testa-blue-dark); border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;"><i class="fa-regular fa-calendar"></i> Período ${anio}</h2>`;
        
        Object.keys(agrupar[anio]).sort((a,b) => b-a).forEach(mes => {
            const facturas = agrupar[anio][mes];
            const mesNombre = mesesNombres[parseInt(mes) - 1];
            let sumaIvaARS = 0;

            let filas = facturas.map(f => {
                sumaIvaARS += f.montoIva;
                let iconHtml = f.archivoUrl ? `<a href="${f.archivoUrl}" target="_blank" class="btn-icon" style="color: ${tipo==='venta'?'#e11d48':'var(--testa-blue)'}; font-size: 1.4em;"><i class="fa-solid fa-file-pdf"></i></a>` : `-`;
                
                let detalleMonto = `<td style="font-weight:bold; color:${tipo==='venta'?'#e11d48':'var(--testa-blue)'};">$ ${f.montoIva.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>`;
                let colId = tipo === 'venta' ? 'facturas_ventas' : 'facturas_iva';
                
                let strPorcentaje = String(f.porcentajeIva).includes('%') || f.porcentajeIva === '-' ? f.porcentajeIva : f.porcentajeIva + '%';
                let badgeTipo = (tipo === 'venta' && f.tipoFactura) ? `<span style="background: #ffe4e6; color: #be123c; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.8em; margin-right: 5px;">${f.tipoFactura}</span>` : '';

                return `<tr>
                    <td>${badgeTipo}${f.creadoEn.split('T')[0].split('-').reverse().join('/')}</td>
                    ${detalleMonto}
                    <td style="font-size: 0.9em; color: #64748b;">${strPorcentaje}</td>
                    <td style="text-align:center;">${iconHtml}</td>
                    <td><button onclick="window.borrarRegistro('${colId}', '${f.id}')" class="btn-icon btn-delete"><i class="fa-trash-can fa-regular"></i></button></td>
                </tr>`;
            }).join('');

            const esActual = (anio === anioActual && mes === mesActual);
            const disp = esActual ? "block" : "none";
            const rot = esActual ? "180deg" : "0deg";
            const idUnico = `${tipo}_${anio}_${mes}`;
            const colorTitulo = tipo === 'venta' ? '#be123c' : 'var(--green-success)';

            divAnio.innerHTML += `
                <div class="table-card" style="margin-bottom: 15px; overflow: hidden;">
                    <div onclick="window.toggleSolapa('${idUnico}')" style="padding: 15px; background: #f8fafc; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i id="icon_${idUnico}" class="fa-solid fa-chevron-down" style="transition: transform 0.3s ease; transform: rotate(${rot});"></i>
                            <strong style="font-size: 1.1em;">${mesNombre}</strong>
                            <span style="margin-left: 15px; color: ${colorTitulo}; font-weight: bold;">Subtotal IVA: $ ${sumaIvaARS.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                    <div id="tabla_${idUnico}" style="display: ${disp}; overflow-x: auto;">
                        <table class="testa-table" style="margin: 0; width: 100%;">
                            <thead><tr><th>Fecha</th><th>Monto IVA</th><th>% Alícuota</th><th>PDF</th><th>Acción</th></tr></thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>
                </div>`;
        });
        contenedor.appendChild(divAnio);
    });

    if (Object.keys(agrupar).length === 0) contenedor.innerHTML = `<div class="table-card" style="padding: 30px; text-align: center; color: #64748b;">Aún no cargaste ${tipo === 'compra' ? 'gastos' : 'facturas de venta'}.</div>`;
}

window.toggleSolapa = (id) => {
    const t = document.getElementById(`tabla_${id}`);
    const i = document.getElementById(`icon_${id}`);
    if (t.style.display === "none") { t.style.display = "block"; i.style.transform = "rotate(180deg)"; } 
    else { t.style.display = "none"; i.style.transform = "rotate(0deg)"; }
};

window.borrarRegistro = async (coleccion, id) => { 
    if(confirm("¿Estás seguro de borrar este registro contable?")) {
        try { await deleteDoc(doc(db, coleccion, id)); } catch(e) {}
    } 
};

// ==========================================
// 7. LECTURA EN TIEMPO REAL
// ==========================================
onSnapshot(collection(db, "facturas_iva"), snap => {
    listaCompras = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarTodo();
});

onSnapshot(collection(db, "facturas_ventas"), snap => {
    listaVentas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarTodo();
});