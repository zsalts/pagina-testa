import { app } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

const auth = getAuth(app);

// Para saber si estamos en la carpeta principal o adentro de una subcarpeta
const enSubcarpeta = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/vistas/');
const rutaLogin = enSubcarpeta ? "../login.html" : "login.html";

// 1. CHEQUEAMOS SI HAY ALGUIEN LOGUEADO
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Si no hay usuario activo, ¡patada al login!
        window.location.href = rutaLogin;
    } else {
        // 2. REVISAMOS EL ROL DE QUIEN ENTRÓ
        const rol = localStorage.getItem("testa_rol");
        const urlActual = window.location.pathname;

        if (rol === "contadora") {
            // Si es la contadora y está intentando entrar a index.html o presupuestos...
            if (!urlActual.includes("facturas-iva.html")) {
                // La mandamos de vuelta a su cucha
                window.location.href = enSubcarpeta ? "facturas-iva.html" : "pages/facturas-iva.html"; 
            }
            
            // Ocultamos el resto del menú lateral (magia pura)
            const linksMenu = document.querySelectorAll('.sidebar-nav a');
            linksMenu.forEach(link => {
                if (!link.href.includes("facturas-iva.html")) {
                    link.style.display = "none";
                }
            });
        }
        
        // Ponemos el mail en la bolita del perfil para que quede pro
        const bolitaPerfil = document.querySelector('.user-profile-circle');
        if(bolitaPerfil) {
            bolitaPerfil.innerHTML = `<i class="fa-solid fa-user-check"></i>`;
            bolitaPerfil.title = user.email;
            bolitaPerfil.style.cursor = "pointer";
            // Le agregamos la función de cerrar sesión a la bolita
            bolitaPerfil.addEventListener('click', () => {
                if(confirm("¿Cerrar sesión en Testa CRM?")) {
                    signOut(auth).then(() => {
                        localStorage.removeItem("testa_rol");
                        window.location.href = rutaLogin;
                    });
                }
            });
        }
    }
});