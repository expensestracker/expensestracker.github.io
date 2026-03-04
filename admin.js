import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEZsRWj_7ZAVfwW8PR7Nj4c2rR3gbeGw0",
  authDomain: "construction-expenses-app.firebaseapp.com",
  projectId: "construction-expenses-app",
  storageBucket: "construction-expenses-app.firebasestorage.app",
  messagingSenderId: "944353147981",
  appId: "1:944353147981:web:36ff635b184d5eac69b004"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Traps: Do not rely solely on this array. Firestore Security Rules are mandatory.
const AUTHORIZED_ADMINS = ["roni.9101862699@gmail.com"]; // REPLACE WITH YOUR ADMIN EMAIL

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const authMessage = document.getElementById('auth-message');
const adminContent = document.getElementById('admin-content');
const appNameInput = document.getElementById('app-name-input');
const colorPicker = document.getElementById('color-picker');
const colorHexInput = document.getElementById('color-hex-input');
const notificationInput = document.getElementById('notification-input');
const maintenanceToggle = document.getElementById('maintenance-toggle');
const saveOverlay = document.getElementById('save-overlay');

const CONFIG_DOC_PATH = "artifacts/construction-expenses/config/appConfig";

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
  if (user && AUTHORIZED_ADMINS.includes(user.email)) {
    await fetchCurrentConfig();
    authOverlay.style.display = 'none';
    adminContent.classList.remove('hidden');
  } else {
    authMessage.textContent = "Access Denied. Redirecting...";
    authMessage.classList.replace('text-slate-600', 'text-red-600');
    setTimeout(() => { window.location.href = 'index.html'; }, 2000);
  }
});

// Fetch Configuration from Firestore
async function fetchCurrentConfig() {
  try {
    const docRef = doc(db, CONFIG_DOC_PATH);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      appNameInput.value = data.appName || 'Money Tracker';
      colorPicker.value = data.primaryColor || '#4f46e5';
      colorHexInput.value = data.primaryColor || '#4f46e5';
      notificationInput.value = data.globalNotification || '';
      maintenanceToggle.checked = data.maintenanceMode || false;
    }
  } catch (error) {
    console.error("Error fetching config:", error);
    alert("Failed to load settings. Check console.");
  }
}

// Sync Color Inputs
colorPicker.addEventListener('input', (e) => colorHexInput.value = e.target.value);
colorHexInput.addEventListener('input', (e) => colorPicker.value = e.target.value);

// Save Configuration
document.getElementById('save-config-btn').addEventListener('click', async () => {
  saveOverlay.classList.remove('hidden');
  saveOverlay.classList.add('flex');
  
  const newConfig = {
    appName: appNameInput.value.trim(),
    primaryColor: colorHexInput.value.trim(),
    globalNotification: notificationInput.value.trim(),
    maintenanceMode: maintenanceToggle.checked,
    lastUpdated: new Date().toISOString()
  };

  try {
    const docRef = doc(db, CONFIG_DOC_PATH);
    await setDoc(docRef, newConfig, { merge: true });
    setTimeout(() => {
      saveOverlay.classList.add('hidden');
      saveOverlay.classList.remove('flex');
    }, 500);
  } catch (error) {
    console.error("Error saving config:", error);
    alert("Failed to save. Check Firestore Rules.");
    saveOverlay.classList.add('hidden');
    saveOverlay.classList.remove('flex');
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  signOut(auth).then(() => window.location.href = 'index.html');
});
