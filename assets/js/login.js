import { app } from "./firebase-config.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const auth = getAuth(app);

document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const errorMsg = document.getElementById('login-error');
    
    let userStr = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;

    // LA TRAMPA NINJA: Si escribe "admin", nosotros mandamos "admin@testa.com"
    if (!userStr.includes('@')) {
        userStr = userStr + "@testa.com";
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    errorMsg.style.display = 'none';

    try {
        // Firebase chequea las credenciales
        const userCredential = await signInWithEmailAndPassword(auth, userStr, pass);
        const userEmail = userCredential.user.email;

        // Guardamos en la memoria del navegador quién entró
        if (userEmail.includes("contadora")) {
            localStorage.setItem("testa_rol", "contadora");
            // La mandamos derecho a su sección
            window.location.href = "pages/facturas-iva.html"; 
        } else {
            localStorage.setItem("testa_rol", "admin");
            // Vos vas al panel general
            window.location.href = "index.html";
        }

    } catch (error) {
        console.error(error);
        errorMsg.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = 'Ingresar al Sistema';
    }
});