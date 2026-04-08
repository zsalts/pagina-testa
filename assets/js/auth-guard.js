import { app, db } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// 1. OCULTAMOS LA PANTALLA COMPLETAMENTE (Evita que vean botones prohibidos por medio segundo)
document.documentElement.style.visibility = 'hidden';

const auth = getAuth(app);
const enSubcarpeta = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/vistas/');
const rutaLogin = enSubcarpeta ? "../login.html" : "login.html";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Si no está logueado y no está en el login, lo pateamos allá
        if (!window.location.pathname.includes('login.html')) {
            window.location.replace(rutaLogin);
        } else {
            // Si está en la pantalla de login, se la mostramos
            document.documentElement.style.visibility = '';
        }
    } else {
        const emailActivo = user.email;
        let urlActual = window.location.pathname;
        let archivoActual = urlActual.split('/').pop();
        if (archivoActual === "") archivoActual = "index.html";

        // Si el usuario ya se logueó pero intentó entrar al login.html, lo mandamos al sistema
        if (archivoActual === "login.html") {
            window.location.replace(enSubcarpeta ? "../index.html" : "index.html");
            return;
        }

        // EL MAESTRO ABSOLUTO
        if (emailActivo === "mateotesta@testa.com") {
            const nav = document.querySelector('.sidebar-nav');
            if (nav && !document.getElementById('link-admin')) {
                const rutaAdmin = enSubcarpeta ? "admin-usuarios.html" : "pages/admin-usuarios.html";
                nav.innerHTML += `<a href="${rutaAdmin}" id="link-admin" style="background: #1e293b; color: white; margin-top: 15px;"><i class="fa-solid fa-user-shield"></i> Admin Permisos</a>`;
            }
            // Al admin le revelamos la pantalla completa sin restricciones
            document.documentElement.style.visibility = '';
        } 
        // LOS MORTALES (Empleados)
        else {
            const docPermisos = await getDoc(doc(db, "usuarios_permisos", emailActivo));
            
            if (docPermisos.exists()) {
                const accesosPermitidos = docPermisos.data().accesos || [];

                // 2. REDIRECCIÓN INVISIBLE
                if (!accesosPermitidos.includes(archivoActual)) {
                    if (accesosPermitidos.length > 0) {
                        const primeraPagina = accesosPermitidos[0];
                        let rutaDestino = primeraPagina === "index.html" 
                            ? (enSubcarpeta ? "../index.html" : "index.html")
                            : (enSubcarpeta ? primeraPagina : `pages/${primeraPagina}`);
                        
                        // Lo teletransportamos (la pantalla sigue oculta, así que no se da cuenta del salto)
                        window.location.replace(rutaDestino); 
                        return; 
                    } else {
                        document.documentElement.style.visibility = '';
                        document.body.innerHTML = "<h1 style='text-align:center; margin-top:50px; font-family: sans-serif; color: #003b5c;'>No tenés accesos asignados. Hablá con la administración.</h1>";
                        setTimeout(() => { signOut(auth); }, 3000);
                        return;
                    }
                }

                // 3. LIMPIEZA DE MENÚ (Ya sabemos que está en su página correcta)
                const linksMenu = document.querySelectorAll('.sidebar-nav a');
                linksMenu.forEach(link => {
                    let linkArchivo = link.pathname.split('/').pop(); 
                    if (linkArchivo === "") linkArchivo = "index.html";

                    // Destruimos del código los botones que no tiene asignados
                    if (!accesosPermitidos.includes(linkArchivo) && link.id !== 'link-admin') {
                        link.remove(); 
                    } else {
                        link.style.display = "flex";
                        
                        // Resaltamos el botón actual visualmente
                        if (linkArchivo === archivoActual) {
                            link.style.background = "#e0f2fe"; 
                            link.style.color = "#0369a1"; 
                            link.style.fontWeight = "bold";
                            link.style.borderRight = "4px solid #0284c7"; 
                        }
                    }
                });

                // 4. EL TRUCO FINAL: Una vez que podamos el menú, ¡prendemos la luz y mostramos la web!
                document.documentElement.style.visibility = '';

            } else {
                document.documentElement.style.visibility = '';
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
                    signOut(auth).then(() => { window.location.replace(rutaLogin); });
                }
            });
        }
    }
});