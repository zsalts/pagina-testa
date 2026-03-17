import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// ==========================================
// 1. CONEXIÓN A FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAJXaRh-OeWXEdK1QXZp133SCCwVLmXa98",
    authDomain: "testa-crm.firebaseapp.com",
    projectId: "testa-crm",
    storageBucket: "testa-crm.firebasestorage.app", 
    messagingSenderId: "616199192563",
    appId: "1:616199192563:web:20b35acba2f635b9735c86",
    measurementId: "G-7Q3BQS18FH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1.5. CARGAR MÉDICOS DESDE FIREBASE
    // ==========================================
    onSnapshot(collection(db, "clientes"), (snap) => {
        let listaMedicos = snap.docs.map(d => d.data().nombre);
        const dl = document.getElementById('lista-nombres-medicos');
        if (dl) {
            dl.innerHTML = listaMedicos.map(nombre => `<option value="${nombre}">${nombre}</option>`).join('');
        }
    }, (error) => {
        console.error("Error cargando médicos:", error);
    });

    // ==========================================
    // 2. CATÁLOGO DESDE LA NUBE (FIREBASE)
    // ==========================================
    let PRODUCTOS_DB = [];

    onSnapshot(collection(db, "productos"), (snap) => {
        PRODUCTOS_DB = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }, (error) => {
        console.error("Error cargando productos:", error);
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-close-modal')) {
            e.target.closest('.modal-overlay').classList.remove('active');
        }
    });

    // --- MODAL 1: AÑADIR PRODUCTO (A FIREBASE) ---
    const modalCarga = document.getElementById('modal-producto');
    document.getElementById('btn-abrir-modal-prod').addEventListener('click', () => modalCarga.classList.add('active'));

    document.getElementById('form-nuevo-producto').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnGuardar = e.target.querySelector('button[type="submit"]');
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        const nuevoProd = {
            nombre: document.getElementById('nuevo-prod-nombre').value.trim(),
            detalles: document.getElementById('nuevo-prod-detalles').value.trim(),
            precio: parseFloat(document.getElementById('nuevo-prod-precio').value),
            moneda: document.getElementById('nuevo-prod-moneda').value,
            iva: parseFloat(document.getElementById('nuevo-prod-iva').value)
        };
        
        try {
            await addDoc(collection(db, "productos"), nuevoProd);
            e.target.reset();
            modalCarga.classList.remove('active');
            alert("¡Producto añadido al catálogo de la nube!");
        } catch (error) {
            alert("Error al guardar en la nube.");
        } finally {
            btnGuardar.disabled = false;
            btnGuardar.innerText = "Guardar en Nube";
        }
    });

    // --- MODAL 2: BUSCADOR EN LA TABLA ---
    const modalBuscador = document.getElementById('modal-buscador-productos');
    const inputBusqueda = document.getElementById('input-busqueda-rapida');
    const contenedorResultados = document.getElementById('lista-resultados-busqueda');
    let filaEnEdicion = null;

    function abrirBuscador(fila) {
        filaEnEdicion = fila;
        inputBusqueda.value = '';
        renderizarResultados('');
        modalBuscador.classList.add('active');
        inputBusqueda.focus();
    }

    function renderizarResultados(filtro) {
        contenedorResultados.innerHTML = '';
        const term = filtro.toLowerCase();
        const filtrados = PRODUCTOS_DB.filter(p => p.nombre.toLowerCase().includes(term) || p.detalles.toLowerCase().includes(term));
        
        if (filtrados.length === 0) {
            contenedorResultados.innerHTML = '<p style="padding:15px; color:var(--text-muted); text-align:center;">No se encontraron productos en la nube.</p>';
            return;
        }

        filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));

        filtrados.forEach(prod => {
            const div = document.createElement('div');
            div.className = 'modern-list-item resultado-item-cat';
            div.innerHTML = `
                <div style="width:100%;">
                    <div class="cat-titulo">${prod.nombre}</div>
                    <div class="cat-detalles">${prod.detalles}</div>
                    <div class="cat-precio">Precio: ${prod.moneda} ${prod.precio.toLocaleString('es-AR', {minimumFractionDigits: 2})} | IVA: ${prod.iva}%</div>
                </div>
            `;
            div.addEventListener('click', () => {
                if (filaEnEdicion) {
                    filaEnEdicion.querySelector('.item-desc').value = prod.nombre;
                    filaEnEdicion.querySelector('.item-detalles').value = prod.detalles;
                    filaEnEdicion.querySelector('.item-precio').value = prod.precio;
                    filaEnEdicion.querySelector('.item-moneda').value = prod.moneda;
                    filaEnEdicion.querySelector('.item-iva').value = prod.iva;
                    calcular();
                }
                modalBuscador.classList.remove('active');
            });
            contenedorResultados.appendChild(div);
        });
    }
    inputBusqueda.addEventListener('input', (e) => renderizarResultados(e.target.value));


    // ==========================================
    // 3. LÓGICA DEL PRESUPUESTO
    // ==========================================
    
    const nroInput = document.getElementById('nro-presupuesto-input');
    const ultimoGuardado = localStorage.getItem('testa_ultimo_nro');
    nroInput.value = ultimoGuardado ? parseInt(ultimoGuardado) + 1 : 175;

    const fechaInput = document.getElementById('fecha-presupuesto');
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset() * 60000;
    fechaInput.value = (new Date(hoy - offset)).toISOString().slice(0, 10);

    const tbody = document.getElementById('items-tbody-presupuesto');
    function calcular() {
        let base = 0, i10 = 0, i21 = 0, sim = "$";
        tbody.querySelectorAll('tr').forEach(f => {
            const c = parseFloat(f.querySelector('.item-cant').value) || 0;
            const p = parseFloat(f.querySelector('.item-precio').value) || 0;
            const i = parseFloat(f.querySelector('.item-iva').value) || 0;
            sim = f.querySelector('.item-moneda').value === 'USD' ? 'U$S' : '$';
            const sub = c * p;
            const vIva = sub * (i / 100);
            f.querySelector('.item-subtotal').textContent = (sub + vIva).toLocaleString('es-AR', {minimumFractionDigits: 2});
            f.querySelector('.simbolo-linea').textContent = sim;
            base += sub;
            if (i === 10.5) i10 += vIva; if (i === 21) i21 += vIva;
        });
        document.querySelectorAll('.simbolo-total').forEach(s => s.textContent = sim);
        document.getElementById('web-base-imponible').textContent = base.toLocaleString('es-AR', {minimumFractionDigits: 2});
        document.getElementById('web-iva-10').textContent = i10.toLocaleString('es-AR', {minimumFractionDigits: 2});
        document.getElementById('web-iva-21').textContent = i21.toLocaleString('es-AR', {minimumFractionDigits: 2});
        document.getElementById('web-total-final').textContent = (base + i10 + i21).toLocaleString('es-AR', {minimumFractionDigits: 2});
    }

    document.getElementById('btn-add-presupuesto-item').addEventListener('click', () => {
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.innerHTML = tbody.querySelector('tr').innerHTML;
        tr.querySelectorAll('input:not([type="button"]), textarea').forEach(i => i.value = i.type === 'number' ? 0 : "");
        tr.querySelector('.item-cant').value = 1;
        tbody.appendChild(tr);
        calcular();
    });

    tbody.addEventListener('input', calcular);
    tbody.addEventListener('change', calcular);
    
    tbody.addEventListener('click', e => { 
        if (e.target.closest('.btn-remove-item') && tbody.rows.length > 1) { 
            e.target.closest('tr').remove(); 
            calcular(); 
        }
        if (e.target.closest('.btn-search-prod')) {
            abrirBuscador(e.target.closest('tr'));
        }
    });

    document.getElementById('condiciones-web').value = `▪ Estos Precios INCLUYEN IVA\n▪ Valor cotizado es a cotización Dólar Oficial BANCO NACION a fecha Factura\n▪ Forma de Pago.: A convenir.\n▪ Plazo de Entrega.: Inmediato\n▪ Todo el equipamiento cotizado es nuevo sin uso y con su última versión de fabricación.\n▪ Estos precios incluyen los gastos de flete, seguro de transporte y acarreo.\n▪ Los equipos se entregarán con su manual correspondiente de uso.\n▪ Testa Equipamiento Medico es agente oficial y servicio técnico oficial de lo cotizado`;

    // ==========================================
    // 4. GENERACIÓN DEL PDF Y ENGRAPADO DE FOLLETO
    // ==========================================
    document.getElementById('form-presupuesto').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uniendo Documentos...';

        const cliente = document.getElementById('cliente-nombre').value;
        const nroBase = nroInput.value;
        const fechaObj = new Date(fechaInput.value + 'T00:00:00');
        const anioCur = fechaObj.getFullYear().toString().slice(-2);
        
        localStorage.setItem('testa_ultimo_nro', nroBase);

        const primerProd = tbody.querySelector('.item-row') ? tbody.querySelector('.item-desc').value : "Doc";
        const fileName = `M${nroBase}-${anioCur} - ${cliente} - ${primerProd}.pdf`;

        document.getElementById('pdf-cliente-nombre').textContent = cliente;
        document.getElementById('pdf-nro-presupuesto-texto').textContent = `M ${nroBase}-${anioCur}`;
        document.getElementById('pdf-fecha-text').textContent = "Mar del Plata, " + fechaObj.toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
        document.getElementById('pdf-condiciones-container').textContent = document.getElementById('condiciones-web').value;

        const pdfTbody = document.getElementById('pdf-tbody');
        pdfTbody.innerHTML = '';
        let sim = "$";
        tbody.querySelectorAll('tr').forEach((f, idx) => {
            sim = f.querySelector('.simbolo-linea').textContent;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="border:1px solid #003b5c; padding:8px; text-align:center; vertical-align:top;">${idx + 1}</td>
                <td style="border:1px solid #003b5c; padding:8px; vertical-align:top; overflow-wrap: anywhere; word-break: break-all; white-space: normal;">
                    <strong style="display:block; margin-bottom:4px;">${f.querySelector('.item-desc').value}</strong>
                    <div style="font-size: 9px; color: #444; white-space: pre-wrap;">${f.querySelector('.item-detalles').value}</div>
                </td>
                <td style="border:1px solid #003b5c; padding:8px; text-align:center; vertical-align:top;">${f.querySelector('.item-cant').value}</td>
                <td style="border:1px solid #003b5c; padding:8px; text-align:right; vertical-align:top;">${sim} ${parseFloat(f.querySelector('.item-precio').value).toLocaleString('es-AR',{minimumFractionDigits:2})}</td>
                <td style="border:1px solid #003b5c; padding:8px; text-align:center; vertical-align:top;">${f.querySelector('.item-iva').value}%</td>
                <td style="border:1px solid #003b5c; padding:8px; text-align:right; vertical-align:top;">${sim} ${f.querySelector('.item-subtotal').textContent}</td>`;
            pdfTbody.appendChild(tr);
        });

        const b = document.getElementById('web-base-imponible').textContent;
        const i10 = document.getElementById('web-iva-10').textContent;
        const i21 = document.getElementById('web-iva-21').textContent;
        const t = document.getElementById('web-total-final').textContent;

        document.getElementById('pdf-tfoot').innerHTML = `
            <tr><td colspan="4" style="border:none;"></td><td style="border:1px solid #003b5c; padding:8px; text-align:right; background:#d0e4f5; font-weight:bold;">BASE IMPONIBLE</td><td style="border:1px solid #003b5c; padding:8px; text-align:right; background:#d0e4f5; font-weight:bold;">${sim} ${b}</td></tr>
            <tr><td colspan="4" style="border:none;"></td><td style="border:1px solid #003b5c; padding:8px; text-align:right;">IVA 10,5 %</td><td style="border:1px solid #003b5c; padding:8px; text-align:right;">${sim} ${i10}</td></tr>
            <tr><td colspan="4" style="border:none;"></td><td style="border:1px solid #003b5c; padding:8px; text-align:right;">IVA 21%</td><td style="border:1px solid #003b5c; padding:8px; text-align:right;">${sim} ${i21}</td></tr>
            <tr><td colspan="4" style="border:none;"></td><td style="border:1px solid #003b5c; padding:8px; text-align:right; background:#b8d1e8; font-weight:bold; color:#003b5c;">TOTAL CON IVA INCLUIDO</td><td style="border:1px solid #003b5c; padding:8px; text-align:right; background:#b8d1e8; font-weight:bold; color:#003b5c;">${sim} ${t}</td></tr>`;

        const wrapper = document.getElementById('pdf-wrapper');
        wrapper.style.opacity = "1"; wrapper.style.zIndex = "9999";
        
        const element = document.getElementById('pdf-content');
        const opt = {
            margin: 0, image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, width: 800, height: 1131, scrollX: 0, scrollY: 0 },
            jsPDF: { unit: 'px', format: [800, 1131], orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).toPdf().get('pdf').then(async function(pdfObj) {
            try {
                const presupuestoBuffer = pdfObj.output('arraybuffer');
                const { PDFDocument } = PDFLib;
                const finalPdf = await PDFDocument.load(presupuestoBuffer);
                const fileInput = document.getElementById('input-folleto-pdf');
                
                if (fileInput.files.length > 0) {
                    const folletoBuffer = await fileInput.files[0].arrayBuffer();
                    const folletoPdf = await PDFDocument.load(folletoBuffer);
                    const paginasCopiadas = await finalPdf.copyPages(folletoPdf, folletoPdf.getPageIndices());
                    paginasCopiadas.forEach(page => finalPdf.addPage(page));
                }

                const pdfBytes = await finalPdf.save();
                const blob = new Blob([pdfBytes], { type: "application/pdf" });
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = fileName;
                link.click();

            } catch (error) {
                console.error(error);
                alert("Hubo un error al unir los PDFs. Revisá que el folleto no esté dañado.");
            } finally {
                wrapper.style.opacity = "0"; wrapper.style.zIndex = "-9999";
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = '<i class="fa-solid fa-file-pdf"></i> GENERAR Y DESCARGAR PDF';
            }
        });
    });
});