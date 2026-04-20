// 1. IMPORTACIONES (Agregamos firebaseConfig, initializeApp y signOut)
import { app, db, firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { collection, doc, setDoc, onSnapshot, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

// 2. INICIALIZACIÓN DE AUTH (Tus dos guardias)
const authPrincipal = getAuth(app); // Tu sesión de administrador que NO se toca

// El clon para crear usuarios por debajo sin molestarte
const appClon = initializeApp(firebaseConfig, "AppClon_Testa");
const authClon = getAuth(appClon); 

// Mapeo de nombres de archivos a nombres del Sidecar
const nombresModulos = {
    "index.html": "Visitas CRM",
    "presupuesto.html": "Expedientes",
    "generador-pdf.html": "Presupuestos",
    "catalogo.html": "Catálogo",
    "folletos.html": "Folletos",
    "ordenes-compra.html": "Órdenes de Compra",
    "facturas-iva.html": "Facturas IVA"
};

let userActual = null;

// 3. RENDERIZAR TABLA CON ANCHO COMPLETO Y NOMBRES FORMATEADOS
onSnapshot(collection(db, "usuarios_permisos"), (snap) => {
    const tabla = document.getElementById('tabla-usuarios-activos');
    if(!tabla) return;
    tabla.innerHTML = '';
    
    snap.forEach(docSnap => {
        const u = docSnap.data();
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid #f1f5f9";
        
        const accesosLegibles = u.accesos ? u.accesos.map(file => nombresModulos[file] || file).join(', ') : 'Sin accesos';

        tr.innerHTML = `
            <td style="padding: 15px 10px; color: #1e293b; width: 20%; word-break: break-word;"><strong>${u.usuario || docSnap.id}</strong></td>
            <td style="padding: 15px 10px; color: #475569; font-size: 13px; width: 60%; word-break: break-word;">${accesosLegibles}</td>
            <td style="padding: 15px 10px; text-align: right; width: 20%;">
                <button type="button" style="background:none; border:none; color:#1e293b; font-weight:600; cursor:pointer; font-size:14px;" onclick="window.abrirModalGestion('${docSnap.id}')">
                    <i class="fa-solid fa-user-pen"></i> Editar / Ver
                </button>
            </td>`;
        tabla.appendChild(tr);
    });
});

// 4. LÓGICA DEL MODAL
window.abrirModalGestion = async (id) => {
    userActual = id;
    const docSnap = await getDoc(doc(db, "usuarios_permisos", id));
    if(!docSnap.exists()) return;
    
    const data = docSnap.data();
    document.getElementById('edit-titulo-user').innerText = `Gestionar: ${data.usuario || id}`;
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

// 5. ACTUALIZAR PERMISOS
document.getElementById('btn-guardar-cambios')?.addEventListener('click', async () => {
    const nuevaPass = document.getElementById('edit-pass-usuario').value;
    let nuevosAccesos = [];
    document.querySelectorAll('.check-edit-permiso:checked').forEach(c => nuevosAccesos.push(c.value));
    
    try {
        await setDoc(doc(db, "usuarios_permisos", userActual), {
            pass_aux: nuevaPass,
            accesos: nuevosAccesos
        }, { merge: true });
        
        alert("¡Permisos actualizados!");
        window.cerrarModalEditar();
    } catch (error) {
        console.error("Error al actualizar:", error);
        alert("Hubo un error al actualizar el usuario.");
    }
});

// 6. BORRAR USUARIO
document.getElementById('btn-borrar-usuario-final')?.addEventListener('click', async () => {
    if(confirm(`¿Eliminar definitivamente este usuario de los permisos?`)) {
        try {
            await deleteDoc(doc(db, "usuarios_permisos", userActual));
            alert("Usuario eliminado correctamente.");
            window.cerrarModalEditar();
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("Error al eliminar el usuario.");
        }
    }
});

// 7. CREAR USUARIO NUEVO (AHORA USA EL CLON)
document.getElementById('form-nuevo-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const email = document.getElementById('admin-user').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    
    let accesos = [];
    document.querySelectorAll('.check-acceso:checked').forEach(checkbox => {
        accesos.push(checkbox.value);
    });

    if (!email.includes('@')) {
        alert("Por favor, ingresá un correo electrónico válido (ej: nombre@empresa.com).");
        return;
    }

    if (pass.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    try {
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        if(btnSubmit) btnSubmit.disabled = true;

        // A. Creamos el usuario en Authentication usando authClon
        const userCredential = await createUserWithEmailAndPassword(authClon, email, pass);
        const uid = userCredential.user.uid;

        // B. Apagamos el clon rápido para que no cambie tu sesión
        await signOut(authClon);

        // C. Lo guardamos en Firestore (tu libreta de permisos)
        await setDoc(doc(db, "usuarios_permisos", email), {
            usuario: email, 
            correo_auth: email, 
            uid: uid,
            pass_aux: pass,            
            accesos: accesos,
            fechaCreacion: new Date().toISOString()
        });

        alert(`¡Éxito!\nSe creó el usuario: ${email}`);
        document.getElementById('form-nuevo-usuario').reset(); 

    } catch (error) {
        console.error("Error al crear:", error);
        if (error.code === 'auth/email-already-in-use') {
            alert("Ese correo ya existe en la base de datos. Intentá con otro.");
        } else if (error.code === 'auth/invalid-email') {
            alert("El formato del correo no es válido.");
        } else {
            alert("Hubo un error: " + error.message);
        }
    } finally {
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        if(btnSubmit) btnSubmit.disabled = false;
    }
});