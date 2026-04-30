import { db, storage } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

const urlGoogleScript = "https://script.google.com/macros/s/AKfycby_iXJtc34gbu_Y_6sQ85s04v5lg0xEF6oZsf3uulXazmDQyg61kDzXblrRF2UOtl8Q/exec";

let presupuestosDisponibles = [];
let proveedoresDisponibles = [];
let transportesDisponibles = [];
let ultimoNroOC = 0; 

// ==========================================
// 1. CARGA DE DATOS (Proveedores, Transportes y Presupuestos)
// ==========================================
onSnapshot(collection(db, "proveedores"), (snap) => {
    proveedoresDisponibles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const selectProv = document.getElementById('oc-proveedor');
    if (selectProv) {
        const valorPrevio = selectProv.value;
        selectProv.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>';
        proveedoresDisponibles.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(p => {
            selectProv.innerHTML += `<option value="${p.nombre}">${p.nombre}</option>`;
        });
        selectProv.value = valorPrevio;
    }
});

onSnapshot(collection(db, "transportes"), (snap) => {
    transportesDisponibles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const selectTrans = document.getElementById('oc-transporte');
    if (selectTrans) {
        const valorPrevio = selectTrans.value;
        selectTrans.innerHTML = '<option value="">-- Seleccionar Transporte --</option>';
        transportesDisponibles.sort((a,b) => (a.nombre || '').localeCompare(b.nombre || '')).forEach(t => {
            selectTrans.innerHTML += `<option value="${t.nombre}">${t.nombre}</option>`;
        });
        selectTrans.value = valorPrevio;
    }
});

onSnapshot(collection(db, "presupuestos"), (snap) => {
    presupuestosDisponibles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const select = document.getElementById('oc-presupuesto');
    if (!select) return;
    
    const valorPrevio = select.value;
    select.innerHTML = '<option value="">-- Seleccionar Presupuesto Base --</option>';
    
    presupuestosDisponibles.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)).forEach(p => {
        const nombreMostrar = p.nombreArchivo || p.id || 'Presupuesto sin nombre';
        const clienteMostrar = p.medico || 'Cliente sin registrar';
        select.innerHTML += `<option value="${p.id}">${nombreMostrar} (Cliente: ${clienteMostrar})</option>`;
    });
    
    select.value = valorPrevio;
});

// ==========================================
// 2. AGREGAR NUEVO PROVEEDOR / TRANSPORTE AL VUELO
// ==========================================
document.getElementById('btn-nuevo-proveedor')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const nombreNuevo = prompt("Ingresá el nombre del nuevo Proveedor:");
    if (nombreNuevo && nombreNuevo.trim() !== "") {
        try {
            await addDoc(collection(db, "proveedores"), { nombre: nombreNuevo.trim() });
            alert("¡Proveedor guardado con éxito! Ya podés seleccionarlo en la lista.");
        } catch (error) {
            alert("Error al guardar el proveedor.");
        }
    }
});

document.getElementById('btn-nuevo-transporte')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const nombreNuevo = prompt("Ingresá el nombre de la nueva empresa de Transporte/Envío:");
    if (nombreNuevo && nombreNuevo.trim() !== "") {
        try {
            await addDoc(collection(db, "transportes"), { nombre: nombreNuevo.trim() });
            alert("¡Transporte guardado con éxito! Ya podés seleccionarlo en la lista.");
        } catch (error) {
            alert("Error al guardar el transporte.");
        }
    }
});

// ==========================================
// 3. ABRIR Y CERRAR MODAL
// ==========================================
document.getElementById('btn-nueva-oc')?.addEventListener('click', () => {
    document.getElementById('form-oc').reset();
    document.getElementById('oc-items-table-body').innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">Seleccioná un presupuesto arriba para cargar los equipos.</td></tr>';
    
    let btnContainer = document.getElementById('contenedor-btn-add-row');
    if(btnContainer) btnContainer.innerHTML = ''; 

    const anio = new Date().getFullYear();
    document.getElementById('oc-nro').value = `${ultimoNroOC + 1}/${anio}`; 
    document.getElementById('modal-oc').classList.add('active');
});

document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal') || e.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-oc').classList.remove('active');
    }
});

// ==========================================
// 4. ARMAR TABLA DE ÍTEMS (SIN CATÁLOGO)
// ==========================================
function crearFilaHTML(desc, cant) {
    let descInput = `<input type="text" class="oc-item-desc" value="${desc || ''}" placeholder="Descripción del equipo..." required style="width:100%; padding:8px; border:1px solid var(--testa-blue); border-radius:4px; font-weight: 500; color: var(--testa-blue-dark);">`;
    
    let cantInput = `<input type="number" class="oc-item-cant" value="${cant}" style="width:100%; padding:8px; border:1px solid var(--testa-blue); border-radius:4px;" min="1" required>`;

    let btnBorrar = `<button type="button" class="btn-icon btn-delete" onclick="this.closest('tr').remove()" style="margin-top:5px; color: #e11d48;" title="Borrar fila"><i class="fa-regular fa-trash-can"></i></button>`;

    return `
    <tr class="oc-item-row">
        <td style="white-space:normal;">
            ${descInput}
        </td>
        <td>${cantInput}</td>
        <td><input type="number" step="0.01" class="oc-item-costo" placeholder="0.00" required style="width:100%; padding:8px; border:1px solid var(--testa-blue); border-radius:4px;"></td>
        <td>
            <select class="oc-item-moneda" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
                <option value="USD">U$S</option>
                <option value="ARS">$</option>
            </select>
        </td>
        <td>
            <select class="oc-item-iva" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; background:#f8fafc;">
                <option value="21">21%</option>
                <option value="10.5">10.5%</option>
                <option value="0">0%</option>
            </select>
            <div style="text-align: right;">${btnBorrar}</div>
        </td>
    </tr>`;
}

document.getElementById('oc-presupuesto')?.addEventListener('change', (e) => {
    const tbody = document.getElementById('oc-items-table-body');
    const pElegido = presupuestosDisponibles.find(p => p.id === e.target.value);
    
    let btnContainer = document.getElementById('contenedor-btn-add-row');
    if(!btnContainer) {
        const tableDiv = tbody.closest('table').parentNode;
        btnContainer = document.createElement('div');
        btnContainer.id = 'contenedor-btn-add-row';
        btnContainer.style = 'margin-top: 10px; text-align: left;';
        tableDiv.parentNode.insertBefore(btnContainer, tableDiv.nextSibling);
    }

    if (!pElegido) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">Seleccioná un presupuesto arriba para cargar los equipos.</td></tr>';
        btnContainer.innerHTML = '';
        return;
    }

    let html = ``;
    
    // Buscador inteligente de los equipos
    let listaEquipos = pElegido.items || pElegido.productos || pElegido.equipos || pElegido.articulos || pElegido.detalle_items || null;

    if (listaEquipos && listaEquipos.length > 0) {
        listaEquipos.forEach((it) => {
            let descFinal = it.desc || it.descripcion || it.nombre || it.producto || '';
            let cantFinal = it.cant || it.cantidad || 1;
            html += crearFilaHTML(descFinal, cantFinal);
        });
    } 
    else if (pElegido.detalle && pElegido.detalle.trim() !== '') {
        html += crearFilaHTML(pElegido.detalle, 1);
    } 
    else {
        html = `<tr><td colspan="5" style="text-align:center; color:#64748b;">Este expediente no tiene equipos guardados en sistema. Añadí el detalle a mano usando el botón de abajo.</td></tr>`;
    }
    
    tbody.innerHTML = html;

    btnContainer.innerHTML = `<button type="button" id="btn-add-fila" class="btn btn-secondary" style="padding: 8px 12px; font-size: 13px;"><i class="fa-solid fa-plus"></i> Añadir Ítem Manual</button>`;
    
    document.getElementById('btn-add-fila').addEventListener('click', () => {
        if(tbody.querySelector('td[colspan="5"]')) tbody.innerHTML = '';
        tbody.insertAdjacentHTML('beforeend', crearFilaHTML('', 1));
    });
});

const fContable = (num) => {
    return String(num.toLocaleString('es-AR', {minimumFractionDigits: 2})).replace(',00', ',-');
};

// ==========================================
// 5. GENERAR EL PDF Y SUBIR AL DRIVE
// ==========================================
document.getElementById('form-oc')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tbodyCarga = document.getElementById('oc-items-table-body');
    if(tbodyCarga.querySelector('td[colspan="5"]')) {
        alert("Por favor, añadí al menos un ítem manual a la Orden de Compra antes de generarla.");
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando OC...';

    const wrapper = document.getElementById('pdf-wrapper-oc');

    try {
        const idPresupuesto = document.getElementById('oc-presupuesto').value;
        const pElegido = presupuestosDisponibles.find(p => p.id === idPresupuesto);
        
        let carpetaDestino = pElegido.carpetaUnica; 
        if (!carpetaDestino) {
            let nombreDoc = pElegido.nombreArchivo || "Presupuesto";
            if (nombreDoc.match(/^\d{2} - \d{2} - \d{2}/)) {
                carpetaDestino = nombreDoc;
            } else {
                const fechaBase = pElegido.fecha || new Date().toISOString().split('T')[0];
                const partes = fechaBase.split('-');
                const fechaFormateada = `${partes[2]} - ${partes[1]} - ${partes[0].substring(2)}`;
                const medicoLimpio = pElegido.medico.replace(/[^a-zA-Z0-9 ]/g, '');
                carpetaDestino = `${fechaFormateada} - ${medicoLimpio} - ${nombreDoc}`;
            }
        }

        const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('pdf-oc-fecha').textContent = 'Mar del Plata, ' + new Date().toLocaleDateString('es-AR', opcionesFecha);
        
        const nroOC = document.getElementById('oc-nro').value;
        document.getElementById('pdf-oc-nro-titulo').textContent = nroOC;
        document.getElementById('pdf-oc-prov').textContent = document.getElementById('oc-proveedor').value;
        document.getElementById('pdf-oc-atte').textContent = document.getElementById('oc-atte').value;

        document.getElementById('pdf-oc-pago').textContent = document.getElementById('oc-pago').value;
        document.getElementById('pdf-oc-plazo').textContent = document.getElementById('oc-plazo').value;
        document.getElementById('pdf-oc-envio').textContent = document.getElementById('oc-envio').value;
        document.getElementById('pdf-oc-transporte').textContent = document.getElementById('oc-transporte').value;
        
        const coti = document.getElementById('oc-coti').value;
        const cajaCoti = document.getElementById('caja-pdf-coti');
        if(coti && coti > 0) {
            cajaCoti.style.display = 'list-item'; 
            document.getElementById('pdf-oc-coti').textContent = fContable(parseFloat(coti));
        } else {
            cajaCoti.style.display = 'none';
        }

        const tbodyPDF = document.getElementById('pdf-oc-tbody');
        tbodyPDF.innerHTML = '';
        
        let subtotalTotal = 0;
        let iva21Total = 0;
        let iva10Total = 0;
        let simboloGlobal = "U$S";

        const filas = document.querySelectorAll('.oc-item-row');
        filas.forEach((fila, index) => {
            const descFinal = fila.querySelector('.oc-item-desc').value || 'Sin descripción';
            const cant = parseFloat(fila.querySelector('.oc-item-cant').value);
            const costo = parseFloat(fila.querySelector('.oc-item-costo').value);
            const moneda = fila.querySelector('.oc-item-moneda').value === 'USD' ? 'U$S' : '$';
            simboloGlobal = moneda; 
            const ivaPorc = parseFloat(fila.querySelector('.oc-item-iva').value);
            
            const sub = cant * costo;
            const montoIva = sub * (ivaPorc / 100);
            
            subtotalTotal += sub;
            if(ivaPorc === 21) iva21Total += montoIva;
            if(ivaPorc === 10.5) iva10Total += montoIva;

            tbodyPDF.innerHTML += `
                <tr>
                    <td style="padding: 6px; border-right: 1px solid #000; border-bottom: 1px solid #ccc; text-align: center;">${index + 1}</td>
                    <td style="padding: 6px; border-right: 1px solid #000; border-bottom: 1px solid #ccc;">${descFinal}</td>
                    <td style="padding: 6px; border-right: 1px solid #000; border-bottom: 1px solid #ccc; text-align: center;">${cant}</td>
                    <td style="padding: 6px; border-right: 1px solid #000; border-bottom: 1px solid #ccc; text-align: right;">${moneda} ${fContable(costo)}</td>
                    <td style="padding: 6px; border-right: 1px solid #000; border-bottom: 1px solid #ccc; text-align: center;">${ivaPorc === 0 ? 'Exento' : ivaPorc + '%'}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ccc; text-align: right;">${moneda} ${fContable(sub)}</td>
                </tr>
            `;
        });

        document.getElementById('pdf-oc-subtotal').textContent = `${simboloGlobal} ${fContable(subtotalTotal)}`;

        const tbodyTotales = document.getElementById('pdf-oc-totales-tbody');
        const totalRow = document.getElementById('pdf-oc-total-row');
        
        Array.from(tbodyTotales.querySelectorAll('.fila-iva-extra')).forEach(tr => tr.remove());

        if (iva10Total > 0) {
            const trIVA2 = document.createElement('tr');
            trIVA2.className = 'fila-iva-extra';
            trIVA2.innerHTML = `<td style="padding: 6px; font-weight: bold; border-right: 1px solid #000; border-bottom: 1px solid #000;">IVA 10,5 %</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #000;">${simboloGlobal} ${fContable(iva10Total)}</td>`;
            tbodyTotales.insertBefore(trIVA2, totalRow); 
        }
        if (iva21Total > 0) {
            const trIVA1 = document.createElement('tr');
            trIVA1.className = 'fila-iva-extra';
            trIVA1.innerHTML = `<td style="padding: 6px; font-weight: bold; border-right: 1px solid #000; border-bottom: 1px solid #000;">IVA 21%</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #000;">${simboloGlobal} ${fContable(iva21Total)}</td>`;
            tbodyTotales.insertBefore(trIVA1, totalRow); 
        }

        const totalFinal = subtotalTotal + iva21Total + iva10Total;
        document.getElementById('pdf-oc-total').textContent = `${simboloGlobal} ${fContable(totalFinal)}`;
        
        const dto = parseFloat(document.getElementById('oc-dto').value) || 0;
        const textoDto = document.getElementById('pdf-oc-dto-texto');
        if (dto > 0) {
            textoDto.style.display = 'block';
            document.getElementById('pdf-oc-dto').textContent = `${simboloGlobal} ${fContable(dto)}`;
        } else {
            textoDto.style.display = 'none';
        }

        wrapper.style.opacity = "1"; wrapper.style.zIndex = "9999";
        const element = document.getElementById('pdf-content-oc');
        const opt = { margin: 0, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'px', format: [800, 1131], orientation: 'portrait' } };
        
        const pdfBase64 = await html2pdf().set(opt).from(element).outputPdf('datauristring');
        const nombreArchivoPdf = `Orden_Compra_${nroOC.replace('/','-')}_${document.getElementById('oc-proveedor').value.replace(/ /g, '_')}.pdf`;
        
        const linkDescarga = document.createElement('a');
        linkDescarga.href = pdfBase64;
        linkDescarga.download = nombreArchivoPdf;
        linkDescarga.click();
        wrapper.style.opacity = "0"; wrapper.style.zIndex = "-9999";

        const pdfPuro = pdfBase64.split(',')[1];
        const storageRef = ref(storage, `expedientes/${carpetaDestino}/${nombreArchivoPdf}`);
        await uploadString(storageRef, pdfPuro, 'base64', { contentType: 'application/pdf' });
        const pdfUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, "ordenes_compra"), {
            fecha: new Date().toISOString(),
            nroOC: nroOC,
            proveedor: document.getElementById('oc-proveedor').value,
            transporte: document.getElementById('oc-transporte').value,
            pdfUrl: pdfUrl,
            presupuestoId: pElegido.id,
            carpetaDrive: carpetaDestino 
        });

        fetch(urlGoogleScript, {
            method: 'POST', 
            mode: 'no-cors',
            body: JSON.stringify({ 
                carpeta: carpetaDestino, 
                archivo: nombreArchivoPdf, 
                link: pdfUrl 
            })
        }).then(() => console.log("OC enviada al Drive")).catch(e => console.error("Error Drive:", e));

        await updateDoc(doc(db, "presupuestos", pElegido.id), {
            estado: 'aprobado',
            ordenCompraLink: pdfUrl,
            ordenCompraNro: nroOC
        });

        if (pElegido.vinculoVisita) {
            const [cId, vIdx] = pElegido.vinculoVisita.split('_');
            const cRef = doc(db, "clientes", cId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
                let vits = cSnap.data().visitas;
                if (vits[vIdx]) { vits[vIdx].estado = "completado"; await updateDoc(cRef, { visitas: vits }); }
            }
        }

        document.getElementById('modal-oc').classList.remove('active');
        alert("¡Orden de Compra guardada con éxito en la carpeta del Expediente en Drive!");

    } catch (e) {
        console.error(e);
        wrapper.style.opacity = "0"; wrapper.style.zIndex = "-9999";
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Generar OC y Cerrar Operación';
    }
});

// ==========================================
// 6. FUNCION DE BORRADO Y RENDER TABLA
// ==========================================
window.borrarOC = async (id) => {
    if(confirm("¿Estás seguro de borrar esta Orden de Compra?")) {
        try {
            await deleteDoc(doc(db, "ordenes_compra", id));
        } catch (e) {
            console.error("Error al borrar:", e);
            alert("Error al borrar la Orden de Compra.");
        }
    }
};

onSnapshot(collection(db, "ordenes_compra"), (snap) => {
    const tabla = document.getElementById('tabla-oc');
    if (!tabla) return;
    tabla.innerHTML = '';
    
    let ordenes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ordenes.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    const anioActual = new Date().getFullYear().toString();
    let maxNro = 0;
    ordenes.forEach(oc => {
        if (oc.nroOC && String(oc.nroOC).includes('/' + anioActual)) {
            let num = parseInt(String(oc.nroOC).split('/')[0]);
            if (!isNaN(num) && num > maxNro) {
                maxNro = num;
            }
        }
    });
    ultimoNroOC = maxNro; 

    if (ordenes.length === 0) {
        tabla.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #64748b;">No hay órdenes emitidas</td></tr>';
        return;
    }

    ordenes.forEach(oc => {
        const f = new Date(oc.fecha).toLocaleDateString('es-AR');
        tabla.innerHTML += `
            <tr>
                <td><strong>${f}</strong><br><span style="font-size:10px; color:#666;">NRO: ${oc.nroOC}</span></td>
                <td style="color: var(--testa-blue-dark); font-weight: bold;">${oc.proveedor}</td>
                <td style="font-size: 13px; font-weight: 500; color: #334155;">${oc.transporte || 'No especificado'}</td>
                <td><a href="${oc.pdfUrl}" target="_blank" class="btn btn-secondary-tint" style="padding: 5px 10px;"><i class="fa-solid fa-file-pdf" style="color: #e11d48;"></i> Ver OC</a></td>
                <td><span style="background: #dcfce7; color: #16a34a; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;"><i class="fa-solid fa-check-double"></i> Visita Completada</span></td>
                <td><button class="btn-icon btn-delete" onclick="window.borrarOC('${oc.id}')" title="Borrar OC"><i class="fa-regular fa-trash-can"></i></button></td>
            </tr>`;
    });
});