import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

// ==========================================
// 1. CONEXIÓN A FIREBASE
// ==========================================
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

// Tu URL de Google Apps Script
const urlGoogleScript = "https://script.google.com/macros/s/AKfycby_iXJtc34gbu_Y_6sQ85s04v5lg0xEF6oZsf3uulXazmDQyg61kDzXblrRF2UOtl8Q/exec"; 

let listaPresupuestos = [];
let listaMedicos = [];

// ==========================================
// 2. FUNCIONES DE INTERFAZ
// ==========================================
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal') || e.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-presupuesto').classList.remove('active');
        document.getElementById('modal-archivo-extra').classList.remove('active');
    }
});

onSnapshot(collection(db, "clientes"), (snap) => {
    listaMedicos = snap.docs.map(d => d.data().nombre);
    const dl = document.getElementById('lista-nombres-medicos');
    if (dl) dl.innerHTML = listaMedicos.map(nombre => `<option value="${nombre}">${nombre}</option>`).join('');
});

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
        let docsHTML = `<a href="${p.link}" target="_blank" class="btn-icon" title="Presupuesto Inicial" style="color: var(--red-alert); font-size: 20px;"><i class="fa-regular fa-file-pdf"></i></a>`;
        
        if (p.archivosExtra) {
            Object.entries(p.archivosExtra).forEach(([tipo, url]) => {
                docsHTML += `<a href="${url}" target="_blank" class="btn-icon" title="${tipo}" style="color: #16a34a; font-size: 20px;"><i class="fa-solid fa-file-circle-check"></i></a>`;
            });
        }

        let carpetaDestino = p.carpetaUnica || p.medico;
        let btnAddDoc = p.estado === 'aprobado' ? `<button class="btn-icon" onclick="window.abrirModalDoc('${p.id}', '${carpetaDestino}')" style="color: var(--green-success); margin-left:10px;"><i class="fa-solid fa-plus-circle"></i></button>` : '';

        html += `<tr>
            <td><strong>${p.medico}</strong></td>
            <td>${new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
            <td data-label="Nombre del Presupuesto"><div class="pedido-text">${p.nombreArchivo || 'Presupuesto Inicial'}</div></td>
            <td><span class="badge ${colorBadge}" onclick="window.rotarEstado('${p.id}', '${p.estado}')" style="cursor:pointer">${p.estado.toUpperCase()}</span></td>
            <td><div style="display:flex; gap:8px; align-items:center;">${docsHTML}${btnAddDoc}</div></td>
            <td><button class="btn-icon btn-delete" onclick="window.borrarPresupuesto('${p.id}')"><i class="fa-regular fa-trash-can"></i></button></td>
        </tr>`;
    });

    cuerpo.innerHTML = html !== '' ? html : `<tr><td colspan="6" class="row-empty">No hay expedientes registrados.</td></tr>`;
    document.getElementById('stat-pendientes').innerText = stats.pen;
    document.getElementById('stat-aprobados').innerText = stats.apr;
    document.getElementById('stat-rechazados').innerText = stats.rec;
}

// ==========================================
// 3. VINCULACIÓN CON VISITAS
// ==========================================
document.getElementById('pres-medico').addEventListener('change', async (e) => {
    const medicoElegido = e.target.value.trim();
    const selectVisitas = document.getElementById('pres-visita');
    if (!medicoElegido) { selectVisitas.innerHTML = '<option value="">-- Escribí un médico primero --</option>'; return; }
    selectVisitas.innerHTML = '<option value="">Buscando visitas...</option>';
    try {
        const q = query(collection(db, "clientes"), where("nombre", "==", medicoElegido));
        const snap = await getDocs(q);
        if (snap.empty) { selectVisitas.innerHTML = '<option value="">El médico no existe</option>'; return; }
        let opciones = '<option value="">-- Elegí la visita --</option>';
        let tieneVisitas = false;
        snap.forEach(documento => {
            const cliente = documento.data();
            if (cliente.visitas) {
                tieneVisitas = true;
                cliente.visitas.forEach((v, index) => {
                    opciones += `<option value="${documento.id}_${index}">${v.fecha} - ${v.pedido.substring(0,30)}...</option>`;
                });
            }
        });
        selectVisitas.innerHTML = tieneVisitas ? opciones : '<option value="">No tiene visitas cargadas</option>';
    } catch (e) { selectVisitas.innerHTML = '<option value="">Error al buscar</option>'; }
});

// ==========================================
// 4. GUARDADO Y SINCRONIZACIÓN DRIVE
// ==========================================
document.getElementById('btn-nuevo-presupuesto').onclick = () => {
    document.getElementById('form-presupuesto').reset();
    document.getElementById('pres-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-presupuesto').classList.add('active');
};

document.getElementById('form-presupuesto').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const archivoFisico = document.getElementById('pres-archivo').files[0];
    const medico = document.getElementById('pres-medico').value.trim();
    if (!archivoFisico) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

    try {
        const nombreOriginalConExt = archivoFisico.name;
        const nombreOriginalSinExt = nombreOriginalConExt.split('.').slice(0, -1).join('.');

        // Formatear Fecha (DD - MM - 26)
        const fechaInput = document.getElementById('pres-fecha').value; 
        const partes = fechaInput.split('-');
        const fechaFormateada = `${partes[2]} - ${partes[1]} - ${partes[0].substring(2)}`;

        const medicoLimpio = medico.replace(/[^a-zA-Z0-9 ]/g, '');
        
        // Carpeta en Drive
        const nombreCarpeta = `${fechaFormateada} - ${medicoLimpio} - ${nombreOriginalSinExt}`;
        const nombreArchivoFinal = nombreOriginalConExt;

        const refArch = ref(storage, `expedientes/${nombreCarpeta}/${nombreArchivoFinal}`);
        const snap = await uploadBytes(refArch, archivoFisico);
        const urlPublica = await getDownloadURL(snap.ref);

        await addDoc(collection(db, "presupuestos"), {
            medico, 
            fecha: fechaInput,
            estado: document.getElementById('pres-estado').value,
            detalle: document.getElementById('pres-detalle').value.trim(),
            nombreArchivo: nombreOriginalSinExt, 
            link: urlPublica, 
            carpetaUnica: nombreCarpeta, 
            archivosExtra: {}
        });

        const visitaVal = document.getElementById('pres-visita').value;
        if (visitaVal) {
            const [cId, vIdx] = visitaVal.split('_');
            const cRef = doc(db, "clientes", cId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
                let vits = cSnap.data().visitas;
                vits[vIdx].presupuestoLink = urlPublica;
                await updateDoc(cRef, { visitas: vits });
            }
        }

        fetch(urlGoogleScript, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ carpeta: nombreCarpeta, archivo: nombreArchivoFinal, link: urlPublica })
        }).catch(e => console.log("Drive Error:", e));

        document.getElementById('modal-presupuesto').classList.remove('active');
    } catch (e) { alert("Error al guardar."); } finally { btn.disabled = false; btn.innerText = "Guardar Presupuesto"; }
};

// ==========================================
// 5. DOCUMENTACIÓN EXTRA
// ==========================================
window.abrirModalDoc = (id, carpeta) => {
    document.getElementById('extra-id').value = id;
    document.getElementById('extra-carpeta').value = carpeta;
    document.getElementById('modal-archivo-extra').classList.add('active');
};

document.getElementById('form-archivo-extra').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const id = document.getElementById('extra-id').value;
    const carpeta = document.getElementById('extra-carpeta').value;
    const tipo = document.getElementById('extra-tipo').value;
    const file = document.getElementById('extra-archivo').files[0];
    if (!file) return;

    btn.disabled = true;
    try {
        const nombreArchivoExtra = file.name;
        const refArch = ref(storage, `expedientes/${carpeta}/${nombreArchivoExtra}`);
        const snap = await uploadBytes(refArch, file);
        const url = await getDownloadURL(snap.ref);

        const pRef = doc(db, "presupuestos", id);
        await updateDoc(pRef, { [`archivosExtra.${tipo}`]: url });

        fetch(urlGoogleScript, {
            method: 'POST', mode: 'no-cors',
            body: JSON.stringify({ carpeta: carpeta, archivo: nombreArchivoExtra, link: url })
        }).catch(e => console.log("Drive Error:", e));

        document.getElementById('modal-archivo-extra').classList.remove('active');
    } catch (e) { alert("Error al adjuntar."); } finally { btn.disabled = false; }
};

// AUXILIARES
window.rotarEstado = async (id, actual) => {
    let sig = actual === 'pendiente' ? 'aprobado' : (actual === 'aprobado' ? 'rechazado' : 'pendiente');
    if (confirm(`¿Pasar a ${sig.toUpperCase()}?`)) await updateDoc(doc(db, "presupuestos", id), { estado: sig });
};

window.borrarPresupuesto = async (id) => { if (confirm("¿Borrar expediente?")) await deleteDoc(doc(db, "presupuestos", id)); };

// ==========================================
// BUSCADOR EN TIEMPO REAL (Expedientes)
// ==========================================
document.getElementById('buscador-presupuestos').addEventListener('input', (e) => {
    const textoBuscado = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.testa-table tbody tr').forEach(fila => {
        if (fila.querySelector('.row-empty')) return; 
        const contenidoFila = fila.textContent.toLowerCase();
        fila.style.display = contenidoFila.includes(textoBuscado) ? '' : 'none';
    });
});