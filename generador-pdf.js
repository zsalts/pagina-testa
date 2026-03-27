import { db } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

// === CONFIGURACIÓN DRIVE ===
const urlGoogleScript = "https://script.google.com/macros/s/AKfycbxvfL1IEuVfRviOSouA_x3upBd60eldf6K64EuuBMcRi-zW8AwzdR_TZm_86y3PmbyQ/exec";

document.addEventListener('DOMContentLoaded', () => {
    let PRODUCTOS_DB = [];
    let listaMedicos = [];
    let filaEnEdicion = null;
    let destinoBuscador = 'desktop';

    // ==========================================
    // 1. CARGA DE DATOS DESDE FIREBASE
    // ==========================================
    onSnapshot(collection(db, "clientes"), (snap) => {
        listaMedicos = snap.docs.map(d => d.data().nombre);
        const dl = document.getElementById('lista-nombres-medicos');
        if (dl) dl.innerHTML = listaMedicos.map(n => `<option value="${n}">${n}</option>`).join('');
    });

    onSnapshot(collection(db, "productos"), (snap) => {
        PRODUCTOS_DB = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });

    // ==========================================
    // 2. GESTIÓN DE MODALES Y BUSCADOR
    // ==========================================
    const modalCarga = document.getElementById('modal-producto');
    const modalBuscador = document.getElementById('modal-buscador-productos');
    const modalMobile = document.getElementById('modal-edicion-mobile');
    const inputBusqueda = document.getElementById('input-busqueda-rapida');
    const contenedorResultados = document.getElementById('lista-resultados-busqueda');

    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-close-modal')) {
            e.target.closest('.modal-overlay').classList.remove('active');
        }
    });

    if (document.getElementById('btn-abrir-modal-prod')) {
        document.getElementById('btn-abrir-modal-prod').addEventListener('click', () => modalCarga.classList.add('active'));
    }

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
            alert("¡Producto añadido al catálogo!");
        } catch (error) { 
            alert("Error al guardar en la nube."); 
        } finally { 
            btnGuardar.disabled = false; 
            btnGuardar.innerText = "Guardar en Nube"; 
        }
    });

    function abrirBuscador(fila, destino = 'desktop') {
        filaEnEdicion = fila;
        destinoBuscador = destino;
        inputBusqueda.value = '';
        renderizarResultados('');
        modalBuscador.classList.add('active');
        inputBusqueda.focus();
    }

    if (document.getElementById('btn-buscar-mob')) {
        document.getElementById('btn-buscar-mob').addEventListener('click', () => {
            abrirBuscador(filaEnEdicion, 'mobile');
        });
    }

    function renderizarResultados(filtro) {
        contenedorResultados.innerHTML = '';
        const term = filtro.toLowerCase();
        const filtrados = PRODUCTOS_DB.filter(p => p.nombre.toLowerCase().includes(term) || p.detalles.toLowerCase().includes(term));
        
        if (filtrados.length === 0) {
            contenedorResultados.innerHTML = '<p style="padding:15px; color:var(--text-muted); text-align:center;">No se encontraron productos.</p>'; 
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
                if (destinoBuscador === 'mobile') {
                    document.getElementById('mob-desc').value = prod.nombre;
                    document.getElementById('mob-detalles').value = prod.detalles;
                    document.getElementById('mob-precio').value = prod.precio;
                    document.getElementById('mob-moneda').value = prod.moneda;
                    document.getElementById('mob-iva').value = prod.iva;
                } else if (filaEnEdicion) {
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
    // 3. LÓGICA DE CÁLCULO
    // ==========================================
    const nroInput = document.getElementById('nro-presupuesto-input');
    const ultimoGuardado = localStorage.getItem('testa_ultimo_nro');
    if (nroInput) {
        nroInput.value = ultimoGuardado ? parseInt(ultimoGuardado) + 1 : 175;
    }

    const fechaInput = document.getElementById('fecha-presupuesto');
    if (fechaInput) {
        const hoy = new Date();
        const offset = hoy.getTimezoneOffset() * 60000;
        fechaInput.value = (new Date(hoy - offset)).toISOString().slice(0, 10);
    }

    const tbody = document.getElementById('items-tbody-presupuesto');

    function calcular() {
        if (!tbody) return;
        let base = 0, i10 = 0, i21 = 0, sim = "$";
        tbody.querySelectorAll('tr').forEach(f => {
            const c = parseFloat(f.querySelector('.item-cant').value) || 0;
            const p = parseFloat(f.querySelector('.item-precio').value) || 0;
            const i = parseFloat(f.querySelector('.item-iva').value) || 0;
            sim = f.querySelector('.item-moneda').value === 'USD' ? 'U$S' : '$';
            
            const sub = c * p; 
            const vIva = sub * (i / 100); 
            
            f.querySelector('.item-subtotal').textContent = sub.toLocaleString('es-AR', {minimumFractionDigits: 2});
            f.querySelector('.simbolo-linea').textContent = sim;
            
            base += sub;
            if (i === 10.5) i10 += vIva; 
            if (i === 21) i21 += vIva;
        });
        
        document.querySelectorAll('.simbolo-total').forEach(s => s.textContent = sim);
        document.getElementById('web-base-imponible').textContent = base.toLocaleString('es-AR', {minimumFractionDigits: 2});
        document.getElementById('web-iva-10').textContent = i10.toLocaleString('es-AR', {minimumFractionDigits: 2});
        document.getElementById('web-iva-21').textContent = i21.toLocaleString('es-AR', {minimumFractionDigits: 2});
        document.getElementById('web-total-final').textContent = (base + i10 + i21).toLocaleString('es-AR', {minimumFractionDigits: 2});
    }

    if (document.getElementById('btn-add-presupuesto-item')) {
        document.getElementById('btn-add-presupuesto-item').addEventListener('click', () => {
            const tr = document.createElement('tr');
            tr.className = 'item-row';
            tr.innerHTML = tbody.querySelector('.item-row').innerHTML;
            tr.querySelectorAll('input:not([type="button"]), textarea').forEach(i => i.value = i.type === 'number' ? 0 : "");
            tr.querySelector('.item-cant').value = 1;
            tbody.appendChild(tr);
            calcular();
        });
    }

    if (tbody) {
        tbody.addEventListener('input', calcular);
        tbody.addEventListener('change', calcular);
        
        tbody.addEventListener('click', e => { 
            const fila = e.target.closest('.item-row');
            const btnBorrar = e.target.closest('.btn-remove-item');

            if (btnBorrar && fila) { 
                if (tbody.querySelectorAll('.item-row').length > 1) { 
                    fila.remove(); 
                } else {
                    fila.querySelector('.item-desc').value = "";
                    fila.querySelector('.item-detalles').value = "";
                    fila.querySelector('.item-cant').value = 1;
                    fila.querySelector('.item-precio').value = 0;
                }
                calcular(); 
                return;
            }

            if (e.target.closest('.btn-search-prod')) {
                abrirBuscador(fila, 'desktop');
                return;
            }

            if (window.innerWidth <= 768 && fila) {
                filaEnEdicion = fila;
                document.getElementById('mob-desc').value = fila.querySelector('.item-desc').value;
                document.getElementById('mob-detalles').value = fila.querySelector('.item-detalles').value;
                document.getElementById('mob-cant').value = fila.querySelector('.item-cant').value;
                document.getElementById('mob-moneda').value = fila.querySelector('.item-moneda').value;
                document.getElementById('mob-precio').value = fila.querySelector('.item-precio').value;
                document.getElementById('mob-iva').value = fila.querySelector('.item-iva').value;
                modalMobile.classList.add('active');
            }
        });
    }

    if (document.getElementById('form-edicion-mobile')) {
        document.getElementById('form-edicion-mobile').addEventListener('submit', (e) => {
            e.preventDefault();
            if (filaEnEdicion) {
                filaEnEdicion.querySelector('.item-desc').value = document.getElementById('mob-desc').value;
                filaEnEdicion.querySelector('.item-detalles').value = document.getElementById('mob-detalles').value;
                filaEnEdicion.querySelector('.item-cant').value = document.getElementById('mob-cant').value;
                filaEnEdicion.querySelector('.item-moneda').value = document.getElementById('mob-moneda').value;
                filaEnEdicion.querySelector('.item-precio').value = document.getElementById('mob-precio').value;
                filaEnEdicion.querySelector('.item-iva').value = document.getElementById('mob-iva').value;
                calcular();
                modalMobile.classList.remove('active');
            }
        });
    }

    if (document.getElementById('condiciones-web')) {
        document.getElementById('condiciones-web').value = `▪ Estos Precios INCLUYEN IVA\n▪ Valor cotizado es a cotización Dólar Oficial BANCO NACION a fecha Factura\n▪ Forma de Pago.: A convenir.\n▪ Plazo de Entrega.: Inmediato\n▪ Todo el equipamiento cotizado es nuevo sin uso y con su última versión de fabricación.\n▪ Estos precios incluyen los gastos de flete, seguro de transporte y acarreo.\n▪ Los equipos se entregarán con su manual correspondiente de uso.\n▪ Testa Equipamiento Medico es agente oficial y servicio técnico oficial de lo cotizado`;
    }

    // ==========================================
    // 4. GENERACIÓN DEL PDF Y SUBIDA A DRIVE
    // ==========================================
    const fileToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
        });
    };

    document.getElementById('form-presupuesto').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-cloud-upload-alt fa-spin"></i> Procesando...';

        const cliente = document.getElementById('cliente-nombre').value || "Desconocido";
        const nroBase = nroInput.value;
        const fechaElegida = fechaInput.value; // Viene en formato YYYY-MM-DD
        const fechaObj = new Date(fechaElegida + 'T00:00:00');
        const anioCur = fechaObj.getFullYear().toString().slice(-2);
        
        localStorage.setItem('testa_ultimo_nro', nroBase);
        const primerProd = tbody.querySelector('.item-row') ? tbody.querySelector('.item-desc').value : "Doc";
        
        // --- LA MAGIA DE LA FECHA: Transformamos YYYY-MM-DD a DD MM AA ---
        const partesFecha = fechaElegida.split('-'); // Cortamos por los guiones
        const dia = partesFecha[2];
        const mes = partesFecha[1];
        const anio = partesFecha[0].slice(-2); // Nos quedamos solo con los últimos 2 dígitos del año
        const fechaFormateada = `${dia} ${mes} ${anio}`; // Queda "27 03 26"

        // ARMAMOS LA CARPETA CON LA FECHA NUEVA
        const nombreCarpetaDeseado = `${fechaFormateada} - ${cliente} - ${primerProd}`.replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, "");
        const fileName = `M${nroBase}-${anioCur} - ${cliente} - ${primerProd}.pdf`.replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, "");

        // Llenar contenido PDF invisible
        document.getElementById('pdf-cliente-nombre').textContent = cliente;
        document.getElementById('pdf-nro-presupuesto-texto').textContent = `M ${nroBase}-${anioCur}`;
        document.getElementById('pdf-fecha-text').textContent = "Mar del Plata, " + fechaObj.toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
        document.getElementById('pdf-condiciones-container').textContent = document.getElementById('condiciones-web').value;

        const pdfTbody = document.getElementById('pdf-tbody');
        pdfTbody.innerHTML = '';
        let sim = "$";
        tbody.querySelectorAll('.item-row').forEach((f, idx) => {
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
        wrapper.style.opacity = "1"; 
        wrapper.style.zIndex = "9999";

        try {
            const element = document.getElementById('pdf-content');
            const opt = { margin: 0, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 2, width: 800, height: 1131, useCORS: true }, jsPDF: { unit: 'px', format: [800, 1131], orientation: 'portrait' } };

            // 1. Crear PDF base
            const pdfObj = await html2pdf().set(opt).from(element).toPdf().get('pdf');
            const { PDFDocument } = PDFLib;
            let finalPdf = await PDFDocument.load(pdfObj.output('arraybuffer'));
            
            // 2. Unir folleto si existe
            const fileInput = document.getElementById('input-folleto-pdf');
            if (fileInput.files.length > 0) {
                const folletoPdf = await PDFDocument.load(await fileInput.files[0].arrayBuffer());
                const paginasCopiadas = await finalPdf.copyPages(folletoPdf, folletoPdf.getPageIndices());
                paginasCopiadas.forEach(page => finalPdf.addPage(page));
            }

            const pdfBytes = await finalPdf.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });

            // 3. Descarga Local (Backup)
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = fileName;
            link.click();

            // 4. Subida a Google Drive y obtener el Link generado
            const base64data = await fileToBase64(blob);
            
            const peticionDrive = await fetch(urlGoogleScript, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ 
                    pdfBase64: base64data, 
                    fileName: fileName,
                    carpeta: nombreCarpetaDeseado // Acá viaja la carpeta con DD MM AA
                })
            });

            // Leemos la respuesta JSON que retorna el Apps Script
            const respuestaDrive = await peticionDrive.json();
            const linkDrive = respuestaDrive.url; // <--- EL LINK GENERADO

            // 5. Actualizar Firestore (Guardando el Link)
            const q = query(collection(db, "presupuestos"), where("medico", "==", cliente));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
                await updateDoc(doc(db, "presupuestos", querySnap.docs[0].id), { 
                    nombreArchivo: fileName, 
                    estado: 'pendiente',
                    fecha: fechaInput.value,
                    link: linkDrive // Guarda el link en el documento existente
                });
            } else {
                await addDoc(collection(db, "presupuestos"), { 
                    medico: cliente, 
                    fecha: fechaInput.value, 
                    estado: 'pendiente', 
                    nombreArchivo: fileName,
                    link: linkDrive, // Guarda el link en un nuevo documento
                    archivosExtra: {} 
                });
            }
            
            alert("¡Presupuesto guardado en Drive y vinculado al CRM!");
            window.location.href = "presupuesto.html";

        } catch (error) { 
            console.error("Error:", error); 
            alert("Error al procesar el PDF."); 
        } finally { 
            wrapper.style.opacity = "0"; 
            wrapper.style.zIndex = "-9999"; 
            btnSubmit.disabled = false; 
            btnSubmit.innerHTML = '<i class="fa-solid fa-file-pdf"></i> GENERAR PDF'; 
        }
    });
});