import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

// 1. CONEXIÓN A FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAJXaRh-OeWXEdK1QXZp133SCCwVLmXa98",
    authDomain: "testa-crm.firebaseapp.com",
    projectId: "testa-crm",
    storageBucket: "testa-crm.firebasestorage.app", 
    messagingSenderId: "616199192563",
    appId: "1:616199192563:web:20b35acba2f635b9735c86",
    measurementId: "G-7Q3BQS18FH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

let listaPresupuestos = [];
let listaMedicos = [];

// 2. CERRAR MODALES
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal') || e.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-presupuesto').classList.remove('active');
        document.getElementById('modal-archivo-extra').classList.remove('active');
    }
});

// 3. CARGAR MÉDICOS PARA AUTOCOMPLETAR
onSnapshot(collection(db, "clientes"), (snap) => {
    listaMedicos = snap.docs.map(d => d.data().nombre);
    const dl = document.getElementById('lista-nombres-medicos');
    if (dl) dl.innerHTML = listaMedicos.map(nombre => `<option value="${nombre}">${nombre}</option>`).join('');
});

// 4. CARGAR Y DIBUJAR PRESUPUESTOS (Expedientes)
onSnapshot(collection(db, "presupuestos"), (snap) => {
    listaPresupuestos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    dibujarTablaPresupuestos();
});

function dibujarTablaPresupuestos() {
    const cuerpo = document.getElementById('cuerpo-tabla-presupuestos');
    if (!cuerpo) return;

    let stats = { pen: 0, apr: 0, rec: 0 };
    let html = '';

    listaPresupuestos.sort((a, b) => b.fecha.localeCompare(a.fecha));

    listaPresupuestos.forEach(p => {
        if (p.estado === 'pendiente') stats.pen++;
        if (p.estado === 'aprobado') stats.apr++;
        if (p.estado === 'rechazado') stats.rec++;

        let colorBadge = p.estado === 'pendiente' ? 'badge-pendiente' : (p.estado === 'aprobado' ? 'badge-completado' : '');
        let estiloRechazado = p.estado === 'rechazado' ? 'background: var(--red-tint); color: #7f1d1d; border: 1px solid #fecaca;' : '';

        // Construir los iconos de documentos subidos
        let docsHTML = `<a href="${p.link}" target="_blank" class="btn-icon" title="Presupuesto Inicial" style="color: var(--red-alert); font-size: 20px;"><i class="fa-regular fa-file-pdf"></i></a>`;
        
        if (p.archivosExtra) {
            if (p.archivosExtra.OC_Cliente) docsHTML += `<a href="${p.archivosExtra.OC_Cliente}" target="_blank" class="btn-icon" title="OC Cliente" style="color: #0284c7; font-size: 20px;"><i class="fa-solid fa-file-invoice-dollar"></i></a>`;
            if (p.archivosExtra.OC_Proveedor) docsHTML += `<a href="${p.archivosExtra.OC_Proveedor}" target="_blank" class="btn-icon" title="OC Proveedor" style="color: #d97706; font-size: 20px;"><i class="fa-solid fa-file-contract"></i></a>`;
            if (p.archivosExtra.Remito) docsHTML += `<a href="${p.archivosExtra.Remito}" target="_blank" class="btn-icon" title="Remito" style="color: #16a34a; font-size: 20px;"><i class="fa-solid fa-truck-fast"></i></a>`;
            if (p.archivosExtra.Recibo) docsHTML += `<a href="${p.archivosExtra.Recibo}" target="_blank" class="btn-icon" title="Recibo de Cobro" style="color: #059669; font-size: 20px;"><i class="fa-solid fa-hand-holding-dollar"></i></a>`;
        }

        let carpetaDestino = p.carpetaUnica || p.medico;
        let btnAgregarDoc = '';
        if (p.estado === 'aprobado') {
            btnAgregarDoc = `<button class="btn-icon" onclick="window.abrirModalDoc('${p.id}', '${carpetaDestino}')" title="Adjuntar a carpeta: ${carpetaDestino}" style="color: var(--green-success); margin-left:10px;"><i class="fa-solid fa-plus-circle"></i></button>`;
        }

        html += `<tr>
            <td data-label="Médico"><span class="medico-name">${p.medico}</span></td>
            <td data-label="Fecha">${new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
            <td data-label="Detalle"><div class="pedido-text">${p.detalle || '-'}</div></td>
            <td data-label="Estado">
                <span class="badge ${colorBadge}" style="${estiloRechazado} cursor:pointer;" onclick="window.rotarEstado('${p.id}', '${p.estado}')" title="Tocar para cambiar">
                    ${p.estado.toUpperCase()}
                </span>
            </td>
            <td data-label="Documentación">
                <div style="display:flex; gap:8px; align-items:center;">
                    ${docsHTML}
                    ${btnAgregarDoc}
                </div>
            </td>
            <td data-label="Acción">
                <button class="btn-icon btn-delete" onclick="window.borrarPresupuesto('${p.id}')"><i class="fa-regular fa-trash-can"></i></button>
            </td>
        </tr>`;
    });

    cuerpo.innerHTML = html !== '' ? html : `<tr><td colspan="6" class="row-empty">No hay expedientes registrados.</td></tr>`;

    document.getElementById('stat-pendientes').innerText = stats.pen;
    document.getElementById('stat-aprobados').innerText = stats.apr;
    document.getElementById('stat-rechazados').innerText = stats.rec;
}

// 5. CAMBIAR ESTADO RÁPIDO (CON CONFIRMACIÓN)
window.rotarEstado = async (id, estadoActual) => {
    let nuevoEstado = 'pendiente';
    if (estadoActual === 'pendiente') nuevoEstado = 'aprobado';
    else if (estadoActual === 'aprobado') nuevoEstado = 'rechazado';

    if (confirm(`¿Estás seguro de que querés pasar este expediente a ${nuevoEstado.toUpperCase()}?`)) {
        try {
            await updateDoc(doc(db, "presupuestos", id), { estado: nuevoEstado });
        } catch (error) { 
            alert("Hubo un error al intentar cambiar el estado.");
        }
    }
};

window.borrarPresupuesto = async (id) => {
    if (confirm("¿Estás seguro de eliminar este expediente completo?")) {
        try { await deleteDoc(doc(db, "presupuestos", id)); } 
        catch (error) { console.error(error); }
    }
};

// ==========================================
// 6. BUSCADOR INTELIGENTE DE VISITAS
// ==========================================
document.getElementById('pres-medico').addEventListener('change', async (e) => {
    const medicoElegido = e.target.value.trim();
    const selectVisitas = document.getElementById('pres-visita');

    if (!medicoElegido) {
        selectVisitas.innerHTML = '<option value="">-- Escribí un médico arriba primero --</option>';
        return;
    }

    selectVisitas.innerHTML = '<option value="">Buscando visitas previas...</option>';

    try {
        const q = query(collection(db, "clientes"), where("nombre", "==", medicoElegido));
        const snap = await getDocs(q);

        if (snap.empty) {
            selectVisitas.innerHTML = '<option value="">El médico no existe o no tiene visitas</option>';
            return;
        }

        let opciones = '<option value="">-- Elegí la visita correspondiente --</option>';
        let tieneVisitas = false;

        snap.forEach(documento => {
            const cliente = documento.data();
            if (cliente.visitas && cliente.visitas.length > 0) {
                tieneVisitas = true;
                cliente.visitas.forEach((v, index) => {
                    const fechaAr = new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-AR');
                    const corto = v.pedido ? v.pedido.substring(0, 35) + '...' : 'Visita';
                    opciones += `<option value="${documento.id}_${index}">${fechaAr} - ${corto}</option>`;
                });
            }
        });

        selectVisitas.innerHTML = tieneVisitas ? opciones : '<option value="">Este médico no tiene visitas cargadas</option>';

    } catch (error) {
        console.error(error);
        selectVisitas.innerHTML = '<option value="">Error al buscar visitas</option>';
    }
});

// ==========================================
// 7. FORMULARIO 1: INICIAR EXPEDIENTE
// ==========================================
document.getElementById('btn-nuevo-presupuesto').onclick = () => {
    document.getElementById('form-presupuesto').reset();
    document.getElementById('pres-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('pres-visita').innerHTML = '<option value="">-- Escribí un médico arriba primero --</option>';
    document.getElementById('modal-presupuesto').classList.add('active');
};

document.getElementById('form-presupuesto').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const archivoFisico = document.getElementById('pres-archivo').files[0];
    const medico = document.getElementById('pres-medico').value.trim();

    if (!archivoFisico) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo PDF...';

    try {
        const nombreCarpeta = `${medico.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
        const referenciaDestino = ref(storage, `expedientes/${nombreCarpeta}/1_Presupuesto.pdf`);
        
        const resultadoSubida = await uploadBytes(referenciaDestino, archivoFisico);
        const urlPublica = await getDownloadURL(resultadoSubida.ref);

        const nuevoRegistro = {
            medico: medico,
            fecha: document.getElementById('pres-fecha').value,
            estado: document.getElementById('pres-estado').value,
            detalle: document.getElementById('pres-detalle').value.trim(),
            link: urlPublica,
            carpetaUnica: nombreCarpeta, 
            archivosExtra: {} 
        };

        // Guardamos el presupuesto
        await addDoc(collection(db, "presupuestos"), nuevoRegistro);

        // VINCULAMOS LA VISITA CON ESTE PDF
        const visitaSelect = document.getElementById('pres-visita').value;
        if (visitaSelect) {
            const [clienteId, visitaIndex] = visitaSelect.split('_');
            const clienteRef = doc(db, "clientes", clienteId);
            const clienteSnap = await getDoc(clienteRef);
            
            if (clienteSnap.exists()) {
                let clienteData = clienteSnap.data();
                clienteData.visitas[visitaIndex].presupuestoLink = urlPublica;
                await updateDoc(clienteRef, { visitas: clienteData.visitas });
            }
        }

        document.getElementById('modal-presupuesto').classList.remove('active');

    } catch (error) {
        alert("Error al subir el archivo.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Presupuesto";
    }
};

// ==========================================
// 8. FORMULARIO 2: AGREGAR DOCUMENTACIÓN
// ==========================================
window.abrirModalDoc = (id, carpeta) => {
    document.getElementById('form-archivo-extra').reset();
    document.getElementById('extra-id').value = id;
    document.getElementById('extra-carpeta').value = carpeta;
    document.getElementById('modal-archivo-extra').classList.add('active');
};

document.getElementById('form-archivo-extra').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const idRegistro = document.getElementById('extra-id').value;
    const carpetaDestino = document.getElementById('extra-carpeta').value;
    const tipoDoc = document.getElementById('extra-tipo').value;
    const archivoFisico = document.getElementById('extra-archivo').files[0];

    if (!archivoFisico) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo documento...';

    try {
        const nombreArchivo = `${tipoDoc}_${Date.now()}_${archivoFisico.name}`;
        const referenciaDestino = ref(storage, `expedientes/${carpetaDestino}/${nombreArchivo}`);
        
        const resultadoSubida = await uploadBytes(referenciaDestino, archivoFisico);
        const urlPublica = await getDownloadURL(resultadoSubida.ref);

        const docRef = doc(db, "presupuestos", idRegistro);
        const campo = `archivosExtra.${tipoDoc}`;
        
        await updateDoc(docRef, { [campo]: urlPublica });

        document.getElementById('modal-archivo-extra').classList.remove('active');

    } catch (error) {
        alert("Error al adjuntar el documento.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Subir a la Carpeta";
    }
};

// ==========================================
// 9. BUSCADOR
// ==========================================
document.getElementById('buscador-presupuestos').oninput = (e) => {
    const f = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.testa-table tbody tr').forEach(r => {
        if(r.querySelector('.row-empty')) return; 
        r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none';
    });
};