import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// 1. CONEXIÓN A FIREBASE (Usamos tus mismas credenciales)
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

    // Ordenamos por fecha (más recientes arriba)
    listaPresupuestos.sort((a, b) => b.fecha.localeCompare(a.fecha));

    listaPresupuestos.forEach(p => {
        // Lógica de estadísticas
        if (p.estado === 'pendiente') stats.pen++;
        if (p.estado === 'aprobado') { stats.apr++; stats.montoApr += Number(p.monto); }
        if (p.estado === 'rechazado') stats.rec++;

        // Lógica de colores de los badges
        let colorBadge = p.estado === 'pendiente' ? 'badge-pendiente' : (p.estado === 'aprobado' ? 'badge-completado' : '');
        let estiloRechazado = p.estado === 'rechazado' ? 'background: var(--red-tint); color: #7f1d1d; border: 1px solid #fecaca;' : '';

        html += `<tr>
            <td data-label="Médico"><span class="medico-name">${p.medico}</span></td>
            <td data-label="Fecha">${new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
            <td data-label="Monto"><strong>$${Number(p.monto).toLocaleString('es-AR')}</strong></td>
            <td data-label="Detalle"><div class="pedido-text">${p.detalle}</div></td>
            <td data-label="Estado">
                <span class="badge ${colorBadge}" style="${estiloRechazado} cursor:pointer;" onclick="window.rotarEstado('${p.id}', '${p.estado}')" title="Tocar para cambiar estado">
                    ${p.estado.toUpperCase()}
                </span>
            </td>
            <td data-label="PDF">
                <a href="${p.link}" target="_blank" class="btn-icon" style="color: var(--red-alert); font-size: 20px;" title="Ver PDF en Drive">
                    <i class="fa-regular fa-file-pdf"></i>
                </a>
            </td>
            <td data-label="Acción">
                <button class="btn-icon btn-delete" onclick="window.borrarPresupuesto('${p.id}')"><i class="fa-regular fa-trash-can"></i></button>
            </td>
        </tr>`;
    });

    cuerpo.innerHTML = html !== '' ? html : `<tr><td colspan="7" class="row-empty">No hay presupuestos cargados aún.</td></tr>`;

    // Actualizar las estadísticas de arriba
    document.getElementById('stat-pendientes').innerText = stats.pen;
    document.getElementById('stat-aprobados').innerText = stats.apr;
    document.getElementById('stat-rechazados').innerText = stats.rec;
    document.getElementById('stat-monto-aprobado').innerText = `$${stats.montoApr.toLocaleString('es-AR')}`;
}

// 5. CAMBIAR ESTADO RÁPIDO (Con un toque rotamos Pendiente -> Aprobado -> Rechazado)
window.rotarEstado = async (id, estadoActual) => {
    let nuevoEstado = 'pendiente';
    if (estadoActual === 'pendiente') nuevoEstado = 'aprobado';
    if (estadoActual === 'aprobado') nuevoEstado = 'rechazado';

    try {
        await updateDoc(doc(db, "presupuestos", id), { estado: nuevoEstado });
    } catch (error) { alert("Error al cambiar estado."); }
};

// 6. BORRAR PRESUPUESTO
window.borrarPresupuesto = async (id) => {
    if (confirm("¿Seguro que querés borrar este registro de presupuesto?")) {
        try { await deleteDoc(doc(db, "presupuestos", id)); } 
        catch (error) { alert("Error al borrar."); }
    }
};

// 7. GUARDAR NUEVO PRESUPUESTO
document.getElementById('btn-nuevo-presupuesto').onclick = () => {
    document.getElementById('form-presupuesto').reset();
    document.getElementById('pres-fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-presupuesto').classList.add('active');
};

document.getElementById('form-presupuesto').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Guardando...";

    const nuevoPresupuesto = {
        medico: document.getElementById('pres-medico').value.trim(),
        monto: document.getElementById('pres-monto').value,
        fecha: document.getElementById('pres-fecha').value,
        link: document.getElementById('pres-link').value.trim(),
        estado: document.getElementById('pres-estado').value,
        detalle: document.getElementById('pres-detalle').value.trim()
    };

    try {
        await addDoc(collection(db, "presupuestos"), nuevoPresupuesto);
        document.getElementById('modal-presupuesto').classList.remove('active');
    } catch (error) {
        alert("Hubo un error al guardar. Reintentá.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Guardar Registro";
    }
};

// 8. BUSCADOR
document.getElementById('buscador-presupuestos').oninput = (e) => {
    const f = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.testa-table tbody tr').forEach(r => {
        if(r.querySelector('.row-empty')) return; 
        r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none';
    });
};