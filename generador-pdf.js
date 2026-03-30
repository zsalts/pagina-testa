import { db } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, query, where, getDocs, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const urlGoogleScript = "https://script.google.com/macros/s/AKfycbxvfL1IEuVfRviOSouA_x3upBd60eldf6K64EuuBMcRi-zW8AwzdR_TZm_86y3PmbyQ/exec";

let PRODUCTOS_DB = [];
let listaMedicosCompletos = []; 
let filaEnEdicion = null;
let destinoBuscador = 'desktop';

// ==========================================
// 1. ANTI-CONGELAMIENTO
// ==========================================
window.addEventListener('pageshow', (event) => {
    if (event.persisted) { window.location.reload(); }
});

// ==========================================
// 2. FUNCIONES DE VINCULACIÓN Y TABLA
// ==========================================
const actualizarSelectorVisitas = (e) => {
    const selectVisita = document.getElementById('vinculo-visita');
    if (!selectVisita) return;
    const medicoElegido = String(e.target.value).trim().toLowerCase();
    const medicoEncontrado = listaMedicosCompletos.find(m => String(m.nombre || '').trim().toLowerCase() === medicoElegido);
    
    if (!medicoEncontrado) {
        selectVisita.innerHTML = '<option value="">-- El médico no existe en la base --</option>';
        return;
    }

    if (!medicoEncontrado.visitas || medicoEncontrado.visitas.length === 0) {
        selectVisita.innerHTML = '<option value="">No tiene visitas cargadas en el CRM</option>';
        return;
    }

    let opciones = '<option value="">-- Opcional: No vincular a ninguna visita --</option>';
    medicoEncontrado.visitas.forEach((v, index) => {
        let indicativo = v.presupuestoLink ? " 📌 (Ya tiene PDF)" : "";
        opciones += `<option value="${medicoEncontrado.id}_${index}">${new Date(v.fecha+'T00:00:00').toLocaleDateString('es-AR')} | ${String(v.pedido).substring(0, 40)}... ${indicativo}</option>`;
    });
    selectVisita.innerHTML = opciones;
};

const clienteInput = document.getElementById('cliente-nombre');
if (clienteInput) {
    clienteInput.addEventListener('input', actualizarSelectorVisitas);
    clienteInput.addEventListener('change', actualizarSelectorVisitas);
}

document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal')) {
        e.target.closest('.modal-overlay')?.classList.remove('active');
    }
});

function abrirBuscador(fila, destino = 'desktop') {
    filaEnEdicion = fila;
    destinoBuscador = destino;
    const inputBusqueda = document.getElementById('input-busqueda-rapida');
    if(inputBusqueda) inputBusqueda.value = '';
    renderizarResultados('');
    const modalBuscador = document.getElementById('modal-buscador-productos');
    if(modalBuscador) {
        modalBuscador.classList.add('active');
        setTimeout(() => { if(inputBusqueda) inputBusqueda.focus() }, 100);
    }
}

function renderizarResultados(filtro) {
    const contenedorResultados = document.getElementById('lista-resultados-busqueda');
    if(!contenedorResultados) return;
    contenedorResultados.innerHTML = '';
    const term = String(filtro).toLowerCase().trim();
    
    const filtrados = PRODUCTOS_DB.filter(p => {
        const n = String(p.nombre || "").toLowerCase();
        const d = String(p.detalles || "").toLowerCase();
        return n.includes(term) || d.includes(term);
    });
    
    if (filtrados.length === 0) {
        contenedorResultados.innerHTML = '<p style="padding:15px; color:var(--text-muted); text-align:center;">No se encontraron productos.</p>'; 
        return;
    }
    
    filtrados.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));

    filtrados.forEach(prod => {
        const div = document.createElement('div');
        div.className = 'modern-list-item resultado-item-cat';
        const precioSeguro = (prod.precio || 0).toLocaleString('es-AR', {minimumFractionDigits: 2});
        
        div.innerHTML = `
            <div style="width:100%;">
                <div class="cat-titulo">${prod.nombre || "Sin nombre"}</div>
                <div class="cat-detalles">${prod.detalles || "Sin detalles"}</div>
                <div class="cat-precio">Precio: ${prod.moneda || "ARS"} ${precioSeguro} | IVA: ${prod.iva || 0}%</div>
            </div>
        `;
        
        div.addEventListener('click', () => {
            if (destinoBuscador === 'mobile') {
                const md = document.getElementById('mob-desc'); if(md) md.value = prod.nombre || '';
                const mdet = document.getElementById('mob-detalles'); if(mdet) mdet.value = prod.detalles || '';
                const mp = document.getElementById('mob-precio'); if(mp) mp.value = prod.precio || 0;
                const mm = document.getElementById('mob-moneda'); if(mm) mm.value = prod.moneda || 'ARS';
                const mi = document.getElementById('mob-iva'); if(mi) mi.value = prod.iva || 0;
            } else if (filaEnEdicion) {
                filaEnEdicion.querySelector('.item-desc').value = prod.nombre || '';
                filaEnEdicion.querySelector('.item-detalles').value = prod.detalles || '';
                filaEnEdicion.querySelector('.item-precio').value = prod.precio || 0;
                filaEnEdicion.querySelector('.item-moneda').value = prod.moneda || 'ARS';
                filaEnEdicion.querySelector('.item-iva').value = prod.iva || 0;
                calcular();
            }
            document.getElementById('modal-buscador-productos')?.classList.remove('active');
        });
        contenedorResultados.appendChild(div);
    });
}

function calcular() {
    const tbody = document.getElementById('items-tbody-presupuesto');
    if (!tbody) return;
    let base = 0, i10 = 0, i21 = 0, sim = "$";
    tbody.querySelectorAll('.item-row').forEach(f => {
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
    const bImp = document.getElementById('web-base-imponible'); if(bImp) bImp.textContent = base.toLocaleString('es-AR', {minimumFractionDigits: 2});
    const iva10 = document.getElementById('web-iva-10'); if(iva10) iva10.textContent = i10.toLocaleString('es-AR', {minimumFractionDigits: 2});
    const iva21 = document.getElementById('web-iva-21'); if(iva21) iva21.textContent = i21.toLocaleString('es-AR', {minimumFractionDigits: 2});
    const tFinal = document.getElementById('web-total-final'); if(tFinal) tFinal.textContent = (base + i10 + i21).toLocaleString('es-AR', {minimumFractionDigits: 2});
}

// ==========================================
// 3. EVENTOS DE BOTONES
// ==========================================
const btnAbrirModalProd = document.getElementById('btn-abrir-modal-prod');
if (btnAbrirModalProd) {
    btnAbrirModalProd.addEventListener('click', () => document.getElementById('modal-producto')?.classList.add('active'));
}

const formNuevoProd = document.getElementById('form-nuevo-producto');
if (formNuevoProd) {
    formNuevoProd.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnGuardar = e.target.querySelector('button[type="submit"]');
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        const nuevoProd = {
            nombre: document.getElementById('nuevo-prod-nombre').value.trim(),
            detalles: document.getElementById('nuevo-prod-detalles').value.trim(),
            precio: parseFloat(document.getElementById('nuevo-prod-precio').value) || 0,
            moneda: document.getElementById('nuevo-prod-moneda').value || 'ARS',
            iva: parseFloat(document.getElementById('nuevo-prod-iva').value) || 21
        };
        
        try {
            await addDoc(collection(db, "productos"), nuevoProd);
            e.target.reset();
            document.getElementById('modal-producto')?.classList.remove('active');
            alert("¡Producto añadido al catálogo!");
        } catch (error) { 
            alert("Error al guardar en la nube."); 
        } finally { 
            btnGuardar.disabled = false; 
            btnGuardar.innerText = "Guardar en Nube"; 
        }
    });
}

const btnBuscarMob = document.getElementById('btn-buscar-mob');
if (btnBuscarMob) {
    btnBuscarMob.addEventListener('click', () => { abrirBuscador(filaEnEdicion, 'mobile'); });
}

const inputBusquedaRapida = document.getElementById('input-busqueda-rapida');
if(inputBusquedaRapida) {
    inputBusquedaRapida.addEventListener('input', (e) => renderizarResultados(e.target.value));
}

const nroInput = document.getElementById('nro-presupuesto-input');
const ultimoGuardado = localStorage.getItem('testa_ultimo_nro');
if (nroInput) nroInput.value = ultimoGuardado ? parseInt(ultimoGuardado) + 1 : 175;

const fechaInput = document.getElementById('fecha-presupuesto');
if (fechaInput) {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset() * 60000;
    fechaInput.value = (new Date(hoy - offset)).toISOString().slice(0, 10);
}

const tbody = document.getElementById('items-tbody-presupuesto');
if (tbody) {
    tbody.addEventListener('input', calcular);
    tbody.addEventListener('change', calcular);
    
    tbody.addEventListener('click', e => { 
        const fila = e.target.closest('.item-row');
        if(!fila) return;

        const btnBorrar = e.target.closest('.btn-remove-item');
        if (btnBorrar) { 
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

        if (window.innerWidth <= 768) {
            filaEnEdicion = fila;
            const md = document.getElementById('mob-desc'); if(md) md.value = fila.querySelector('.item-desc').value;
            const mdet = document.getElementById('mob-detalles'); if(mdet) mdet.value = fila.querySelector('.item-detalles').value;
            const mc = document.getElementById('mob-cant'); if(mc) mc.value = fila.querySelector('.item-cant').value;
            const mm = document.getElementById('mob-moneda'); if(mm) mm.value = fila.querySelector('.item-moneda').value;
            const mp = document.getElementById('mob-precio'); if(mp) mp.value = fila.querySelector('.item-precio').value;
            const mi = document.getElementById('mob-iva'); if(mi) mi.value = fila.querySelector('.item-iva').value;
            document.getElementById('modal-edicion-mobile')?.classList.add('active');
        }
    });
}

const btnAddPresItem = document.getElementById('btn-add-presupuesto-item');
if (btnAddPresItem && tbody) {
    btnAddPresItem.addEventListener('click', () => {
        const primeraFila = tbody.querySelector('.item-row');
        if(!primeraFila) return;
        const tr = document.createElement('tr');
        tr.className = 'item-row';
        tr.innerHTML = primeraFila.innerHTML;
        tr.querySelectorAll('input:not([type="button"]), textarea').forEach(i => i.value = i.type === 'number' ? 0 : "");
        tr.querySelector('.item-cant').value = 1;
        tbody.appendChild(tr);
        calcular();
    });
}

const formEdicionMobile = document.getElementById('form-edicion-mobile');
if (formEdicionMobile) {
    formEdicionMobile.addEventListener('submit', (e) => {
        e.preventDefault();
        if (filaEnEdicion) {
            filaEnEdicion.querySelector('.item-desc').value = document.getElementById('mob-desc').value;
            filaEnEdicion.querySelector('.item-detalles').value = document.getElementById('mob-detalles').value;
            filaEnEdicion.querySelector('.item-cant').value = document.getElementById('mob-cant').value;
            filaEnEdicion.querySelector('.item-moneda').value = document.getElementById('mob-moneda').value;
            filaEnEdicion.querySelector('.item-precio').value = document.getElementById('mob-precio').value;
            filaEnEdicion.querySelector('.item-iva').value = document.getElementById('mob-iva').value;
            calcular();
            document.getElementById('modal-edicion-mobile')?.classList.remove('active');
        }
    });
}

const condWeb = document.getElementById('condiciones-web');
if (condWeb) {
    condWeb.value = `▪ Estos Precios INCLUYEN IVA\n▪ Valor cotizado es a cotización Dólar Oficial BANCO NACION a fecha Factura\n▪ Forma de Pago.: A convenir.\n▪ Plazo de Entrega.: Inmediato\n▪ Todo el equipamiento cotizado es nuevo sin uso y con su última versión de fabricación.\n▪ Estos precios incluyen los gastos de flete, seguro de transporte y acarreo.\n▪ Los equipos se entregarán con su manual correspondiente de uso.\n▪ Testa Equipamiento Medico es agente oficial y servicio técnico oficial de lo cotizado`;
}

const fileToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
};

const formPresupuesto = document.getElementById('form-presupuesto');
if(formPresupuesto) {
    formPresupuesto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-cloud-upload-alt fa-spin"></i> Procesando...';

        const cliente = document.getElementById('cliente-nombre').value || "Desconocido";
        const nroBase = nroInput ? nroInput.value : "0";
        const fechaElegida = fechaInput ? fechaInput.value : new Date().toISOString().split('T')[0]; 
        const fechaObj = new Date(fechaElegida + 'T00:00:00');
        const anioCur = fechaObj.getFullYear().toString().slice(-2);
        
        localStorage.setItem('testa_ultimo_nro', nroBase);
        const primerProd = tbody && tbody.querySelector('.item-row') ? tbody.querySelector('.item-desc').value || "Doc" : "Doc";
        
        // --- AQUÍ ESTÁ EL CAMBIO PARA EL NOMBRE LARG0 EXACTO ---
        const partesFecha = fechaElegida.split('-'); 
        const dia = partesFecha[2];
        const mes = partesFecha[1];
        const anio = partesFecha[0].slice(-2); 
        
        const fechaFormateada = `${dia} - ${mes} - ${anio}`; 

        // Crea el nombre largo como: 26 - 03 - 26 - Compras CNYF - M181-26 - Camillas de Traslado
        const nombreDeseado = `${fechaFormateada} - ${cliente} - M${nroBase}-${anioCur} - ${primerProd}`.replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, "");
        
        const nombreCarpetaDeseado = nombreDeseado;
        const fileName = `${nombreDeseado}.pdf`;

        const pClienteNom = document.getElementById('pdf-cliente-nombre'); if(pClienteNom) pClienteNom.textContent = cliente;
        const pNroPres = document.getElementById('pdf-nro-presupuesto-texto'); if(pNroPres) pNroPres.textContent = `M ${nroBase}-${anioCur}`;
        const pFechaText = document.getElementById('pdf-fecha-text'); if(pFechaText) pFechaText.textContent = "Mar del Plata, " + fechaObj.toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
        const pCondContainer = document.getElementById('pdf-condiciones-container'); if(pCondContainer && condWeb) pCondContainer.textContent = condWeb.value;

        const pdfTbody = document.getElementById('pdf-tbody');
        if(pdfTbody && tbody) {
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
        }

        const b = document.getElementById('web-base-imponible')?.textContent || "0.00";
        const i10 = document.getElementById('web-iva-10')?.textContent || "0.00";
        const i21 = document.getElementById('web-iva-21')?.textContent || "0.00";
        const t = document.getElementById('web-total-final')?.textContent || "0.00";
        let sim = tbody?.querySelector('.simbolo-linea')?.textContent || "$";

        const pTfoot = document.getElementById('pdf-tfoot');
        if(pTfoot) {
            pTfoot.innerHTML = `
                <tr><td colspan="4" style="border:none;"></td><td style="border:1px solid #003b5c; padding:8px; text-align:right; background:#d0e4f5; font-weight:bold;">BASE IMPONIBLE</td><td style="border:1px solid #003b5c; padding:8px; text-align:right; background:#d0e4f5; font-weight:bold;">${sim} ${b}</td></tr>
                <tr><td colspan="4" style="border:none;"></td><td style="border:1px solid #003b5c; padding:8px; text-align:right;">IVA 10,5 %</td><td style="border:1px solid #003b5c; padding:8px; text-align:right;">${sim} ${i10}</td></tr>
                <tr><td colspan="4" style="border:none;"></td><td style="border:1px solid #003b5c; padding:8px; text-align:right;">IVA 21%</td><td style="border:1px solid #003b5c; padding:8px; text-align:right;">${sim} ${i21}</td></tr>
                <tr><td colspan="4" style="border:none;"></td><td style="border:1px solid #003b5c; padding:8px; text-align:right; background:#b8d1e8; font-weight:bold; color:#003b5c;">TOTAL CON IVA INCLUIDO</td><td style="border:1px solid #003b5c; padding:8px; text-align:right; background:#b8d1e8; font-weight:bold; color:#003b5c;">${sim} ${t}</td></tr>`;
        }

        const wrapper = document.getElementById('pdf-wrapper');
        if(wrapper) { wrapper.style.opacity = "1"; wrapper.style.zIndex = "9999"; }

        try {
            const element = document.getElementById('pdf-content');
            if(!element) throw new Error("No se encontró el contenedor del PDF");
            const opt = { margin: 0, image: { type: 'jpeg', quality: 1 }, html2canvas: { scale: 2, width: 800, height: 1131, useCORS: true }, jsPDF: { unit: 'px', format: [800, 1131], orientation: 'portrait' } };

            const pdfObj = await html2pdf().set(opt).from(element).toPdf().get('pdf');
            const { PDFDocument } = PDFLib;
            let finalPdf = await PDFDocument.load(pdfObj.output('arraybuffer'));
            
            const fileInput = document.getElementById('input-folleto-pdf');
            if (fileInput && fileInput.files.length > 0) {
                const folletoPdf = await PDFDocument.load(await fileInput.files[0].arrayBuffer());
                const paginasCopiadas = await finalPdf.copyPages(folletoPdf, folletoPdf.getPageIndices());
                paginasCopiadas.forEach(page => finalPdf.addPage(page));
            }

            const pdfBytes = await finalPdf.save();
            const blob = new Blob([pdfBytes], { type: "application/pdf" });

            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = fileName;
            link.click();

            const base64data = await fileToBase64(blob);
            
            const peticionDrive = await fetch(urlGoogleScript, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ 
                    pdfBase64: base64data, 
                    fileName: fileName,
                    carpeta: nombreCarpetaDeseado 
                })
            });

            const respuestaDrive = await peticionDrive.json();
            const linkDrive = respuestaDrive.url; 

            // GUARDAMOS EL EXPEDIENTE EN FIREBASE CON EL NOMBRE LARGO
            const q = query(collection(db, "presupuestos"), where("medico", "==", cliente));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
                await updateDoc(doc(db, "presupuestos", querySnap.docs[0].id), { 
                    nombreArchivo: nombreDeseado, 
                    estado: 'pendiente',
                    fecha: fechaElegida,
                    link: linkDrive 
                });
            } else {
                await addDoc(collection(db, "presupuestos"), { 
                    medico: cliente, 
                    fecha: fechaElegida, 
                    estado: 'pendiente', 
                    nombreArchivo: nombreDeseado,
                    link: linkDrive, 
                    archivosExtra: {} 
                });
            }

            // VINCULACIÓN A LA VISITA
            const visitaElegida = document.getElementById('vinculo-visita')?.value;
            if (visitaElegida) {
                const [cId, vIdx] = visitaElegida.split('_');
                const cRef = doc(db, "clientes", cId);
                const cSnap = await getDoc(cRef);
                if (cSnap.exists()) {
                    let vits = cSnap.data().visitas;
                    vits[vIdx].presupuestoLink = linkDrive; 
                    await updateDoc(cRef, { visitas: vits });
                }
            }
            
            alert("¡Presupuesto generado y vinculado al CRM con éxito!");
            window.location.href = "presupuesto.html";

        } catch (error) { 
            console.error("Error:", error); 
            alert("Error al procesar el PDF."); 
        } finally { 
            if(wrapper) { wrapper.style.opacity = "0"; wrapper.style.zIndex = "-9999"; }
            btnSubmit.disabled = false; 
            btnSubmit.innerHTML = '<i class="fa-solid fa-file-pdf"></i> GENERAR PDF'; 
        }
    });
}

// ==========================================
// 4. LECTURA DE FIREBASE (AL FINAL DE TODO)
// ==========================================
onSnapshot(collection(db, "clientes"), (snap) => {
    listaMedicosCompletos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const dl = document.getElementById('lista-nombres-medicos');
    if (dl) {
        dl.innerHTML = listaMedicosCompletos.map(m => `<option value="${m.nombre}">${m.nombre}</option>`).join('');
    }
});

onSnapshot(collection(db, "productos"), (snap) => {
    PRODUCTOS_DB = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});