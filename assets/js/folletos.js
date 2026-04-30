import { db, storage } from "./firebase-config.js";
import { collection, addDoc, onSnapshot, deleteDoc, updateDoc, doc, serverTimestamp, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

const urlGoogleScript = "https://script.google.com/macros/s/AKfycbwn_SWhv-OkGSXI3WjWqE8b9-EfcbCEit3CbzXLZASrtE7e8igj9jsr5yJ9V93bE-kP_A/exec";

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
    });
};

// CERRAR MODALES CON LA "X" O EL FONDO
document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-close-modal') || e.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-crear-carpeta')?.classList.remove('active');
        document.getElementById('modal-editar-carpeta')?.classList.remove('active');
        document.getElementById('modal-editar-folleto')?.classList.remove('active');
    }
});

// ==========================================
// 1. CREAR NUEVA CARPETA (MODAL)
// ==========================================
const btnAbrirCrearCarpeta = document.getElementById('btn-abrir-crear-carpeta');
const formCrearCarpeta = document.getElementById('form-crear-carpeta');

if (btnAbrirCrearCarpeta) {
    btnAbrirCrearCarpeta.addEventListener('click', () => {
        document.getElementById('input-nueva-carpeta').value = "";
        document.getElementById('modal-crear-carpeta').classList.add('active');
    });
}

if (formCrearCarpeta) {
    formCrearCarpeta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nuevaCarpeta = document.getElementById('input-nueva-carpeta').value.trim();
        const btnSubmit = formCrearCarpeta.querySelector('button[type="submit"]');

        if (!nuevaCarpeta) return;
        
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';

        try {
            await addDoc(collection(db, "folletos"), {
                nombre: "_vacio",
                categoria: nuevaCarpeta,
                esCarpetaVacia: true,
                fecha: serverTimestamp()
            });

            const selectCategoria = document.getElementById('categoria-folleto');
            if(selectCategoria) selectCategoria.value = nuevaCarpeta;

            await fetch(urlGoogleScript, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ action: "createFolder", carpeta: nuevaCarpeta })
            });

            document.getElementById('modal-crear-carpeta').classList.remove('active');
        } catch (err) {
            console.error("Error:", err);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Confirmar y Crear';
        }
    });
}

// ==========================================
// 2. RENOMBRAR CARPETA EXISTENTE (MODAL)
// ==========================================
const btnAbrirEditarCarpeta = document.getElementById('btn-abrir-editar-carpeta');
const formEditarCarpeta = document.getElementById('form-editar-carpeta');

if (btnAbrirEditarCarpeta) {
    btnAbrirEditarCarpeta.addEventListener('click', () => {
        const selectCategoria = document.getElementById('categoria-folleto');
        const oldName = selectCategoria.value;
        
        if (!oldName) {
            alert("Por favor, elegí una categoría del menú desplegable primero.");
            return;
        }

        document.getElementById('edit-carpeta-oldname').value = oldName;
        document.getElementById('input-editar-carpeta').value = oldName;
        document.getElementById('modal-editar-carpeta').classList.add('active');
    });
}

if (formEditarCarpeta) {
    formEditarCarpeta.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldName = document.getElementById('edit-carpeta-oldname').value;
        const newName = document.getElementById('input-editar-carpeta').value.trim();
        const btnSubmit = formEditarCarpeta.querySelector('button[type="submit"]');

        if (!newName || oldName === newName) return;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            // A. Buscar todos los folletos de esta categoría y cambiarles el nombre a la nueva
            const q = query(collection(db, "folletos"), where("categoria", "==", oldName));
            const querySnapshot = await getDocs(q);
            
            const promesasUpdate = [];
            querySnapshot.forEach((docSnap) => {
                promesasUpdate.push(updateDoc(doc(db, "folletos", docSnap.id), { categoria: newName }));
            });
            await Promise.all(promesasUpdate);

            // B. Actualizar en Google Drive
            await fetch(urlGoogleScript, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ action: "renameFolder", oldFolderName: oldName, newFolderName: newName })
            });

            const selectCategoria = document.getElementById('categoria-folleto');
            if (selectCategoria) selectCategoria.value = newName;

            document.getElementById('modal-editar-carpeta').classList.remove('active');
        } catch(err) {
            console.error("Error al renombrar la carpeta:", err);
            alert("Hubo un error al renombrar la carpeta.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Guardar Cambios';
        }
    });
}

// ==========================================
// 3. LÓGICA DE SUBIDA DE FOLLETOS
// ==========================================
const formSubir = document.getElementById('form-subir-folleto');
const btnSubmitFolleto = document.getElementById('btn-submit-folleto');

if (formSubir) {
    formSubir.onsubmit = async (e) => {
        e.preventDefault();
        
        const inputNombreBase = document.getElementById('nombre-folleto').value.trim();
        const categoriaSeleccionada = document.getElementById('categoria-folleto').value;
        const inputFiles = document.getElementById('archivo-folleto').files;

        if (inputFiles.length === 0 || !categoriaSeleccionada) return;

        btnSubmitFolleto.disabled = true;
        
        let subidosExitosamente = 0;
        let errores = 0;

        for (let i = 0; i < inputFiles.length; i++) {
            const inputFile = inputFiles[i];
            
            btnSubmitFolleto.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando folleto ${i + 1} de ${inputFiles.length}...`;

            const nombreOriginal = inputFile.name.replace(/\.[^/.]+$/, "");
            let nombreFinal = nombreOriginal; 
            
            if (inputNombreBase !== "") {
                if (inputFiles.length > 1) {
                    nombreFinal = `${inputNombreBase} - Parte ${i + 1}`;
                } else {
                    nombreFinal = inputNombreBase;
                }
            }

            try {
                const fileNameUnico = Date.now() + '_' + inputFile.name;
                const storageRef = ref(storage, `folletos/${fileNameUnico}`);
                await uploadBytes(storageRef, inputFile);
                const downloadURL = await getDownloadURL(storageRef);

                await addDoc(collection(db, "folletos"), {
                    nombre: nombreFinal,
                    categoria: categoriaSeleccionada,
                    url: downloadURL,
                    fileNameStorage: fileNameUnico,
                    fecha: serverTimestamp()
                });

                const base64data = await fileToBase64(inputFile);
                const nombreParaDrive = nombreFinal + ".pdf";
                
                await fetch(urlGoogleScript, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify({ 
                        pdfBase64: base64data, 
                        fileName: nombreParaDrive, 
                        carpeta: categoriaSeleccionada 
                    })
                });

                subidosExitosamente++;
            } catch (error) {
                console.error("Error al subir:", error);
                errores++;
            }
        }

        if (errores === 0) {
            alert(`¡Guardado exitoso! Se guardaron ${subidosExitosamente} archivo/s.`);
        } else {
            alert(`Se guardaron ${subidosExitosamente} archivos, pero hubo ${errores} errores. Revisá la conexión.`);
        }

        formSubir.reset();
        btnSubmitFolleto.disabled = false;
        btnSubmitFolleto.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Guardar Folleto/s`;
    };
}

// ==========================================
// 4. RENDERIZAR EL CATÁLOGO (ACORDEÓN)
// ==========================================
const contenedorAcordeon = document.getElementById('catalogo-acordeon');

onSnapshot(collection(db, "folletos"), (snapshot) => {
    if (!contenedorAcordeon) return;

    if (snapshot.empty) {
        contenedorAcordeon.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted); background: white; border-radius: 8px; border: 1px dashed var(--border-color);">No hay folletos cargados en el catálogo aún.</div>`;
        return;
    }

    const folletos = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    const folletosPorCategoria = {};
    
    folletos.forEach(f => {
        const cat = f.categoria || "Sin Categoría";
        if (!folletosPorCategoria[cat]) {
            folletosPorCategoria[cat] = [];
        }
        
        if (f.nombre !== "_vacio" && !f.esCarpetaVacia) {
            folletosPorCategoria[cat].push(f);
        }
    });

    let html = '';
    const categoriasOrdenadas = Object.keys(folletosPorCategoria).sort();

    const selectCategoria = document.getElementById('categoria-folleto');
    if (selectCategoria) {
        const valueActual = selectCategoria.value; 
        const categoriasExistentes = Array.from(selectCategoria.options).map(o => o.value);
        
        categoriasOrdenadas.forEach(cat => {
            if (!categoriasExistentes.includes(cat) && cat !== "Sin Categoría") {
                const nuevaOpcion = document.createElement('option');
                nuevaOpcion.value = cat;
                nuevaOpcion.textContent = cat;
                selectCategoria.appendChild(nuevaOpcion);
            }
        });
        
        Array.from(selectCategoria.options).forEach(opt => {
            if (opt.value && !categoriasOrdenadas.includes(opt.value)) {
                opt.remove();
            }
        });

        if(valueActual) selectCategoria.value = valueActual;
    }

    categoriasOrdenadas.forEach(categoria => {
        const catId = categoria.replace(/[^a-zA-Z0-9]/g, "");
        const cantidadItems = folletosPorCategoria[categoria].length;
        const itemsOrdenados = folletosPorCategoria[categoria].sort((a, b) => a.nombre.localeCompare(b.nombre));

        html += `
        <div class="acordeon-item">
            <button class="acordeon-header" onclick="window.toggleCategoria('${catId}')" id="btn-${catId}">
                <span style="font-weight: 700; display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-folder-open" style="color: var(--testa-blue); font-size: 18px;"></i> 
                    ${categoria} 
                    <span style="background: var(--testa-blue-tint); padding: 2px 8px; border-radius: 12px; font-size: 11px; color: var(--testa-blue-dark);">${cantidadItems}</span>
                </span>
                <i class="fa-solid fa-chevron-down icon-arrow"></i>
            </button>
            
            <div class="acordeon-content" id="content-${catId}" style="display: none;">
                <table class="testa-table" style="margin: 0; box-shadow: none; border-radius: 0;">
                    <thead>
                        <tr>
                            <th>Nombre del Folleto</th>
                            <th>Fecha</th>
                            <th>Archivo</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (cantidadItems === 0) {
            html += `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 15px;">Carpeta vacía</td></tr>`;
        } else {
            itemsOrdenados.forEach(data => {
                let fechaDisplay = "Reciente";
                if (data.fecha) fechaDisplay = data.fecha.toDate().toLocaleDateString('es-AR');

                const nombreSeguro = data.nombre.replace(/'/g, "\\'");
                const categoriaSegura = (data.categoria || "").replace(/'/g, "\\'");

                html += `
                            <tr>
                                <td data-label="Nombre"><span class="medico-name">${data.nombre}</span></td>
                                <td data-label="Fecha">${fechaDisplay}</td>
                                <td data-label="Archivo">
                                    <a href="${data.url}" target="_blank" class="btn btn-secondary-tint" style="display: inline-flex; padding: 6px 12px;">
                                        <i class="fa-solid fa-eye"></i> Ver PDF
                                    </a>
                                </td>
                                <td data-label="Acción">
                                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                                        <button class="btn-icon btn-edit" onclick="window.abrirModalEdicionFolleto('${data.id}', '${nombreSeguro}', '${categoriaSegura}')" title="Editar Nombre">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                        <button class="btn-icon btn-delete" onclick="window.borrarFolleto('${data.id}', '${data.fileNameStorage}')" title="Borrar Folleto">
                                            <i class="fa-regular fa-trash-can"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        </div>
        `;
    });

    contenedorAcordeon.innerHTML = html;
}, (error) => {
    console.error("Error leyendo folletos: ", error);
});

// ==========================================
// 5. FUNCIONES GLOBALES DE LA UI
// ==========================================
window.toggleCategoria = (catId) => {
    const contenido = document.getElementById('content-' + catId);
    const boton = document.getElementById('btn-' + catId);
    if (contenido.style.display === 'none') {
        contenido.style.display = 'block';
        boton.classList.add('activo');
    } else {
        contenido.style.display = 'none';
        boton.classList.remove('activo');
    }
};

window.borrarFolleto = async (firestoreId, fileNameStorage) => {
    if (confirm("¿Estás seguro de eliminar este folleto? (Solo se borra del CRM)")) {
        try {
            const fileRef = ref(storage, `folletos/${fileNameStorage}`);
            await deleteObject(fileRef);
            await deleteDoc(doc(db, "folletos", firestoreId));
        } catch (error) {
            alert("Hubo un error al intentar eliminar el folleto.");
        }
    }
};

window.abrirModalEdicionFolleto = (id, nombreActual, categoria) => {
    const modal = document.getElementById('modal-editar-folleto');
    if (modal) {
        document.getElementById('edit-folleto-id').value = id;
        document.getElementById('edit-folleto-nombre').value = nombreActual;
        document.getElementById('edit-folleto-oldname').value = nombreActual; 
        document.getElementById('edit-folleto-categoria').value = categoria;
        modal.classList.add('active');
    }
};

const formEditarFolleto = document.getElementById('form-editar-folleto');
if (formEditarFolleto) {
    formEditarFolleto.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit-folleto-id').value;
        const nuevoNombre = document.getElementById('edit-folleto-nombre').value.trim();
        const oldName = document.getElementById('edit-folleto-oldname').value;
        const categoria = document.getElementById('edit-folleto-categoria').value;
        const btnSubmitEdit = formEditarFolleto.querySelector('button[type="submit"]');

        if (!id || !nuevoNombre) return;

        btnSubmitEdit.disabled = true;
        btnSubmitEdit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';

        try {
            await updateDoc(doc(db, "folletos", id), { nombre: nuevoNombre });

            try {
                await fetch(urlGoogleScript, {
                    method: "POST",
                    mode: "no-cors",
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify({
                        action: "rename",
                        oldName: oldName + ".pdf",
                        newName: nuevoNombre + ".pdf",
                        carpeta: categoria
                    })
                });
            } catch (errDrive) {
                console.error("Drive error:", errDrive);
            }

            document.getElementById('modal-editar-folleto').classList.remove('active');
        } catch (error) {
            alert("Hubo un error al actualizar el nombre del folleto.");
        } finally {
            btnSubmitEdit.disabled = false;
            btnSubmitEdit.innerHTML = 'Guardar y Sincronizar en Drive';
        }
    });
}