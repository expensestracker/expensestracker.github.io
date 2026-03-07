// Firebase Imports
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  doc,
  where,
  orderBy,
  getDocs,
  writeBatch,
  runTransaction,
  setDoc // <-- ADDED THIS HERE
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- Global State ---
let currentUser = null, activeProjectId = null, projects = [], projectsUnsubscribe = null, expensesUnsubscribe = null, allExpensesForProject = [], isSigningUp = false;

// --- DOM Elements ---
const views = {
  splash: document.getElementById('splash-view'),
  auth: document.getElementById('auth-view'),
  app: document.getElementById('app-view')
};
const userNameDisplay = document.getElementById('user-display-name');
const authTitle = document.getElementById('auth-title'), emailForm = document.getElementById('email-form'), emailInput = document.getElementById('email-input'), passwordInput = document.getElementById('password-input'), authError = document.getElementById('auth-error'), emailActionBtn = document.getElementById('email-action-btn'), authToggleLink = document.getElementById('auth-toggle-link'), forgotPasswordLink = document.getElementById('forgot-password-link'), googleSignInBtn = document.getElementById('google-signin-btn');
const expenseDashboard = document.getElementById('expense-dashboard'), noProjectMessage = document.getElementById('no-project-message'), expenseForm = document.getElementById('expense-form'), expenseList = document.getElementById('expense-list'), finalExpensesEl = document.getElementById('final-expenses'), materialSummaryEl = document.getElementById('material-summary');
const userProfileDesktop = document.getElementById('user-profile-desktop'), userProfileMobile = document.getElementById('user-profile-mobile');
const hamburgerBtn = document.getElementById('user-profile-desktop'), mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop'), mobileMenu = document.getElementById('mobile-menu'), closeMenuBtn = document.getElementById('close-menu-btn'), mobileSignOutBtn = document.getElementById('mobile-sign-out-btn');
const editModal = document.getElementById('edit-modal'), editExpenseForm = document.getElementById('edit-expense-form'), cancelEditBtn = document.getElementById('cancel-edit-btn');
const searchInput = document.getElementById('search-input'), startDateInput = document.getElementById('start-date-input'), endDateInput = document.getElementById('end-date-input');
const sidebarProjectList = document.getElementById('sidebar-project-list'), sidebarAddProjectBtn = document.getElementById('sidebar-add-project-btn');
const editProjectModal = document.getElementById('edit-project-modal'), editProjectForm = document.getElementById('edit-project-form'), cancelEditProjectBtn = document.getElementById('cancel-edit-project-btn');
const addProjectModal = document.getElementById('add-project-modal'), addProjectFormModal = document.getElementById('add-project-form-modal'), cancelAddProjectBtn = document.getElementById('cancel-add-project-btn');
const infoModal = document.getElementById('info-modal'), infoModalTitle = document.getElementById('info-modal-title'), infoModalContent = document.getElementById('info-modal-content'), closeInfoModalBtn = document.getElementById('close-info-modal-btn');
const projectSummaryTitle = document.getElementById('project-summary-title');

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

// --- Custom Native-Feel Confirmation Modal ---
function showConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center opacity-0 transition-opacity duration-300';
    
    const modal = document.createElement('div');
    modal.className = 'bg-white p-6 rounded-[2rem] shadow-2xl w-[90%] max-w-sm text-center transform scale-95 transition-transform duration-300';
    
    modal.innerHTML = `
      <div class="w-14 h-14 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center mb-4">
        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </div>
      <h3 class="text-xl font-bold text-slate-800 mb-2">${escapeHTML(title)}</h3>
      <p class="text-sm text-slate-500 mb-8 leading-relaxed">${escapeHTML(message)}</p>
      <div class="flex gap-3">
        <button id="confirm-cancel-btn" class="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
        <button id="confirm-delete-btn" class="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200">Delete</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        modal.classList.remove('scale-95');
      });
    });
    
    const closeAndResolve = (result) => {
      overlay.classList.add('opacity-0');
      modal.classList.add('scale-95');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 300);
    };
    
    modal.querySelector('#confirm-cancel-btn').addEventListener('click', () => closeAndResolve(false));
    modal.querySelector('#confirm-delete-btn').addEventListener('click', () => closeAndResolve(true));
  });
}

// --- View Management ---
const showView = (viewName) => {
  Object.values(views).forEach(v => v?.classList.remove('active')); 
  if (views[viewName]) views[viewName].classList.add('active');
};

// --- Authentication ---
setTimeout(() => {
  if (!currentUser) showView('auth');
}, 1500);

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    showView('app'); 
    setupUIForUser(user); 
    listenForProjects(user.uid);
  } else {
    showView('auth'); 
    if (projectsUnsubscribe) projectsUnsubscribe(); 
    if (expensesUnsubscribe) expensesUnsubscribe(); 
    activeProjectId = null;
  }
});

authToggleLink?.addEventListener('click', e => {
  e.preventDefault();
  isSigningUp = !isSigningUp;
  authTitle.textContent = isSigningUp ? 'Create Account': 'Welcome Back';
  emailActionBtn.textContent = isSigningUp ? 'Sign Up': 'Log In';
  authToggleLink.textContent = isSigningUp ? 'Have an account? Log In': 'Need an account? Sign Up';
  authError.textContent = '';
  if (isSigningUp) {
    emailActionBtn.classList.replace('bg-indigo-600', 'bg-emerald-600');
    emailActionBtn.classList.replace('hover:bg-indigo-700', 'hover:bg-emerald-700');
  } else {
    emailActionBtn.classList.replace('bg-emerald-600', 'bg-indigo-600');
    emailActionBtn.classList.replace('hover:bg-emerald-700', 'hover:bg-indigo-700');
  }
});

emailForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!navigator.onLine) {
    showToast("Please connect to internet", "error"); 
    return;
  }
  const email = emailInput.value, password = passwordInput.value;
  authError.textContent = '';
  try {
    if (isSigningUp) {
      // 1. Create the Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Add their profile to the users collection so the Admin Panel can see them
      const appId = "construction-expenses";
      await setDoc(doc(db, `artifacts/${appId}/users`, userCredential.user.uid), {
        email: email,
        status: "active",
        createdAt: new Date().toISOString()
      });

    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    authError.textContent = error.message;
  }
});


googleSignInBtn?.addEventListener('click', () => {
  if (!navigator.onLine) {
    showToast("Please connect to internet", "error"); 
    return;
  }
  signInWithPopup(auth, new GoogleAuthProvider()).catch(error => authError.textContent = error.message);
});

forgotPasswordLink?.addEventListener('click', async e => {
  e.preventDefault();
  const email = emailInput.value;
  if (!email) {
    authError.textContent = 'Please enter your email address first.'; return;
  }
  try {
    await sendPasswordResetEmail(auth, email); 
    showToast('Password reset email sent!', 'success');
  } catch (error) {
    authError.textContent = error.message;
  }
});

// --- UI Setup & Mobile Menu ---
function setupUIForUser(user) {
  const photo = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=E2E8F0&color=4A5568`;
  
  if(userProfileDesktop) userProfileDesktop.innerHTML = `<div class="w-10 h-10 rounded-full overflow-hidden"><img src="${photo}" alt="User photo" class="w-full h-full object-cover"></div>`;
  if(userProfileMobile) userProfileMobile.innerHTML = `<div class="flex items-center"><div class="w-12 h-12 rounded-full overflow-hidden mr-3"><img src="${photo}" alt="User photo" class="w-full h-full object-cover"></div><div><p class="font-semibold">${escapeHTML(user.displayName || 'User')}</p><p class="text-xs text-gray-500 truncate">${escapeHTML(user.email)}</p></div></div>`;
  
  if (navigator.onLine) {
    updateStatusUI('welcome');
  } else {
    updateStatusUI('offline');
  }

  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.valueAsDate = new Date();
}

const openMenu = () => {
  mobileMenuBackdrop?.classList.remove('pointer-events-none', 'opacity-0'); 
  mobileMenu?.classList.remove('-translate-x-full');
};
const closeMenu = () => {
  mobileMenuBackdrop?.classList.add('pointer-events-none', 'opacity-0'); 
  mobileMenu?.classList.add('-translate-x-full');
};
hamburgerBtn?.addEventListener('click', openMenu);
closeMenuBtn?.addEventListener('click', closeMenu);
mobileMenuBackdrop?.addEventListener('click', e => {
  if (e.target === mobileMenuBackdrop) closeMenu();
});
mobileSignOutBtn?.addEventListener('click', () => signOut(auth));

// --- Projects ---
function listenForProjects(uid) {
  const appId = "construction-expenses";
  const projectsRef = collection(db, `artifacts/${appId}/users/${uid}/projects`);
  
  projectsUnsubscribe = onSnapshot(query(projectsRef, orderBy("name")),
    async (snapshot) => {
      if (snapshot.metadata.fromCache) return;

      projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (projects.length === 0 && navigator.onLine) {
        const newProjectRef = doc(collection(db, `artifacts/${appId}/users/${uid}/projects`));
        await runTransaction(db, async (t) => {
          t.set(newProjectRef, { name: "General" });
        });
        return;
      }
      populateSidebarProjects(projects);
      if (!activeProjectId || !projects.find(p => p.id === activeProjectId)) activeProjectId = projects[0]?.id;
      if (activeProjectId) updateActiveProject();
    });
}

function updateActiveProject() {
  const activeProject = projects.find(p => p.id === activeProjectId);
  if (activeProject && projectSummaryTitle) projectSummaryTitle.textContent = `${activeProject.name}`;
  updateSidebarSelection();
  toggleDashboardVisibility(true);
  listenForExpenses(currentUser.uid, activeProjectId);
}

sidebarAddProjectBtn?.addEventListener('click', () => {
  addProjectModal.classList.remove('hidden'); 
  document.getElementById('new-project-name-modal').focus(); 
  closeMenu();
});

addProjectFormModal?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!navigator.onLine) {
    showToast("Please connect to internet", "error"); 
    return;
  }
  const projectName = document.getElementById('new-project-name-modal').value.trim();
  if (projectName && currentUser) {
    const appId = "construction-expenses";
    const newProjRef = doc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/projects`));
    try {
      await runTransaction(db, async (t) => {
        t.set(newProjRef, { name: projectName });
      });
      addProjectFormModal.reset();
      addProjectModal.classList.add('hidden');
      
      // NEW: Success Toast
      showToast(`Project "${projectName}" created!`, "success"); 
      
    } catch (err) {
      showToast("Transaction failed: Check your connection.", "error");
    }
  }
});


function populateSidebarProjects(projects) {
  if(!sidebarProjectList) return;
  sidebarProjectList.innerHTML = projects.map(p => {
    const isGeneral = p.name === "General";
    const buttonsHTML = isGeneral ? '': `<div class="flex items-center space-x-2 opacity-50 group-hover:opacity-100 transition-opacity"><button data-project-id="${p.id}" data-project-name="${escapeHTML(p.name)}" class="edit-project-btn p-1 text-gray-400 hover:text-indigo-600"><svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg></button><button data-project-id="${p.id}" data-project-name="${escapeHTML(p.name)}" class="delete-project-btn p-1 text-gray-400 hover:text-red-600"><svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></div>`;
    return `<div class="flex justify-between items-center group rounded"><a href="#" data-project-id="${p.id}" class="sidebar-project-link block py-2 px-4 text-sm flex-grow truncate rounded">${escapeHTML(p.name)}</a>${buttonsHTML}</div>`;
  }).join('');
  
  document.querySelectorAll('.sidebar-project-link').forEach(link => link.addEventListener('click', e => {
    e.preventDefault(); 
    activeProjectId = e.target.dataset.projectId; 
    updateActiveProject(); 
    closeMenu();
  }));
  document.querySelectorAll('.edit-project-btn').forEach(btn => btn.addEventListener('click', handleEditProject));
  document.querySelectorAll('.delete-project-btn').forEach(btn => btn.addEventListener('click', handleDeleteProject));
}

function updateSidebarSelection() {
  document.querySelectorAll('.sidebar-project-link').forEach(link => {
    link.classList.toggle('active', link.dataset.projectId === activeProjectId);
  });
}

const toggleDashboardVisibility = (hasProjects) => {
  if(expenseDashboard) expenseDashboard.style.display = hasProjects ? 'block': 'none'; 
  if(noProjectMessage) noProjectMessage.style.display = hasProjects ? 'none': 'block';
};

// --- Expenses ---
function listenForExpenses(uid, projectId) {
  if (expensesUnsubscribe) expensesUnsubscribe();
  if (!uid || !projectId) {
    allExpensesForProject = []; 
    applyFilters(); 
    updateSummaries([]); 
    return;
  };
  const appId = "construction-expenses";
  const expensesRef = collection(db, `artifacts/${appId}/users/${uid}/expenses`);
  const q = query(expensesRef, where("projectId", "==", projectId));
  
  expensesUnsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.metadata.fromCache) return; 
    
    allExpensesForProject = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allExpensesForProject.sort((a, b) => new Date(b.date) - new Date(a.date));
    applyFilters();
    updateSummaries(allExpensesForProject);
  });
}

const applyFilters = () => {
  if(!searchInput) return;
  const searchTerm = searchInput.value.toLowerCase();
  const startDate = startDateInput.value;
  const endDate = endDateInput.value;

  const isFiltering = searchTerm !== '' || startDate !== '' || endDate !== '';
  let filtered = allExpensesForProject;

  if (isFiltering) {
    filtered = allExpensesForProject.filter(exp => 
      (exp.material.toLowerCase().includes(searchTerm)) && 
      (!startDate || exp.date >= startDate) && 
      (!endDate || exp.date <= endDate)
    );
  } else {
    filtered = allExpensesForProject.slice(0, 20);
  }

  renderExpenses(filtered);
};

[searchInput, startDateInput, endDateInput].forEach(el => el?.addEventListener('input', applyFilters));

expenseForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUser || !activeProjectId || !navigator.onLine) {
    if (!navigator.onLine) showToast("Please connect to internet", "error");
    return;
  }
  const material = document.getElementById('material-name').value.trim();
  const cost = parseFloat(document.getElementById('cost').value);
  const date = document.getElementById('date').value;
  
  if (material && !isNaN(cost) && date) {
    const appId = "construction-expenses";
    const newRef = doc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/expenses`));
    try {
      await runTransaction(db, async (t) => {
        t.set(newRef, { material, cost, date, projectId: activeProjectId });
      });
      expenseForm.reset();
      document.getElementById('date').valueAsDate = new Date();
      
      // NEW: Success Toast
      showToast("Expense added successfully!", "success");
      
    } catch (err) {
      showToast("Network Error: Data not saved.", "error");
    }
  }
});


// --- Render, CRUD, Utils ---
function renderExpenses(expenses) {
  if(!expenseList) return;
  if (expenses.length === 0) {
    expenseList.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No expenses found.</td></tr>`; 
    return;
  }
  expenseList.innerHTML = expenses.map(expense => `<tr><td class="whitespace-normal break-words pl-6 py-2"><div class="text-sm font-medium">${escapeHTML(expense.material)}</div></td><td class="pl-4 py-2"><div class="text-sm">₹${expense.cost.toLocaleString('en-IN', {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  })}</div></td><td class="pl-4 py-2"><div class="text-sm">${new Date(expense.date).toLocaleDateString('en-IN', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric'
  })}</div></td><td class="px-6 py-2 text-right text-sm font-medium space-x-4"><button data-id="${expense.id}" class="edit-btn text-indigo-600 hover:text-indigo-900">Edit</button><br><button data-id="${expense.id}" class="delete-btn text-red-600 hover:text-red-900">Delete</button></td></tr>`).join('');
  
  document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', handleDelete));
  document.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', handleEdit));
}

async function handleDelete(event) {
  const id = event.target.dataset.id;
  
  if (!navigator.onLine) {
    showToast("Please connect to internet", "error"); 
    return;
  }
  if (!id) return;

  const isConfirmed = await showConfirm("Delete Expense", "Are you sure you want to delete this expense? This action cannot be undone.");
  
  if (isConfirmed) {
    if (!navigator.onLine) {
      showToast("Cannot delete while offline.", "error"); 
      return; 
    }

    const appId = "construction-expenses";
    const docRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/expenses`, id);
    try {
      await runTransaction(db, async (t) => {
        t.delete(docRef);
      });
      showToast("Expense deleted", "success");
    } catch (err) {
      showToast("Delete failed: Network error.", "error");
    }
  }
}

function handleEdit(event) {
  const id = event.target.dataset.id;
  const expense = allExpensesForProject.find(e => e.id === id);
  if (!expense) return;
  document.getElementById('edit-expense-id').value = expense.id;
  document.getElementById('edit-material-name').value = expense.material;
  document.getElementById('edit-cost').value = expense.cost;
  document.getElementById('edit-date').value = expense.date;
  editModal.classList.remove('hidden');
}

editExpenseForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!navigator.onLine) {
    showToast("Offline: Cannot update.", "error"); return;
  }
  const id = document.getElementById('edit-expense-id').value;
  const updatedData = {
    material: document.getElementById('edit-material-name').value.trim(),
    cost: parseFloat(document.getElementById('edit-cost').value),
    date: document.getElementById('edit-date').value
  };
  if (updatedData.material && !isNaN(updatedData.cost) && updatedData.date) {
    const appId = "construction-expenses";
    const docRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/expenses`, id);
    try {
      await runTransaction(db, async (t) => {
        t.update(docRef, updatedData);
      });
      closeEditModal();
      
      // NEW: Success Toast
      showToast("Expense updated successfully!", "success");
      
    } catch (err) {
      showToast("Update failed: Check connection.", "error");
    }
  }
});


function handleEditProject(e) {
  const projectId = e.target.dataset.projectId, projectName = e.target.dataset.projectName; 
  document.getElementById('edit-project-id').value = projectId; 
  document.getElementById('edit-project-name').value = projectName; 
  editProjectModal.classList.remove('hidden');
}

async function handleDeleteProject(e) {
  const projectId = e.target.dataset.projectId, projectName = e.target.dataset.projectName;
  
  if (!navigator.onLine) {
    showToast("Please connect to internet", "error"); return;
  }
  if (!projectId) return;

  const isConfirmed = await showConfirm("Delete Project", `Are you sure? All expenses in "${projectName}" will be permanently deleted.`);
  
  if (isConfirmed) {
    if (!navigator.onLine) {
      showToast("Cannot delete while offline.", "error"); 
      return; 
    }

    const appId = "construction-expenses";
    const expensesRef = collection(db, `artifacts/${appId}/users/${currentUser.uid}/expenses`);
    const q = query(expensesRef, where("projectId", "==", projectId));

    try {
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, `artifacts/${appId}/users/${currentUser.uid}/projects`, projectId));
      await batch.commit();
      
      showToast("Project deleted", "success");
      
      if (activeProjectId === projectId) {
        const generalProject = projects.find(p => p.name === 'General') || projects[0];
        if (generalProject) {
          activeProjectId = generalProject.id; updateActiveProject();
        }
      }
    } catch (error) {
      showToast("Delete failed: Network error.", "error");
    }
  }
}

editProjectForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!navigator.onLine) {
    showToast("Please connect to internet", "error"); return;
  }
  const projectId = document.getElementById('edit-project-id').value,
  newName = document.getElementById('edit-project-name').value.trim();
  
  if (newName && projectId) {
    const appId = "construction-expenses";
    const projectRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/projects`, projectId);
    try {
      await runTransaction(db, async (t) => {
        t.update(projectRef, { name: newName });
      });
      closeEditProjectModal();
      
      // NEW: Success Toast
      showToast("Project renamed successfully!", "success");
      
    } catch (err) {
      showToast("Rename failed.", "error");
    }
  }
});


// Modal Closers
const closeEditModal = () => editModal?.classList.add('hidden');
cancelEditBtn?.addEventListener('click', closeEditModal);
editModal?.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

const closeEditProjectModal = () => editProjectModal?.classList.add('hidden');
cancelEditProjectBtn?.addEventListener('click', closeEditProjectModal);
editProjectModal?.addEventListener('click', e => { if (e.target === editProjectModal) closeEditProjectModal(); });

const closeAddProjectModal = () => addProjectModal?.classList.add('hidden');
cancelAddProjectBtn?.addEventListener('click', closeAddProjectModal);
addProjectModal?.addEventListener('click', e => { if (e.target === addProjectModal) closeAddProjectModal(); });

// --- Info Modals ---
const infoContent = {
  'about-link': { title: 'About Us', content: 'Track materials and project costs with ease.' }, 
  'privacy-link': { title: 'Privacy Policy', content: 'Your data is secure with Firebase.' }, 
  'contact-link': { title: 'Contact Us', content: 'Email: support@expensetracker.app' }
};

document.querySelectorAll('#about-link, #privacy-link, #contact-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault(); 
    const { title, content } = infoContent[e.currentTarget.id]; 
    if(infoModalTitle) infoModalTitle.textContent = title; 
    if(infoModalContent) infoModalContent.innerHTML = content; 
    infoModal?.classList.remove('hidden');
  });
});
closeInfoModalBtn?.addEventListener('click', () => infoModal?.classList.add('hidden'));
infoModal?.addEventListener('click', e => { if (e.target === infoModal) infoModal.classList.add('hidden'); });

// --- Summaries ---
function updateSummaries(expenses) {
  if(!finalExpensesEl) return;
  
  const total = expenses.reduce((sum, exp) => sum + exp.cost, 0);
  finalExpensesEl.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  
  const materialTotals = expenses.reduce((acc, exp) => {
    const key = exp.material.trim().toLowerCase(); 
    acc[key] = (acc[key] || 0) + exp.cost; 
    return acc;
  }, {});
  
  const sorted = Object.keys(materialTotals).sort((a, b) => materialTotals[b] - materialTotals[a]);
  if (sorted.length === 0) {
    if(materialSummaryEl) materialSummaryEl.innerHTML = `<p class="text-gray-500">No expenses to summarize.</p>`; 
    return;
  }
  
  if(materialSummaryEl){
     materialSummaryEl.innerHTML = sorted.map(key => {
      const total = materialTotals[key]; 
      const displayName = key.charAt(0).toUpperCase() + key.slice(1); 
      return `<div class="flex justify-between items-center text-sm"><span class="font-medium">${escapeHTML(displayName)}</span><span>₹${total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span></div>`;
    }).join('');
  }
}

const escapeHTML = (str) => {
  const div = document.createElement('div'); div.appendChild(document.createTextNode(str || '')); return div.innerHTML;
};

// --- Admin Configuration Listener ---
let globalConfigUnsubscribe = null;
const ADMIN_EMAILS = ["roni9101862699@gmail.com"]; // REPLACE WITH YOUR ADMIN EMAIL

function listenForAppConfig() {
  if (globalConfigUnsubscribe) return; 

  const configRef = doc(db, "artifacts/construction-expenses/config/appConfig");
  globalConfigUnsubscribe = onSnapshot(configRef, (snapshot) => {
    if (snapshot.exists()) {
      applyGlobalConfig(snapshot.data());
    }
  });
}

function applyGlobalConfig(config) {
  const isUserAdmin = currentUser && ADMIN_EMAILS.includes(currentUser.email);
  const maintenanceView = document.getElementById('maintenance-view');
  
  if (config.maintenanceMode && !isUserAdmin) {
    maintenanceView?.classList.remove('hidden');
    maintenanceView?.classList.add('flex');
    ['auth-view', 'app-view', 'splash-view'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
  } else {
    maintenanceView?.classList.add('hidden');
    maintenanceView?.classList.remove('flex');
    if (currentUser && maintenanceView?.classList.contains('hidden') === false) {
      showView('app');
    }
  }

  if (config.appName) {
    document.querySelectorAll('.dynamic-app-name').forEach(el => el.textContent = config.appName);
    document.title = config.appName;
  }

  if (config.primaryColor) {
    document.documentElement.style.setProperty('--dynamic-primary', config.primaryColor);
    document.querySelectorAll('.bg-indigo-600').forEach(el => { el.style.backgroundColor = config.primaryColor; });
    document.querySelectorAll('.text-indigo-600').forEach(el => { el.style.color = config.primaryColor; });
  }

  const notifEl = document.getElementById('global-notification');
  const notifText = document.getElementById('notification-text');

  if (config.globalNotification && config.globalNotification.trim() !== "") {
    if(notifText) notifText.textContent = config.globalNotification;
    notifEl?.classList.remove('hidden');
  } else {
    notifEl?.classList.add('hidden');
  }
}

document.getElementById('close-notification')?.addEventListener('click', () => {
  document.getElementById('global-notification').classList.add('hidden');
});

listenForAppConfig();

// --- Service Worker ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js");
  });
}
let deferredPrompt;
const installBtn = document.getElementById("ibtn");
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredPrompt = e; if (installBtn) installBtn.classList.remove("hidden");
});
window.installApp = async () => {
  if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; if (installBtn) installBtn.classList.add("hidden");
};
window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.classList.add("hidden");
});

const userStatusDisplay = document.getElementById('user-status-display');
let statusTimeout; 

function updateStatusUI(state) {
  if (!userStatusDisplay) return;
  
  userStatusDisplay.classList.add('opacity-0');
  
  setTimeout(() => {
    if (state === 'offline') {
      userStatusDisplay.innerHTML = `
        <span class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
        <span class="text-sm font-semibold">Offline</span>
      `;
    } else if (state === 'online') {
      userStatusDisplay.innerHTML = `
        <span class="relative flex size-3">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
          <span class="relative inline-flex size-3 rounded-full bg-sky-500"></span>
        </span>
        <span class="text-sm font-semibold">Back Online</span>
      `;
      statusTimeout = setTimeout(() => updateStatusUI('welcome'), 5000);
      
    } else if (state === 'welcome') {
      const name = currentUser?.displayName || 'User';
      userStatusDisplay.innerHTML = `<span class="text-sm text-gray-700">Welcome, <strong>${escapeHTML(name)}</strong></span>`;
    }
    
    userStatusDisplay.classList.remove('opacity-0');
  }, 300); 
}

window.addEventListener('offline', () => {
  clearTimeout(statusTimeout);
  updateStatusUI('offline');
});

window.addEventListener('online', () => {
  clearTimeout(statusTimeout);
  updateStatusUI('online');
});

document.getElementById('go-to-analytics-btn')?.addEventListener('click', () => {
  if (!activeProjectId) {
    showToast("Please select a project first.", "error");
    return;
  }
  window.location.href = `analytics.html?projectId=${activeProjectId}`;
});

// App configuration
const APP_VERSION = "1.4";
const APP_NAME = "Expense Tracker";
const currentYear = new Date().getFullYear();

const appVersionEl = document.getElementById("app-version");
const appCopyrightEl = document.getElementById("app-copyright");

if(appVersionEl) appVersionEl.textContent = `Version-${APP_VERSION}`;
if(appCopyrightEl) appCopyrightEl.textContent = `© ${currentYear} ${APP_NAME}. All Rights Reserved.`;
