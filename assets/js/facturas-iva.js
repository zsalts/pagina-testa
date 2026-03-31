import { db, storage } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

let listaFacturas = [];
let archivoParaSubir = null;

const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// ==========================================
// 1. ABRIR Y CERRAR MODAL
// ==========================================
document.getElementById('btn-nueva-factura')?.addEventListener('click', () => {
    document.getElementById('form-factura').reset();
    archivoParaSubir = null;
    document.getElementById('file-name-display').innerText = "Ningún archivo seleccionado";
    
    // Autocompletar el mes y año actual
    const hoy = new Date();
    document.getElementById('fac-mes-periodo').value = String(hoy.getMonth() + 1).padStart(2, '0');
    document.getElementById('fac-anio-periodo').value = String(hoy.getFullYear());
    
    document.getElementById('modal-factura')?.classList.add('active');
});

document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal') || e.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-factura')?.classList.remove('active');
    }
});

// ==========================================
// 2. MANEJO DE ARCHIVOS
// ==========================================
document.getElementById('fac-archivo')?.addEventListener('change', e => { 
    if(e.target.files.length > 0) {
        archivoParaSubir = e.target.files[0]; 
        document.getElementById('file-name-display').innerHTML = `📎 Archivo cargado:<br>${archivoParaSubir.name}`; 
        document.getElementById('fac-camara').value = "";
    }
});

document.getElementById('fac-camara')?.addEventListener('change', e => { 
    if(e.target.files.length > 0) {
        archivoParaSubir = e.target.files[0]; 
        document.getElementById('file-name-display').innerHTML = `📸 ¡Foto capturada!`; 
        document.getElementById('fac-archivo').value = "";
    }
});

// ==========================================
// 3. GUARDAR EL REGISTRO
// ==========================================
document.getElementById('form-factura')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        let archivoUrl = "";
        if (archivoParaSubir) {
            const extension = archivoParaSubir.name.split('.').pop();
            const nombreFinal = `iva_${document.getElementById('fac-anio-periodo').value}_${document.getElementById('fac-mes-periodo').value}_${Date.now()}.${extension}`;
            const storageRef = ref(storage, `facturas_iva/${nombreFinal}`);
            const snap = await uploadBytes(storageRef, archivoParaSubir);
            archivoUrl = await getDownloadURL(snap.ref);
        }

        await addDoc(collection(db, "facturas_iva"), {
            total: parseFloat(document.getElementById('fac-total').value) || 0,
            montoIva: parseFloat(document.getElementById('fac-monto-iva').value) || 0,
            porcentajeIva: document.getElementById('fac-porcentaje').value,
            mes: document.getElementById('fac-mes-periodo').value,
            anio: document.getElementById('fac-anio-periodo').value,
            archivoUrl: archivoUrl,
            creadoEn: new Date().toISOString()
        });
        document.getElementById('modal-factura').classList.remove('active');
    } catch (err) { 
        alert("Error al guardar. Verificá tu conexión."); 
    } finally { 
        btnSubmit.disabled = false; 
        btnSubmit.innerText = "Guardar Registro"; 
    }
});

// ==========================================
// 4. RENDERIZADO DINÁMICO (AÑO > MES) Y ESTADÍSTICAS DEL MES ACTUAL
// ==========================================
function renderizarEstructura() {
    const contenedor = document.getElementById('contenedor-iva-dinamico');
    if (!contenedor) return;
    contenedor.innerHTML = "";

    // Datos para la barra de resumen del mes actual
    const hoy = new Date();
    const mesActualCalculo = String(hoy.getMonth() + 1).padStart(2, '0');
    const anioActualCalculo = String(hoy.getFullYear());
    let facturadoMesActual = 0;
    let ivaMesActual = 0;

    // Agrupamos las facturas
    const agrupar = {};
    listaFacturas.forEach(f => {
        const anio = f.anio || "2026";
        const mes = f.mes || "01";
        
        // Sumamos si es del mes y año actual
        if (anio === anioActualCalculo && mes === mesActualCalculo) {
            facturadoMesActual += f.total;
            ivaMesActual += f.montoIva;
        }

        if (!agrupar[anio]) agrupar[anio] = {};
        if (!agrupar[anio][mes]) agrupar[anio][mes] = [];
        agrupar[anio][mes].push(f);
    });

    // Actualizar la barra superior del mes actual
    const txtMesActual = document.getElementById('txt-mes-actual');
    if(txtMesActual) txtMesActual.innerText = `${mesesNombres[hoy.getMonth()]} ${anioActualCalculo}`;
    
    const txtTotalMes = document.getElementById('txt-total-mes');
    if(txtTotalMes) txtTotalMes.innerText = `$ ${facturadoMesActual.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
    
    const txtIvaMes = document.getElementById('txt-iva-mes');
    if(txtIvaMes) txtIvaMes.innerText = `$ ${ivaMesActual.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;


    // Iteramos los años de mayor a menor
    Object.keys(agrupar).sort((a,b) => b-a).forEach(anio => {
        const divAnio = document.createElement('div');
        divAnio.innerHTML = `<h2 style="margin: 20px 0 15px; color: var(--testa-blue-dark); border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;"><i class="fa-regular fa-calendar"></i> Período ${anio}</h2>`;
        
        // Iteramos los meses de mayor a menor (Diciembre a Enero)
        Object.keys(agrupar[anio]).sort((a,b) => b-a).forEach(mes => {
            const facturasMes = agrupar[anio][mes];
            const mesNombre = mesesNombres[parseInt(mes) - 1];
            
            let sumaIvaMes = 0;

            let filas = facturasMes.map(f => {
                sumaIvaMes += f.montoIva;
                
                let iconHtml = f.archivoUrl 
                    ? `<a href="${f.archivoUrl}" target="_blank" class="btn-icon" style="color: ${f.archivoUrl.includes('.pdf') ? 'var(--red-alert)' : 'var(--testa-blue)'}; font-size: 1.4em;"><i class="fa-solid fa-${f.archivoUrl.includes('.pdf') ? 'file-pdf' : 'image'}"></i></a>` 
                    : `<span style="color:#cbd5e1; font-size: 0.8em;">Sin adjunto</span>`;

                return `<tr>
                    <td>${f.creadoEn.split('T')[0].split('-').reverse().join('/')}</td>
                    <td style="font-weight:bold; color:var(--testa-blue);">$ ${f.montoIva.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                    <td>${f.porcentajeIva}%</td>
                    <td>$ ${f.total.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                    <td style="text-align:center;">${iconHtml}</td>
                    <td><button onclick="window.borrarFactura('${f.id}')" class="btn-icon btn-delete"><i class="fa-trash-can fa-regular"></i></button></td>
                </tr>`;
            }).join('');

            divAnio.innerHTML += `
                <div class="table-card" style="margin-bottom: 25px;">
                    <div style="padding: 15px; background: #f8fafc; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <strong style="font-size: 1.1em; color: var(--testa-blue-dark);">${mesNombre}</strong>
                            <span style="margin-left: 15px; color: var(--green-success); font-weight: bold;"><i class="fa-solid fa-arrow-trend-up"></i> IVA a favor: $ ${sumaIvaMes.toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                        </div>
                        <button class="btn btn-secondary-tint" onclick="window.descargarZip('${anio}', '${mes}', '${mesNombre}')">
                            <i class="fa-solid fa-file-zipper"></i> Descargar Comprobantes
                        </button>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="testa-table" style="margin: 0;">
                            <thead><tr><th>Carga</th><th>Monto IVA</th><th>%</th><th>Total Factura</th><th>Archivo</th><th>Acción</th></tr></thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>
                </div>`;
        });
        contenedor.appendChild(divAnio);
    });

    if (Object.keys(agrupar).length === 0) {
        contenedor.innerHTML = `<div class="table-card" style="padding: 30px; text-align: center; color: #64748b;">Aún no cargaste comprobantes en ningún período.</div>`;
    }
}

// ==========================================
// 5. FUNCIÓN PARA DESCARGAR EL ZIP
// ==========================================
window.descargarZip = async (anio, mes, nombreMes) => {
    const zip = new JSZip();
    const facturas = listaFacturas.filter(f => f.anio === anio && f.mes === mes && f.archivoUrl);
    
    if (facturas.length === 0) return alert("No hay archivos adjuntos en este mes para descargar.");

    document.body.style.cursor = 'wait';
    alert(`Preparando el ZIP de ${nombreMes} ${anio}. Esto puede demorar unos segundos dependiendo de tu conexión...`);
    
    try {
        for (let i = 0; i < facturas.length; i++) {
            const f = facturas[i];
            const response = await fetch(f.archivoUrl);
            const blob = await response.blob();
            
            let extension = f.archivoUrl.split('?')[0].split('.').pop();
            if(extension.length > 4) extension = "jpg"; 

            const nombreArchivo = `Comprobante_${i+1}_IVA-$${f.montoIva}.${extension}`;
            zip.file(nombreArchivo, blob);
        }

        const content = await zip.generateAsync({type:"blob"});
        saveAs(content, `TESTA_IVA_${nombreMes}_${anio}.zip`);
    } catch (e) { 
        console.error("Error armando el ZIP:", e);
        alert("Hubo un problema al descargar los archivos. Intentá de nuevo.");
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.borrarFactura = async id => { 
    if(confirm("¿Estás seguro de borrar este registro?")) await deleteDoc(doc(db, "facturas_iva", id)); 
};

onSnapshot(collection(db, "facturas_iva"), snap => {
    listaFacturas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarEstructura();
});