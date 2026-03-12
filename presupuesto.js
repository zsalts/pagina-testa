alert("¡El cerebro de presupuestos está vivo!");
console.log("El archivo JS cargó perfectamente.");
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

// 1. CONEXIÓN A FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAJXaRh-OeWXEdK1QXZp133SCCwVLmXa98",
    authDomain: "testa-crm.firebaseapp.com",
    projectId: "testa-crm",
    storageBucket: "testa-crm.appspot.com", // Si falla la subida, cambiá appspot.com por firebasestorage.app
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
    }
});

// 3. CARGAR MÉDICOS (Para el autocompletado)
onSnapshot(collection(db, "clientes"), (snap) => {
    listaMedicos = snap.docs.map(d => d.data().nombre);
    const dl = document.getElementById('lista-nombres-medicos');
    if (dl) dl.innerHTML = listaMedicos.map(nombre => `<option value="${nombre}">${nombre}</option>`).join('');
});

// 4. CARGAR Y DIBUJAR PRESUPUESTOS
onSnapshot(collection(db, "presupuestos"), (snap) => {
    listaPresupuestos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    dibujarTablaPresupuestos();
});

function dibujarTablaPresupuestos() {
    const cuerpo = document.getElementById('cuerpo-tabla-presupuestos');
    if (!cuerpo) return;

    let stats = { pen: 0, apr: 0, rec: 0, montoApr: 0 };
    let html = '';

    // Ordenar por fecha (más recientes primero)
    listaPresupuestos.sort((a, b) => b.fecha.localeCompare(a.fecha));

    listaPresupuestos.forEach(p => {
        if (p.estado === 'pendiente') stats.pen++;
        if (p.estado === 'aprobado') { stats.apr++; stats.montoApr += Number(p.monto); }
        if (p.estado === 'rechazado') stats.rec++;

        let colorBadge = p.estado === 'pendiente' ? 'badge-pendiente' : (p.estado === 'aprobado' ? 'badge-completado' : '');
        let estiloRechazado = p.estado === 'rechazado' ? 'background: var(--red-tint); color: #7f1d1d; border: 1px solid #fecaca;' : '';

        html += `<tr>
            <td data-label="Médico"><span class="medico-name">${p.medico}</span></td>
            <td data-label="Fecha">${new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
            <td data-label="Monto"><strong>$${Number(p.monto).toLocaleString('es-AR')}</strong></td>
            <td data-label="Detalle"><div class="pedido-text">${p.detalle || '-'}</div></td>
            <td data-label="Estado">
                <span class="badge ${colorBadge}" style="${estiloRechazado} cursor:pointer;" onclick="window.rotarEstado('${p.id}', '${p.estado}')" title="Tocar para cambiar">
                    ${p.estado.toUpperCase()}
                </span>
            </td>
            <td data-label="PDF">
                <a href="${p.link}" target="_blank" class="btn-icon" style="color: var(--red-alert); font-size: 20px;" title="Ver PDF">
                    <i class="fa-regular fa-file-pdf"></i>
                </a>
            </td>
            <td data-label="Acción">
                <button class="btn-icon btn-delete" onclick="window.borrarPresupuesto('${p.id}')"><i class="fa-regular fa-trash-can"></i></button>
            </td>
        </tr>`;
    });

    cuerpo.innerHTML = html !== '' ? html : `<tr><td colspan="7" class="row-empty">No hay presupuestos registrados.</td></tr>`;

    document.getElementById('stat-pendientes').innerText = stats.pen;
    document.getElementById('stat-aprobados').innerText = stats.apr;
    document.getElementById('stat-rechazados').innerText = stats.rec;
    document.getElementById('stat-monto-aprobado').innerText = `$${stats.montoApr.toLocaleString('es-AR')}`;
}

// 5. CAMBIAR ESTADO RÁPIDO
window.rotarEstado = async (id, estadoActual) => {
    let nuevoEstado = 'pendiente';
    if (estadoActual === 'pendiente') nuevoEstado = 'aprobado';
    else if (estadoActual === 'aprobado') nuevoEstado = 'rechazado';

    try {
        await updateDoc(doc(db, "presupuestos", id), { estado: nuevoEstado });
    } catch (error) { console.error(error); }
};

// 6. BORRAR PRESUPUESTO
window.borrarPresupuesto = async (id) => {
    if (confirm("¿Estás seguro de eliminar este presupuesto?")) {
        try { await deleteDoc(doc(db, "presupuestos", id)); } 
        catch (error) { console.error(error); }
    }
};

// 7. ABRIR MODAL
document.getElementById('btn-nuevo-presupuesto').onclick = () => {
    document.getElementById('form-presupuesto').reset();
    document.getElementById('pres-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-presupuesto').classList.add('active');
};

// 8. LA MAGIA: SUBIR EL ARCHIVO Y GUARDAR LOS DATOS
document.getElementById('form-presupuesto').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    
    // Capturamos el archivo físico
    const archivoInput = document.getElementById('pres-archivo');
    const archivoFisico = archivoInput.files[0];

    if (!archivoFisico) {
        alert("Por favor, seleccioná un archivo PDF.");
        return;
    }

    // Bloqueamos el botón
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo PDF...';

    try {
        // A. Subir el archivo a Firebase Storage
        const nombreUnico = `${Date.now()}_${archivoFisico.name}`;
        const referenciaDestino = ref(storage, 'presupuestos/' + nombreUnico);
        
        const resultadoSubida = await uploadBytes(referenciaDestino, archivoFisico);
        
        // B. Obtener la URL pública de descarga
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando datos...';
        const urlPublica = await getDownloadURL(resultadoSubida.ref);

        // C. Guardar en Firestore
        const nuevoRegistro = {
            medico: document.getElementById('pres-medico').value.trim(),
            monto: Number(document.getElementById('pres-monto').value),
            fecha: document.getElementById('pres-fecha').value,
            estado: document.getElementById('pres-estado').value,
            detalle: document.getElementById('pres-detalle').value.trim(),
            link: urlPublica // Guardamos el link generado por Firebase
        };

        await addDoc(collection(db, "presupuestos"), nuevoRegistro);
        
        // D. Cerramos el modal
        document.getElementById('modal-presupuesto').classList.remove('active');
        alert("¡Presupuesto guardado con éxito!");

    } catch (error) {
        console.error("Error detallado:", error);
        alert("Error al subir. Revisá que las reglas de Firebase Storage estén en modo público.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar y Subir Archivo";
    }
};

// 9. BUSCADOR
document.getElementById('buscador-presupuestos').oninput = (e) => {
    const f = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.testa-table tbody tr').forEach(r => {
        if(r.querySelector('.row-empty')) return; 
        r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none';
    });
};