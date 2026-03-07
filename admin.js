import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const saveConfigBtn = document.getElementById('save-config-btn');

const CONFIG_DOC_PATH = "artifacts/construction-expenses/config/appConfig";

// --- Custom Native-Feel Toast Notification ---
function showToast(message, type = 'error') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col items-center gap-3 w-max pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  let icon = '';
  if (type === 'error') {
    icon = `<svg class="w-5 h-5 text-red-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  } else if (type === 'success') {
    icon = `<svg class="w-5 h-5 text-green-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  }

  toast.className = `bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl flex items-center text-sm font-medium transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto border border-slate-700/50`;
  
  const escapeHTML = (str) => {
    const div = document.createElement('div'); div.appendChild(document.createTextNode(str || '')); return div.innerHTML;
  };

  toast.innerHTML = `${icon}<span>${escapeHTML(message)}</span>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-10', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });
  });

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-10', 'opacity-0');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

// --- Dynamically Inject User Management UI ---
function injectUserManagementUI() {
  const userMgmtHTML = `
    <section class="bg-white p-6 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-6 border border-slate-100">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center">
          <div class="w-1.5 h-5 bg-indigo-500 rounded-full mr-3"></div>
          <h3 class="text-base font-semibold text-gray-800">User Directory</h3>
        </div>
        <button id="refresh-users-btn" class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">Refresh List</button>
      </div>
      
      <div class="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        <ul id="all-users-list" class="divide-y divide-slate-200 max-h-72 overflow-y-auto">
          <li class="px-4 py-8 text-sm text-slate-500 text-center flex flex-col items-center">
             <div class="loader ease-linear rounded-full border-4 border-t-4 border-slate-200 h-8 w-8 mb-2"></div>
             Loading users...
          </li>
        </ul>
      </div>
    </section>
  `;
  
  saveConfigBtn.insertAdjacentHTML('beforebegin', userMgmtHTML);
  document.getElementById('refresh-users-btn').addEventListener('click', loadAllUsers);
}

// --- Fetch and Render All Users ---
async function loadAllUsers() {
  const listEl = document.getElementById('all-users-list');
  try {
    const usersRef = collection(db, "artifacts/construction-expenses/users");
    const snapshot = await getDocs(usersRef);
    
    if (snapshot.empty) {
      listEl.innerHTML = `<li class="px-4 py-6 text-sm text-slate-500 italic text-center">No users found. Ensure signups are writing to the 'users' collection.</li>`;
      return;
    }

    let html = '';
    snapshot.forEach(docSnap => {
      const user = docSnap.data();
      const uid = docSnap.id;
      const isSuspended = user.status === "suspended";
      const isAdmin = AUTHORIZED_ADMINS.includes(user.email);
      
      html += `
        <li class="px-4 py-4 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
          <div>
            <p class="text-sm font-bold text-slate-800">${user.email || 'Unknown Email'}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}">${isAdmin ? 'Admin' : 'User'}</span>
              <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isSuspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${isSuspended ? 'Suspended' : 'Active'}</span>
            </div>
          </div>
          ${!isAdmin ? `
            <button data-uid="${uid}" data-action="${isSuspended ? 'active' : 'suspended'}" class="status-toggle-btn text-xs font-bold ${isSuspended ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-red-600 bg-red-50 hover:bg-red-100'} px-4 py-2 rounded-xl transition-colors shadow-sm">
              ${isSuspended ? 'Unban User' : 'Suspend User'}
            </button>
          ` : '<span class="text-xs font-medium text-slate-400 italic">Protected</span>'}
        </li>
      `;
    });

    listEl.innerHTML = html;

    // Attach listeners to the dynamic buttons
    document.querySelectorAll('.status-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = e.target.dataset.uid;
        const newStatus = e.target.dataset.action; // "active" or "suspended"
        
        e.target.textContent = "Updating...";
        e.target.disabled = true;
        
        try {
          const userRef = doc(db, "artifacts/construction-expenses/users", uid);
          await updateDoc(userRef, { status: newStatus });
          showToast(`User successfully ${newStatus === 'active' ? 'unbanned' : 'suspended'}.`, "success");
          loadAllUsers(); // Reload the list
        } catch (error) {
          showToast("Failed to update user status.", "error");
          e.target.disabled = false;
        }
      });
    });

  } catch (error) {
    console.error("Error loading users:", error);
    listEl.innerHTML = `<li class="px-4 py-6 text-sm text-red-500 text-center">Failed to load users. Check permissions.</li>`;
  }
}


// Auth State Listener
onAuthStateChanged(auth, async (user) => {
  if (user && AUTHORIZED_ADMINS.includes(user.email)) {
    injectUserManagementUI();
    loadAllUsers(); // Fetch users immediately
    await fetchCurrentConfig();
    authOverlay.style.display = 'none';
    adminContent.classList.remove('hidden');
  } else {
    authMessage.textContent = "Access Denied. Redirecting...";
    authMessage.classList.replace('text-slate-800', 'text-red-600');
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
    showToast("Failed to load settings. Check console.", "error");
  }
}

// Sync Color Inputs
colorPicker.addEventListener('input', (e) => colorHexInput.value = e.target.value);
colorHexInput.addEventListener('input', (e) => colorPicker.value = e.target.value);

// Save Configuration
saveConfigBtn.addEventListener('click', async () => {
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
      showToast("Configuration Published Successfully!", "success");
    }, 500);
  } catch (error) {
    console.error("Error saving config:", error);
    showToast("Failed to save. Check Firestore Rules.", "error");
    saveOverlay.classList.add('hidden');
    saveOverlay.classList.remove('flex');
  }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  signOut(auth).then(() => window.location.href = 'index.html');
});
