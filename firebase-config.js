import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

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

// Persistencia offline para evitar problemas de carga
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("La persistencia falló (múltiples pestañas)");
    } else if (err.code == 'unimplemented') {
        console.warn("El navegador no soporta persistencia");
    }
});

export { db, storage };

console.log("🔥 Firebase Config: Cargado correctamente");
console.log("DB Instance:", db);