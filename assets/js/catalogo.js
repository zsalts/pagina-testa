import { db } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let PRODUCTOS_DB = [];
let productoSeleccionadoId = null;

// 1. ESCUCHAR FIREBASE
onSnapshot(collection(db, "productos"), (snap) => {
    PRODUCTOS_DB = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderizarCatalogo('');
}, (error) => {
    console.error("Error al cargar Firebase:", error);
    const grid = document.getElementById('grid-productos');
    if(grid) grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Error al cargar datos.</p>`;
});

// 2. DIBUJAR LA GRILLA
function renderizarCatalogo(filtro) {
    const grid = document.getElementById('grid-productos');
    if(!grid) return;
    
    grid.innerHTML = '';
    const term = filtro.toLowerCase().trim();
    
    const filtrados = PRODUCTOS_DB.filter(p => {
        const n = String(p.nombre || "").toLowerCase();
        const d = String(p.detalles || "").toLowerCase();
        return n.includes(term) || d.includes(term);
    });

    if (filtrados.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">No se encontraron productos.</p>';
        return;
    }

    filtrados.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

    filtrados.forEach(prod => {
        const sim = prod.moneda === 'USD' ? 'U$S' : '$';
        const precioFormat = parseFloat(prod.precio || 0).toLocaleString('es-AR', {minimumFractionDigits: 2});

        const card = document.createElement('div');
        card.className = 'producto-card';
        card.innerHTML = `
            <div>
                <i class="fa-solid fa-box-open prod-card-icon"></i>
                <div class="prod-card-title" title="${prod.nombre || ''}">${prod.nombre || 'Sin nombre'}</div>
                <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">${prod.iva || 0}% IVA</div>
            </div>
            <div class="prod-card-price">${sim} ${precioFormat}</div>
        `;
        
        card.addEventListener('click', () => abrirModalDetalle(prod.id));
        grid.appendChild(card);
    });
}

// 3. BUSCADOR EN TIEMPO REAL
const inputBuscador = document.getElementById('buscador-catalogo');
if(inputBuscador) {
    inputBuscador.addEventListener('input', (e) => renderizarCatalogo(e.target.value));
}

// 4. LÓGICA DE MODALES
const modalEdicion = document.getElementById('modal-producto');
const modalDetalle = document.getElementById('modal-detalle-producto');
const formProducto = document.getElementById('form-producto');

document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => {
    formProducto.reset();
    document.getElementById('prod-id').value = ""; 
    document.getElementById('modal-titulo').innerText = "Nuevo Producto";
    modalEdicion.classList.add('active');
});

document.getElementById('btn-cerrar-modal')?.addEventListener('click', () => modalEdicion.classList.remove('active'));
document.getElementById('btn-cerrar-detalle')?.addEventListener('click', () => modalDetalle.classList.remove('active'));

window.addEventListener('click', (e) => {
    if (e.target === modalEdicion) modalEdicion.classList.remove('active');
    if (e.target === modalDetalle) modalDetalle.classList.remove('active');
});

// 5. ABRIR EL MODAL DE DETALLES
function abrirModalDetalle(id) {
    const prod = PRODUCTOS_DB.find(p => p.id === id);
    if (!prod) return;
    
    productoSeleccionadoId = id; 
    
    const sim = prod.moneda === 'USD' ? 'U$S' : '$';
    const precioFormat = parseFloat(prod.precio || 0).toLocaleString('es-AR', {minimumFractionDigits: 2});

    document.getElementById('detalle-nombre').innerText = prod.nombre || '';
    document.getElementById('detalle-desc').innerHTML = (prod.detalles || 'Sin especificaciones detalladas.').replace(/\n/g, '<br>');
    document.getElementById('detalle-precio').innerText = `${sim} ${precioFormat}`;
    document.getElementById('detalle-iva').innerText = `${prod.iva || 0}%`;

    modalDetalle.classList.add('active');
}

// 6. ACCIONES DESDE EL DETALLE
document.getElementById('btn-editar-desde-detalle')?.addEventListener('click', () => {
    modalDetalle.classList.remove('active');
    abrirModalEdicion(productoSeleccionadoId);
});

document.getElementById('btn-borrar-desde-detalle')?.addEventListener('click', () => {
    borrarProducto(productoSeleccionadoId);
});

// 7. RELLENAR MODAL PARA EDITAR
function abrirModalEdicion(id) {
    const prod = PRODUCTOS_DB.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-nombre').value = prod.nombre || '';
    document.getElementById('prod-detalles').value = prod.detalles || '';
    document.getElementById('prod-precio').value = prod.precio || 0;
    document.getElementById('prod-moneda').value = prod.moneda || 'ARS';
    document.getElementById('prod-iva').value = prod.iva || 0;

    document.getElementById('modal-titulo').innerText = "Editar Producto";
    modalEdicion.classList.add('active');
}

// 8. GUARDAR / EDITAR EN FIREBASE
if(formProducto) {
    formProducto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.innerText;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        const id = document.getElementById('prod-id').value;
        const datosProducto = {
            nombre: document.getElementById('prod-nombre').value.trim(),
            detalles: document.getElementById('prod-detalles').value.trim(),
            precio: parseFloat(document.getElementById('prod-precio').value) || 0,
            moneda: document.getElementById('prod-moneda').value || 'ARS',
            iva: parseFloat(document.getElementById('prod-iva').value) || 21
        };

        try {
            if (id) {
                await updateDoc(doc(db, "productos", id), datosProducto);
            } else {
                await addDoc(collection(db, "productos"), datosProducto);
            }
            modalEdicion.classList.remove('active');
        } catch (error) {
            console.error(error);
            alert("Error al guardar en Firebase.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = textoOriginal;
        }
    });
}

// 9. BORRAR DE FIREBASE
async function borrarProducto(id) {
    const prod = PRODUCTOS_DB.find(p => p.id === id);
    const nombreProd = prod ? prod.nombre : "este producto";

    if (confirm(`¿Estás seguro de eliminar "${nombreProd}" del catálogo?`)) {
        try {
            await deleteDoc(doc(db, "productos", id));
            modalDetalle.classList.remove('active');
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar.");
        }
    }
}