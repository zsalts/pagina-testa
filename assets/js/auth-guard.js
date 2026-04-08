import { app, db } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const auth = getAuth(app);
const enSubcarpeta = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/vistas/');
const rutaLogin = enSubcarpeta ? "../login.html" : "login.html";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = rutaLogin;
    } else {
        const emailActivo = user.email;
        const nombreUsuarioLimpio = emailActivo.split('@')[0]; // Ej: "contadora"
        const urlActual = window.location.pathname;

        // EL MAESTRO ABSOLUTO (¡Vos, Mateo!)
        if (emailActivo === "mateotesta@testa.com") {
            // Te inyectamos el botón de administrador en el menú dinámicamente
            const nav = document.querySelector('.sidebar-nav');
            if (nav && !document.getElementById('link-admin')) {
                const rutaAdmin = enSubcarpeta ? "admin-usuarios.html" : "pages/admin-usuarios.html";
                nav.innerHTML += `<a href="${rutaAdmin}" id="link-admin" style="background: #1e293b; color: white; margin-top: 15px;"><i class="fa-solid fa-user-shield"></i> Admin Permisos</a>`;
            }
        } 
        // LOS MORTALES (Tus empleados)
        else {
            // Buscamos qué permisos le diste en Firestore usando el correo completo para que coincida
            const docPermisos = await getDoc(doc(db, "usuarios_permisos", emailActivo));
            
            if (docPermisos.exists()) {
                const accesosPermitidos = docPermisos.data().accesos;

                // 1. Ocultar los botones del menú que NO tiene permitidos
                const linksMenu = document.querySelectorAll('.sidebar-nav a');
                linksMenu.forEach(link => {
                    const linkArchivo = link.href.split('/').pop(); 
                    if (!accesosPermitidos.includes(linkArchivo) && linkArchivo !== '') {
                        link.style.display = "none";
                    }
                });

                // 2. Si está en una página prohibida, lo pateamos a la primera que tenga permitida
                const archivoActual = urlActual.split('/').pop() || "index.html"; 
                if (!accesosPermitidos.includes(archivoActual) && archivoActual !== "login.html") {
                    const primeraPagina = accesosPermitidos[0];
                    window.location.href = enSubcarpeta ? primeraPagina : `pages/${primeraPagina}`;
                }

            } else {
                // Si el usuario existe pero no tiene permisos guardados
                document.body.innerHTML = "<h1 style='text-align:center; margin-top:50px; font-family: sans-serif; color: #003b5c;'>No tenés accesos asignados. Hablá con la administración.</h1>";
                setTimeout(() => { signOut(auth); }, 3000);
            }
        }
        
        // La bolita de cerrar sesión
        const bolitaPerfil = document.querySelector('.user-profile-circle');
        if(bolitaPerfil) {
            bolitaPerfil.innerHTML = `<i class="fa-solid fa-power-off"></i>`;
            bolitaPerfil.title = "Cerrar sesión de " + emailActivo;
            bolitaPerfil.style.cursor = "pointer";
            bolitaPerfil.addEventListener('click', () => {
                if(confirm("¿Cerrar sesión de " + emailActivo + "?")) {
                    signOut(auth).then(() => { window.location.href = rutaLogin; });
                }
            });
        }
    }
});