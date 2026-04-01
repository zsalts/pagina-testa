import { app, db } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, doc, setDoc, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// El Truco Ninja: Creamos una app secundaria para no desloguear al admin
const appSecundaria = initializeApp(app.options, "Secundaria");
const authSecundario = getAuth(appSecundaria);

// 1. CREAR USUARIO Y GUARDAR PERMISOS
document.getElementById('form-nuevo-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';

    const userLimpio = document.getElementById('admin-user').value.trim().toLowerCase();
    const emailFalso = userLimpio + "@testa.com";
    const pass = document.getElementById('admin-pass').value;

    // Juntamos todos los checkbox que el admin marcó
    let modulosPermitidos = [];
    document.querySelectorAll('.check-acceso:checked').forEach(chk => {
        modulosPermitidos.push(chk.value);
    });

    if(modulosPermitidos.length === 0) {
        alert("Dale al menos 1 permiso de acceso para que pueda hacer algo.");
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-check"></i> Crear Cuenta y Dar Permisos';
        return;
    }

    try {
        // A) Creamos el usuario en la App Secundaria
        await createUserWithEmailAndPassword(authSecundario, emailFalso, pass);
        await signOut(authSecundario); // Cerramos esa sesión fantasma

        // B) Guardamos sus permisos en la base de datos oficial
        await setDoc(doc(db, "usuarios_permisos", userLimpio), {
            usuario: userLimpio,
            email: emailFalso,
            accesos: modulosPermitidos,
            creadoEn: new Date().toISOString()
        });

        alert("¡Usuario creado y permisos asignados con éxito!");
        e.target.reset();

    } catch (error) {
        console.error(error);
        if(error.code === 'auth/email-already-in-use') alert("Ese nombre de usuario ya existe.");
        else alert("Error al crear usuario: " + error.message);
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-check"></i> Crear Cuenta y Dar Permisos';
    }
});

// 2. LEER USUARIOS CREADOS
onSnapshot(collection(db, "usuarios_permisos"), (snap) => {
    const tabla = document.getElementById('tabla-usuarios-activos');
    if(!tabla) return;
    tabla.innerHTML = '';

    const usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if(usuarios.length === 0) {
        tabla.innerHTML = '<tr><td colspan="3" style="text-align: center;">Solo estás vos como administrador.</td></tr>';
        return;
    }

    usuarios.forEach(u => {
        // Hacemos que los nombres de los HTML se vean lindos
        let badges = u.accesos.map(acc => {
            let nombreLindo = acc.replace('.html', '').replace('index', 'Visitas').toUpperCase();
            return `<span style="background: #e2e8f0; color: #475569; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-right: 5px; display: inline-block; margin-bottom: 4px;">${nombreLindo}</span>`;
        }).join('');

        tabla.innerHTML += `
            <tr>
                <td style="font-weight: bold; color: var(--testa-blue-dark);"><i class="fa-solid fa-user" style="color: #cbd5e1; margin-right: 5px;"></i> ${u.usuario}</td>
                <td>${badges}</td>
                <td><button class="btn-icon btn-delete" onclick="window.borrarPermiso('${u.id}')" title="Revocar Acceso"><i class="fa-regular fa-trash-can"></i></button></td>
            </tr>
        `;
    });
});

window.borrarPermiso = async (id) => {
    if(confirm("Si borrás este registro, el usuario no podrá acceder a NADA. ¿Confirmás? (Para borrarlo del todo tenés que ir a Firebase Auth)")) {
        await deleteDoc(doc(db, "usuarios_permisos", id));
    }
};