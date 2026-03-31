import { db, storage } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

// La URL de tu Google Apps Script para guardar en Drive
const urlGoogleScript = "https://script.google.com/macros/s/AKfycbxvfL1IEuVfRviOSouA_x3upBd60eldf6K64EuuBMcRi-zW8AwzdR_TZm_86y3PmbyQ/exec";

let presupuestosDisponibles = [];
let ultimoNroOC = 0; 

// ==========================================
// 1. ABRIR Y CERRAR MODAL
// ==========================================
document.getElementById('btn-nueva-oc')?.addEventListener('click', () => {
    document.getElementById('form-oc').reset();
    document.getElementById('oc-items-table-body').innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">Seleccioná un presupuesto arriba para cargar los equipos.</td></tr>';
    
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
// 2. LEER PRESUPUESTOS Y ARMAR TABLA DE COSTOS
// ==========================================
onSnapshot(collection(db, "presupuestos"), (snap) => {
    presupuestosDisponibles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const select = document.getElementById('oc-presupuesto');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccionar Presupuesto Base --</option>';
    
    presupuestosDisponibles.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(p => {
        if (p.items && p.items.length > 0) {
            select.innerHTML += `<option value="${p.id}">${p.nombreArchivo} (Cliente: ${p.medico})</option>`;
        }
    });
});

document.getElementById('oc-presupuesto')?.addEventListener('change', (e) => {
    const tbody = document.getElementById('oc-items-table-body');
    const pElegido = presupuestosDisponibles.find(p => p.id === e.target.value);
    
    if (!pElegido || !pElegido.items) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">Seleccioná un presupuesto arriba para cargar los equipos.</td></tr>';
        return;
    }

    let html = ``;
    pElegido.items.forEach((it, idx) => {
        html += `
        <tr class="oc-item-row" data-desc="${it.desc}">
            <td style="white-space:normal; font-size:12px; font-weight:500;">${it.desc}</td>
            <td><input type="number" class="oc-item-cant" value="${it.cant}" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:4px;" readonly></td>
            <td><input type="number" step="0.01" class="oc-item-costo" placeholder="0.00" required style="width:100%; padding:5px; border:1px solid var(--testa-blue); border-radius:4px;"></td>
            <td>
                <select class="oc-item-moneda" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:4px;">
                    <option value="USD">U$S</option>
                    <option value="ARS">$</option>
                </select>
            </td>
            <td>
                <select class="oc-item-iva" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:4px;">
                    <option value="21">21%</option>
                    <option value="10.5">10.5%</option>
                    <option value="0">0%</option>
                </select>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
});

const fContable = (num) => {
    return String(num.toLocaleString('es-AR', {minimumFractionDigits: 2})).replace(',00', ',-');
};

// ==========================================
// 3. GENERAR EL PDF Y AUTOMATIZAR TODO
// ==========================================
document.getElementById('form-oc')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando OC...';

    try {
        const idPresupuesto = document.getElementById('oc-presupuesto').value;
        const pElegido = presupuestosDisponibles.find(p => p.id === idPresupuesto);
        
        document.getElementById('pdf-oc-fecha').textContent = new Date().toLocaleDateString('es-AR', {day: '2-digit', month: '2-digit', year: 'numeric'});
        const nroOC = document.getElementById('oc-nro').value;
        document.getElementById('pdf-oc-nro-titulo').textContent = nroOC;
        document.getElementById('pdf-oc-prov').textContent = document.getElementById('oc-proveedor').value;
        document.getElementById('pdf-oc-atte').textContent = document.getElementById('oc-atte').value;
        document.getElementById('pdf-oc-cliente').textContent = pElegido.medico;

        document.getElementById('pdf-oc-pago').textContent = document.getElementById('oc-pago').value;
        document.getElementById('pdf-oc-plazo').textContent = document.getElementById('oc-plazo').value;
        document.getElementById('pdf-oc-envio').textContent = document.getElementById('oc-envio').value;
        
        const coti = document.getElementById('oc-coti').value;
        const cajaCoti = document.getElementById('caja-pdf-coti');
        if(coti && coti > 0) {
            cajaCoti.style.display = 'inline';
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
            const desc = fila.getAttribute('data-desc');
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
                    <td style="padding: 6px; border: 1px solid #333; text-align: center;">${index + 1}</td>
                    <td style="padding: 6px; border: 1px solid #333;">${desc}</td>
                    <td style="padding: 6px; border: 1px solid #333; text-align: center;">${cant}</td>
                    <td style="padding: 6px; border: 1px solid #333; text-align: right;">${moneda} ${fContable(costo)}</td>
                    <td style="padding: 6px; border: 1px solid #333; text-align: center;">${ivaPorc === 0 ? 'Exento' : ivaPorc + '%'}</td>
                    <td style="padding: 6px; border: 1px solid #333; text-align: right;">${moneda} ${fContable(sub)}</td>
                </tr>
            `;
        });

        document.getElementById('pdf-oc-subtotal').textContent = `${simboloGlobal} ${fContable(subtotalTotal)}`;

        const trIVA1 = document.createElement('tr');
        const trIVA2 = document.createElement('tr');
        const tablaTotales = document.getElementById('pdf-oc-totales');
        
        Array.from(tablaTotales.children).forEach(tr => {
            if(tr.id === 'fila-iva-extra') tr.remove();
        });

        if (iva21Total > 0) {
            trIVA1.id = 'fila-iva-extra';
            trIVA1.innerHTML = `<td colspan="3" style="border:none;"></td><td colspan="2" style="border:1px solid #333; padding:6px; text-align:right;">IVA 21%:</td><td style="border:1px solid #333; padding:6px; text-align:right; background:#c1d5e0;">${simboloGlobal} ${fContable(iva21Total)}</td>`;
            tablaTotales.insertBefore(trIVA1, tablaTotales.children[1]); 
        }
        if (iva10Total > 0) {
            trIVA2.id = 'fila-iva-extra';
            trIVA2.innerHTML = `<td colspan="3" style="border:none;"></td><td colspan="2" style="border:1px solid #333; padding:6px; text-align:right;">IVA 10,5%:</td><td style="border:1px solid #333; padding:6px; text-align:right; background:#c1d5e0;">${simboloGlobal} ${fContable(iva10Total)}</td>`;
            tablaTotales.insertBefore(trIVA2, tablaTotales.children[1]); 
        }

        const totalFinal = subtotalTotal + iva21Total + iva10Total;
        document.getElementById('pdf-oc-total').textContent = `${simboloGlobal} ${fContable(totalFinal)}`;
        
        const dto = parseFloat(document.getElementById('oc-dto').value) || 0;
        document.getElementById('pdf-oc-dto').textContent = dto > 0 ? `${simboloGlobal} ${fContable(dto)}` : '';

        const wrapper = document.getElementById('pdf-wrapper-oc');
        wrapper.style.opacity = "1"; wrapper.style.zIndex = "9999";
        
        const element = document.getElementById('pdf-content-oc');
        const opt = { margin: 0, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'px', format: [800, 1131], orientation: 'portrait' } };
        
        const pdfWorker = html2pdf().set(opt).from(element);
        
        const nombreArchivoPdf = `Orden_Compra_${nroOC.replace('/','-')}_${document.getElementById('oc-proveedor').value.replace(/ /g, '_')}.pdf`;
        pdfWorker.save(nombreArchivoPdf); 

        const pdfBase64 = await pdfWorker.outputPdf('datauristring');
        wrapper.style.opacity = "0"; wrapper.style.zIndex = "-9999";

        const pdfPuro = pdfBase64.split(',')[1];
        const storageRef = ref(storage, `ordenes_compra/${nroOC.replace('/','-')}.pdf`);
        await uploadString(storageRef, pdfPuro, 'base64', { contentType: 'application/pdf' });
        const pdfUrl = await getDownloadURL(storageRef);

        await addDoc(collection(db, "ordenes_compra"), {
            fecha: new Date().toISOString(),
            nroOC: nroOC,
            proveedor: document.getElementById('oc-proveedor').value,
            clienteRef: pElegido.medico,
            pdfUrl: pdfUrl,
            presupuestoId: pElegido.id
        });

        // --- MAGIA NUEVA: SUBIR A GOOGLE DRIVE DIRECTO A LA CARPETA DEL EXPEDIENTE ---
        const carpetaDestinoDrive = pElegido.carpetaUnica || pElegido.medico; // Busca la carpeta del presupuesto
        try {
            await fetch(urlGoogleScript, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ 
                    pdfBase64: pdfPuro, 
                    fileName: nombreArchivoPdf,
                    carpeta: carpetaDestinoDrive 
                })
            });
        } catch (driveErr) {
            console.error("Error al subir OC al Drive:", driveErr);
        }

        // --- COMPLETAR LA VISITA EN EL CRM ---
        if (pElegido.vinculoVisita) {
            const [cId, vIdx] = pElegido.vinculoVisita.split('_');
            const cRef = doc(db, "clientes", cId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
                let vits = cSnap.data().visitas;
                if (vits[vIdx]) {
                    vits[vIdx].estado = "completado"; 
                    await updateDoc(cRef, { visitas: vits });
                }
            }
        }

        // --- ACTUALIZAR EXPEDIENTE (PRESUPUESTO) A APROBADO ---
        await updateDoc(doc(db, "presupuestos", pElegido.id), {
            estado: 'aprobado',
            ordenCompraLink: pdfUrl,
            ordenCompraNro: nroOC
        });

        document.getElementById('modal-oc').classList.remove('active');
        alert("¡Éxito! OC generada, subida a Drive en su carpeta, Expediente Aprobado y Visita Completada.");

    } catch (e) {
        console.error(e);
        alert("Hubo un error en el proceso.");
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Generar OC y Cerrar Operación';
    }
});

// ==========================================
// 4. FUNCION DE BORRADO
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

// ==========================================
// 5. RENDERIZAR TABLA DE ÓRDENES CREADAS Y BUSCAR ÚLTIMO NRO
// ==========================================
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
                <td style="font-size: 12px;">${oc.clienteRef}</td>
                <td><a href="${oc.pdfUrl}" target="_blank" class="btn btn-secondary-tint" style="padding: 5px 10px;"><i class="fa-solid fa-file-pdf" style="color: #e11d48;"></i> Ver OC</a></td>
                <td><span style="background: #dcfce7; color: #16a34a; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;"><i class="fa-solid fa-check-double"></i> Visita Completada</span></td>
                <td><button class="btn-icon btn-delete" onclick="window.borrarOC('${oc.id}')" title="Borrar OC"><i class="fa-regular fa-trash-can"></i></button></td>
            </tr>`;
    });
});