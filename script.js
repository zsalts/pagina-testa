import "./clientes.js";
import "./clinicas.js";

// Cerrar cualquier modal al tocar la X
document.querySelectorAll('.btn-close').forEach(b => {
    b.onclick = (e) => e.target.closest('.modal-overlay').classList.remove('active');
});

// Cerrar modal si se hace clic fuera del contenido blanco
window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.classList.remove('active');
    }
}