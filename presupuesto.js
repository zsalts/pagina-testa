import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, query, where, deleteField } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

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
const storage = getStorage(app);
const urlGoogleScript = "https://script.google.com/macros/s/AKfycby_iXJtc34gbu_Y_6sQ85s04v5lg0xEF6oZsf3uulXazmDQyg61kDzXblrRF2UOtl8Q/exec"; 

let listaPresupuestos = [];
let listaMedicos = [];
let vistaActual = 'pendientes'; 

// ==========================================
// 1. ANTI-CONGELAMIENTO
// ==========================================
window.addEventListener('pageshow', (event) => {
    if (event.persisted) { window.location.reload(); }
});

// ==========================================
// 2. FUNCIONES GLOBALES Y MODALES
// ==========================================
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal') || e.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-presupuesto')?.classList.remove('active');
        document.getElementById('modal-archivo-extra')?.classList.remove('active');
        document.getElementById('modal-editar-presupuesto')?.classList.remove('active');
    }
});

window.pesoDoc = function(tipoDocumento) {
    let t = tipoDocumento.toLowerCase();
    if (t.includes("presupuesto")) return 1;
    if (t.includes("cliente")) return 2;
    if (t.includes("proveedor")) return 3;
    if (t.includes("orden") || t.includes("oc")) return 4;
    if (t.includes("factura")) return 5;
    if (t.includes("remito")) return 6;
    if (t.includes("recibo")) return 7;
    return 8; 
};

window.obtenerAbreviatura = function(tipoDocumento) {
    let tipo = tipoDocumento.toLowerCase(); 
    if (tipo.includes("presupuesto")) return `PRE`;
    if (tipo.includes("cliente")) return `OCC`;
    if (tipo.includes("proveedor")) return `OCP`;
    if (tipo.includes("orden") || tipo.includes("oc")) return `OC`;
    if (tipo.includes("factura")) return `FAC`;
    if (tipo.includes("remito")) return `REM`;
    if (tipo.includes("recibo")) return `REC`;
    return `DOC`; 
};

window.dibujarTablaPresupuestos = function() {
    const cuerpo = document.getElementById('cuerpo-tabla-presupuestos');
    if (!cuerpo) return;

    let tableContainer = document.querySelector('.table-card'); 
    
    if (tableContainer && !document.getElementById('tabs-expedientes')) {
        let tabsHTML = `
        <div id="tabs-expedientes" style="display: flex; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-radius: 8px 8px 0 0; overflow: hidden;">
            <button id="tab-pendientes" style="flex:1; padding: 15px; font-weight: bold; border:none; background: white; color: #0284c7; border-bottom: 3px solid #0284c7; cursor:pointer; font-size: 15px; transition: 0.3s;">
                <i class="fa-solid fa-clock-rotate-left"></i> Pendientes
            </button>
            <button id="tab-completados" style="flex:1; padding: 15px; font-weight: bold; border:none; background: transparent; color: #64748b; border-bottom: 3px solid transparent; cursor:pointer; font-size: 15px; transition: 0.3s;">
                <i class="fa-solid fa-folder-closed"></i> Historial (Aprob. / Cerrados)
            </button>
        </div>
        `;
        tableContainer.insertAdjacentHTML('afterbegin', tabsHTML);

        document.getElementById('tab-pendientes').onclick = () => {
            vistaActual = 'pendientes';
            document.getElementById('tab-pendientes').style.background = 'white';
            document.getElementById('tab-pendientes').style.color = '#0284c7';
            document.getElementById('tab-pendientes').style.borderBottom = '3px solid #0284c7';
            document.getElementById('tab-completados').style.background = 'transparent';
            document.getElementById('tab-completados').style.color = '#64748b';
            document.getElementById('tab-completados').style.borderBottom = '3px solid transparent';
            window.dibujarTablaPresupuestos(); 
        };

        document.getElementById('tab-completados').onclick = () => {
            vistaActual = 'completados';
            document.getElementById('tab-completados').style.background = 'white';
            document.getElementById('tab-completados').style.color = '#475569';
            document.getElementById('tab-completados').style.borderBottom = '3px solid #475569';
            document.getElementById('tab-pendientes').style.background = 'transparent';
            document.getElementById('tab-pendientes').style.color = '#64748b';
            document.getElementById('tab-pendientes').style.borderBottom = '3px solid transparent';
            window.dibujarTablaPresupuestos(); 
        };
    }
    
    let stats = { pen: 0, apr: 0, cer: 0 };
    let pendientes = [];
    let completados = [];

    listaPresupuestos.sort((a, b) => b.fecha.localeCompare(a.fecha));

    listaPresupuestos.forEach(p => {
        if (p.estado === 'pendiente') {
            stats.pen++;
            pendientes.push(p);
        } else {
            if (p.estado === 'aprobado') stats.apr++;
            if (p.estado === 'cerrado') stats.cer++;
            completados.push(p);
        }
    });

    const generarFilas = (lista) => {
        if (lista.length === 0) return `<tr><td colspan="6" class="row-empty" style="text-align:center; padding: 30px; color: #64748b;">No hay expedientes en esta lista.</td></tr>`;
        
        let htmlFilas = '';
        lista.forEach(p => {
            let colorBadge = p.estado === 'pendiente' ? 'badge-pendiente' : (p.estado === 'aprobado' ? 'badge-completado' : 'badge');
            let colorFondoBadge = p.estado === 'cerrado' ? '#475569' : ''; 
            let colorTextoBadge = p.estado === 'cerrado' ? 'white' : '';

            const estiloBadgeDoc = `display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-weight: bold; font-size: 0.85em; padding: 4px 8px; background: #f1f5f9; border-radius: 6px; border: 1px solid #e2e8f0; color: #334155; margin-right: 5px; min-width: 35px;`;

            let docsHTML = p.link ? `<a href="${p.link}" target="_blank" style="${estiloBadgeDoc}" title="Presupuesto Inicial">PRE</a>` : '';
            
            if (p.archivosExtra) {
                let extras = Object.entries(p.archivosExtra);
                extras.sort((a, b) => window.pesoDoc(a[0]) - window.pesoDoc(b[0]));
                
                extras.forEach(([tipo, url]) => {
                    let abreviatura = window.obtenerAbreviatura(tipo);
                    docsHTML += `<a href="${url}" target="_blank" style="${estiloBadgeDoc}" title="${tipo}">${abreviatura}</a>`;
                });
            }

            let carpetaDestino = p.carpetaUnica || p.medico;
            let btnAddDoc = (p.estado === 'aprobado' || p.estado === 'pendiente') ? `<button class="btn-icon" onclick="window.abrirModalDoc('${p.id}', '${carpetaDestino}')" style="color: var(--green-success); margin-left:5px; font-size: 1.2em;" title="Adjuntar Documentación"><i class="fa-solid fa-circle-plus"></i></button>` : '';

            let botonesAccion = `
                <div style="display:flex; gap: 8px; justify-content: center;">
                    <button class="btn-icon" onclick="window.abrirModalEditar('${p.id}')" style="color: #0ea5e9;" title="Editar Expediente"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon btn-delete" onclick="window.borrarPresupuesto('${p.id}')" title="Borrar Todo"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            `;

            htmlFilas += `<tr>
                <td><strong>${p.medico}</strong></td>
                <td>${new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                <td data-label="Nombre del Presupuesto"><div class="pedido-text">${p.nombreArchivo || 'Presupuesto Inicial'}</div></td>
                <td><span class="badge ${colorBadge}" onclick="window.rotarEstado('${p.id}', '${p.estado}')" style="cursor:pointer; background:${colorFondoBadge}; color:${colorTextoBadge}" title="Hacé clic para cambiar estado">${p.estado.toUpperCase()} <i class="${p.estado === 'cerrado' ? 'fa-solid fa-lock' : ''}"></i></span></td>
                <td><div style="display:flex; flex-wrap: wrap; gap:5px; align-items:center;">${docsHTML}${btnAddDoc}</div></td>
                <td>${botonesAccion}</td>
            </tr>`;
        });
        return htmlFilas;
    };

    if (vistaActual === 'pendientes') {
        cuerpo.innerHTML = generarFilas(pendientes);
    } else {
        cuerpo.innerHTML = generarFilas(completados);
    }

    const statPen = document.getElementById('stat-pendientes');
    if(statPen) statPen.innerText = stats.pen;
    
    const statApr = document.getElementById('stat-aprobados');
    if(statApr) statApr.innerText = stats.apr;

    const statCer = document.getElementById('stat-cerrados');
    if(statCer) statCer.innerText = stats.cer;
    
    const buscador = document.getElementById('buscador-presupuestos');
    if(buscador && buscador.value) {
        buscador.dispatchEvent(new Event('input'));
    }
};

window.abrirModalEditar = (id) => {
    const p = listaPresupuestos.find(x => x.id === id);
    if (!p) return;

    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-fecha').value = p.fecha;
    document.getElementById('edit-detalle').value = p.detalle || '';

    const contenedorArchivos = document.getElementById('lista-archivos-edit');
    let htmlArchivos = '';
    
    if (p.archivosExtra && Object.keys(p.archivosExtra).length > 0) {
        Object.entries(p.archivosExtra).forEach(([tipo, url]) => {
            htmlArchivos += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; margin-bottom: 5px; border-radius: 4px; border: 1px solid #e2e8f0;">
                <span style="font-size: 0.9em; font-weight: 600; color: #334155;">${tipo}</span>
                <button type="button" onclick="window.borrarArchivoExtra('${p.id}', '${tipo}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.1em;" title="Desvincular archivo">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>`;
        });
    } else {
        htmlArchivos = '<p style="font-size: 0.85em; color: #64748b; margin: 0; text-align: center;">No hay documentos adjuntos para borrar.</p>';
    }
    
    if(contenedorArchivos) contenedorArchivos.innerHTML = htmlArchivos;
    document.getElementById('modal-editar-presupuesto')?.classList.add('active');
};

window.borrarArchivoExtra = async (idExpediente, tipoDoc) => {
    if (confirm(`¿Seguro que querés desvincular la "${tipoDoc}" de este expediente?`)) {
        try {
            const pRef = doc(db, "presupuestos", idExpediente);
            await updateDoc(pRef, {
                [`archivosExtra.${tipoDoc}`]: deleteField()
            });
            window.abrirModalEditar(idExpediente);
        } catch (error) {
            alert("Hubo un error al borrar el archivo.");
        }
    }
};

window.abrirModalDoc = (id, carpeta) => {
    document.getElementById('extra-id').value = id;
    document.getElementById('extra-carpeta').value = carpeta;
    document.getElementById('modal-archivo-extra')?.classList.add('active');
};

window.rotarEstado = async (id, actual) => {
    let sig = actual === 'pendiente' ? 'aprobado' : (actual === 'aprobado' ? 'cerrado' : 'pendiente');
    if (confirm(`¿Pasar a ${sig.toUpperCase()}?`)) await updateDoc(doc(db, "presupuestos", id), { estado: sig });
};

window.borrarPresupuesto = async (id) => { if (confirm("¿Borrar expediente completo?")) await deleteDoc(doc(db, "presupuestos", id)); };


// ==========================================
// 3. EVENTOS DE BOTONES
// ==========================================
const btnNuevoPresupuesto = document.getElementById('btn-nuevo-presupuesto');
if (btnNuevoPresupuesto) {
    btnNuevoPresupuesto.addEventListener('click', () => {
        document.getElementById('form-presupuesto')?.reset();
        const presFecha = document.getElementById('pres-fecha');
        if(presFecha) presFecha.value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-presupuesto')?.classList.add('active');
    });
}

const formEditarPres = document.getElementById('form-editar-presupuesto');
if (formEditarPres) {
    formEditarPres.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const id = document.getElementById('edit-id').value;
        const nuevaFecha = document.getElementById('edit-fecha').value;
        const nuevoDetalle = document.getElementById('edit-detalle').value;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            await updateDoc(doc(db, "presupuestos", id), {
                fecha: nuevaFecha,
                detalle: nuevoDetalle
            });
            document.getElementById('modal-editar-presupuesto')?.classList.remove('active');
        } catch (error) {
            alert("Error al actualizar el expediente.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Guardar Cambios";
        }
    };
}

const presMedico = document.getElementById('pres-medico');
if (presMedico) {
    presMedico.addEventListener('change', async (e) => {
        const medicoElegido = e.target.value.trim();
        const selectVisitas = document.getElementById('pres-visita');
        if(!selectVisitas) return;

        if (!medicoElegido) { selectVisitas.innerHTML = '<option value="">-- Escribí un médico primero --</option>'; return; }
        selectVisitas.innerHTML = '<option value="">Buscando visitas...</option>';
        try {
            const q = query(collection(db, "clientes"), where("nombre", "==", medicoElegido));
            const snap = await getDocs(q);
            if (snap.empty) { selectVisitas.innerHTML = '<option value="">El médico no existe</option>'; return; }
            let opciones = '<option value="">-- Elegí la visita --</option>';
            let tieneVisitas = false;
            snap.forEach(documento => {
                const cliente = documento.data();
                if (cliente.visitas) {
                    tieneVisitas = true;
                    cliente.visitas.forEach((v, index) => {
                        opciones += `<option value="${documento.id}_${index}">${v.fecha} - ${v.pedido.substring(0,30)}...</option>`;
                    });
                }
            });
            selectVisitas.innerHTML = tieneVisitas ? opciones : '<option value="">No tiene visitas cargadas</option>';
        } catch (e) { selectVisitas.innerHTML = '<option value="">Error al buscar</option>'; }
    });
}

const formPres = document.getElementById('form-presupuesto');
if (formPres) {
    formPres.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const archivoFisico = document.getElementById('pres-archivo').files[0];
        const medico = document.getElementById('pres-medico').value.trim();
        if (!archivoFisico) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const nombreOriginalConExt = archivoFisico.name;
            const nombreOriginalSinExt = nombreOriginalConExt.split('.').slice(0, -1).join('.');
            const fechaInput = document.getElementById('pres-fecha').value; 
            const partes = fechaInput.split('-');
            const fechaFormateada = `${partes[2]} - ${partes[1]} - ${partes[0].substring(2)}`;
            const medicoLimpio = medico.replace(/[^a-zA-Z0-9 ]/g, '');
            
            const nombreCarpeta = `${fechaFormateada} - ${medicoLimpio} - ${nombreOriginalSinExt}`;
            const nombreArchivoFinal = nombreOriginalConExt;

            const refArch = ref(storage, `expedientes/${nombreCarpeta}/${nombreArchivoFinal}`);
            const snap = await uploadBytes(refArch, archivoFisico);
            const urlPublica = await getDownloadURL(snap.ref);

            await addDoc(collection(db, "presupuestos"), {
                medico, 
                fecha: fechaInput,
                estado: document.getElementById('pres-estado').value,
                detalle: document.getElementById('pres-detalle').value.trim(),
                nombreArchivo: nombreOriginalSinExt, 
                link: urlPublica, 
                carpetaUnica: nombreCarpeta, 
                archivosExtra: {}
            });

            const visitaVal = document.getElementById('pres-visita').value;
            if (visitaVal) {
                const [cId, vIdx] = visitaVal.split('_');
                const cRef = doc(db, "clientes", cId);
                const cSnap = await getDoc(cRef);
                if (cSnap.exists()) {
                    let vits = cSnap.data().visitas;
                    vits[vIdx].presupuestoLink = urlPublica;
                    await updateDoc(cRef, { visitas: vits });
                }
            }

            fetch(urlGoogleScript, {
                method: 'POST', mode: 'no-cors',
                body: JSON.stringify({ carpeta: nombreCarpeta, archivo: nombreArchivoFinal, link: urlPublica })
            }).catch(e => console.log("Drive Error:", e));

            document.getElementById('modal-presupuesto')?.classList.remove('active');
        } catch (e) { alert("Error al guardar."); } finally { btn.disabled = false; btn.innerText = "Guardar Presupuesto"; }
    };
}

const formExtra = document.getElementById('form-archivo-extra');
if (formExtra) {
    formExtra.onsubmit = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const id = document.getElementById('extra-id').value;
        const carpeta = document.getElementById('extra-carpeta').value;
        const tipo = document.getElementById('extra-tipo').value;
        const file = document.getElementById('extra-archivo').files[0];
        if (!file) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
        try {
            const nombreArchivoExtra = file.name;
            const refArch = ref(storage, `expedientes/${carpeta}/${nombreArchivoExtra}`);
            const snap = await uploadBytes(refArch, file);
            const url = await getDownloadURL(snap.ref);

            const pRef = doc(db, "presupuestos", id);
            await updateDoc(pRef, { [`archivosExtra.${tipo}`]: url });

            const pGuardado = listaPresupuestos.find(x => x.id === id);
            if (pGuardado) {
                let archivosActuales = pGuardado.archivosExtra ? Object.keys(pGuardado.archivosExtra) : [];
                if (!archivosActuales.includes(tipo)) archivosActuales.push(tipo);

                const obligatorios = ["Orden de Compra Proveedor", "Factura", "Remito", "Recibo de Cobro"];
                const tieneTodos = obligatorios.every(req => archivosActuales.includes(req));

                if (tieneTodos && pGuardado.estado !== 'cerrado') {
                    await updateDoc(pRef, { estado: 'cerrado' });
                }
            }

            fetch(urlGoogleScript, {
                method: 'POST', mode: 'no-cors',
                body: JSON.stringify({ carpeta: carpeta, archivo: nombreArchivoExtra, link: url })
            }).catch(e => console.log("Drive Error:", e));

            document.getElementById('modal-archivo-extra')?.classList.remove('active');
        } catch (e) { 
            alert("Error al adjuntar."); 
        } finally { 
            btn.disabled = false; 
            btn.innerText = "Subir a la Carpeta";
        }
    };
}

const buscadorPres = document.getElementById('buscador-presupuestos');
if (buscadorPres) {
    buscadorPres.addEventListener('input', (e) => {
        const textoBuscado = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.testa-table tbody tr').forEach(fila => {
            if (fila.querySelector('.row-empty')) return; 
            const contenidoFila = fila.textContent.toLowerCase();
            fila.style.display = contenidoFila.includes(textoBuscado) ? '' : 'none';
        });
    });
}

// ==========================================
// 4. LECTURA DE FIREBASE (AL FINAL DE TODO)
// ==========================================
onSnapshot(collection(db, "clientes"), (snap) => {
    listaMedicos = snap.docs.map(d => d.data().nombre);
    const dl = document.getElementById('lista-nombres-medicos');
    if (dl) dl.innerHTML = listaMedicos.map(nombre => `<option value="${nombre}">${nombre}</option>`).join('');
});

onSnapshot(collection(db, "presupuestos"), (snap) => {
    listaPresupuestos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if(typeof window.dibujarTablaPresupuestos === 'function') window.dibujarTablaPresupuestos();
});