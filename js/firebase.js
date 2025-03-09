// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAEPt-KdbLcGKQeouq3QQybgJDA--gxsig",
    authDomain: "clipmate-1fa83.firebaseapp.com",
    projectId: "clipmate-1fa83",
    storageBucket: "clipmate-1fa83.firebasestorage.app",
    messagingSenderId: "465442742689",
    appId: "1:465442742689:web:3509e2b6ff941634446be0",
    measurementId: "G-CM2FX9STY0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence (this helps with offline functionality)
enableIndexedDbPersistence(db)
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled
          // in one tab at a time.
          console.warn('Firestore persistence could not be enabled: multiple tabs open');
      } else if (err.code == 'unimplemented') {
          // The current browser does not support all of the
          // features required to enable persistence
          console.warn('Firestore persistence not supported in this browser');
      } else {
          console.error('Error enabling Firestore persistence:', err);
      }
  });

export { app, auth, db };

// Console message for Firebase initialization status
console.log('Firebase initialized');