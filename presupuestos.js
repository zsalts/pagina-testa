// Atrapamos los elementos del HTML
const contenedorItems = document.getElementById('contenedor-items');
const btnAgregarItem = document.getElementById('btn-agregar-item');
const totalSpan = document.getElementById('total-presupuesto');

// 1. FUNCIÓN PARA SUMAR EL TOTAL
function calcularTotal() {
    let total = 0;
    // Buscamos todos los inputs que tengan la clase 'item-precio'
    const inputsPrecios = document.querySelectorAll('.item-precio');
    
    inputsPrecios.forEach(input => {
        // Convertimos el texto a número. Si está vacío, sumamos 0.
        const valor = parseFloat(input.value) || 0;
        total += valor;
    });
    
    // Mostramos el total en pantalla
    totalSpan.innerText = total.toLocaleString('es-AR'); // Le da formato de miles (ej: 1.500)
}

// 2. ESCUCHAR CUANDO SE ESCRIBEN PRECIOS (Para actualizar el total en vivo)
contenedorItems.addEventListener('input', (e) => {
    if (e.target.classList.contains('item-precio')) {
        calcularTotal();
    }
});

// 3. AGREGAR UN NUEVO RENGLÓN (ÍTEM)
btnAgregarItem.addEventListener('click', () => {
    const nuevaFila = document.createElement('div');
    nuevaFila.className = 'item-fila';
    nuevaFila.style.cssText = 'display: flex; gap: 10px; margin-bottom: 12px; align-items: center;';
    
    nuevaFila.innerHTML = `
        <input type="text" class="item-desc" placeholder="Descripción del equipo..." style="flex: 2;" required>
        <input type="number" class="item-precio" placeholder="$ Precio" style="flex: 1;" required>
        <button type="button" class="btn-icon btn-delete btn-quitar-item"><i class="fa-solid fa-trash"></i></button>
    `;
    
    contenedorItems.appendChild(nuevaFila);
    actualizarBotonesDeBasura();
});

// 4. BORRAR UN RENGLÓN
contenedorItems.addEventListener('click', (e) => {
    // Si hicimos clic en el tachito de basura...
    if (e.target.closest('.btn-quitar-item')) {
        e.target.closest('.item-fila').remove(); // Borra la fila entera
        calcularTotal(); // Recalculamos el total
        actualizarBotonesDeBasura();
    }
});

// 5. OCULTAR LA BASURA SI HAY UN SOLO ÍTEM (Para que siempre haya al menos uno)
function actualizarBotonesDeBasura() {
    const filas = document.querySelectorAll('.item-fila');
    const botonesBasura = document.querySelectorAll('.btn-quitar-item');
    
    botonesBasura.forEach(btn => {
        if (filas.length > 1) {
            btn.style.display = 'block'; // Mostrar si hay más de 1
        } else {
            btn.style.display = 'none'; // Ocultar si es el único
        }
    });
}

// 6. CUANDO SE TOCA "GUARDAR PRESUPUESTO"
document.getElementById('form-presupuesto').addEventListener('submit', (e) => {
    e.preventDefault(); // Evita que la página se recargue
    
    // Acá más adelante vamos a mandar los datos a Firebase o generar un PDF
    alert("¡Presupuesto armado! El total es: $" + totalSpan.innerText);
});