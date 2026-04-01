import { app } from "./firebase-config.js";
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const auth = getAuth(app);

document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const errorMsg = document.getElementById('login-error');
    
    let userStr = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;

    if (!userStr.includes('@')) {
        userStr = userStr + "@testa.com";
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    errorMsg.style.display = 'none';

    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, userStr, pass);
        
        // Mandamos a todos al Index. Si es empleado, el Guardián lo va a re-dirigir a su lugar en milisegundos.
        window.location.href = "index.html"; 

    } catch (error) {
        console.error(error);
        errorMsg.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = 'Ingresar al Sistema';
    }
});