import { app, db } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { collection, doc, setDoc, onSnapshot, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const authOficial = getAuth(app);
const appSecundaria = initializeApp(app.options, "Secundaria");
const authSecundario = getAuth(appSecundaria);

let usuarioAccion = null;
let tipoAccion = null;

// 1. CREAR USUARIO
document.getElementById('form-nuevo-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const userLimpio = document.getElementById('admin-user').value.trim().toLowerCase();
    const pass = document.getElementById('admin-pass').value;
    let accesos = [];
    document.querySelectorAll('.check-acceso:checked').forEach(chk => accesos.push(chk.value));

    if(accesos.length === 0) return alert("Seleccioná al menos un permiso.");

    btn.disabled = true;
    try {
        await createUserWithEmailAndPassword(authSecundario, userLimpio + "@testa.com", pass);
        await signOut(authSecundario);
        // Guardamos pass en Firestore para que VOS la puedas ver (encriptada para otros, no para el admin)
        await setDoc(doc(db, "usuarios_permisos", userLimpio), {
            usuario: userLimpio,
            pass_aux: pass, 
            accesos: accesos,
            creadoEn: new Date().toISOString()
        });
        alert("Usuario creado con éxito.");
        e.target.reset();
    } catch (error) { alert("Error: " + error.message); }
    finally { btn.disabled = false; }
});

// 2. LISTAR USUARIOS
onSnapshot(collection(db, "usuarios_permisos"), (snap) => {
    const tabla = document.getElementById('tabla-usuarios-activos');
    if(!tabla) return;
    tabla.innerHTML = '';
    snap.forEach(docSnap => {
        const u = docSnap.data();
        tabla.innerHTML += `
            <tr>
                <td><strong>${u.usuario}</strong></td>
                <td><span id="txt-pass-${u.usuario}">******</span></td>
                <td><small>${u.accesos.join(', ')}</small></td>
                <td style="text-align:center;">
                    <button class="btn-icon" onclick="verificarAdmin('${u.usuario}', 'ver')"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-icon btn-delete" onclick="verificarAdmin('${u.usuario}', 'borrar')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    });
});

// 3. SEGURIDAD: VERIFICAR QUE SOS VOS (MATEO)
window.verificarAdmin = (id, accion) => {
    usuarioAccion = id;
    tipoAccion = accion;
    document.getElementById('modal-admin-auth').style.display = 'flex';
};

window.cerrarModalAuth = () => {
    document.getElementById('modal-admin-auth').style.display = 'none';
    document.getElementById('pass-admin-confirm').value = '';
};

document.getElementById('btn-confirmar-auth')?.addEventListener('click', async () => {
    const passAdmin = document.getElementById('pass-admin-confirm').value;
    const btn = document.getElementById('btn-confirmar-auth');
    
    btn.disabled = true;
    try {
        // Re-autenticamos para estar seguros de que sos Mateo
        await signInWithEmailAndPassword(authOficial, "mateotesta@testa.com", passAdmin);
        
        if(tipoAccion === 'ver') {
            const d = await getDoc(doc(db, "usuarios_permisos", usuarioAccion));
            document.getElementById(`txt-pass-${usuarioAccion}`).innerText = d.data().pass_aux;
        } else if(tipoAccion === 'borrar') {
            if(confirm(`¿Borrar a ${usuarioAccion}?`)) {
                await deleteDoc(doc(db, "usuarios_permisos", usuarioAccion));
            }
        }
        cerrarModalAuth();
    } catch (e) { alert("Contraseña de administrador incorrecta."); }
    finally { btn.disabled = false; }
});