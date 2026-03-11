import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

let listaClinicas = [];

onSnapshot(collection(db, "instituciones"), (snap) => {
    listaClinicas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const dl = document.getElementById('lista-instituciones');
    if(dl) dl.innerHTML = listaClinicas.map(c => `<option value="${c.nombre}"></option>`).join('');
    
    const gestor = document.getElementById('lista-clinicas-gestion');
    if(gestor) {
        gestor.innerHTML = listaClinicas.length ? listaClinicas.map(c => `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee; align-items:center;">
                <span><b>${c.nombre}</b><br><small style="color:gray">${c.direccion}</small></span>
                <button class="btn-icon" onclick="window.borrarClinica('${c.id}')" style="color:red"><i class="fa-regular fa-trash-can"></i></button>
            </div>
        `).join('') : '<p style="text-align:center;color:gray;padding:10px;">No hay clínicas cargadas.</p>';
    }
});

// Autocompletado de dirección
document.getElementById('institucion').oninput = (e) => {
    const found = listaClinicas.find(c => c.nombre === e.target.value);
    if(found) {
        const inputDir = document.getElementById('direccion');
        inputDir.value = found.direccion;
        inputDir.style.backgroundColor = "#dcfce7";
        setTimeout(() => inputDir.style.backgroundColor = "transparent", 800);
    }
};

document.getElementById('form-clinica').onsubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "instituciones"), {
        nombre: document.getElementById('nombre-clinica').value,
        direccion: document.getElementById('direccion-clinica').value
    });
    e.target.reset();
};

window.borrarClinica = async (id) => { if(confirm("¿Borrar clínica?")) await deleteDoc(doc(db, "instituciones", id)); };

document.getElementById('btn-clinicas').onclick = () => document.getElementById('modal-clinicas').classList.add('active');