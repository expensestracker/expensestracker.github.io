import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, doc, runTransaction, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  // Replace with your real Firebase config
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
const APP_ID = "loan-tracker-app";

// Global State
let currentUser = null;
let loans = [];
let loansUnsubscribe = null;
let activeDetailLoanId = null;

// DOM Elements
const views = { 
    splash: document.getElementById('splash-view'), 
    auth: document.getElementById('auth-view'), 
    app: document.getElementById('app-view') 
};
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const mobileSignOutBtn = document.getElementById('mobile-sign-out-btn');
const userStatusDisplay = document.getElementById('user-status-display');

const loansContainer = document.getElementById('loans-container');
const addLoanModal = document.getElementById('add-loan-modal');
const addLoanForm = document.getElementById('add-loan-form');
const btnAddLoanInline = document.getElementById('btn-add-loan-inline');
const loanDetailView = document.getElementById('loan-detail-view');
const btnDeleteLoan = document.getElementById('btn-delete-loan');

const flexPaySection = document.getElementById('flexible-payment-section');
const btnFlexPay = document.getElementById('btn-flex-pay');
const flexPayAmount = document.getElementById('flex-pay-amount');

const escapeHTML = (str) => { const div = document.createElement('div'); div.appendChild(document.createTextNode(str || '')); return div.innerHTML; };

// Robust Toast / Notification UI
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  
  const isError = type === 'error';
  const bgClass = isError ? 'bg-rose-600' : 'bg-slate-900';
  const borderClass = isError ? 'border-rose-700' : 'border-slate-700';

  const toast = document.createElement('div');
  toast.className = `${bgClass} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center text-sm font-bold transition-all duration-300 translate-y-10 opacity-0 mb-2 border ${borderClass}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
  toastContainer.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const showView = (viewName) => {
  Object.values(views).forEach(v => { 
      if(v) { v.classList.add('hidden'); v.classList.remove('active'); }
  });
  if (views[viewName]) { 
      views[viewName].classList.remove('hidden'); 
      views[viewName].classList.add('active'); 
      if(viewName === 'app') views[viewName].classList.add('flex'); 
  }
};

// Robust Offline/Online Status Detection
let statusTimeout;
function updateStatusUI(state) {
    if (!userStatusDisplay) return;
    if (state === 'offline') {
        userStatusDisplay.innerHTML = `<span class="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span> <span class="text-rose-500">Offline (Read Only)</span>`;
    } else if (state === 'online') {
        userStatusDisplay.innerHTML = `<span class="w-2 h-2 bg-emerald-500 rounded-full"></span> <span class="text-emerald-600">Back Online</span>`;
        statusTimeout = setTimeout(() => updateStatusUI('welcome'), 3000);
    } else if (state === 'welcome') {
        userStatusDisplay.innerHTML = `<span class="w-2 h-2 bg-emerald-500 rounded-full"></span> Online`;
    }
}
window.addEventListener('offline', () => { clearTimeout(statusTimeout); updateStatusUI('offline'); });
window.addEventListener('online', () => { clearTimeout(statusTimeout); updateStatusUI('online'); });

// UI Logic: Calculate Days Left & Styling
function getDaysLeftDetails(dateStr) {
    if (!dateStr) return { text: "Fully Settled", colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200" };
    
    const due = new Date(dateStr);
    due.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `Overdue by ${Math.abs(diffDays)} Days`, colorClass: "bg-rose-50 text-rose-600 border-rose-200 shadow-sm" };
    if (diffDays === 0) return { text: `Due Today`, colorClass: "bg-orange-50 text-orange-600 border-orange-200 shadow-sm" };
    if (diffDays <= 5) return { text: `Due in ${diffDays} Days`, colorClass: "bg-orange-50 text-orange-600 border-orange-200" };
    return { text: `Due in ${diffDays} Days`, colorClass: "bg-indigo-50 text-indigo-600 border-indigo-200" };
}

// Authentication Listeners
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    updateStatusUI(navigator.onLine ? 'welcome' : 'offline');
    setTimeout(() => {
        showView('app');
        // Establish baseline history state on load
        history.replaceState({ view: 'home' }, '', '#home');
        listenForLoans(user.uid);
    }, 800);
  } else {
    showView('auth');
    if (loansUnsubscribe) loansUnsubscribe();
  }
});

if(emailForm) {
    emailForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!navigator.onLine) { showToast("Cannot login while offline", "error"); return; }
      
      const email = emailInput.value;
      const password = passwordInput.value;
      const btnText = document.getElementById('btn-text');
      const btnSpinner = document.getElementById('btn-spinner');
      const actionBtn = document.getElementById('email-action-btn');
      
      if(btnText && btnSpinner) {
          btnText.classList.add('opacity-0');
          btnSpinner.classList.remove('opacity-0');
          actionBtn.disabled = true;
      }

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        try { await createUserWithEmailAndPassword(auth, email, password); } 
        catch (err) { showToast("Authentication failed", 'error'); }
      } finally {
          if(btnText && btnSpinner) {
              btnText.classList.remove('opacity-0');
              btnSpinner.classList.add('opacity-0');
              actionBtn.disabled = false;
          }
      }
    });
}

if (mobileSignOutBtn) mobileSignOutBtn.addEventListener('click', () => signOut(auth));

// ==========================================
// WEBVIEW BACK PRESS & HISTORY API ROUTING
// ==========================================

function closeLoanDetailUI() {
    if (loanDetailView && !loanDetailView.classList.contains('hidden')) {
        loanDetailView.classList.add('translate-x-full');
        // Wait for the CSS transition (300ms) defined in your HTML before hiding it[span_2](start_span)[span_2](end_span)
        setTimeout(() => {
            loanDetailView.classList.add('hidden');
        }, 300); 
        activeDetailLoanId = null;
    }
}

window.addEventListener('popstate', (e) => {
    const state = e.state;
    
    // Manage Add Loan Modal State
    if (addLoanModal) {
        if (!state || state.view !== 'add-loan') {
            addLoanModal.classList.add('hidden');
        } else {
            addLoanModal.classList.remove('hidden');
        }
    }
    
    // Manage Detail View State
    if (!state || state.view !== 'loan-detail') {
        closeLoanDetailUI();
    } else if (state && state.view === 'loan-detail') {
        // Third param true skips pushing duplicate state on forward/back navigation
        openLoanDetail(state.id, true);
    }
});

// Bind UI Buttons to trigger History Navigation[span_3](start_span)[span_3](end_span)
if (btnAddLoanInline) {
    btnAddLoanInline.addEventListener('click', () => {
        if (!navigator.onLine) { showToast("Cannot add new loans while offline", "error"); return; }
        addLoanModal.classList.remove('hidden');
        history.pushState({ view: 'add-loan' }, '', '#add-loan');
    });
}

const closeAddLoanBtn = document.getElementById('close-add-loan-btn');
if (closeAddLoanBtn) {
    closeAddLoanBtn.addEventListener('click', () => {
        if (history.state && history.state.view === 'add-loan') {
            history.back(); 
        } else {
            addLoanModal.classList.add('hidden');
        }
    });
}

const backToHomeBtn = document.getElementById('back-to-home-btn');
if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', () => {
        if (history.state && history.state.view === 'loan-detail') {
            history.back(); 
        } else {
            closeLoanDetailUI();
        }
    });
}

// UI Interactivity - Toggle Loan Form Fields dynamically
const loanTypeRadios = document.querySelectorAll('input[name="loan-type"]');
loanTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const isStandard = e.target.value === 'standard';
        const payableGroup = document.getElementById('loan-payable-group');
        const installmentsGroup = document.getElementById('loan-installments-group');
        
        if (payableGroup && installmentsGroup) {
            if (isStandard) {
                payableGroup.classList.remove('hidden');
                installmentsGroup.classList.remove('hidden');
                document.getElementById('loan-payable').required = true;
                document.getElementById('loan-installments').required = true;
            } else {
                payableGroup.classList.add('hidden');
                installmentsGroup.classList.add('hidden');
                document.getElementById('loan-payable').required = false;
                document.getElementById('loan-installments').required = false;
            }
        }
    });
});

// Delete Loan Action
if (btnDeleteLoan) {
    btnDeleteLoan.addEventListener('click', async () => {
        if (!activeDetailLoanId) return;
        if (!navigator.onLine) { showToast("Cannot delete loans while offline", "error"); return; }

        const confirmDelete = window.confirm("Are you sure you want to delete this profile? This action cannot be undone.");
        if (confirmDelete) {
            const btnText = document.getElementById('delete-btn-text');
            const btnSpinner = document.getElementById('delete-btn-spinner');
            
            if(btnText && btnSpinner) {
                btnText.classList.add('opacity-0');
                btnSpinner.classList.remove('opacity-0');
                btnDeleteLoan.disabled = true;
            }

            try {
                await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${currentUser.uid}/loans`, activeDetailLoanId));
                showToast("Profile deleted successfully.");
                
                // Back out gracefully
                if (history.state && history.state.view === 'loan-detail') {
                    history.back(); 
                } else {
                    closeLoanDetailUI();
                }
            } catch (err) {
                showToast("Failed to delete. Check connection.", "error");
            } finally {
                if(btnText && btnSpinner) {
                    btnText.classList.remove('opacity-0');
                    btnSpinner.classList.add('opacity-0');
                    btnDeleteLoan.disabled = false;
                }
            }
        }
    });
}

// Database: Add Loan Form Submission
if (addLoanForm) {
    addLoanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!navigator.onLine) { showToast("Cannot create profile while offline", "error"); return; }

        const btnText = document.getElementById('init-loan-text');
        const btnSpinner = document.getElementById('init-loan-spinner');
        const initBtn = document.getElementById('init-loan-btn');

        if(btnText && btnSpinner) {
            btnText.classList.add('opacity-0');
            btnSpinner.classList.remove('opacity-0');
            initBtn.disabled = true;
        }

        const type = document.querySelector('input[name="loan-type"]:checked').value;
        const name = document.getElementById('loan-name').value.trim();
        const principal = parseFloat(document.getElementById('loan-principal').value);
        const startDateInput = document.getElementById('loan-start-date').value;
        
        let payable = principal;
        let schedule = [];

        if (type === 'standard') {
            payable = parseFloat(document.getElementById('loan-payable').value);
            const installmentsCount = parseInt(document.getElementById('loan-installments').value);
            if (payable && installmentsCount) {
                const emi = payable / installmentsCount;
                const startObj = new Date(startDateInput);
                const dayOfMonth = startObj.getDate();
                for (let i = 0; i < installmentsCount; i++) {
                    let instDate = new Date(startObj.getFullYear(), startObj.getMonth() + i, dayOfMonth);
                    schedule.push({
                        id: Math.random().toString(36).substring(2, 11),
                        date: instDate.toISOString(),
                        amount: emi,
                        status: 'pending',
                        paidDate: null
                    });
                }
            }
        }

        if (name && principal && startDateInput) {
            try {
                const newRef = doc(collection(db, `artifacts/${APP_ID}/users/${currentUser.uid}/loans`));
                await runTransaction(db, async (t) => {
                    t.set(newRef, { 
                        type, name, principal, payable, 
                        startDate: startDateInput,
                        createdAt: new Date().toISOString(), 
                        schedule 
                    });
                });
                
                addLoanForm.reset();
                document.querySelector('input[name="loan-type"][value="standard"]').click();
                showToast("Profile created successfully");
                
                if (history.state && history.state.view === 'add-loan') {
                    history.back();
                } else {
                    addLoanModal.classList.add('hidden');
                }
            } catch (error) {
                showToast("Failed to create profile", "error");
            } finally {
                if(btnText && btnSpinner) {
                    btnText.classList.remove('opacity-0');
                    btnSpinner.classList.add('opacity-0');
                    initBtn.disabled = false;
                }
            }
        }
    });
}

// Flexible Borrowing Ad-hoc Payment
if (btnFlexPay) {
    btnFlexPay.addEventListener('click', async () => {
        if (!activeDetailLoanId) return;
        if (!navigator.onLine) { showToast("Cannot modify payments while offline", "error"); return; }
        
        const amount = parseFloat(flexPayAmount.value);
        if (!amount || amount <= 0) { showToast("Enter a valid amount", "error"); return; }

        const dateInputStr = document.getElementById('flex-pay-date').value;
        const payDate = dateInputStr ? new Date(dateInputStr).toISOString() : new Date().toISOString();

        const btnText = document.getElementById('flex-btn-text');
        const btnSpinner = document.getElementById('flex-btn-spinner');

        if(btnText && btnSpinner) {
            btnText.classList.add('opacity-0');
            btnSpinner.classList.remove('opacity-0');
            btnFlexPay.disabled = true;
        }

        try {
            const loanRef = doc(db, `artifacts/${APP_ID}/users/${currentUser.uid}/loans`, activeDetailLoanId);
            await runTransaction(db, async (t) => {
                const docSnap = await t.get(loanRef);
                if (!docSnap.exists()) throw "Profile not found";
                
                const loanData = docSnap.data();
                const newPayment = {
                    id: Math.random().toString(36).substring(2, 11),
                    date: payDate,
                    amount: amount,
                    status: 'paid',
                    paidDate: new Date().toISOString()
                };
                
                const updatedSchedule = [...(loanData.schedule || []), newPayment];
                t.update(loanRef, { schedule: updatedSchedule });
            });
            
            flexPayAmount.value = '';
            document.getElementById('flex-pay-date').value = '';
            document.getElementById('flex-pay-date').type = 'text'; 

            showToast("Payment recorded!", "success");
        } catch (err) {
            showToast("Transaction failed.", "error");
        } finally {
            if(btnText && btnSpinner) {
                btnText.classList.remove('opacity-0');
                btnSpinner.classList.add('opacity-0');
                btnFlexPay.disabled = false;
            }
        }
    });
}

// Database Sync: Fetch and Sort Loans
function listenForLoans(uid) {
  const loansRef = collection(db, `artifacts/${APP_ID}/users/${uid}/loans`);
  loansUnsubscribe = onSnapshot(query(loansRef), (snapshot) => {
    loans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort logic
    loans.sort((a, b) => {
        const schedA = a.schedule || [];
        const schedB = b.schedule || [];
        
        const isAFlex = a.type === 'flexible';
        const isBFlex = b.type === 'flexible';
        
        const paidA = schedA.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.amount, 0);
        const paidB = schedB.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.amount, 0);
        
        const aSettled = isAFlex ? (paidA >= (a.payable || 0)) : !schedA.find(s => s.status === 'pending');
        const bSettled = isBFlex ? (paidB >= (b.payable || 0)) : !schedB.find(s => s.status === 'pending');

        if (aSettled && !bSettled) return 1;
        if (!aSettled && bSettled) return -1;
        if (aSettled && bSettled) return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        
        const nextA = !isAFlex ? schedA.find(s => s.status === 'pending') : null;
        const nextB = !isBFlex ? schedB.find(s => s.status === 'pending') : null;

        const timeA = nextA?.date ? new Date(nextA.date).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = nextB?.date ? new Date(nextB.date).getTime() : Number.MAX_SAFE_INTEGER;

        if (timeA !== timeB) return timeA - timeB; 
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    renderHomeDashboard();
    
    // Refresh detail view live if open
    if(activeDetailLoanId && loans.find(l => l.id === activeDetailLoanId)) {
        openLoanDetail(activeDetailLoanId, true);
    }
  });
}

// Render: Home Dashboard and Cards
function renderHomeDashboard() {
    let globalTaken = 0;
    let globalPayable = 0;
    let globalPaid = 0;
    let globalDueThisMonth = 0;
    let globalOverdue = 0;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    if (loansContainer) {
        loansContainer.innerHTML = loans.map(loan => {
            const schedule = loan.schedule || [];
            const isFlexible = loan.type === 'flexible';
            const paidAmount = schedule.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.amount, 0);
            const currentPayable = loan.principal - paidAmount;
            const progressPercent = loan.payable > 0 ? Math.min(100, Math.round((paidAmount / loan.payable) * 100)) : 0;
            
            const isSettled = isFlexible ? (paidAmount >= loan.payable) : !schedule.find(s => s.status === 'pending');
            
            if (!isSettled) {
                globalTaken += loan.principal;
                globalPayable += currentPayable;
                globalPaid += paidAmount;
                
                if (!isFlexible) {
                    schedule.forEach(s => {
                        if (s.status === 'pending') {
                            const d = new Date(s.date);
                            if (d < today) {
                                globalOverdue += s.amount;
                                globalDueThisMonth += s.amount;
                            } else if (d >= today && d <= thirtyDaysFromNow) {
                                globalDueThisMonth += s.amount;
                            }
                        }
                    });
                }
            }

            const nextInst = !isFlexible ? schedule.find(s => s.status === 'pending') : null;
            let daysLeftInfo = getDaysLeftDetails(nextInst ? nextInst.date : null);
            if (isFlexible) {
                 daysLeftInfo = isSettled 
                    ? { text: "Fully Settled", colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200" }
                    : { text: "No Fixed EMI", colorClass: "bg-slate-50 text-slate-500 border-slate-200" };
            }

            const nextDateStr = nextInst ? new Date(nextInst.date).toLocaleDateString('en-IN', {month:'short', day:'numeric', year:'numeric'}) : '';
            const startDateObj = loan.startDate ? new Date(loan.startDate) : new Date(loan.createdAt);
            const startDateStr = startDateObj.toLocaleDateString('en-IN', {month:'short', day:'numeric', year:'numeric'});
            const emiAmount = isFlexible ? "Flexible" : (schedule.length > 0 ? `₹${schedule[0].amount.toLocaleString('en-IN', {maximumFractionDigits:0})}` : '0');

            return `
            <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 cursor-pointer loan-card transition-all duration-200 hover:border-indigo-200 hover:shadow-md relative overflow-hidden active:scale-[0.98]" data-id="${loan.id}">
                <div class="absolute -right-8 -top-8 w-24 h-24 ${isFlexible ? 'bg-gradient-to-br from-purple-50 to-pink-50' : 'bg-gradient-to-br from-indigo-50 to-purple-50'} rounded-full z-0 opacity-50 pointer-events-none"></div>

                <div class="relative z-10">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-black text-lg text-slate-900 tracking-tight leading-none">${escapeHTML(loan.name)}</h3>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Started: ${startDateStr}</p>
                        </div>
                        <div class="text-right shrink-0">
                            <p class="text-[10px] text-indigo-400 font-black uppercase tracking-wider mb-0.5">EMI Amount</p>
                            <p class="text-xl font-black text-indigo-600 tracking-tight leading-none">${emiAmount}</p>
                        </div>
                    </div>

                    <div class="w-full bg-slate-100 rounded-full h-1.5 mb-4 overflow-hidden shadow-inner">
                        <div class="${isFlexible ? 'bg-purple-500' : 'bg-indigo-500'} h-1.5 rounded-full transition-all duration-700 ease-out" style="width: ${progressPercent}%"></div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                        <div>
                            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Total Taken</p>
                            <p class="text-sm font-black text-slate-800 tracking-tight">₹${loan.principal.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Total Payable</p>
                            <p class="text-sm font-black text-slate-800 tracking-tight">₹${Math.max(0, currentPayable).toLocaleString('en-IN')}</p>
                        </div>
                    </div>
                    
                    ${!isSettled ? `
                    <div class="pt-2 flex justify-between items-center px-1">
                        <p class="text-xs font-bold text-slate-500 tracking-tight">${isFlexible ? 'Flexible Plan' : `Next EMI: <span class="font-black text-indigo-600">${nextDateStr}</span>`}</p>
                        <span class="${daysLeftInfo.colorClass} text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md border shadow-sm">
                            ${daysLeftInfo.text}
                        </span>
                    </div>
                    ` : `
                    <div class="pt-2 flex items-center gap-2 px-1">
                        <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <p class="text-xs font-black text-emerald-600 uppercase tracking-wider">Profile Fully Settled</p>
                    </div>
                    `}
                </div>
            </div>
            `;
        }).join('') || `<div class="text-center py-12 px-6 bg-white rounded-3xl border border-dashed border-slate-200"><p class="text-slate-400 text-sm font-bold">Your portfolio is empty. Add a loan to start tracking.</p></div>`;
    }

    let globalTotalExpected = 0;
    loans.forEach(l => {
        const isFlex = l.type === 'flexible';
        const isSettled = isFlex ? ((l.schedule||[]).reduce((acc,s)=>acc+s.amount,0) >= l.payable) : !(l.schedule||[]).find(s=>s.status==='pending');
        if (!isSettled) globalTotalExpected += l.payable;
    });
    
    const globalProgressPercent = globalTotalExpected > 0 ? Math.min(100, Math.round((globalPaid / globalTotalExpected) * 100)) : 0;
    
    const gProgressBar = document.getElementById('global-progress-bar');
    if(gProgressBar) gProgressBar.style.width = `${globalProgressPercent}%`;
    
    const gProgressText = document.getElementById('global-progress-text');
    if(gProgressText) gProgressText.textContent = `${globalProgressPercent}%`;

    const gTaken = document.getElementById('global-taken');
    if(gTaken) gTaken.textContent = `₹${globalTaken.toLocaleString('en-IN')}`;
    
    const gPayable = document.getElementById('global-payable');
    if(gPayable) gPayable.textContent = `₹${Math.max(0, globalPayable).toLocaleString('en-IN')}`;
    
    const gPaid = document.getElementById('global-paid');
    if(gPaid) gPaid.textContent = `₹${globalPaid.toLocaleString('en-IN')}`;
    
    const gDue = document.getElementById('global-due-month');
    if(gDue) gDue.textContent = `₹${globalDueThisMonth.toLocaleString('en-IN', {maximumFractionDigits:0})}`;
    
    const gOverdue = document.getElementById('global-overdue-text');
    if(gOverdue) gOverdue.textContent = globalOverdue > 0 ? `(Includes ₹${globalOverdue.toLocaleString('en-IN', {maximumFractionDigits:0})} overdue)` : '';

    document.querySelectorAll('.loan-card').forEach(card => {
        card.addEventListener('click', (e) => openLoanDetail(e.currentTarget.dataset.id, false));
    });
}

// Render: Individual Loan Details and Timeline Sequence
function openLoanDetail(loanId, skipPushState = false) {
    activeDetailLoanId = loanId;
    const loan = loans.find(l => l.id === loanId);
    if(!loan) return;

    const schedule = loan.schedule || [];
    const isFlexible = loan.type === 'flexible';
    
    const paidArr = schedule.filter(s => s.status === 'paid');
    const paidCount = paidArr.length;
    const paidTotal = paidArr.reduce((sum, s) => sum + s.amount, 0);
    
    const totalInst = isFlexible ? '-' : schedule.length;
    const pendingCount = isFlexible ? '-' : (totalInst - paidCount);
    
    const currentPayable = loan.principal - paidTotal;
    const progressPercent = loan.payable > 0 ? Math.min(100, Math.round((paidTotal / loan.payable) * 100)) : 0;
    const isSettled = isFlexible ? (paidTotal >= loan.payable) : !schedule.find(s => s.status === 'pending');

    const safeSetText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    safeSetText('detail-loan-name', loan.name);
    safeSetText('detail-taken', `₹${loan.principal.toLocaleString('en-IN')}`);
    safeSetText('detail-payable', `₹${Math.max(0, currentPayable).toLocaleString('en-IN')}`);
    
    const interestAmt = loan.payable - loan.principal;
    safeSetText('detail-interest-amt', isFlexible ? 'N/A' : `₹${interestAmt.toLocaleString('en-IN')}`);
    
    const roi = isFlexible ? 'N/A' : `${(((loan.payable - loan.principal) / loan.principal) * 100).toFixed(1)}%`;
    safeSetText('detail-roi', roi);
    
    const emiAmount = isFlexible ? 'Flexible' : (schedule.length > 0 ? `₹${schedule[0].amount.toLocaleString('en-IN', {maximumFractionDigits:0})}` : '0');
    safeSetText('detail-emi-amount', emiAmount);
    
    const nextInst = !isFlexible ? schedule.find(s => s.status === 'pending') : null;
    let daysLeftInfo = getDaysLeftDetails(nextInst ? nextInst.date : null);
    if(isFlexible) {
        daysLeftInfo = isSettled 
            ? { text: "Fully Settled", colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200" }
            : { text: "No Fixed EMI", colorClass: "bg-slate-50 text-slate-500 border-slate-200" };
    }

    const detailDaysLeftContainer = document.getElementById('detail-days-left-container');
    if (detailDaysLeftContainer) {
        if(!nextInst) {
            detailDaysLeftContainer.innerHTML = `<span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border shadow-sm ${daysLeftInfo.colorClass}">${daysLeftInfo.text}</span>`;
        } else {
            const nextDateStr = new Date(nextInst.date).toLocaleDateString('en-IN', {month:'short', day:'numeric', year:'numeric'});
            detailDaysLeftContainer.innerHTML = `
                <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Next EMI: <span class="text-slate-800 font-black">${nextDateStr}</span></p>
                <span class="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border shadow-sm ${daysLeftInfo.colorClass}">${daysLeftInfo.text}</span>
            `;
        }
    }

    const dProgressBar = document.getElementById('detail-progress-bar');
    if (dProgressBar) dProgressBar.style.width = `${progressPercent}%`;
    
    safeSetText('detail-progress-paid', `₹${paidTotal.toLocaleString('en-IN', {maximumFractionDigits:0})}`);
    safeSetText('detail-progress-percent', `${progressPercent}%`);
    safeSetText('detail-total-inst', totalInst);
    safeSetText('detail-paid-inst', paidCount);
    safeSetText('detail-pend-inst', pendingCount);

    if (flexPaySection) {
        if (isFlexible && !isSettled) {
            flexPaySection.classList.remove('hidden');
            safeSetText('timeline-header', 'Payment History');
        } else {
            flexPaySection.classList.add('hidden');
            safeSetText('timeline-header', 'Payment Schedule');
        }
    }

    const timelineContainer = document.getElementById('timeline-container');
    if (timelineContainer) {
        if (schedule.length === 0) {
            timelineContainer.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm font-bold border-l-2 border-slate-100 ml-4 pl-4">No payments recorded.</div>`;
        } else {
            const firstPendingId = !isFlexible ? schedule.find(s => s.status === 'pending')?.id : null;
            const scheduleToRender = isFlexible ? [...schedule].reverse() : schedule;

            timelineContainer.innerHTML = scheduleToRender.map((inst, index) => {
                const isPaid = inst.status === 'paid';
                const isCurrentActive = inst.id === firstPendingId;
                const displayDate = new Date(inst.date).toLocaleDateString('en-IN', {month:'short', year:'numeric', day:'numeric'});
                const isLast = index === scheduleToRender.length - 1;
                
                const canUndo = isFlexible ? (index === 0) : (inst.id === [...schedule].reverse().find(s => s.status === 'paid')?.id);
                
                let actionHtml = '';
                if (isPaid) {
                    actionHtml = `
                        <div class="flex flex-col items-end gap-1 shrink-0">
                            <span class="text-emerald-600 font-black text-[10px] bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded uppercase tracking-wider">Paid</span>
                            ${canUndo ? `<button class="mark-btn text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase tracking-wider underline mt-0.5" data-action="${isFlexible ? 'flex-undo' : 'unpaid'}" data-loan-id="${loan.id}" data-inst-id="${inst.id}">Undo Last</button>` : ''}
                        </div>`;
                } else {
                    if (isCurrentActive) {
                        actionHtml = `<button class="mark-btn bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 shrink-0 uppercase tracking-wider" data-action="paid" data-loan-id="${loan.id}" data-inst-id="${inst.id}">Pay EMI</button>`;
                    } else {
                        actionHtml = `<button disabled class="bg-slate-50 text-slate-400 px-3 py-2 rounded-xl font-bold text-[10px] cursor-not-allowed border border-slate-200 shrink-0 uppercase tracking-wider">Locked</button>`;
                    }
                }

                const bubbleNum = isFlexible ? (scheduleToRender.length - index) : (index + 1);

                return `
                <div class="flex relative gap-4">
                    ${!isLast ? `<div class="absolute left-[15px] top-8 bottom-[-20px] w-[2px] bg-slate-200 z-0"></div>` : ''}
                    <div class="relative z-10 mt-3 w-8 h-8 rounded-full ${isPaid ? 'bg-emerald-500 border-4 border-emerald-100 text-white' : (isCurrentActive ? 'bg-indigo-500 border-4 border-indigo-100 text-white ring-4 ring-indigo-50 shadow-md' : 'bg-slate-100 border-4 border-white text-slate-500 shadow-sm')} flex items-center justify-center font-black text-[10px] shrink-0 transition-all duration-300">
                        ${bubbleNum}
                    </div>
                    
                    <div class="flex-1 bg-white p-4 rounded-2xl border ${isPaid ? 'border-emerald-100 shadow-sm' : (isCurrentActive ? 'border-indigo-200 shadow-md' : 'border-slate-100 shadow-sm')} flex justify-between items-center transition-all duration-300 mb-2">
                        <div>
                            <p class="font-black text-slate-800 tracking-tight">${displayDate}</p>
                            <p class="text-xs font-bold text-slate-500 mt-0.5">₹${inst.amount.toLocaleString('en-IN', {maximumFractionDigits:0})}</p>
                        </div>
                        ${actionHtml}
                    </div>
                </div>`;
            }).join('');
        }
    }

    document.querySelectorAll('.mark-btn').forEach(btn => {
        btn.addEventListener('click', handleMarkInst);
    });

    if (loanDetailView) {
        // First unhide the element so the browser registers its display[span_4](start_span)[span_4](end_span)
        loanDetailView.classList.remove('hidden');
        // A tiny timeout allows the DOM to catch up before triggering the CSS slide transition[span_5](start_span)[span_5](end_span)
        setTimeout(() => {
            loanDetailView.classList.remove('translate-x-full');
        }, 10);
    }
    
    // Only push state if we are explicitly entering this view anew
    if (!skipPushState && (!history.state || history.state.view !== 'loan-detail' || history.state.id !== loanId)) {
        history.pushState({ view: 'loan-detail', id: loanId }, '', `#loan-${loanId}`);
    }
}

// Database Action: Mark Sequential Installment OR Undo Flexible Payment
async function handleMarkInst(e) {
    if (!navigator.onLine) { showToast("Cannot modify installments while offline.", "error"); return; }
    
    const lId = e.target.dataset.loanId;
    const iId = e.target.dataset.instId;
    const action = e.target.dataset.action; 

    try {
        const loanRef = doc(db, `artifacts/${APP_ID}/users/${currentUser.uid}/loans`, lId);
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(loanRef);
            if (!docSnap.exists()) throw "Profile not found";
            
            const loanData = docSnap.data();
            
            if (action === 'flex-undo') {
                const updatedSchedule = (loanData.schedule || []).filter(inst => inst.id !== iId);
                t.update(loanRef, { schedule: updatedSchedule });
            } else {
                const updatedSchedule = (loanData.schedule || []).map(inst => {
                    if (inst.id === iId) {
                        return action === 'paid' 
                            ? { ...inst, status: 'paid', paidDate: new Date().toISOString() }
                            : { ...inst, status: 'pending', paidDate: null };
                    }
                    return inst;
                });
                t.update(loanRef, { schedule: updatedSchedule });
            }
        });
        showToast(action === 'paid' ? "Payment registered" : "Payment reversed", "success");
    } catch (err) {
        showToast("Transaction sync failed.", "error");
    }
}