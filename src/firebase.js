// src/firebase.js - UPDATED VERSION
// Import the compatibility versions
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAxT9BXgiLuw4BkPzmlMv-pc9GMCO_miVM",
  authDomain: "client-side-aes-encryption.firebaseapp.com",
  projectId: "client-side-aes-encryption",
  storageBucket: "client-side-aes-encryption.firebasestorage.app",
  messagingSenderId: "1038006574860",
  appId: "1:1038006574860:web:6c29bbdf233f6ca94f3329",
  measurementId: "G-SH8YLFQNZY",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("✅ Firebase initialized successfully!");
console.log("📊 Project ID:", firebaseConfig.projectId);

// Export the database
export { db, firebaseConfig };
