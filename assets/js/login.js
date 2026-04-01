import { app } from "./firebase-config.js";
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const auth = getAuth(app);

document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const errorMsg = document.getElementById('login-error');
    
    // Tomamos lo que el usuario escribió (ej: "contadora" o "mateotesta")
    let userStr = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;

    // LA MAGIA: Si no escribió un @, le pegamos el dominio de Testa automáticamente
    if (!userStr.includes('@')) {
        userStr = userStr + "@testa.com";
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    errorMsg.style.display = 'none';

    try {
        // Configuramos para que la sesión no se cierre sola
        await setPersistence(auth, browserLocalPersistence);
        
        // Iniciamos sesión en Firebase con el mail "armado" por nosotros
        await signInWithEmailAndPassword(auth, userStr, pass);
        
        // Si todo sale bien, al Index (el Guardián se encarga del resto)
        window.location.href = "index.html"; 

    } catch (error) {
        console.error("Error de login:", error);
        errorMsg.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = 'Ingresar al Sistema';
    }
});