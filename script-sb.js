import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = 'https://qbdzwwqkcjnfcqlgnknc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZHp3d3FrY2puZmNxbGdua25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzgyNTEsImV4cCI6MjEwMzAxNDI1MX0.GgeDNJCZwQdbfe9pKsDiV8Ld6rgJm_WkccI7iGbB4mg';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Global State ---
let currentUser = null, activeProjectId = null, projects = [], projectsUnsubscribe = null, expensesUnsubscribe = null, allExpensesForProject = [];
let showAllExpenses = false; 
let activeDataRequest = 0;
let isUserAdmin = false;

// --- DOM Elements ---
const views = { 
    splash: document.getElementById('splash-view'), 
    auth: document.getElementById('auth-view'), 
    app: document.getElementById('app-view'),
    maintenance: document.getElementById('maintenance-view') 
};

const headerAvatar = document.getElementById('header-avatar');
const headerUserName = document.getElementById('header-user-name');
const authTitle = document.getElementById('auth-title');
const emailForm = document.getElementById('email-form'), emailInput = document.getElementById('email-input'), passwordInput = document.getElementById('password-input'), emailActionBtn = document.getElementById('email-action-btn'), btnText = document.getElementById('btn-text'), btnSpinner = document.getElementById('btn-spinner'), togglePasswordBtn = document.getElementById('toggle-password-btn'), eyeIcon = document.getElementById('eye-icon'), eyeSlashIcon = document.getElementById('eye-slash-icon'), forgotPasswordLink = document.getElementById('forgot-password-link'), googleSignInBtn = document.getElementById('google-signin-btn');

const expenseDashboard = document.getElementById('expense-dashboard'), noProjectMessage = document.getElementById('no-project-message'), expenseForm = document.getElementById('expense-form'), expenseList = document.getElementById('expense-list'), finalExpensesEl = document.getElementById('final-expenses'), materialSummaryEl = document.getElementById('material-summary');
const userProfileMobile = document.getElementById('user-profile-mobile');
const hamburgerBtn = document.getElementById('hamburger-btn'), mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop'), mobileMenu = document.getElementById('mobile-menu'), closeMenuBtn = document.getElementById('close-menu-btn'), mobileSignOutBtn = document.getElementById('mobile-sign-out-btn');
const editModal = document.getElementById('edit-modal'), editExpenseForm = document.getElementById('edit-expense-form');

const searchInput = document.getElementById('search-input'), 
      startDateInput = document.getElementById('start-date-input'), 
      endDateInput = document.getElementById('end-date-input'),
      startTimeInput = document.getElementById('start-time-input'),
      endTimeInput = document.getElementById('end-time-input'),
      minAmountInput = document.getElementById('min-amount-input'),
      maxAmountInput = document.getElementById('max-amount-input');

const sidebarProjectList = document.getElementById('sidebar-project-list'), sidebarAddProjectBtn = document.getElementById('sidebar-add-project-btn');
const editProjectModal = document.getElementById('edit-project-modal'), editProjectForm = document.getElementById('edit-project-form');
const addProjectModal = document.getElementById('add-project-modal'), addProjectFormModal = document.getElementById('add-project-form-modal');
const infoModal = document.getElementById('info-modal'), infoModalTitle = document.getElementById('info-modal-title'), infoModalContent = document.getElementById('info-modal-content'), closeInfoModalBtn = document.getElementById('close-info-modal-btn');
const projectSummaryTitle = document.getElementById('project-summary-title');
const viewAllBtn = document.getElementById('view-all');

const fabAddExpense = document.getElementById('fab-add-expense'), addExpenseSheet = document.getElementById('add-expense-sheet');
const goToAnalyticsBtnNav = document.getElementById('go-to-analytics-btn-nav'), goToAnalyticsBtn = document.getElementById('go-to-analytics-btn');

const closeAddExpenseBtn = document.getElementById('close-add-expense-btn');
const closeEditBtn = document.getElementById('close-edit-btn');
const closeEditProjectBtn = document.getElementById('close-edit-project-btn');
const closeAddProjectBtn = document.getElementById('close-add-project-btn');

const toggleAddOptional = document.getElementById('toggle-add-optional');
const addOptionalFields = document.getElementById('add-optional-fields');

expenseForm?.addEventListener('submit', e => e.preventDefault());
editExpenseForm?.addEventListener('submit', e => e.preventDefault());
editProjectForm?.addEventListener('submit', e => e.preventDefault());
addProjectFormModal?.addEventListener('submit', e => e.preventDefault());

const escapeHTML = (str) => { const div = document.createElement('div'); div.appendChild(document.createTextNode(str || '')); return div.innerHTML; };

// --- Back Button Modal Management ---
function pushModalState() { history.pushState({ modalOpen: true }, ''); }

window.addEventListener('popstate', () => {
    closeAddExpenseModal();
    closeEditModal();
    closeEditProjectModal();
    closeAddProjectModal();
    closeInfoModal();
    analyticsModal?.classList.add('hidden');
    closeMenu();
});

// FIX: Global date formatter enforcing Local Timezone
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Animation Helper ---
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

// --- Custom Toast Notification ---
function showToast(message, type = 'error') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  let icon = type === 'error' ? 
      `<svg class="w-5 h-5 text-red-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` : 
      `<svg class="w-5 h-5 text-green-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

  toast.className = `bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl flex items-center text-sm font-bold tracking-wide transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto border border-slate-700/50`;
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

function setAuthButtonLoading(isLoading) {
  if (!emailActionBtn || !btnText || !btnSpinner) return;
  if (isLoading) {
    btnText.classList.add('opacity-0');
    btnSpinner.classList.remove('opacity-0');
    emailActionBtn.disabled = true;
  } else {
    btnText.classList.remove('opacity-0');
    btnSpinner.classList.add('opacity-0');
    emailActionBtn.disabled = false;
  }
}

// --- Universal Swipe Logic Hook ---
function initSwipeButton(containerId, onConfirmAsync) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const thumb = container.querySelector('.swipe-thumb');
    const track = container.querySelector('.swipe-track');
    const text = container.querySelector('.swipe-text');
    const spinner = container.querySelector('.swipe-spinner');

    let isDragging = false;
    let isConfirmed = false;
    let startX = 0;
    let currentX = 0;

    const reset = () => {
        isConfirmed = false;
        thumb.classList.remove('pointer-events-none');
        spinner.classList.add('opacity-0');
        text.style.opacity = '1';
        thumb.style.transform = `translateX(0px)`;
        track.style.width = `3.25rem`;
    };

    const onDragStart = (e) => {
        if (isConfirmed) return;
        isDragging = true;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        thumb.style.transition = 'none';
        track.style.transition = 'none';
        text.style.opacity = '0.3'; 
    };

    const onDragMove = (e) => {
        if (!isDragging || isConfirmed) return;
        const maxDrag = container.clientWidth - thumb.clientWidth - 8; 
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        currentX = Math.max(0, Math.min(clientX - startX, maxDrag));
        
        thumb.style.transform = `translateX(${currentX}px)`;
        track.style.width = `calc(3.25rem + ${currentX}px)`;
    };

    const onDragEnd = async () => {
        if (!isDragging || isConfirmed) return;
        isDragging = false;
        const maxDrag = container.clientWidth - thumb.clientWidth - 8;
        
        thumb.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        track.style.transition = 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        
        if (currentX >= maxDrag * 0.95) {
            isConfirmed = true;
            thumb.style.transform = `translateX(${maxDrag}px)`;
            track.style.width = '100%';
            thumb.classList.add('pointer-events-none');
            
            spinner.classList.remove('opacity-0');
            
            if (onConfirmAsync) {
                try {
                    await onConfirmAsync();
                } catch (err) {
                    reset();
                }
            }
        } else {
            thumb.style.transform = `translateX(0px)`;
            track.style.width = `3.25rem`;
            text.style.opacity = '1';
        }
    };

    thumb.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    
    thumb.addEventListener('touchstart', onDragStart, {passive: true});
    document.addEventListener('touchmove', onDragMove, {passive: false});
    document.addEventListener('touchend', onDragEnd);
    
    return { reset };
}

function showConfirm(title, onConfirmAsync = null) {
  return new Promise((resolve) => {
    const appContainer = document.querySelector('.max-w-md.relative');
    const targetParent = appContainer || document.body;
      
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-slate-1000/100 backdrop-blur-sm z-[150] flex flex-col justify-end opacity-0 transition-opacity duration-300';

    const modal = document.createElement('div');
    modal.className = 'bg-white p-6 pb-6 border-t border-red-300 rounded-t-3xl shadow-2xl w-full text-left transform translate-y-full transition-transform duration-300';

    modal.innerHTML = `
    <div class="flex justify-between items-start">
        <h3 class="text-xl font-bold text-slate-800 pr-4 leading-snug">${title}</h3>
        <button id="confirm-close-btn" class="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 hover:bg-slate-200 transition-colors focus:outline-none">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    </div>
    <div class="relative w-full h-[52px] bg-red-50 rounded-xl flex items-center overflow-hidden select-none border border-red-100 touch-none mt-2">
        <div class="absolute inset-0 flex items-center justify-center font-bold tracking-wide pointer-events-none z-0">
            <span id="swipe-text" class="swipe-text shimmer-text shimmer-red transition-opacity duration-300">Swipe to delete</span>
        </div>
        <div id="swipe-track" class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-transparent to-red-500 rounded-xl z-10 pointer-events-none flex items-center justify-center overflow-hidden" style="width: 3.25rem;">
            <svg id="swipe-spinner" class="w-5 h-5 animate-spin opacity-0 transition-opacity text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        </div>
        <div id="swipe-thumb" class="absolute left-1 w-11 h-[44px] bg-white rounded-lg shadow-md cursor-grab active:cursor-grabbing flex items-center justify-center z-20 text-red-500 hover:scale-[1.02] transition-transform">
            <svg class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
        </div>
    </div>`;

    overlay.appendChild(modal);
    targetParent.appendChild(overlay);

    const closeBtn = modal.querySelector('#confirm-close-btn');
    const swipeThumb = modal.querySelector('#swipe-thumb');
    const swipeTrack = modal.querySelector('#swipe-track');
    const swipeText = modal.querySelector('#swipe-text');
    const swipeSpinner = modal.querySelector('#swipe-spinner');
    const sliderContainer = swipeThumb.parentElement;
    
    let isDragging = false;
    let isConfirmed = false;
    let startX = 0;
    let currentX = 0;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        modal.classList.remove('translate-y-full');
      });
    });

    const closeAndResolve = (result) => {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('touchend', onDragEnd);
        
      overlay.classList.add('opacity-0');
      modal.classList.add('translate-y-full');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 300); 
    };

    closeBtn.addEventListener('click', () => closeAndResolve(false));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAndResolve(false);
    });

    const onDragStart = (e) => {
        if (isConfirmed) return;
        isDragging = true;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        swipeThumb.style.transition = 'none';
        swipeTrack.style.transition = 'none';
        swipeText.style.opacity = '0.3'; 
    };

    const onDragMove = (e) => {
        if (!isDragging || isConfirmed) return;
        const maxDrag = sliderContainer.clientWidth - swipeThumb.clientWidth - 8; 
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        currentX = Math.max(0, Math.min(clientX - startX, maxDrag));
        
        swipeThumb.style.transform = `translateX(${currentX}px)`;
        swipeTrack.style.width = `calc(3.25rem + ${currentX}px)`;
    };

    const onDragEnd = async () => {
        if (!isDragging || isConfirmed) return;
        isDragging = false;
        const maxDrag = sliderContainer.clientWidth - swipeThumb.clientWidth - 8;
        
        swipeThumb.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        swipeTrack.style.transition = 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        
        if (currentX >= maxDrag * 0.95) {
            isConfirmed = true;
            swipeThumb.style.transform = `translateX(${maxDrag}px)`;
            swipeTrack.style.width = '100%';
            swipeThumb.classList.add('pointer-events-none');
            
            swipeSpinner.classList.remove('opacity-0');
            
            if (onConfirmAsync) {
                try {
                    await onConfirmAsync();
                    closeAndResolve(true);
                } catch (err) {
                    isConfirmed = false;
                    swipeThumb.classList.remove('pointer-events-none');
                    swipeSpinner.classList.add('opacity-0');
                    swipeText.style.opacity = '1';
                    swipeThumb.style.transform = `translateX(0px)`;
                    swipeTrack.style.width = `3.25rem`;
                }
            } else {
                closeAndResolve(true);
            }
        } else {
            swipeThumb.style.transform = `translateX(0px)`;
            swipeTrack.style.width = `3.25rem`;
            swipeText.style.opacity = '1';
        }
    };

    swipeThumb.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    
    swipeThumb.addEventListener('touchstart', onDragStart, {passive: true});
    document.addEventListener('touchmove', onDragMove, {passive: false});
    document.addEventListener('touchend', onDragEnd);
  });
}

// --- View Management ---
const showView = (viewName) => {
  const currentActive = Object.values(views).find(v => v && v.classList.contains('active'));

  const transitionToNew = () => {
      Object.values(views).forEach(v => {
          if(v) {
              v.classList.add('hidden');
              v.classList.remove('active', 'animate-fade-in', 'flex');
          }
      });
      
      const nextView = views[viewName] || views.app;
      if (nextView) {
          nextView.classList.remove('hidden');
          nextView.classList.add('active', 'animate-fade-in');
          if (viewName === 'app' || viewName === 'maintenance') nextView.classList.add('flex');
      }
  };

  if (currentActive && currentActive.id !== `${viewName}-view` && currentActive.id !== viewName) {
      currentActive.classList.add('animate-fade-out');
      setTimeout(() => {
          currentActive.classList.remove('animate-fade-out');
          transitionToNew();
      }, 300);
  } else {
      transitionToNew();
  }
};


// --- Authentication ---
let isInitialLoad = true;
let isAppInitialized = false; 

supabase.auth.onAuthStateChange(async (event, session) => {
  const user = session?.user;
  currentUser = user;

  const routeUser = async () => {
    if (user) {
      setupUIForUser(user);
      
      // -- BEGIN ADMIN SETTINGS CHECK --
      const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single();
      const { data: role } = await supabase.from('user_roles').select('is_admin').eq('user_id', user.id).maybeSingle();
      
      isUserAdmin = role?.is_admin || false;
      const adminSection = document.getElementById('admin-menu-section');
      if(isUserAdmin && adminSection) {
          adminSection.classList.remove('hidden');
      } else if (adminSection) {
          adminSection.classList.add('hidden');
      }

      if (settings) {
          if (settings.maintenance_mode && !isUserAdmin) {
              showView('maintenance');
              return; 
          }
          
          const notifBar = document.getElementById('global-notification');
          const notifText = document.getElementById('notification-text');
          if (settings.global_notification && settings.global_notification.trim() !== '') {
              notifText.textContent = settings.global_notification;
              notifBar.classList.remove('hidden');
          } else {
              notifBar.classList.add('hidden');
          }
      }
      // -- END ADMIN SETTINGS CHECK --

      await listenForProjects(user.id);
      
      if (!isAppInitialized) {
          showView('app');
          isAppInitialized = true;
          document.getElementById('expense-dashboard')?.classList.add('dashboard-reveal');
      }
    } else {
      isAppInitialized = false;
      showView('auth');
      if (projectsUnsubscribe) supabase.removeChannel(projectsUnsubscribe);
      if (expensesUnsubscribe) supabase.removeChannel(expensesUnsubscribe);
      activeProjectId = null;
    }
  };

  if (isInitialLoad) {
    isInitialLoad = false;
    await routeUser();
  } else {
    routeUser();
  }
});


document.getElementById('close-notification')?.addEventListener('click', (e) => e.currentTarget.parentElement.classList.add('hidden'));


function setInputStatus(status) {
  if (!passwordInput) return;
  passwordInput.classList.remove('border-red-500', 'ring-1', 'ring-red-500', 'border-green-500', 'ring-green-500', 'focus:ring-indigo-600', 'border-gray-300');

  if (status === 'error') {
    passwordInput.classList.add('border-red-500', 'ring-1', 'ring-red-500');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } else if (status === 'success') {
    passwordInput.classList.add('border-green-500', 'ring-1', 'ring-green-500');
  } else {
    passwordInput.classList.add('border-gray-300', 'focus:ring-indigo-600');
  }
}

passwordInput?.addEventListener('input', () => setInputStatus('default'));

togglePasswordBtn?.addEventListener('click', () => {
  if (!passwordInput || !eyeIcon || !eyeSlashIcon) return;
  const isPassword = passwordInput.getAttribute('type') === 'password';
  passwordInput.setAttribute('type', isPassword ? 'text': 'password');
  if (isPassword) {
    eyeIcon.classList.add('hidden');
    eyeSlashIcon.classList.remove('hidden');
  } else {
    eyeIcon.classList.remove('hidden');
    eyeSlashIcon.classList.add('hidden');
  }
});

emailForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!navigator.onLine) { showToast("Please connect to the internet", "error"); return; }

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!password) { showToast('Please enter a password.', 'error'); setInputStatus('error'); return; }

  setAuthButtonLoading(true);

  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  
  if (!loginError) {
    setInputStatus('success');
    showToast("Login successful!", "success");
    setAuthButtonLoading(false);
  } else {
    if (loginError.message.includes("Invalid login")) {
        const { error: signupError } = await supabase.auth.signUp({ email, password });
        if (!signupError) {
            setInputStatus('success');
            showToast("Account created successfully!", "success");
            setAuthButtonLoading(false);
        } else {
            setInputStatus('error');
            setAuthButtonLoading(false);
            showToast(signupError.message || "Something went wrong.", 'error');
        }
    } else {
        setInputStatus('error');
        setAuthButtonLoading(false);
        showToast(loginError.message, 'error');
    }
  }
});

googleSignInBtn?.addEventListener('click', async () => {
  if (!navigator.onLine) { showToast("Please connect to internet", "error"); return; }
  
  const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'google',
      options: {
          redirectTo: window.location.origin
      }
  });

  if (error) {
      showToast(error.message, 'error');
  }
});

forgotPasswordLink?.addEventListener('click', async e => {
  e.preventDefault();
  const email = emailInput.value;
  if (!email) { showToast('Please enter your email address first.', 'error'); return; }
  
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    showToast(error.message, 'error');
  } else {
    showToast('Password reset email sent!', 'success');
  }
});

// --- Focus Next Autocomplete Function ---
const setupAutocomplete = (inputId, dropdownId, onSelectCallback) => {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    let timeout;

    input?.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const term = e.target.value.trim();
        if (!term || !activeProjectId) {
            dropdown.classList.add('hidden');
            return;
        }
        timeout = setTimeout(async () => {
            const { data } = await supabase.rpc('get_item_suggestions', { p_project_id: activeProjectId, p_search_term: term });
            if (data && data.length > 0) {
                dropdown.innerHTML = data.map(d => `<li class="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm font-semibold text-slate-700">${escapeHTML(d.material)}</li>`).join('');
                dropdown.classList.remove('hidden');
                
                dropdown.querySelectorAll('li').forEach(li => {
                    li.addEventListener('click', () => {
                        input.value = li.textContent;
                        dropdown.classList.add('hidden');
                        if (onSelectCallback) onSelectCallback();
                    });
                });
            } else {
                dropdown.classList.add('hidden');
            }
        }, 300);
    });
    
    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== dropdown) {
            dropdown?.classList.add('hidden');
        }
    });
};

setupAutocomplete('material-name', 'add-material-suggestions', () => document.getElementById('cost').focus());
setupAutocomplete('edit-material-name', 'edit-material-suggestions', () => document.getElementById('edit-cost').focus());
setupAutocomplete('search-input', 'search-suggestions', () => debouncedApplyFilters(true));

// --- Toggle Hide/Show Fields Logic ---
toggleAddOptional?.addEventListener('click', () => {
    const isHidden = addOptionalFields.classList.contains('hidden');
    if (isHidden) {
        addOptionalFields.classList.remove('hidden');
        toggleAddOptional.innerHTML = `<span>Hide options</span><svg class="w-4 h-4 transform rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
    } else {
        addOptionalFields.classList.add('hidden');
        toggleAddOptional.innerHTML = `<span>Show more options (Date, Time, Info)</span><svg class="w-4 h-4 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
    }
});


// --- UI Setup & Mobile Menu ---
function setupUIForUser(user) {
  const photo = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=e0e7ff&color=4f46e5`;

  if (headerAvatar) headerAvatar.src = photo;
  if (headerUserName) headerUserName.textContent = escapeHTML(user.user_metadata?.full_name || user.email.split('@')[0] || 'User');
  
  if (userProfileMobile) userProfileMobile.innerHTML = `<div class="flex items-center"><div class="w-12 h-12 rounded-full border-2 border-indigo-100 overflow-hidden mr-3"><img src="${photo}" alt="User photo" class="w-full h-full object-cover"></div><div><p class="font-bold text-slate-800">${escapeHTML(user.user_metadata?.full_name || 'User')}</p><p class="text-sm text-slate-500 font-medium truncate">${escapeHTML(user.email)}</p></div></div>`;

  if (navigator.onLine) {
    updateStatusUI('welcome');
  } else {
    updateStatusUI('offline');
  }
  
  // FIX: Formats to exact current local date instead of defaulting to UTC
  const dateInput = document.getElementById('date');
  if (dateInput) dateInput.value = formatDate(new Date());
}

const openMenu = () => {
  pushModalState();
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
mobileSignOutBtn?.addEventListener('click', () => supabase.auth.signOut());

// --- Data Backup & Restore ---
document.getElementById('backup-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    closeMenu();
    if (!currentUser || !navigator.onLine) { showToast("Cannot backup offline/unauthenticated.", "error"); return; }
    showToast("Preparing backup...", "success");
    try {
        const { data: projectsData, error: pErr } = await supabase.from('projects').select('*').eq('user_id', currentUser.id);
        if(pErr) throw pErr;
        const { data: expensesData, error: eErr } = await supabase.from('expenses').select('*').eq('user_id', currentUser.id);
        if(eErr) throw eErr;
        
        const backupData = { projects: projectsData, expenses: expensesData, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hisapbook_backup_${formatDate(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showToast("Backup downloaded successfully!", "success");
    } catch(err) {
        showToast("Backup failed.", "error");
        console.error(err);
    }
});

const restoreInput = document.getElementById('restore-file-input');
document.getElementById('restore-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    restoreInput?.click();
});

restoreInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (!data.projects || !data.expenses) throw new Error("Invalid format");
            
            showToast("Restoring data...", "success");
            
            if(data.projects.length > 0) {
                const { error: pErr } = await supabase.from('projects').upsert(data.projects);
                if (pErr) throw pErr;
            }
            if(data.expenses.length > 0) {
                const { error: eErr } = await supabase.from('expenses').upsert(data.expenses);
                if (eErr) throw eErr;
            }
            showToast("Data restored successfully!", "success");
            await reloadProjectsData();
        } catch(err) {
            showToast("Restore failed: " + err.message, "error");
        }
        restoreInput.value = ""; 
    };
    reader.readAsText(file);
});


// --- Core Helper Functions ---
async function reloadProjectsData() {
    if(!currentUser) return;
    const updated = await fetchProjects(currentUser.id);
    await processProjects(currentUser.id, updated);
}

// Backend-Powered Unified Fetch
const applyFilters = async (animate = false) => {
    if (!activeProjectId) return;
    const currentRequestId = ++activeDataRequest;

    const searchTerm = searchInput?.value.trim() || null;
    const startDate = startDateInput?.value || null;
    const endDate = endDateInput?.value || null;
    const startTime = startTimeInput?.value || null;
    const endTime = endTimeInput?.value || null;
    const minAmount = minAmountInput?.value || null;
    const maxAmount = maxAmountInput?.value || null;

    const isFiltering = searchTerm || startDate || endDate || startTime || endTime || minAmount || maxAmount;
    
    // Build List Query via PostgREST
    let query = supabase.from('expenses').select('*', { count: 'exact' }).eq('project_id', activeProjectId);
    
    if (searchTerm) {
        let orQuery = `material.ilike.%${searchTerm}%,info.ilike.%${searchTerm}%`;
        if (!isNaN(parseFloat(searchTerm)) && isFinite(searchTerm)) {
            orQuery += `,cost.eq.${parseFloat(searchTerm)}`;
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(searchTerm)) {
            orQuery += `,date.eq.${searchTerm}`;
        }
        query = query.or(orQuery);
    }

    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    if (startTime) query = query.gte('time', startTime);
    if (endTime) query = query.lte('time', endTime);
    if (minAmount) query = query.gte('cost', minAmount);
    if (maxAmount) query = query.lte('cost', maxAmount);
    
    query = query.order('date', { ascending: false }).order('time', { ascending: false });

    if (!isFiltering && !showAllExpenses) query = query.limit(5);

    // Fetch Aggregations via Backend RPC
    const summaryPromise = supabase.rpc('get_filtered_summary', {
        p_project_id: activeProjectId,
        p_search_term: searchTerm,
        p_start_date: startDate,
        p_end_date: endDate,
        p_start_time: startTime,
        p_end_time: endTime,
        p_min_amount: minAmount ? parseFloat(minAmount) : null,
        p_max_amount: maxAmount ? parseFloat(maxAmount) : null
    });

    const [expensesRes, summaryRes] = await Promise.all([query, summaryPromise]);

    if (currentRequestId !== activeDataRequest) return;

    allExpensesForProject = expensesRes.data || [];
    const exactCount = expensesRes.count || 0;
    
    if (!isFiltering && !showAllExpenses && exactCount > 5) {
        if (viewAllBtn) viewAllBtn.style.display = 'block';
    } else {
        if (viewAllBtn) viewAllBtn.style.display = 'none';
    }

    renderExpenses(allExpensesForProject, animate);
    renderSummaries(summaryRes.data, animate);
};

// Debounce filter inputs
let filterTimeout;
const debouncedApplyFilters = (animate = false) => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => applyFilters(animate), 300);
};
[searchInput, startDateInput, endDateInput, startTimeInput, endTimeInput, minAmountInput, maxAmountInput].forEach(el => el?.addEventListener('input', () => debouncedApplyFilters(false)));


async function fetchProjects(uid) {
  const { data } = await supabase.from('projects').select('*').eq('user_id', uid).order('created_at', { ascending: true });
  return data || [];
}

async function processProjects(uid, fetchedProjects) {
  projects = fetchedProjects;
  if (projects.length === 0 && navigator.onLine) {
    const { data: newProject } = await supabase.from('projects').insert([{ name: "General Project", user_id: uid }]).select();
    if(newProject && newProject.length > 0) {
        projects = newProject;
    }
  }
  
  populateSidebarProjects(projects);

  const savedProjectId = localStorage.getItem('lastActiveProjectId');
  if (savedProjectId && projects.find(p => p.id === savedProjectId)) {
    activeProjectId = savedProjectId;
  } else if (!activeProjectId || !projects.find(p => p.id === activeProjectId)) {
    activeProjectId = projects[0]?.id;
  }

  if (activeProjectId) {
    localStorage.setItem('lastActiveProjectId', activeProjectId);
    await updateActiveProject();
  }
}

async function listenForProjects(uid) {
  await reloadProjectsData();

  if (projectsUnsubscribe) supabase.removeChannel(projectsUnsubscribe);
  projectsUnsubscribe = supabase.channel('public:projects')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${uid}` }, async (payload) => {
        await reloadProjectsData(); 
    })
    .subscribe();
}

async function updateActiveProject() {
    const activeProject = projects.find(p => p.id === activeProjectId);
    if (activeProject && projectSummaryTitle) {
        projectSummaryTitle.textContent = activeProject.name;
    }
    updateSidebarSelection();
    toggleDashboardVisibility(true);
    
    await listenForExpenses(activeProjectId);
}

sidebarAddProjectBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu();
    pushModalState();
    setTimeout(() => { addProjectModal.classList.remove('hidden'); }, 300);
});

let addProjectSwipeObj = initSwipeButton('add-project-swipe', async () => {
    if (!addProjectFormModal.reportValidity()) throw new Error("Validation failed");
    if (!navigator.onLine) { showToast("Please connect to internet", "error"); throw new Error("Offline"); }
    
    const projectName = document.getElementById('new-project-name-modal').value.trim();
    
    if (projectName && currentUser) {
        try {
            const { error } = await supabase.from('projects').insert([{ name: projectName, user_id: currentUser.id }]);
            if (error) throw error;

            addProjectFormModal.reset();
            closeAddProjectModal();
            showToast(`Project "${projectName}" created!`, "success");
            
            await reloadProjectsData(); 
            addProjectSwipeObj.reset();
        } catch (err) {
            showToast("Transaction failed: Check your connection.", "error");
            throw err;
        }
    } else { throw new Error("Invalid payload"); }
});

function populateSidebarProjects(projects) {
    if (!sidebarProjectList) return;
    sidebarProjectList.innerHTML = projects.map((p, index) => {
        const buttonsHTML = `
            <div class="flex items-center space-x-1">
                <button data-project-id="${p.id}" data-project-name="${escapeHTML(p.name)}" class="edit-project-btn p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg></button>
                <button data-project-id="${p.id}" data-project-name="${escapeHTML(p.name)}" class="delete-project-btn p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50"><svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>`;
        return `
            <div class="flex justify-between items-center group rounded-xl hover:bg-slate-50 transition-colors">
                <a href="#" data-project-id="${p.id}" class="sidebar-project-link block py-2.5 px-3 text-sm font-semibold flex-grow truncate text-slate-600">${escapeHTML(p.name)}</a>
                ${buttonsHTML}
            </div>`;
    }).join('');

    document.querySelectorAll('.sidebar-project-link').forEach(link => link.addEventListener('click', async e => {
        e.preventDefault();
        const newProjectId = e.currentTarget.dataset.projectId;
        if (newProjectId === activeProjectId) return;
        
        activeProjectId = newProjectId;
        localStorage.setItem('lastActiveProjectId', activeProjectId);
        showAllExpenses = false;
        
        const dash = document.getElementById('expense-dashboard');
        if (dash) dash.style.opacity = '0.5';
        
        await updateActiveProject();
        closeMenu();
        
        if (dash) dash.style.opacity = '1';
    }));
    
    document.querySelectorAll('.edit-project-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const { projectId, projectName } = e.currentTarget.dataset;
        closeMenu();
        pushModalState();
        setTimeout(() => handleEditProject(projectId, projectName), 300);
    }));
    
    document.querySelectorAll('.delete-project-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const { projectId, projectName } = e.currentTarget.dataset;
        closeMenu();
        setTimeout(() => handleDeleteProject(projectId, projectName), 300);
    }));
}

function updateSidebarSelection() {
    document.querySelectorAll('.sidebar-project-link').forEach(link => {
        if(link.dataset.projectId === activeProjectId) {
            link.classList.add('text-indigo-600', 'bg-indigo-50');
            link.classList.remove('text-slate-600');
        } else {
            link.classList.remove('text-indigo-600', 'bg-indigo-50');
            link.classList.add('text-slate-600');
        }
    });
}

const toggleDashboardVisibility = (hasProjects) => {
    if (expenseDashboard) expenseDashboard.style.display = hasProjects ? 'block' : 'none';
    if (noProjectMessage) noProjectMessage.style.display = hasProjects ? 'none' : 'block';
};

viewAllBtn?.addEventListener('click', () => {
    showAllExpenses = true;
    applyFilters(false);
});

const filterBtn = document.getElementById('filter-btn');
const filterPanel = document.getElementById('filter-panel');
filterBtn?.addEventListener('click', () => {
    const isClosed = filterPanel.classList.contains('max-h-0');
    if (isClosed) {
        filterPanel.classList.remove('max-h-0', 'opacity-0', 'hidden');
        filterPanel.classList.add('max-h-[500px]', 'opacity-100');
        filterBtn.classList.add('bg-indigo-100', 'text-indigo-600');
    } else {
        filterPanel.classList.add('max-h-0', 'opacity-0');
        filterPanel.classList.remove('max-h-[500px]', 'opacity-100');
        filterBtn.classList.remove('bg-indigo-100', 'text-indigo-600');
        setTimeout(() => filterPanel.classList.add('hidden'), 300);
    }
});

async function listenForExpenses(projectId) {
    if (expensesUnsubscribe) {
        supabase.removeChannel(expensesUnsubscribe);
        expensesUnsubscribe = null;
    }
    if (!projectId) {
        allExpensesForProject = [];
        renderExpenses([], false);
        renderSummaries(null, false);
        return;
    }
    
    await applyFilters(false);
    
    expensesUnsubscribe = supabase.channel('public:expenses')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `project_id=eq.${projectId}` }, async (payload) => {
            await applyFilters(false); 
        })
        .subscribe();
}

const setDateFilter = (timeframe) => {
    const endDate = new Date();
    const startDate = new Date();
    switch (timeframe) {
        case 'last-week': startDate.setDate(startDate.getDate() - 7); break;
        case 'last-month': startDate.setMonth(startDate.getMonth() - 1); break;
        case 'last-year': startDate.setFullYear(startDate.getFullYear() - 1); break;
    }
    if (startDateInput) startDateInput.value = formatDate(startDate);
    if (endDateInput) endDateInput.value = formatDate(endDate);
    applyFilters(false);
};

document.getElementById('last-week')?.addEventListener('click', () => setDateFilter('last-week'));
document.getElementById('last-month')?.addEventListener('click', () => setDateFilter('last-month'));
document.getElementById('last-year')?.addEventListener('click', () => setDateFilter('last-year'));

// --- Modal Display Flows ---
fabAddExpense?.addEventListener('click', () => { 
    pushModalState();
    const now = new Date();
    document.getElementById('date').value = formatDate(now);
    document.getElementById('time').value = now.toTimeString().slice(0, 5);
    addExpenseSheet.classList.remove('hidden'); 
});

let addExpenseSwipeObj = initSwipeButton('add-expense-swipe', async () => {
    if (!expenseForm.reportValidity()) throw new Error("Validation failed");
    if (!currentUser || !activeProjectId || !navigator.onLine) {
        if (!navigator.onLine) showToast("Please connect to internet", "error");
        throw new Error("Offline or Unauthenticated");
    }
    
    const type = document.querySelector('input[name="entry-type"]:checked').value;
    const material = document.getElementById('material-name').value.trim();
    const cost = parseFloat(document.getElementById('cost').value);
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const info = document.getElementById('additional-info').value.trim();

    if (material && !isNaN(cost) && date && time) {
        try {
            const { error } = await supabase.from('expenses').insert([{ 
                material, cost, date, time, type, info, project_id: activeProjectId, user_id: currentUser.id 
            }]);
            if (error) throw error;

            expenseForm.reset();
            document.querySelector('input[name="entry-type"][value="expense"]').checked = true;
            closeAddExpenseModal();
            showToast("Entry added successfully!", "success");
            
            await applyFilters(false);
            
            document.getElementById('main-scroll').scrollTo({
                top: document.getElementById('history-section').offsetTop - 20,
                behavior: 'smooth'
            });
            
            addExpenseSwipeObj.reset();
        } catch (err) {
            showToast("Network Error: Data not saved.", "error");
            throw err;
        }
    } else { throw new Error("Invalid Payload"); }
});

const formatDisplayTime = (timeStr) => {
    if(!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

function renderExpenses(expenses, animate = false) {
    if (!expenseList) return;
    if (expenses.length === 0) {
        expenseList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm font-medium">No transactions found.</div>`;
        return;
    }
    
    expenseList.innerHTML = expenses.map((expense, index) => {
        const isIncome = expense.type === 'income';
        const costSign = '';
        const costColor = isIncome ? 'text-emerald-600' : 'text-slate-700';
        const iconBgColor = isIncome ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500';
        const iconSvg = isIncome 
            ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>'
            : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"></path></svg>';
        
        const animationStyle = animate ? `style="animation-fill-mode: both; animation-delay: ${index * 30}ms;"` : '';
        const animationClass = animate ? `animate-fade-in` : '';

        return `
        <div class="relative overflow-hidden rounded-2xl mb-3 bg-transparent swipe-item ${animationClass}" ${animationStyle} data-id="${expense.id}">
            
            <!-- Swipe Actions Background (No Inner Shadow) -->
            <div class="absolute inset-y-0 left-0 w-1/2 bg-indigo-50 flex items-center pl-6 rounded-l-2xl border border-indigo-100">
                <span class="text-indigo-600 font-bold tracking-wider text-sm flex items-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg> Edit</span>
            </div>
            <div class="absolute inset-y-0 right-0 w-1/2 bg-rose-50 flex items-center justify-end pr-6 rounded-r-2xl border border-rose-100">
                <span class="text-rose-600 font-bold tracking-wider text-sm flex items-center gap-1.5">Delete <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></span>
            </div>

            <!-- Swipe Foreground Card -->
            <div class="relative bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100 group transition-transform duration-200 swipe-front z-10 w-full touch-pan-y">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-xl ${iconBgColor} flex items-center justify-center shrink-0">
                        ${iconSvg}
                    </div>
                    <div class="overflow-hidden flex-1 pointer-events-none">
                        <h4 class="font-bold text-slate-700 break-words whitespace-normal leading-tight">${escapeHTML(expense.material)}</h4>
                        <p class="text-sm font-bold tracking-wider text-slate-500 mt-0.5">
                            ${new Date(expense.date).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })} &bull; ${formatDisplayTime(expense.time)}
                        </p>
                        ${expense.info ? `<p class="text-xs font-medium text-slate-400 mt-1 truncate max-w-[140px]">${escapeHTML(expense.info)}</p>` : ''}
                    </div>
                </div>
                <div class="text-right shrink-0 ml-3 pointer-events-none">
                    <p class="font-bold ${costColor}">${costSign}₹${Math.abs(expense.cost).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
        </div>
    `}).join('');

    // Setup Swipe Listeners with Directionality check
    document.querySelectorAll('.swipe-front').forEach(el => {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isSwiping = false;
        let isScrolling = false;

        el.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            el.style.transition = 'none';
            isSwiping = true;
            isScrolling = false;
        }, { passive: true });

        el.addEventListener('touchmove', e => {
            if (!isSwiping) return;
            
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;

            // Stop horizontal slide if user intents to scroll vertically
            if (!isScrolling && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
                isScrolling = true;
                isSwiping = false; 
                el.style.transform = `translateX(0px)`;
                return;
            }

            if (isScrolling) return;

            currentX = deltaX;
            // Dampen elasticity for limits smoothly
            if (currentX > 75) currentX = 75 + (currentX - 75) * 0.25; 
            if (currentX < -75) currentX = -75 + (currentX + 75) * 0.25;
            
            if (Math.abs(currentX) > 5) {
                el.style.transform = `translateX(${currentX}px)`;
            }
        }, { passive: true });

        const handleTouchEnd = () => {
            if (!isSwiping) return;
            isSwiping = false;
            el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            
            const expenseId = el.parentElement.dataset.id;
            const threshold = 65;

            if (currentX > threshold) {
                // Edit swipe completed
                el.style.transform = `translateX(100px)`;
                setTimeout(() => {
                    el.style.transform = `translateX(0px)`;
                    handleEdit({ currentTarget: { dataset: { id: expenseId } } });
                }, 150);
            } else if (currentX < -threshold) {
                // Delete swipe completed
                el.style.transform = `translateX(-100px)`;
                setTimeout(() => {
                    el.style.transform = `translateX(0px)`;
                    handleDelete({ currentTarget: { dataset: { id: expenseId } } });
                }, 150);
            } else {
                // Snap Back
                el.style.transform = `translateX(0px)`;
            }
            currentX = 0;
        };

        el.addEventListener('touchend', handleTouchEnd);
        el.addEventListener('touchcancel', handleTouchEnd);
    });
}

async function handleDelete(event) {
    const id = event.currentTarget.dataset.id;
    if (!navigator.onLine) { showToast("Please connect to internet", "error"); return; }
    if (!id) return;
    
    const expense = allExpensesForProject.find(e => e.id === id);
    if(!expense) return;
    
    const sign = ''; 
    const costStr = `₹${Math.abs(expense.cost).toLocaleString('en-IN')}`;
    const modalTitle = `Delete ${escapeHTML(expense.material)} (${sign}${costStr})?`;

    await showConfirm(modalTitle, async () => {
        if (!navigator.onLine) { showToast("Cannot delete while offline.", "error"); throw new Error("Offline"); }
        try {
            const { error } = await supabase.from('expenses').delete().eq('id', id);
            if (error) throw error;
            showToast("Entry deleted", "success");
            await applyFilters(false);
        } catch (err) {
            showToast("Delete failed: Network error.", "error");
            throw err;
        }
    });
}

function handleEdit(event) {
    const id = event.currentTarget.dataset.id;
    const expense = allExpensesForProject.find(e => e.id === id);
    if (!expense) return;
    
    pushModalState();
    
    document.getElementById('edit-expense-id').value = expense.id;
    document.querySelector(`input[name="edit-entry-type"][value="${expense.type || 'expense'}"]`).checked = true;
    document.getElementById('edit-material-name').value = expense.material;
    document.getElementById('edit-cost').value = expense.cost;
    document.getElementById('edit-date').value = expense.date;
    document.getElementById('edit-time').value = expense.time ? expense.time.slice(0, 5) : '';
    const infoInput = document.getElementById('edit-additional-info');
    if(infoInput) infoInput.value = expense.info || '';
    
    editModal.classList.remove('hidden');
}

let editExpenseSwipeObj = initSwipeButton('edit-expense-swipe', async () => {
    if (!editExpenseForm.reportValidity()) throw new Error("Validation failed");
    if (!navigator.onLine) { showToast("Offline: Cannot update.", "error"); throw new Error("Offline"); }
    
    const id = document.getElementById('edit-expense-id').value;
    const updatedData = {
        type: document.querySelector('input[name="edit-entry-type"]:checked').value,
        material: document.getElementById('edit-material-name').value.trim(),
        cost: parseFloat(document.getElementById('edit-cost').value),
        date: document.getElementById('edit-date').value,
        time: document.getElementById('edit-time').value,
        info: document.getElementById('edit-additional-info').value.trim()
    };
    
    if (updatedData.material && !isNaN(updatedData.cost) && updatedData.date && updatedData.time) {
        try {
            const { error } = await supabase.from('expenses').update(updatedData).eq('id', id);
            if (error) throw error;

            closeEditModal();
            showToast("Entry updated successfully!", "success");
            await applyFilters(false);
            editExpenseSwipeObj.reset();
        } catch (err) {
            showToast("Update failed: Check connection.", "error");
            throw err;
        }
    } else { throw new Error("Invalid payload"); }
});

function handleEditProject(projectId, projectName) {
    document.getElementById('edit-project-id').value = projectId;
    document.getElementById('edit-project-name').value = projectName;
    editProjectModal.classList.remove('hidden');
}

async function handleDeleteProject(projectId, projectName) {
    if (!navigator.onLine) { showToast("Please connect to internet", "error"); return; }
    if (!projectId) return;

    await showConfirm(`Delete project "${escapeHTML(projectName)}"?`, async () => {
        if (!navigator.onLine) { showToast("Cannot delete while offline.", "error"); throw new Error("Offline"); }
        try {
            const { error: expError } = await supabase.from('expenses').delete().eq('project_id', projectId);
            if (expError) throw expError;

            const { error: projError } = await supabase.from('projects').delete().eq('id', projectId);
            if (projError) throw projError;
            
            showToast("Project deleted", "success");
            
            if (activeProjectId === projectId) {
                const remainingProjects = projects.filter(p => p.id !== projectId);
                if (remainingProjects.length > 0) {
                    activeProjectId = remainingProjects[0].id;
                    localStorage.setItem('lastActiveProjectId', activeProjectId);
                    await updateActiveProject();
                } else {
                    activeProjectId = null;
                    localStorage.removeItem('lastActiveProjectId');
                    toggleDashboardVisibility(false);
                }
            }
            await reloadProjectsData();
        } catch (error) {
            showToast("Delete failed: Network error.", "error");
            throw error;
        }
    });
}

let editProjectSwipeObj = initSwipeButton('edit-project-swipe', async () => {
    if (!editProjectForm.reportValidity()) throw new Error("Validation failed");
    if (!navigator.onLine) { showToast("Please connect to internet", "error"); throw new Error("Offline"); }
    
    const projectId = document.getElementById('edit-project-id').value,
    newName = document.getElementById('edit-project-name').value.trim();
    
    if (newName && projectId) {
        try {
            const { error } = await supabase.from('projects').update({ name: newName }).eq('id', projectId);
            if (error) throw error;

            closeEditProjectModal();
            showToast("Project renamed successfully!", "success");
            
            await reloadProjectsData();
            editProjectSwipeObj.reset();
        } catch (err) {
            showToast("Rename failed.", "error");
            throw err;
        }
    } else { throw new Error("Invalid Payload"); }
});

const closeAddExpenseModal = () => { 
    addExpenseSheet?.classList.add('hidden'); 
    
    // Reset toggle fields UI state
    addOptionalFields?.classList.add('hidden');
    if (toggleAddOptional) toggleAddOptional.innerHTML = `<span>Show more options (Date, Time, Info)</span><svg class="w-4 h-4 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
    
    if(addExpenseSwipeObj) addExpenseSwipeObj.reset(); 
};
closeAddExpenseBtn?.addEventListener('click', closeAddExpenseModal);
addExpenseSheet?.addEventListener('click', e => { if (e.target === addExpenseSheet) closeAddExpenseModal(); });

const closeEditModal = () => { 
    editModal?.classList.add('hidden'); 
    if(editExpenseSwipeObj) editExpenseSwipeObj.reset();
};
closeEditBtn?.addEventListener('click', closeEditModal);
editModal?.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

const closeEditProjectModal = () => { 
    editProjectModal?.classList.add('hidden'); 
    if(editProjectSwipeObj) editProjectSwipeObj.reset();
};
closeEditProjectBtn?.addEventListener('click', closeEditProjectModal);
editProjectModal?.addEventListener('click', e => { if (e.target === editProjectModal) closeEditProjectModal(); });

const closeAddProjectModal = () => { 
    addProjectModal?.classList.add('hidden'); 
    if(addProjectSwipeObj) addProjectSwipeObj.reset();
};
closeAddProjectBtn?.addEventListener('click', closeAddProjectModal);
addProjectModal?.addEventListener('click', e => { if (e.target === addProjectModal) closeAddProjectModal(); });

const infoContent = {
    'about-link': {
        title: 'About Us',
        content: `<p class="mb-3">Welcome to <strong>HisapBook</strong>, your ultimate solution to track materials and project costs with ease.</p><p class="mb-3">Our mission is to simplify financial tracking for individuals, freelancers, and project managers. By providing real-time insights into your spending and budget allocation, we help you make informed financial decisions.</p><p>Built with speed and reliability in mind, HisapBook takes the headache out of expense management so you can focus on what matters most.</p>`
    },
    'privacy-link': {
        title: 'Privacy Policy',
        content: `<h4 class="font-bold text-slate-800 mb-1">1. Introduction</h4><p class="mb-4">We are committed to protecting your personal data when you use HisapBook.</p><h4 class="font-bold text-slate-800 mb-1">2. Data We Collect</h4><p class="mb-4">We collect basic Identity Data (email, profile) and Financial Data (expenses, incomes, budgets) to provide our service.</p><h4 class="font-bold text-slate-800 mb-1">3. Storage & Security</h4><p>Your data is authenticated and securely stored using Supabase, accessible only by you.</p>`
    },
    'contact-link': {
        title: 'Contact Us',
        content: `<p class="mb-4">We're here to help! Whether you have a question about a feature, need technical support, or want to provide feedback.</p><div class="bg-slate-50 p-4 rounded-xl border border-slate-100"><h4 class="font-bold text-slate-800 mb-2">Email Support</h4><a href="mailto:support@fintrack.app" class="text-indigo-600 font-semibold hover:underline">support@expensetracker.app</a><p class="text-[10px] uppercase text-slate-400 mt-2">We aim to respond within 24-48 hours.</p></div>`
    }
};

document.querySelectorAll('#about-link, #privacy-link, #contact-link').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        closeMenu();
        pushModalState();
        const { title, content } = infoContent[e.currentTarget.id];
        if (infoModalTitle) infoModalTitle.textContent = title;
        if (infoModalContent) infoModalContent.innerHTML = content;
        setTimeout(() => infoModal?.classList.remove('hidden'), 300);
    });
});

const closeInfoModal = () => { infoModal?.classList.add('hidden'); };
closeInfoModalBtn?.addEventListener('click', closeInfoModal);
infoModal?.addEventListener('click', e => { if (e.target === infoModal) closeInfoModal(); });

function renderSummaries(data, animate = false) {
    if (!finalExpensesEl) return;
    
    if (!data) data = { net_balance: 0, total_income: 0, total_expense: 0, material_totals: [] };
    
    const currentFinal = parseFloat(finalExpensesEl.textContent.replace(/[^\d.-]/g, '') || 0);
    animateNumber(finalExpensesEl, currentFinal, Math.abs(data.net_balance || 0));
    
    const cardIncomeCopy = document.getElementById('card-income-copy');
    if(cardIncomeCopy) {
        const currentInc = parseFloat(cardIncomeCopy.textContent.replace(/[^\d.-]/g, '') || 0);
        animateNumber(cardIncomeCopy, currentInc, Math.abs(data.total_income || 0));
    }
    
    const cardExpenseCopy = document.getElementById('card-expense-copy');
    if(cardExpenseCopy) {
        const currentExp = parseFloat(cardExpenseCopy.textContent.replace(/[^\d.-]/g, '') || 0);
        animateNumber(cardExpenseCopy, currentExp, Math.abs(data.total_expense || 0));
    }

    const matTotals = data.material_totals || [];
    if (matTotals.length === 0) {
        if (materialSummaryEl) materialSummaryEl.innerHTML = `<p class="text-slate-400 py-2">No summary available yet.</p>`;
        return;
    }

    if (materialSummaryEl) {
        materialSummaryEl.innerHTML = matTotals.map((item, index) => {
            const netAmount = item.net_amount;
            const colorClass = netAmount > 0 ? 'text-red-500' : (netAmount < 0 ? 'text-green-700' : 'text-slate-900');
            const displayName = item.material_name;
            
            const animationStyle = animate ? `style="animation-fill-mode: both; animation-delay: ${index * 30}ms"` : '';
            const animationClass = animate ? `animate-fade-in` : '';

            return `<div class="flex justify-between items-center py-1 ${animationClass}" ${animationStyle}><span class="font-semibold text-slate-700 break-words whitespace-normal leading-tight">${escapeHTML(displayName)}</span><span class="font-bold ${colorClass} ml-3">₹${Math.abs(netAmount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span></div>`;
        }).join('');
    }
}

const analyticsModal = document.getElementById('analytics-modal');
const closeAnalyticsBtn = document.getElementById('close-analytics-btn');
let categoryChartInstance = null;
let monthlyChartInstance = null;

const routeToAnalytics = async () => {
    if (!activeProjectId) { 
        showToast("Please select a project first.", "error"); 
        return; 
    }
    
    pushModalState();
    analyticsModal.classList.remove('hidden');

    const { data, error } = await supabase.rpc('get_project_analytics', { p_project_id: activeProjectId });
    if (error || !data) {
        showToast("Failed to load analytics data", "error");
        return;
    }

    const categoryTotals = data.category_totals || {};
    const monthlyData = data.monthly_data || {};
    const sortedMonths = Object.keys(monthlyData).sort();
    
    const finalMonthlyExp = {};
    const finalMonthlyInc = {};
    
    sortedMonths.forEach(m => {
        finalMonthlyExp[m] = monthlyData[m].expense;
        finalMonthlyInc[m] = monthlyData[m].income;
    });

    renderCharts(categoryTotals, finalMonthlyExp, finalMonthlyInc);
};

const renderCharts = (categoryTotals, monthlyExpenseTotals, monthlyIncomeTotals) => {
    const currencyFormatter = (value) => '₹' + value.toLocaleString('en-IN');
    
    if (categoryChartInstance) categoryChartInstance.destroy();
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    
    const ctxCategory = document.getElementById('category-chart').getContext('2d');
    categoryChartInstance = new Chart(ctxCategory, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: [
                    '#4F46E5', '#10B981', '#F59E0B', '#EF4444', 
                    '#8B5CF6', '#3B82F6', '#EC4899', '#64748B'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });

    const ctxMonthly = document.getElementById('monthly-chart').getContext('2d');
    monthlyChartInstance = new Chart(ctxMonthly, {
        type: 'bar',
        data: {
            labels: Object.keys(monthlyExpenseTotals).map(date => {
                const d = new Date(date + '-01'); 
                return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            }),
            datasets: [
                {
                    label: 'Income',
                    data: Object.values(monthlyIncomeTotals),
                    backgroundColor: '#10B981',
                    borderRadius: 4
                },
                {
                    label: 'Expenses',
                    data: Object.values(monthlyExpenseTotals),
                    backgroundColor: '#EF4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { callback: currencyFormatter } }
            },
            plugins: { legend: { display: true, position: 'top' } }
        }
    });
};

goToAnalyticsBtn?.addEventListener('click', routeToAnalytics);
goToAnalyticsBtnNav?.addEventListener('click', routeToAnalytics);

closeAnalyticsBtn?.addEventListener('click', () => analyticsModal.classList.add('hidden'));
analyticsModal?.addEventListener('click', e => { 
    if (e.target === analyticsModal) analyticsModal.classList.add('hidden'); 
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
            const name = currentUser?.user_metadata?.full_name || currentUser?.email.split('@')[0] || 'User';
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

document.getElementById('shareFinTrackBtn')?.addEventListener('click', async () => {
    const finTrackShareText = "I’ve been using HisapBook to manage my expenses and get clear insights into my spending.\nIt’s simple, effective, and actually helps me stay on top of my finances.\n\nYou should give it a try 👍";
    const appUrl = window.location.origin;
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Check out HisapBook', text: finTrackShareText, url: appUrl });
        } catch (error) { console.error('Error sharing:', error); }
    } else {
        navigator.clipboard.writeText(`${finTrackShareText}\n${appUrl}`).then(() => {
            showToast("Share message copied to clipboard!", "success");
        }).catch(err => console.error("Failed to copy text: ", err));
    }
});

const APP_VERSION = "2.4.0: Refined Swipe Gestures & Admin Placement";
const appVersionEl = document.getElementById("app-version");
if (appVersionEl) appVersionEl.textContent = `Version ${APP_VERSION}`;
