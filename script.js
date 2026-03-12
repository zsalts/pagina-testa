import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

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

let listaMedicos = [];
let listaClinicas = [];
let medicoPendienteDeGuardar = null;

// ==========================================
// 2. CERRAR VENTANAS
// ==========================================
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal')) {
        e.target.closest('.modal-overlay').classList.remove('active');
    }
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ==========================================
// 3. BASE DE DATOS: CLÍNICAS
// ==========================================
onSnapshot(collection(db, "instituciones"), (snap) => {
    listaClinicas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const dl = document.getElementById('lista-instituciones');
    if(dl) dl.innerHTML = listaClinicas.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    
    const gestor = document.getElementById('lista-clinicas-gestion');
    if(gestor) {
        gestor.innerHTML = listaClinicas.length ? listaClinicas.map(c => `
            <div class="modern-list-item">
                <span><b>${c.nombre}</b><br><small style="color:var(--text-muted)">${c.direccion}</small></span>
                <button class="btn-icon btn-delete" onclick="window.borrarClinica('${c.id}')"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        `).join('') : '<p style="text-align:center;color:gray;padding:10px;">No hay clínicas cargadas.</p>';
    }

    const btnMdp = document.getElementById('btn-cargar-clinicas-mdp');
    if(btnMdp && listaClinicas.length >= 7) btnMdp.style.display = 'none';
}, (error) => console.error("Error cargando clínicas:", error));

document.getElementById('btn-cargar-clinicas-mdp').onclick = async () => {
    if(confirm("¿Querés cargar automáticamente las clínicas principales de MDP?")) {
        const clinicasMdp = [
            { nombre: "HPC", direccion: "Córdoba 4545" },
            { nombre: "Clínica Colón", direccion: "Av. Colón 3629" },
            { nombre: "Clínica 25 de Mayo", direccion: "25 de Mayo 3542" },
            { nombre: "Clínica Pueyrredon", direccion: "Jujuy 2176" },
            { nombre: "Hospital Materno Infantil", direccion: "Castelli 2450" },
            { nombre: "Clínica del Niño y la Madre", direccion: "Av. Colón 2749" },
            { nombre: "Particulares", direccion: "Sin dirección" }
        ];
        try {
            for (const c of clinicasMdp) {
                if (!listaClinicas.find(ex => ex.nombre.trim().toLowerCase() === c.nombre.trim().toLowerCase())) {
                    await addDoc(collection(db, "instituciones"), c);
                }
            }
            alert("Clínicas de Mar del Plata cargadas exitosamente.");
        } catch (error) {
            alert("Hubo un error al cargar las clínicas. Revisá tu conexión.");
        }
    }
};

document.getElementById('institucion').oninput = (e) => {
    const found = listaClinicas.find(c => c.nombre.trim().toLowerCase() === e.target.value.trim().toLowerCase());
    if(found) document.getElementById('direccion').value = found.direccion;
};

// ==========================================
// 4. BASE DE DATOS: MÉDICOS Y VISITAS 
// ==========================================
onSnapshot(collection(db, "clientes"), (snap) => {
    listaMedicos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    actualizarTablaClientes();
    dibujarListaMedicosGestion(); 
}, (error) => console.error("Error cargando médicos:", error));

window.actualizarTablaClientes = function() {
    const cuerpoPendientes = document.getElementById('cuerpo-tabla-pendientes');
    const cuerpoCompletadas = document.getElementById('cuerpo-tabla-completadas');
    if(!cuerpoPendientes || !cuerpoCompletadas) return;
    
    let stats = { v: 0, p: 0, c: 0 };
    let todasLasVisitas = []; 

    const dlMedicos = document.getElementById('lista-nombres-medicos');
    if (dlMedicos) dlMedicos.innerHTML = listaMedicos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');

    listaMedicos.forEach(m => {
        const visitas = m.visitas || [];
        visitas.forEach((v, index) => {
            stats.v++;
            if(v.estado === 'pendiente') stats.p++; else stats.c++;
            todasLasVisitas.push({
                medicoId: m.id, medicoNombre: m.nombre, contacto: m.contacto, institucion: m.institucion,
                fecha: v.fecha, fechaDisplay: new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-AR'), 
                pedido: v.pedido, estado: v.estado, entrega: v.entrega, idxReal: index
            });
        });
    });

    todasLasVisitas.sort((a, b) => b.fecha.localeCompare(a.fecha));

    let htmlPendientes = '';
    let htmlCompletadas = '';

    todasLasVisitas.forEach(fila => {
        let entregaHTML = fila.entrega && fila.estado === 'pendiente' ? `<span class="limite-entrega"><i class="fa-solid fa-truck-fast"></i> Límite: ${new Date(fila.entrega+'T00:00:00').toLocaleDateString('es-AR')}</span>` : '';
        let estadoHTML = `<span class="badge ${fila.estado==='pendiente'?'badge-pendiente':'badge-completado'}" onclick="window.cambiarEstadoVisita('${fila.medicoId}', ${fila.idxReal})" title="Tocar para cambiar">${fila.estado}</span>`;

        let linkGoogleCalendar = '';
        if (fila.entrega && fila.estado === 'pendiente') {
            const tituloCal = encodeURIComponent(`TESTA: Entrega ${fila.medicoNombre}`);
            const detalleCal = encodeURIComponent(`Inst: ${fila.institucion}\nPedido: ${fila.pedido}`);
            const fechaInicio = fila.entrega.replace(/-/g, '');
            let fechaObj = new Date(fila.entrega + 'T00:00:00');
            fechaObj.setDate(fechaObj.getDate() + 1);
            const fechaFin = fechaObj.toISOString().split('T')[0].replace(/-/g, '');
            linkGoogleCalendar = `https://www.google.com/calendar/render?action=TEMPLATE&text=${tituloCal}&details=${detalleCal}&dates=${fechaInicio}/${fechaFin}&sf=true&output=xml`;
        }

        const filaHTML = `<tr>
            <td data-label="Médico"><span class="medico-name">${fila.medicoNombre}</span><br><span class="contacto-sub">${fila.contacto}</span></td>
            <td data-label="Institución">${fila.institucion}</td>
            <td data-label="Fecha"><span class="fecha-visita">${fila.fechaDisplay}</span></td>
            <td data-label="Detalle"><div class="pedido-text">${fila.pedido}</div></td>
            <td data-label="Estado">${estadoHTML} ${entregaHTML}</td>
            <td data-label="Acción">
                ${linkGoogleCalendar ? `<a href="${linkGoogleCalendar}" target="_blank" class="btn-icon" style="color:#4285F4;" title="Agendar"><i class="fa-solid fa-calendar-plus"></i></a>` : ''}
                <button class="btn-icon btn-delete" onclick="window.borrarVisita('${fila.medicoId}', ${fila.idxReal})" title="Borrar"><i class="fa-regular fa-trash-can"></i></button>
            </td>
        </tr>`;

        if (fila.estado === 'pendiente') htmlPendientes += filaHTML;
        else htmlCompletadas += filaHTML;
    });

    cuerpoPendientes.innerHTML = htmlPendientes !== '' ? htmlPendientes : `<tr><td colspan="6" class="row-empty"><i class="fa-solid fa-check"></i> ¡Excelente! No tenés visitas pendientes.</td></tr>`;
    cuerpoCompletadas.innerHTML = htmlCompletadas !== '' ? htmlCompletadas : `<tr><td colspan="6" class="row-empty">Aún no hay visitas completadas.</td></tr>`;

    document.getElementById('contador-clientes').innerText = listaMedicos.length;
    document.getElementById('stat-visitas').innerText = stats.v;
    document.getElementById('stat-pendientes').innerText = stats.p;
    document.getElementById('stat-completadas').innerText = stats.c;
}

// FUNCIONES DE ACCIÓN
window.borrarVisita = async (id, idx) => {
    if(confirm("¿Estás seguro de borrar esta visita?")) {
        try {
            const m = listaMedicos.find(x => x.id === id);
            const nuevas = [...m.visitas]; nuevas.splice(idx, 1);
            await updateDoc(doc(db, "clientes", id), { visitas: nuevas });
        } catch (error) { alert("Error al borrar. Comprobá tu conexión."); }
    }
};

window.cambiarEstadoVisita = async (id, idx) => {
    try {
        const m = listaMedicos.find(x => x.id === id);
        const vis = [...m.visitas];
        vis[idx].estado = vis[idx].estado === 'pendiente' ? 'completado' : 'pendiente';
        await updateDoc(doc(db, "clientes", id), { visitas: vis });
    } catch (error) { alert("Error al cambiar estado."); }
};

window.borrarClinica = async (id) => { 
    if(confirm("¿Borrar clínica?")) {
        try { await deleteDoc(doc(db, "instituciones", id)); } catch (e) { alert("Error al borrar."); }
    } 
};

// FORMULARIOS
document.getElementById('btn-nueva-visita-modal').onclick = () => {
    document.getElementById('form-nueva-visita').reset();
    document.getElementById('nv-fecha-visita').value = new Date().toISOString().split('T')[0];
    medicoPendienteDeGuardar = null; 
    document.getElementById('modal-nueva-visita').classList.add('active');
};

document.getElementById('form-nueva-visita').onsubmit = async (e) => {
    e.preventDefault();
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    btnSubmit.disabled = true; 
    btnSubmit.innerText = "Guardando...";

    const nombreMedico = document.getElementById('input-select-medico').value.trim();
    const nuevaV = {
        fecha: document.getElementById('nv-fecha-visita').value,
        entrega: document.getElementById('nv-fecha-entrega').value || null,
        estado: document.getElementById('nv-estado-visita').value,
        pedido: document.getElementById('nv-pedido-visita').value.trim()
    };
    
    try {
        const med = listaMedicos.find(m => m.nombre.trim().toLowerCase() === nombreMedico.toLowerCase());
        if (med) {
            await updateDoc(doc(db, "clientes", med.id), { visitas: [...(med.visitas || []), nuevaV] });
        } else if (medicoPendienteDeGuardar && medicoPendienteDeGuardar.nombre.toLowerCase() === nombreMedico.toLowerCase()) {
            medicoPendienteDeGuardar.visitas = [nuevaV];
            await addDoc(collection(db, "clientes"), medicoPendienteDeGuardar);
            medicoPendienteDeGuardar = null;
        } else {
            alert("El médico no existe. Hacé clic en el ícono '+' para agregarlo.");
            return;
        }
        document.getElementById('modal-nueva-visita').classList.remove('active');
    } catch (error) {
        alert("Hubo un error al guardar. Reintentá.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerText = "Guardar Registro de Visita";
    }
};

document.getElementById('btn-crear-medico-rapido').onclick = () => {
    document.getElementById('form-cliente').reset();
    document.getElementById('modal-nueva-visita').classList.remove('active');
    document.getElementById('modal-nuevo-cliente').classList.add('active');
};

document.getElementById('form-cliente').onsubmit = (e) => {
    e.preventDefault();
    medicoPendienteDeGuardar = {
        nombre: document.getElementById('nombre').value.trim(),
        institucion: document.getElementById('institucion').value.trim(),
        contacto: document.getElementById('contacto').value.trim(),
        direccion: document.getElementById('direccion').value.trim(),
        visitas: []
    };
    document.getElementById('modal-nuevo-cliente').classList.remove('active');
    document.getElementById('modal-nueva-visita').classList.add('active');
    document.getElementById('input-select-medico').value = medicoPendienteDeGuardar.nombre;
};

// GESTIÓN MÉDICOS
document.getElementById('btn-gestion-medicos').onclick = () => document.getElementById('modal-gestion-medicos').classList.add('active');

window.borrarMedicoPorCompleto = async (id) => { 
    if(confirm("¿Estás 100% seguro de borrar el médico y todo su historial?")) {
        try { await deleteDoc(doc(db, "clientes", id)); } catch(e) { alert("Error al borrar."); }
    } 
};

window.dibujarListaMedicosGestion = function() {
    const contenedor = document.getElementById('lista-medicos-gestion');
    if(!contenedor) return;
    contenedor.innerHTML = listaMedicos.map(m => `
        <div class="modern-list-item">
            <span><b>${m.nombre}</b><br><small>${m.institucion}</small></span>
            <div style="display: flex; gap: 8px;">
                <button class="btn-icon" onclick="window.prepararEdicionMedico('${m.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon btn-delete" onclick="window.borrarMedicoPorCompleto('${m.id}')" title="Borrar"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        </div>
    `).join('');
};

window.prepararEdicionMedico = (id) => {
    const m = listaMedicos.find(x => x.id === id);
    document.getElementById('edit-medico-id').value = m.id;
    document.getElementById('edit-medico-nombre').value = m.nombre;
    document.getElementById('edit-medico-institucion').value = m.institucion;
    document.getElementById('edit-medico-contacto').value = m.contacto || '';
    document.getElementById('edit-medico-direccion').value = m.direccion || '';
    document.getElementById('form-editar-medico').style.display = 'block';
};

document.getElementById('form-editar-medico').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
        const id = document.getElementById('edit-medico-id').value;
        await updateDoc(doc(db, "clientes", id), {
            nombre: document.getElementById('edit-medico-nombre').value.trim(),
            institucion: document.getElementById('edit-medico-institucion').value.trim(),
            contacto: document.getElementById('edit-medico-contacto').value.trim(),
            direccion: document.getElementById('edit-medico-direccion').value.trim()
        });
        document.getElementById('form-editar-medico').reset();
        document.getElementById('form-editar-medico').style.display = 'none';
    } catch (error) { alert("Error al actualizar."); } finally { btn.disabled = false; }
};

document.getElementById('btn-cancelar-edicion-medico').onclick = () => { document.getElementById('form-editar-medico').style.display = 'none'; };

document.getElementById('btn-borrar-todo').onclick = async () => {
    if(confirm("⚠️ ATENCIÓN: ¿Querés eliminar TODOS los registros?")) {
        const pass = prompt("Escribí BORRAR (en mayúsculas):");
        if(pass === 'BORRAR') {
            try {
                for (const m of listaMedicos) await deleteDoc(doc(db, "clientes", m.id));
                alert("Base de datos limpia.");
                document.getElementById('modal-gestion-medicos').classList.remove('active');
            } catch(e) { alert("Hubo un error al borrar los registros."); }
        }
    }
};

// CALENDARIO
window.dibujarCalendario = () => {
    const g = document.getElementById('cuadricula-calendario');
    g.innerHTML = ['D','L','M','X','J','V','S'].map(d => `<div style="text-align:center;font-weight:700;padding:10px;background:#f8fafc;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border-color);">${d}</div>`).join('');
    const hoy = new Date(), mes = hoy.getMonth(), anio = hoy.getFullYear();
    const pDia = new Date(anio, mes, 1).getDay(), dMes = new Date(anio, mes+1, 0).getDate();
    for(let i=0; i<pDia; i++) g.innerHTML += '<div class="cal-day" style="background:#f8fafc;"></div>';
    for(let d=1; d<=dMes; d++){
        const fStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let vts = '';
        listaMedicos.forEach(m => (m.visitas||[]).forEach(v => {
            if(v.fecha === fStr) vts += `<div class="cal-visit-badge" style="background:var(--testa-blue-tint);">${m.nombre}</div>`;
            if(v.entrega === fStr && v.estado === 'pendiente') vts += `<div class="cal-visit-badge" style="background:var(--red-tint);color:var(--red-alert);"><i class="fa-solid fa-truck-fast"></i> ${m.nombre}</div>`;
        }));
        g.innerHTML += `<div class="cal-day"><div class="cal-date-num">${d}</div>${vts}</div>`;
    }
};
document.getElementById('btn-calendario').onclick = () => { window.dibujarCalendario(); document.getElementById('modal-calendario').classList.add('active'); };

// BUSCADOR EN TIEMPO REAL
document.getElementById('buscador').oninput = (e) => {
    const f = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.testa-table tbody tr').forEach(r => {
        if(r.querySelector('.row-empty')) return; 
        r.style.display = r.innerText.toLowerCase().includes(f) ? '' : 'none';
    });
};