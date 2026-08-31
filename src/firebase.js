import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDvtgS8F3CAgDTnbeLNsMFsH3AkwtPe1qc",
  authDomain: "bloom-teams.firebaseapp.com",
  projectId: "bloom-teams",
  storageBucket: "bloom-teams.firebasestorage.app",
  messagingSenderId: "1050168141162",
  appId: "1:1050168141162:web:b9f0f9bab58325fae97113"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export default db;