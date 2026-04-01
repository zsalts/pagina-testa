import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
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

// ACÁ ESTÁ LA CLAVE: Le pusimos "export" a la app para que el Guardián la pueda usar
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);