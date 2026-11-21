import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmPMW9P4sSVZXY9zThBiJHNovyWDazEYo",
  authDomain: "tavirah-os.firebaseapp.com",
  projectId: "tavirah-os",
  storageBucket: "tavirah-os.firebasestorage.app",
  messagingSenderId: "677812755983",
  appId: "1:677812755983:web:71438497f728a72cad8d7a"
};

export const FOUNDER_UID = "eDfdVfWey6hECZxISXl3x3qJcpo1";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  arrayUnion
};
