import { app, db } from "./firebase-config.js";
import { collection, doc, setDoc, onSnapshot, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// Mapeo de nombres de archivos a nombres del Sidecar
const nombresModulos = {
    "index.html": "Visitas CRM",
    "presupuesto.html": "Expedientes",
    "generador-pdf.html": "Presupuestos",
    "ordenes-compra.html": "Órdenes de Compra",
    "facturas-iva.html": "Facturas IVA"
};

let userActual = null;

// RENDERIZAR TABLA CON ANCHO COMPLETO Y NOMBRES FORMATEADOS
onSnapshot(collection(db, "usuarios_permisos"), (snap) => {
    const tabla = document.getElementById('tabla-usuarios-activos');
    if(!tabla) return;
    tabla.innerHTML = '';
    
    snap.forEach(docSnap => {
        const u = docSnap.data();
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #f1f5f9";
        
        // Traducir los nombres de los archivos a los nombres del Sidecar
        const accesosLegibles = u.accesos ? u.accesos.map(file => nombresModulos[file] || file).join(', ') : 'Sin accesos';

        // ANCHOS FORZADOS AQUÍ (20%, 60%, 20%) para coincidir con el thead
        tr.innerHTML = `
            <td style="padding: 15px 10px; color: #1e293b; width: 20%; word-break: break-word;"><strong>${u.usuario}</strong></td>
            <td style="padding: 15px 10px; color: #475569; font-size: 13px; width: 60%; word-break: break-word;">${accesosLegibles}</td>
            <td style="padding: 15px 10px; text-align: right; width: 20%;">
                <button style="background:none; border:none; color:#1e293b; font-weight:600; cursor:pointer; font-size:14px;" onclick="window.abrirModalGestion('${u.usuario}')">
                    <i class="fa-solid fa-user-pen"></i> Editar / Ver
                </button>
            </td>`;
        tabla.appendChild(tr);
    });
});

window.abrirModalGestion = async (id) => {
    userActual = id;
    const docSnap = await getDoc(doc(db, "usuarios_permisos", id));
    if(!docSnap.exists()) return;
    
    const data = docSnap.data();
    document.getElementById('edit-titulo-user').innerText = `Gestionar: ${id}`;
    document.getElementById('edit-pass-usuario').value = data.pass_aux || "";
    
    const contenedor = document.getElementById('contenedor-checks-edit');
    contenedor.innerHTML = '';
    
    Object.keys(nombresModulos).forEach(file => {
        const checked = (data.accesos || []).includes(file) ? 'checked' : '';
        contenedor.innerHTML += `
            <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                <input type="checkbox" class="check-edit-permiso" value="${file}" ${checked}> ${nombresModulos[file]}
            </label>`;
    });
    
    document.getElementById('modal-editar-usuario').style.display = 'flex';
};

window.cerrarModalEditar = () => {
    document.getElementById('modal-editar-usuario').style.display = 'none';
};

window.copiarPass = () => {
    const input = document.getElementById('edit-pass-usuario');
    input.select();
    document.execCommand('copy');
    alert("Copiado!");
};

document.getElementById('btn-guardar-cambios')?.addEventListener('click', async () => {
    const nuevaPass = document.getElementById('edit-pass-usuario').value;
    let nuevosAccesos = [];
    document.querySelectorAll('.check-edit-permiso:checked').forEach(c => nuevosAccesos.push(c.value));
    
    await setDoc(doc(db, "usuarios_permisos", userActual), {
        pass_aux: nuevaPass,
        accesos: nuevosAccesos
    }, { merge: true });
    
    alert("¡Usuario actualizado!");
    window.cerrarModalEditar();
});

document.getElementById('btn-borrar-usuario-final')?.addEventListener('click', async () => {
    if(confirm(`¿Eliminar definitivamente a ${userActual}?`)) {
        await deleteDoc(doc(db, "usuarios_permisos", userActual));
        window.cerrarModalEditar();
    }
});
// EVENTO PARA CREAR NUEVO USUARIO
document.getElementById('form-nuevo-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const usuario = document.getElementById('admin-user').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    
    // Capturar los checkboxes de accesos
    let accesos = [];
    document.querySelectorAll('.check-acceso:checked').forEach(checkbox => {
        accesos.push(checkbox.value);
    });

    if (!usuario || !pass) {
        alert("Por favor, completa usuario y contraseña.");
        return;
    }

    try {
        // Guardar en Firestore usando el Nickname como ID del documento
        await setDoc(doc(db, "usuarios_permisos", usuario), {
            usuario: usuario,
            pass_aux: pass,
            accesos: accesos,
            fechaCreacion: new Date().toISOString()
        });

        alert(`¡Usuario ${usuario} creado con éxito!`);
        document.getElementById('form-nuevo-usuario').reset(); // Limpiar formulario
    } catch (error) {
        console.error("Error al crear usuario:", error);
        alert("Error al guardar en Firebase. Revisa la consola.");
    }
});
// ESCUCHAR EL FORMULARIO DE CREACIÓN
document.getElementById('form-nuevo-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const usuario = document.getElementById('admin-user').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    
    // Capturar los checkboxes de accesos seleccionados
    let accesos = [];
    document.querySelectorAll('.check-acceso:checked').forEach(checkbox => {
        accesos.push(checkbox.value);
    });

    if (!usuario || !pass) {
        alert("Completar usuario y contraseña");
        return;
    }

    try {
        // Guardar en la colección 'usuarios_permisos'
        await setDoc(doc(db, "usuarios_permisos", usuario), {
            usuario: usuario,
            pass_aux: pass,
            accesos: accesos
        });

        alert(`¡Usuario ${usuario} creado con éxito!`);
        document.getElementById('form-nuevo-usuario').reset(); 
    } catch (error) {
        console.error("Error al guardar en Firebase:", error);
        alert("Error de Firebase: " + error.message);
    }
});