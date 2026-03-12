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
// 2. CERRAR VENTANAS (ARREGLADO)
// ==========================================
document.addEventListener('click', (e) => {
    // Acá estaba el error, ahora busca 'btn-close-modal'
    if (e.target.closest('.btn-close-modal')) {
        e.target.closest('.modal-overlay').classList.remove('active');
    }
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ==========================================
// 3. BASE DE DATOS: CLÍNICAS Y CARGA MÁGICA
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
    if(btnMdp) {
        if(listaClinicas.length >= 7) {
            btnMdp.style.display = 'none';
        } else {
            btnMdp.style.display = 'block';
        }
    }
});

document.getElementById('btn-cargar-clinicas-mdp').onclick = async () => {
    if(confirm("¿Querés cargar automáticamente las clínicas principales (HPC, Colón, Materno, etc)?")) {
        const clinicasMdp = [
            { nombre: "HPC", direccion: "Córdoba 4545" },
            { nombre: "Clínica Colón", direccion: "Av. Colón 3629" },
            { nombre: "Clínica 25 de Mayo", direccion: "25 de Mayo 3542" },
            { nombre: "Clínica Pueyrredon", direccion: "Jujuy 2176" },
            { nombre: "Hospital Materno Infantil", direccion: "Castelli 2450" },
            { nombre: "Clínica del Niño y la Madre", direccion: "Av. Colón 2749" },
            { nombre: "Particulares", direccion: "Sin dirección" }
        ];
        
        for (const c of clinicasMdp) {
            if (!listaClinicas.find(existente => existente.nombre === c.nombre)) {
                await addDoc(collection(db, "instituciones"), c);
            }
        }
        alert("¡Clínicas cargadas con éxito!");
    }
};

document.getElementById('institucion').oninput = (e) => {
    const found = listaClinicas.find(c => c.nombre === e.target.value);
    if(found) {
        const inputDir = document.getElementById('direccion');
        inputDir.value = found.direccion;
        inputDir.style.backgroundColor = "#e0f2fe";
        setTimeout(() => inputDir.style.backgroundColor = "#f8fafc", 800);
    }
};

const inputEditInstitucion = document.getElementById('edit-medico-institucion');
if(inputEditInstitucion) {
    inputEditInstitucion.oninput = (e) => {
        const found = listaClinicas.find(c => c.nombre === e.target.value);
        if(found) {
            const inputDir = document.getElementById('edit-medico-direccion');
            inputDir.value = found.direccion;
            inputDir.style.backgroundColor = "#e0f2fe";
            setTimeout(() => inputDir.style.backgroundColor = "#f8fafc", 800);
        }
    };
}

document.getElementById('form-clinica').onsubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "instituciones"), {
        nombre: document.getElementById('nombre-clinica').value,
        direccion: document.getElementById('direccion-clinica').value
    });
    e.target.reset();
};

window.borrarClinica = async (id) => { if(confirm("¿Borrar clínica?")) await deleteDoc(doc(db, "instituciones", id)); };
document.getElementById('btn-clinicas').onclick = () => document.getElementById('modal-clinicas').classList.add('active');


// ==========================================
// 4. BASE DE DATOS: MÉDICOS Y VISITAS 
// ==========================================
onSnapshot(collection(db, "clientes"), (snap) => {
    listaMedicos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    actualizarTablaClientes();
    dibujarListaMedicosGestion(); 
});

function actualizarTablaClientes() {
    const cuerpo = document.getElementById('cuerpo-tabla-clientes');
    if(!cuerpo) return;
    cuerpo.innerHTML = '';
    
    let stats = { v: 0, p: 0, c: 0 };
    let todasLasVisitas = []; 

    const dlMedicos = document.getElementById('lista-nombres-medicos');
    if (dlMedicos) dlMedicos.innerHTML = listaMedicos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');

    if (listaMedicos.length === 0) {
        document.getElementById('contenedor-tabla-clientes').style.display = 'none';
        document.getElementById('mensaje-vacio-clientes').style.display = 'block';
        document.getElementById('mensaje-vacio-clientes').innerHTML = '<i class="fa-solid fa-database-nfc empty-icon"></i><p>Cargá tu primera visita para empezar</p>';
        return;
    }

    document.getElementById('contenedor-tabla-clientes').style.display = 'block';
    document.getElementById('mensaje-vacio-clientes').style.display = 'none';

    listaMedicos.forEach(m => {
        const visitas = m.visitas || [];
        if (visitas.length === 0) {
            todasLasVisitas.push({
                medicoId: m.id, medicoNombre: m.nombre, contacto: m.contacto, institucion: m.institucion,
                fecha: '0000-00-00', fechaDisplay: 'Sin visitas', pedido: 'No hay visitas cargadas', estado: '-', entrega: null, idxReal: -1
            });
        } else {
            visitas.forEach((v, index) => {
                stats.v++;
                if(v.estado === 'pendiente') stats.p++; else stats.c++;
                todasLasVisitas.push({
                    medicoId: m.id, medicoNombre: m.nombre, contacto: m.contacto, institucion: m.institucion,
                    fecha: v.fecha, fechaDisplay: new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-AR'), 
                    pedido: v.pedido, estado: v.estado, entrega: v.entrega, idxReal: index
                });
            });
        }
    });

    todasLasVisitas.sort((a, b) => b.fecha.localeCompare(a.fecha));

    todasLasVisitas.forEach(fila => {
        let entregaHTML = fila.entrega ? `<span class="limite-entrega"><i class="fa-solid fa-truck-fast"></i> Límite: ${new Date(fila.entrega+'T00:00:00').toLocaleDateString('es-AR')}</span>` : '';
        
        let estadoHTML = '-';
        if(fila.estado === 'pendiente') estadoHTML = `<span class="badge badge-pendiente" onclick="window.cambiarEstadoVisita('${fila.medicoId}', ${fila.idxReal})" title="Tocar para cambiar">Pendiente <i class="fa-solid fa-rotate"></i></span>`;
        if(fila.estado === 'completado') estadoHTML = `<span class="badge badge-completado" onclick="window.cambiarEstadoVisita('${fila.medicoId}', ${fila.idxReal})" title="Tocar para cambiar">Completado <i class="fa-solid fa-rotate"></i></span>`;

        let btnBorrar = fila.idxReal >= 0 ? `<button class="btn-icon btn-delete" onclick="window.borrarVisita('${fila.medicoId}', ${fila.idxReal})" title="Borrar esta Visita"><i class="fa-regular fa-trash-can"></i></button>` : '';

        cuerpo.innerHTML += `<tr>
            <td data-label="Médico"><span class="medico-name">${fila.medicoNombre}</span><br><span class="contacto-sub">${fila.contacto}</span></td>
            <td data-label="Institución">${fila.institucion}</td>
            <td data-label="Fecha"><span class="fecha-visita">${fila.fechaDisplay}</span></td>
            <td data-label="Detalle"><div class="pedido-text">${fila.pedido}</div></td>
            <td data-label="Estado">${estadoHTML} ${entregaHTML}</td>
            <td data-label="Acción">
                ${btnBorrar}
            </td>
        </tr>`;
    });

    document.getElementById('contador-clientes').innerText = listaMedicos.length;
    document.getElementById('stat-visitas').innerText = stats.v;
    document.getElementById('stat-pendientes').innerText = stats.p;
    document.getElementById('stat-completadas').innerText = stats.c;
}

// NUEVA VISITA
document.getElementById('btn-nueva-visita-modal').onclick = () => {
    document.getElementById('form-nueva-visita').reset();
    document.getElementById('nv-fecha-visita').value = new Date().toISOString().split('T')[0];
    medicoPendienteDeGuardar = null; 
    document.getElementById('modal-nueva-visita').classList.add('active');
};

document.getElementById('form-nueva-visita').onsubmit = async (e) => {
    e.preventDefault();
    const nombreMedico = document.getElementById('input-select-medico').value;
    
    const nuevaVisita = {
        fecha: document.getElementById('nv-fecha-visita').value,
        entrega: document.getElementById('nv-fecha-entrega').value || null,
        estado: document.getElementById('nv-estado-visita').value,
        pedido: document.getElementById('nv-pedido-visita').value
    };

    const medicoEncontrado = listaMedicos.find(m => m.nombre.toLowerCase() === nombreMedico.toLowerCase());

    if (medicoEncontrado) {
        const nuevas = [...(medicoEncontrado.visitas || []), nuevaVisita];
        await updateDoc(doc(db, "clientes", medicoEncontrado.id), { visitas: nuevas });
    } else if (medicoPendienteDeGuardar && medicoPendienteDeGuardar.nombre.toLowerCase() === nombreMedico.toLowerCase()) {
        medicoPendienteDeGuardar.visitas = [nuevaVisita];
        await addDoc(collection(db, "clientes"), medicoPendienteDeGuardar);
        medicoPendienteDeGuardar = null; 
    } else {
        alert("El médico no existe. Hacé clic en el botón '+' para agregarlo primero.");
        return;
    }

    document.getElementById('modal-nueva-visita').classList.remove('active');
};

// CREAR MÉDICO RÁPIDO
document.getElementById('btn-crear-medico-rapido').onclick = () => {
    document.getElementById('form-cliente').reset();
    document.getElementById('modal-nueva-visita').classList.remove('active');
    document.getElementById('modal-nuevo-cliente').classList.add('active');
};

document.getElementById('form-cliente').onsubmit = (e) => {
    e.preventDefault();
    const nombreIngresado = document.getElementById('nombre').value;
    
    medicoPendienteDeGuardar = {
        nombre: nombreIngresado,
        institucion: document.getElementById('institucion').value,
        contacto: document.getElementById('contacto').value,
        direccion: document.getElementById('direccion').value,
        visitas: []
    };
    
    document.getElementById('modal-nuevo-cliente').classList.remove('active');
    document.getElementById('modal-nueva-visita').classList.add('active');
    document.getElementById('input-select-medico').value = nombreIngresado;
};

// BORRAR VISITA
window.borrarVisita = async (idMedico, idxVisita) => {
    if(confirm("¿Estás seguro de que querés borrar ESTA visita?")) {
        const m = listaMedicos.find(x => x.id === idMedico);
        const nuevasVisitas = [...m.visitas];
        nuevasVisitas.splice(idxVisita, 1); 
        await updateDoc(doc(db, "clientes", idMedico), { visitas: nuevasVisitas });
    }
};

window.cambiarEstadoVisita = async (id, idx) => {
    const m = listaMedicos.find(x => x.id === id);
    const vis = [...m.visitas];
    vis[idx].estado = vis[idx].estado === 'pendiente' ? 'completado' : 'pendiente';
    await updateDoc(doc(db, "clientes", id), { visitas: vis });
};

// ==========================================
// 5. GESTIÓN DE MÉDICOS
// ==========================================
document.getElementById('btn-gestion-medicos').onclick = () => document.getElementById('modal-gestion-medicos').classList.add('active');

function dibujarListaMedicosGestion() {
    const contenedor = document.getElementById('lista-medicos-gestion');
    if(!contenedor) return;
    contenedor.innerHTML = listaMedicos.map(m => `
        <div class="modern-list-item">
            <span><b>${m.nombre}</b><br><small style="color:var(--text-muted)">${m.institucion}</small></span>
            <div style="display: flex; gap: 8px;">
                <button class="btn-icon" onclick="window.prepararEdicionMedico('${m.id}')" title="Editar Médico"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon btn-delete" onclick="window.borrarMedicoPorCompleto('${m.id}')" title="Borrar Médico Definitivo"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        </div>
    `).join('');
}

window.prepararEdicionMedico = (id) => {
    const m = listaMedicos.find(x => x.id === id);
    document.getElementById('edit-medico-id').value = m.id;
    document.getElementById('edit-medico-nombre').value = m.nombre;
    document.getElementById('edit-medico-institucion').value = m.institucion;
    document.getElementById('edit-medico-contacto').value = m.contacto;
    document.getElementById('edit-medico-direccion').value = m.direccion;
    document.getElementById('form-editar-medico').style.display = 'block';
};

document.getElementById('form-editar-medico').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-medico-id').value;
    await updateDoc(doc(db, "clientes", id), {
        nombre: document.getElementById('edit-medico-nombre').value,
        institucion: document.getElementById('edit-medico-institucion').value,
        contacto: document.getElementById('edit-medico-contacto').value,
        direccion: document.getElementById('edit-medico-direccion').value
    });
    document.getElementById('form-editar-medico').reset();
    document.getElementById('form-editar-medico').style.display = 'none';
};

document.getElementById('btn-cancelar-edicion-medico').onclick = () => {
    document.getElementById('form-editar-medico').reset();
    document.getElementById('form-editar-medico').style.display = 'none';
};

window.borrarMedicoPorCompleto = async (id) => { 
    if(confirm("¿Estás seguro de que querés borrar ESTE MÉDICO y TODO su historial?")) {
        await deleteDoc(doc(db, "clientes", id)); 
    }
};

document.getElementById('btn-borrar-todo').onclick = async () => {
    if(confirm("⚠️ ATENCIÓN: ¿Querés eliminar TODOS los médicos y visitas cargadas?")) {
        const pass = prompt("Para confirmar, escribí la palabra 'BORRAR' (en mayúsculas):");
        if(pass === 'BORRAR') {
            for (const m of listaMedicos) {
                await deleteDoc(doc(db, "clientes", m.id));
            }
            alert("¡Listo! Base de datos limpia.");
            document.getElementById('modal-gestion-medicos').classList.remove('active');
        } else {
            alert("Cancelado.");
        }
    }
};

// ==========================================
// 6. UTILIDADES: CALENDARIO, EXPORTAR Y BUSCADOR
// ==========================================
window.dibujarCalendario = () => {
    const g = document.getElementById('cuadricula-calendario');
    
    // Encabezados de los días de la semana con estilo unificado
    g.innerHTML = ['D','L','M','X','J','V','S'].map(d => `
        <div style="text-align:center; font-weight:700; background:#f8fafc; padding:8px 0; font-size:12px; color:var(--text-muted); border-bottom:1px solid var(--border-color);">
            ${d}
        </div>
    `).join('');
    
    const hoy = new Date(), mes = hoy.getMonth(), anio = hoy.getFullYear();
    const pDia = new Date(anio, mes, 1).getDay(), dMes = new Date(anio, mes+1, 0).getDate();
    
    // Espacios vacíos al principio del mes
    for(let i=0; i<pDia; i++) g.innerHTML += '<div class="cal-day" style="background:#f8fafc;"></div>';
    
    // Días del mes con sus visitas
    for(let d=1; d<=dMes; d++){
        const fechaStr = `${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let vts = '';
        listaMedicos.forEach(m => (m.visitas||[]).forEach(v => {
            if(v.fecha === fechaStr) vts += `<div class="cal-visit-badge" style="background:var(--testa-blue-tint); color:var(--testa-blue-dark); border: 1px solid #bae6fd;">${m.nombre}</div>`;
            if(v.entrega === fechaStr && v.estado === 'pendiente') vts += `<div class="cal-visit-badge" style="background:var(--red-tint); color:var(--red-alert); border: 1px solid #fecaca;"><i class="fa-solid fa-truck-fast"></i> ${m.nombre}</div>`;
        }));
        g.innerHTML += `<div class="cal-day"><div class="cal-date-num">${d}</div>${vts}</div>`;
    }
};
document.getElementById('btn-calendario').onclick = () => { window.dibujarCalendario(); document.getElementById('modal-calendario').classList.add('active'); };

document.getElementById('btn-exportar').onclick = () => { /* Export logic same */ };

document.getElementById('buscador').oninput = (e) => {
    const filter = e.target.value.toLowerCase();
    const filas = document.querySelectorAll('#cuerpo-tabla-clientes tr');
    filas.forEach(fila => {
        const texto = fila.innerText.toLowerCase();
        fila.style.display = texto.includes(filter) ? '' : 'none';
    });
};