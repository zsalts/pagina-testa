import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

export let listaMedicos = [];

// Escuchar cambios en la base de datos
onSnapshot(collection(db, "clientes"), (snap) => {
    listaMedicos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    actualizarTablaClientes();
});

function actualizarTablaClientes() {
    const cuerpo = document.getElementById('cuerpo-tabla-clientes');
    if(!cuerpo) return;
    cuerpo.innerHTML = '';
    let stats = { v: 0, p: 0, c: 0 };

    if (listaMedicos.length > 0) {
        document.getElementById('contenedor-tabla-clientes').style.display = 'block';
        document.getElementById('mensaje-vacio-clientes').style.display = 'none';
    } else {
        document.getElementById('contenedor-tabla-clientes').style.display = 'none';
        document.getElementById('mensaje-vacio-clientes').style.display = 'block';
        document.getElementById('mensaje-vacio-clientes').innerText = "Agregá tu primer cliente para empezar";
    }

    listaMedicos.forEach(m => {
        let ultV = "Sin visitas", pCount = 0;
        const visitas = m.visitas || [];
        if (visitas.length > 0) {
            stats.v += visitas.length;
            ultV = new Date(visitas[visitas.length-1].fecha + 'T00:00:00').toLocaleDateString('es-AR');
            visitas.forEach(v => { if(v.estado==='pendiente') {pCount++; stats.p++;} else stats.c++; });
        }
        
        // ACÁ ESTÁ EL CAMBIO PARA EL CELULAR: Los 'data-label' le avisan al CSS qué título poner
        cuerpo.innerHTML += `<tr>
            <td data-label="Médico"><b>${m.nombre}</b><br><small>${m.contacto}</small></td>
            <td data-label="Institución">${m.institucion}</td>
            <td data-label="Última Visita">${ultV}</td>
            <td data-label="Estado Pedidos">${pCount > 0 ? `<span class="badge badge-pendiente">${pCount} Pendiente</span>` : `<span class="badge badge-completado">Al día</span>`}</td>
            <td data-label="Acciones">
                <button class="btn-icon" onclick="window.abrirVisitas('${m.id}')"><i class="fa-regular fa-folder-open"></i></button>
                <button class="btn-icon" onclick="window.borrarCliente('${m.id}')" style="color:red"><i class="fa-regular fa-trash-can"></i></button>
            </td>
        </tr>`;
    });

    document.getElementById('contador-clientes').innerText = listaMedicos.length;
    document.getElementById('stat-visitas').innerText = stats.v;
    document.getElementById('stat-pendientes').innerText = stats.p;
    document.getElementById('stat-completadas').innerText = stats.c;
}

// FUNCIONES GLOBALES PARA EL HTML
window.abrirVisitas = (id) => {
    const m = listaMedicos.find(x => x.id === id);
    document.getElementById('nombre-medico-visita').innerText = "Historial: " + m.nombre;
    document.getElementById('id-medico-actual').value = m.id;
    document.getElementById('fecha-visita').value = new Date().toISOString().split('T')[0];
    
    const h = document.getElementById('historial-visitas');
    const vis = m.visitas || [];
    h.innerHTML = vis.length ? [...vis].reverse().map((v, i) => `
        <div class="visita-card">
            <div class="visita-header">
                <b>${new Date(v.fecha+'T00:00:00').toLocaleDateString('es-AR')}</b>
                <span class="badge ${v.estado==='pendiente'?'badge-pendiente':'badge-completado'}" 
                      onclick="window.cambiarEstadoVisita('${m.id}', ${vis.length-1-i})">
                    ${v.estado} <i class="fa-solid fa-rotate"></i>
                </span>
            </div>
            <p>${v.pedido}</p>
        </div>
    `).join('') : '<p style="text-align:center;color:gray;">No hay visitas registradas.</p>';

    document.getElementById('modal-visitas').classList.add('active');
};

window.cambiarEstadoVisita = async (id, idx) => {
    const m = listaMedicos.find(x => x.id === id);
    const vis = [...m.visitas];
    vis[idx].estado = vis[idx].estado === 'pendiente' ? 'completado' : 'pendiente';
    await updateDoc(doc(db, "clientes", id), { visitas: vis });
    window.abrirVisitas(id);
};

window.borrarCliente = async (id) => { 
    if(confirm("¿Estás seguro de que querés borrar este médico y su historial?")) {
        await deleteDoc(doc(db, "clientes", id)); 
    }
};

// Guardar nueva visita
document.getElementById('form-visita').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('id-medico-actual').value;
    const m = listaMedicos.find(x => x.id === id);
    const nuevas = [...(m.visitas||[]), {
        fecha: document.getElementById('fecha-visita').value,
        estado: document.getElementById('estado-visita').value,
        pedido: document.getElementById('pedido-visita').value
    }];
    await updateDoc(doc(db, "clientes", id), { visitas: nuevas });
    document.getElementById('pedido-visita').value = '';
    window.abrirVisitas(id);
};

// Guardar nuevo médico
document.getElementById('form-cliente').onsubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "clientes"), {
        nombre: document.getElementById('nombre').value,
        institucion: document.getElementById('institucion').value,
        contacto: document.getElementById('contacto').value,
        direccion: document.getElementById('direccion').value,
        visitas: []
    });
    document.getElementById('modal-nuevo-cliente').classList.remove('active');
    e.target.reset();
};

document.getElementById('btn-nuevo').onclick = () => document.getElementById('modal-nuevo-cliente').classList.add('active');

// Calendario
window.dibujarCalendario = () => {
    const g = document.getElementById('cuadricula-calendario');
    g.innerHTML = ['D','L','M','X','J','V','S'].map(d => `<div style="text-align:center;font-weight:700">${d}</div>`).join('');
    const hoy = new Date(), mes = hoy.getMonth(), anio = hoy.getFullYear();
    const pDia = new Date(anio, mes, 1).getDay(), dMes = new Date(anio, mes+1, 0).getDate();
    for(let i=0; i<pDia; i++) g.innerHTML += '<div class="cal-day" style="border:none"></div>';
    for(let d=1; d<=dMes; d++){
        const fecha = `${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let vts = '';
        listaMedicos.forEach(m => (m.visitas||[]).forEach(v => {
            if(v.fecha === fecha) vts += `<div class="cal-visit-badge">${m.nombre}</div>`;
        }));
        g.innerHTML += `<div class="cal-day"><div class="cal-date-num">${d}</div>${vts}</div>`;
    }
};
document.getElementById('btn-calendario').onclick = () => { window.dibujarCalendario(); document.getElementById('modal-calendario').classList.add('active'); };

// Exportar CSV
document.getElementById('btn-exportar').onclick = () => {
    if(!listaMedicos.length) return alert("Nada que exportar");
    let csv = "\ufeffMédico,Institución,Contacto,Dirección,Ultima Visita\n";
    listaMedicos.forEach(m => {
        const uv = (m.visitas||[]).length ? m.visitas[m.visitas.length-1].fecha : '-';
        csv += `${m.nombre},${m.institucion},${m.contacto},${m.direccion},${uv}\n`;
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    link.download = "Lista_Clientes_Testa.csv";
    link.click();
};

// Buscador
document.getElementById('buscador').oninput = (e) => {
    const filter = e.target.value.toLowerCase();
    const filas = document.querySelectorAll('#cuerpo-tabla-clientes tr');
    filas.forEach(fila => {
        const texto = fila.innerText.toLowerCase();
        fila.style.display = texto.includes(filter) ? '' : 'none';
    });
};