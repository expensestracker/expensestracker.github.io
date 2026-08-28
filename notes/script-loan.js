import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = 'https://qbdzwwqkcjnfcqlgnknc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZHp3d3FrY2puZmNxbGdua25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzgyNTEsImV4cCI6MjEwMzAxNDI1MX0.GgeDNJCZwQdbfe9pKsDiV8Ld6rgJm_WkccI7iGbB4mg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Global State
let currentUser = null;
let loans = [];
let loansUnsubscribe = null;
let activeDetailLoanId = null;

// DOM Elements
const views = { splash: document.getElementById('splash-view'), auth: document.getElementById('auth-view'), app: document.getElementById('app-view') };
const emailForm = document.getElementById('email-form'), emailInput = document.getElementById('email-input'), passwordInput = document.getElementById('password-input');
const togglePasswordBtn = document.getElementById('toggle-password-btn'), eyeIcon = document.getElementById('eye-icon'), eyeSlashIcon = document.getElementById('eye-slash-icon'), googleSignInBtn = document.getElementById('google-signin-btn');
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

// Animation Helpers
const activeAnimations = new Map();
function animateNumber(element, start, end, duration = 800) {
    if (!element) return;
    if (activeAnimations.has(element)) cancelAnimationFrame(activeAnimations.get(element));
    if (start === end) {
        element.textContent = `₹${end.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(easeOut * (end - start) + start);
        element.textContent = `₹${current.toLocaleString('en-IN')}`;
        
        if (progress < 1) {
            activeAnimations.set(element, window.requestAnimationFrame(step));
        } else {
            element.textContent = `₹${end.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
            activeAnimations.delete(element);
        }
    };
    activeAnimations.set(element, window.requestAnimationFrame(step));
}

// Toast UI
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
  const currentActive = Object.values(views).find(v => v && v.classList.contains('active'));
  const transitionToNew = () => {
      Object.values(views).forEach(v => {
          if(v) { v.classList.add('hidden'); v.classList.remove('active', 'animate-fade-in'); }
      });
      const nextView = views[viewName];
      if (nextView) {
          nextView.classList.remove('hidden'); nextView.classList.add('active', 'animate-fade-in');
          if (viewName === 'app') nextView.classList.add('flex');
      }
  };
  if (currentActive && currentActive.id !== `${viewName}-view` && currentActive.id !== viewName) {
      currentActive.classList.add('animate-fade-out');
      setTimeout(() => { currentActive.classList.remove('animate-fade-out'); transitionToNew(); }, 300);
  } else { transitionToNew(); }
};

let statusTimeout;
function updateStatusUI(state) {
    if (!userStatusDisplay) return;
    if (state === 'offline') {
        userStatusDisplay.innerHTML = `<span class="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span> <span class="text-rose-500">Offline</span>`;
    } else if (state === 'online') {
        userStatusDisplay.innerHTML = `<span class="w-2 h-2 bg-emerald-500 rounded-full"></span> <span class="text-emerald-600">Back Online</span>`;
        statusTimeout = setTimeout(() => updateStatusUI('welcome'), 3000);
    } else if (state === 'welcome') {
        userStatusDisplay.innerHTML = `<span class="w-2 h-2 bg-emerald-500 rounded-full"></span> Online`;
    }
}
window.addEventListener('offline', () => { clearTimeout(statusTimeout); updateStatusUI('offline'); });
window.addEventListener('online', () => { clearTimeout(statusTimeout); updateStatusUI('online'); });

function setupUIForUser(user) {
    const name = user.user_metadata?.full_name || user.email.split('@')[0] || 'User';
    const photo = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e0e7ff&color=4f46e5`;

    const headerAvatar = document.getElementById('header-avatar');
    if (headerAvatar) {
        headerAvatar.src = photo;
        headerAvatar.classList.remove('hidden');
    }
    
    updateStatusUI(navigator.onLine ? 'welcome' : 'offline');
}

// --- Auth System ---
let isInitialLoad = true;
let isAppInitialized = false;

supabase.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user;
  currentUser = user;

  const routeUser = async () => {
    if (user) {
      setupUIForUser(user);
      await loadAppDashboard(false);
      setupRealtime();
      if (!isAppInitialized) {
          showView('app');
          isAppInitialized = true;
          document.getElementById('global-dashboard')?.classList.add('dashboard-reveal');
      }
    } else {
      isAppInitialized = false;
      showView('auth');
      if (loansUnsubscribe) supabase.removeChannel(loansUnsubscribe);
    }
  };

  if (isInitialLoad) { isInitialLoad = false; await routeUser(); } 
  else { routeUser(); }
});

togglePasswordBtn?.addEventListener('click', () => {
  if (!passwordInput || !eyeIcon || !eyeSlashIcon) return;
  const isPassword = passwordInput.getAttribute('type') === 'password';
  passwordInput.setAttribute('type', isPassword ? 'text': 'password');
  if (isPassword) { eyeIcon.classList.add('hidden'); eyeSlashIcon.classList.remove('hidden'); } 
  else { eyeIcon.classList.remove('hidden'); eyeSlashIcon.classList.add('hidden'); }
});

emailForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!navigator.onLine) { showToast("Cannot login while offline", "error"); return; }
  
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');
  btnText.classList.add('opacity-0');
  btnSpinner.classList.remove('opacity-0');

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  
  btnText.classList.remove('opacity-0');
  btnSpinner.classList.add('opacity-0');

  if (!loginError) {
      showToast("Login successful!");
  } else {
      if (loginError.message.includes("Invalid login")) {
          const { error: signupError } = await supabase.auth.signUp({ email, password });
          if (!signupError) showToast("Account created successfully!");
          else showToast(signupError.message, 'error');
      } else { showToast(loginError.message, 'error'); }
  }
});

googleSignInBtn?.addEventListener('click', async () => {
  if (!navigator.onLine) { showToast("Please connect to internet", "error"); return; }
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  if (error) showToast(error.message, 'error');
});

mobileSignOutBtn.addEventListener('click', () => supabase.auth.signOut());


// --- UI Utilities ---
function getDaysLeftUI(daysLeft, isSettled, isFlexible) {
    if (isFlexible) {
        return isSettled 
            ? { text: "Fully Settled", colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200" }
            : { text: "No Fixed EMI", colorClass: "bg-slate-50 text-slate-500 border-slate-200" };
    }
    if (isSettled) return { text: "Fully Settled", colorClass: "bg-emerald-50 text-emerald-600 border-emerald-200" };
    
    if (daysLeft < 0) return { text: `Overdue by ${Math.abs(daysLeft)} Days`, colorClass: "bg-rose-50 text-rose-600 border-rose-200 shadow-sm" };
    if (daysLeft === 0) return { text: `Due Today`, colorClass: "bg-orange-50 text-orange-600 border-orange-200 shadow-sm" };
    if (daysLeft <= 5) return { text: `Due in ${daysLeft} Days`, colorClass: "bg-orange-50 text-orange-600 border-orange-200" };
    return { text: `Due in ${daysLeft} Days`, colorClass: "bg-indigo-50 text-indigo-600 border-indigo-200" };
}


// --- Modal & History Navigation Logic ---

// Listen to physical back button / swipe gestures
window.addEventListener('popstate', () => {
    if (!loanDetailView.classList.contains('hidden')) {
        closeLoanDetail(true);
    }
    if (!addLoanModal.classList.contains('hidden')) {
        closeAddLoanModal(true);
    }
});

btnAddLoanInline.addEventListener('click', () => {
    if (!navigator.onLine) { showToast("Cannot add new loans while offline", "error"); return; }
    const now = new Date();
    const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0'); const d = String(now.getDate()).padStart(2, '0');
    document.getElementById('loan-start-date').value = `${y}-${m}-${d}`;
    
    history.pushState({ modal: 'addLoan' }, '');
    addLoanModal.classList.remove('hidden');
});

const closeAddLoanModal = (fromPopState = false) => {
    if (addLoanModal.classList.contains('hidden')) return;
    addLoanModal.classList.add('hidden');
    if (fromPopState !== true) {
        history.back(); // Pops the state we pushed when opening
    }
};
document.getElementById('close-add-loan-btn').addEventListener('click', () => closeAddLoanModal());

const closeLoanDetail = (fromPopState = false) => {
    if (loanDetailView.classList.contains('hidden')) return;
    
    loanDetailView.classList.add('translate-x-full');
    setTimeout(() => loanDetailView.classList.add('hidden'), 300);
    activeDetailLoanId = null;
    
    if (fromPopState !== true) {
        history.back();
    }
};
document.getElementById('back-to-home-btn').addEventListener('click', () => closeLoanDetail());

const loanTypeRadios = document.querySelectorAll('input[name="loan-type"]');
loanTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        const isStandard = e.target.value === 'standard';
        const payableGroup = document.getElementById('loan-payable-group');
        const installmentsGroup = document.getElementById('loan-installments-group');
        
        if (isStandard) {
            payableGroup.classList.remove('hidden'); installmentsGroup.classList.remove('hidden');
            document.getElementById('loan-payable').required = true; document.getElementById('loan-installments').required = true;
        } else {
            payableGroup.classList.add('hidden'); installmentsGroup.classList.add('hidden');
            document.getElementById('loan-payable').required = false; document.getElementById('loan-installments').required = false;
        }
    });
});


// --- Database Logic ---

// Unified Payload Fetching via Backend RPC
async function loadAppDashboard(animate = false) {
    if (!currentUser) return;
    
    const { data, error } = await supabase.rpc('get_loan_dashboard_data', { p_user_id: currentUser.id });

    if (error) {
        showToast("Failed to sync latest data", "error");
        return;
    }

    loans = data.loans || [];
    renderHomeDashboard(data.summary, animate);
    
    if(activeDetailLoanId && loans.find(l => l.id === activeDetailLoanId)) { 
        openLoanDetail(activeDetailLoanId); 
    } else if (activeDetailLoanId) {
        closeLoanDetail();
    }
}

// Background Realtime Listener
function setupRealtime() {
    if (loansUnsubscribe) supabase.removeChannel(loansUnsubscribe);
    loansUnsubscribe = supabase.channel('public:loans')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loans', filter: `user_id=eq.${currentUser.id}` }, async () => {
            await loadAppDashboard(false); 
        }).subscribe();
}

// Add New Loan
addLoanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!navigator.onLine) { showToast("Cannot create profile while offline", "error"); return; }

    const initText = document.getElementById('init-loan-text');
    const initSpinner = document.getElementById('init-loan-spinner');
    initText.classList.add('opacity-0'); initSpinner.classList.remove('opacity-0');

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
        const { error } = await supabase.from('loans').insert([{
            user_id: currentUser.id,
            type, name, principal, payable, start_date: startDateInput, schedule
        }]);

        initText.classList.remove('opacity-0'); initSpinner.classList.add('opacity-0');

        if (error) { showToast(error.message, "error"); return; }
        
        addLoanForm.reset();
        document.querySelector('input[name="loan-type"][value="standard"]').click();
        closeAddLoanModal();
        showToast("Profile created successfully");
        
        await loadAppDashboard(false);
    }
});

// Delete Loan
btnDeleteLoan.addEventListener('click', async () => {
    if (!activeDetailLoanId) return;
    if (!navigator.onLine) { showToast("Cannot delete loans while offline", "error"); return; }

    if (window.confirm("Are you sure you want to delete this profile?")) {
        const delText = document.getElementById('delete-btn-text');
        const delSpinner = document.getElementById('delete-btn-spinner');
        delText.classList.add('opacity-0'); delSpinner.classList.remove('opacity-0');

        const { error } = await supabase.from('loans').delete().eq('id', activeDetailLoanId);
        
        delText.classList.remove('opacity-0'); delSpinner.classList.add('opacity-0');
        
        if (error) { showToast("Failed to delete.", "error"); return; }
        
        showToast("Profile deleted successfully.");
        closeLoanDetail();
        await loadAppDashboard(false);
    }
});

// Flexible Payment
btnFlexPay.addEventListener('click', async () => {
    if (!activeDetailLoanId) return;
    if (!navigator.onLine) { showToast("Cannot modify payments while offline", "error"); return; }
    
    const amount = parseFloat(flexPayAmount.value);
    if (!amount || amount <= 0) { showToast("Enter a valid amount", "error"); return; }

    const flexText = document.getElementById('flex-btn-text');
    const flexSpinner = document.getElementById('flex-btn-spinner');
    flexText.classList.add('opacity-0'); flexSpinner.classList.remove('opacity-0');

    const dateInputStr = document.getElementById('flex-pay-date').value;
    const payDate = dateInputStr ? new Date(dateInputStr).toISOString() : new Date().toISOString();

    const loan = loans.find(l => l.id === activeDetailLoanId);
    if (!loan) return;

    const newPayment = {
        id: Math.random().toString(36).substring(2, 11),
        date: payDate,
        amount: amount,
        status: 'paid',
        paidDate: new Date().toISOString()
    };
    
    const updatedSchedule = [...(loan.schedule || []), newPayment];
    const { error } = await supabase.from('loans').update({ schedule: updatedSchedule }).eq('id', activeDetailLoanId);
    
    flexText.classList.remove('opacity-0'); flexSpinner.classList.add('opacity-0');
    
    if (error) { showToast("Transaction failed.", "error"); } 
    else {
        flexPayAmount.value = '';
        document.getElementById('flex-pay-date').value = '';
        document.getElementById('flex-pay-date').type = 'text';
        showToast("Payment recorded!", "success");
        await loadAppDashboard(false);
    }
});


// --- Renders ---
function renderHomeDashboard(summaryData, animate = false) {
    const globalTaken = summaryData?.total_taken || 0;
    const globalPayable = summaryData?.total_payable || 0;
    const globalPaid = summaryData?.total_paid || 0;
    const globalDueThisMonth = summaryData?.due_in_30_days || 0;
    const globalOverdue = summaryData?.overdue || 0;

    loansContainer.innerHTML = loans.map(loan => {
        const isFlexible = loan.type === 'flexible';
        const daysLeftInfo = getDaysLeftUI(loan.days_until_due, loan.is_settled, isFlexible);

        const nextDateStr = loan.next_inst_date ? new Date(loan.next_inst_date).toLocaleDateString('en-IN', {month:'short', day:'numeric', year:'numeric'}) : '';
        const startDateObj = loan.start_date ? new Date(loan.start_date) : new Date(loan.created_at);
        const startDateStr = startDateObj.toLocaleDateString('en-IN', {month:'short', day:'numeric', year:'numeric'});
        const emiAmount = isFlexible ? "Flexible" : (loan.next_inst_amount ? `₹${parseFloat(loan.next_inst_amount).toLocaleString('en-IN', {maximumFractionDigits:0})}` : '0');

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
                    <div class="${isFlexible ? 'bg-purple-500' : 'bg-indigo-500'} h-1.5 rounded-full transition-all duration-700 ease-out" style="width: ${loan.progress_percent}%"></div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                    <div>
                        <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Total Taken</p>
                        <p class="text-sm font-black text-slate-800 tracking-tight">₹${parseFloat(loan.principal).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Total Payable</p>
                        <p class="text-sm font-black text-slate-800 tracking-tight">₹${parseFloat(loan.current_payable).toLocaleString('en-IN')}</p>
                    </div>
                </div>
                
                ${!loan.is_settled ? `
                <div class="pt-2 flex justify-between items-center px-1">
                    <p class="text-xs font-bold text-slate-500 tracking-tight">${isFlexible ? 'Flexible Plan' : `Next EMI: <span class="font-black text-indigo-600">${nextDateStr}</span>`}</p>
                    <span class="${daysLeftInfo.colorClass} text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md border shadow-sm">${daysLeftInfo.text}</span>
                </div>` : `<div class="pt-2 flex items-center gap-2 px-1"><div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div><p class="text-xs font-black text-emerald-600 uppercase tracking-wider">Profile Fully Settled</p></div>`}
            </div>
        </div>`;
    }).join('') || `<div class="text-center py-12 px-6 bg-white rounded-3xl border border-dashed border-slate-200"><p class="text-slate-400 text-sm font-bold">Your portfolio is empty. Add a loan to start tracking.</p></div>`;
    
    // Global Progress Math
    let globalTotalExpected = 0;
    loans.forEach(l => {
        if (!l.is_settled) globalTotalExpected += l.payable;
    });
    const globalProgressPercent = globalTotalExpected > 0 ? Math.min(100, Math.round((globalPaid / globalTotalExpected) * 100)) : 0;
    
    document.getElementById('global-progress-bar').style.width = `${globalProgressPercent}%`;
    document.getElementById('global-progress-text').textContent = `${globalProgressPercent}%`;

    const elTaken = document.getElementById('global-taken');
    const elPayable = document.getElementById('global-payable');
    const elPaid = document.getElementById('global-paid');

    animateNumber(elTaken, parseFloat(elTaken.textContent.replace(/[^\d.-]/g, ''))||0, globalTaken);
    animateNumber(elPayable, parseFloat(elPayable.textContent.replace(/[^\d.-]/g, ''))||0, Math.max(0, globalPayable));
    animateNumber(elPaid, parseFloat(elPaid.textContent.replace(/[^\d.-]/g, ''))||0, globalPaid);
    
    document.getElementById('global-due-month').textContent = `₹${globalDueThisMonth.toLocaleString('en-IN', {maximumFractionDigits:0})}`;
    document.getElementById('global-overdue-text').textContent = globalOverdue > 0 ? `(Includes ₹${globalOverdue.toLocaleString('en-IN', {maximumFractionDigits:0})} overdue)` : '';

    document.querySelectorAll('.loan-card').forEach(card => card.addEventListener('click', (e) => openLoanDetail(e.currentTarget.dataset.id)));
}

function openLoanDetail(loanId) {
    const isAlreadyOpen = !loanDetailView.classList.contains('hidden');
    
    activeDetailLoanId = loanId;
    const loan = loans.find(l => l.id === loanId);
    if(!loan) return;

    const isFlexible = loan.type === 'flexible';
    const scheduleToRender = isFlexible ? [...loan.schedule].reverse() : loan.schedule;
    
    document.getElementById('detail-loan-name').textContent = loan.name;
    document.getElementById('detail-taken').textContent = `₹${loan.principal.toLocaleString('en-IN')}`;
    document.getElementById('detail-payable').textContent = `₹${loan.current_payable.toLocaleString('en-IN')}`;
    document.getElementById('detail-interest-amt').textContent = isFlexible ? 'N/A' : `₹${loan.interest_amt.toLocaleString('en-IN')}`;
    document.getElementById('detail-roi').textContent = isFlexible ? 'N/A' : `${loan.roi}%`;
    document.getElementById('detail-emi-amount').textContent = isFlexible ? 'Flexible' : (loan.next_inst_amount ? `₹${parseFloat(loan.next_inst_amount).toLocaleString('en-IN', {maximumFractionDigits:0})}` : '0');
    
    const daysLeftInfo = getDaysLeftUI(loan.days_until_due, loan.is_settled, isFlexible);
    const detailDaysLeftContainer = document.getElementById('detail-days-left-container');
    if(!loan.next_inst_date) {
        detailDaysLeftContainer.innerHTML = `<span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border shadow-sm ${daysLeftInfo.colorClass}">${daysLeftInfo.text}</span>`;
    } else {
        const nextDateStr = new Date(loan.next_inst_date).toLocaleDateString('en-IN', {month:'short', day:'numeric', year:'numeric'});
        detailDaysLeftContainer.innerHTML = `<p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Next EMI: <span class="text-slate-800 font-black">${nextDateStr}</span></p><span class="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded border shadow-sm ${daysLeftInfo.colorClass}">${daysLeftInfo.text}</span>`;
    }

    document.getElementById('detail-progress-bar').style.width = `${loan.progress_percent}%`;
    document.getElementById('detail-progress-paid').textContent = `₹${parseFloat(loan.paid_amount).toLocaleString('en-IN', {maximumFractionDigits:0})}`;
    document.getElementById('detail-progress-percent').textContent = `${loan.progress_percent}%`;

    document.getElementById('detail-total-inst').textContent = isFlexible ? '-' : loan.total_inst;
    document.getElementById('detail-paid-inst').textContent = loan.paid_inst;
    document.getElementById('detail-pend-inst').textContent = isFlexible ? '-' : loan.pending_inst;

    if (isFlexible && !loan.is_settled) { flexPaySection.classList.remove('hidden'); document.getElementById('timeline-header').textContent = 'Payment History'; } 
    else { flexPaySection.classList.add('hidden'); document.getElementById('timeline-header').textContent = 'Payment Schedule'; }

    const timelineContainer = document.getElementById('timeline-container');
    if (scheduleToRender.length === 0) {
        timelineContainer.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm font-bold border-l-2 border-slate-100 ml-4 pl-4">No payments recorded.</div>`;
    } else {
        timelineContainer.innerHTML = scheduleToRender.map((inst, index) => {
            const isPaid = inst.status === 'paid';
            const isCurrentActive = inst.id === loan.first_pending_id;
            const displayDate = new Date(inst.date).toLocaleDateString('en-IN', {month:'short', year:'numeric', day:'numeric'});
            const isLast = index === scheduleToRender.length - 1;
            const canUndo = isFlexible ? (index === 0) : (inst.id === [...loan.schedule].reverse().find(s => s.status === 'paid')?.id);
            
            let actionHtml = '';
            if (isPaid) {
                actionHtml = `<div class="flex flex-col items-end gap-1 shrink-0"><span class="text-emerald-600 font-black text-[10px] bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded uppercase tracking-wider">Paid</span>${canUndo ? `<button class="undo-btn text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase tracking-wider underline mt-0.5" data-action="${isFlexible ? 'flex-undo' : 'unpaid'}" data-inst-id="${inst.id}">Undo Last</button>` : ''}</div>`;
            } else {
                if (isCurrentActive) { 
                    actionHtml = `<button class="mark-btn bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 shrink-0 uppercase tracking-wider relative flex items-center justify-center min-w-[80px]" data-action="paid" data-inst-id="${inst.id}">
                        <span class="btn-text pointer-events-none transition-opacity">Pay EMI</span>
                        <svg class="w-4 h-4 animate-spin absolute opacity-0 btn-spinner pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    </button>`; 
                } 
                else { actionHtml = `<button disabled class="bg-slate-50 text-slate-400 px-3 py-2 rounded-xl font-bold text-[10px] cursor-not-allowed border border-slate-200 shrink-0 uppercase tracking-wider">Locked</button>`; }
            }

            const bubbleNum = isFlexible ? (scheduleToRender.length - index) : (index + 1);

            return `
            <div class="flex relative gap-4">
                ${!isLast ? `<div class="absolute left-[15px] top-8 bottom-[-20px] w-[2px] bg-slate-200 z-0"></div>` : ''}
                <div class="relative z-10 mt-3 w-8 h-8 rounded-full ${isPaid ? 'bg-emerald-500 border-4 border-emerald-100 text-white' : (isCurrentActive ? 'bg-indigo-500 border-4 border-indigo-100 text-white ring-4 ring-indigo-50 shadow-md' : 'bg-slate-100 border-4 border-white text-slate-500 shadow-sm')} flex items-center justify-center font-black text-[10px] shrink-0 transition-all duration-300">${bubbleNum}</div>
                <div class="flex-1 bg-white p-4 rounded-2xl border ${isPaid ? 'border-emerald-100 shadow-sm' : (isCurrentActive ? 'border-indigo-200 shadow-md' : 'border-slate-100 shadow-sm')} flex justify-between items-center transition-all duration-300 mb-2">
                    <div>
                        <p class="font-black text-slate-800 tracking-tight">${displayDate}</p>
                        <p class="text-xs font-bold text-slate-500 mt-0.5">₹${parseFloat(inst.amount).toLocaleString('en-IN', {maximumFractionDigits:0})}</p>
                    </div>
                    ${actionHtml}
                </div>
            </div>`;
        }).join('');
    }

    document.querySelectorAll('.mark-btn, .undo-btn').forEach(btn => btn.addEventListener('click', handleMarkInst));
    
    if (!isAlreadyOpen) {
        history.pushState({ modal: 'loanDetail' }, '');
        loanDetailView.classList.remove('hidden');
        setTimeout(() => loanDetailView.classList.remove('translate-x-full'), 10);
    }
}

// Mark Pay/Undo
async function handleMarkInst(e) {
    if (!navigator.onLine) { showToast("Cannot modify installments while offline.", "error"); return; }
    
    const btn = e.currentTarget;
    const iId = btn.dataset.instId;
    const action = btn.dataset.action; 

    if(action === 'paid') {
        btn.classList.add('pointer-events-none');
        btn.querySelector('.btn-text').classList.add('opacity-0');
        btn.querySelector('.btn-spinner').classList.remove('opacity-0');
    }

    const loan = loans.find(l => l.id === activeDetailLoanId);
    if (!loan) return;

    let updatedSchedule;
    if (action === 'flex-undo') {
        updatedSchedule = (loan.schedule || []).filter(inst => inst.id !== iId);
    } else {
        updatedSchedule = (loan.schedule || []).map(inst => {
            if (inst.id === iId) {
                return action === 'paid' ? { ...inst, status: 'paid', paidDate: new Date().toISOString() } : { ...inst, status: 'pending', paidDate: null };
            }
            return inst;
        });
    }

    const { error } = await supabase.from('loans').update({ schedule: updatedSchedule }).eq('id', activeDetailLoanId);
    if (error) { 
        showToast("Transaction sync failed.", "error"); 
        if(action === 'paid') {
            btn.classList.remove('pointer-events-none');
            btn.querySelector('.btn-text').classList.remove('opacity-0');
            btn.querySelector('.btn-spinner').classList.add('opacity-0');
        }
    } 
    else { 
        showToast(action === 'paid' ? "Payment registered" : "Payment reversed", "success"); 
        await loadAppDashboard(false);
    }
}