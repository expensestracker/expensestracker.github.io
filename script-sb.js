import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = 'https://qbdzwwqkcjnfcqlgnknc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZHp3d3FrY2puZmNxbGdua25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzgyNTEsImV4cCI6MjEwMzAxNDI1MX0.GgeDNJCZwQdbfe9pKsDiV8Ld6rgJm_WkccI7iGbB4mg';
const supabase = createClient(supabaseUrl, supabaseKey);

Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

let currentUser = null, activeProjectId = null, projects = [], projectsUnsubscribe = null, expensesUnsubscribe = null, allExpensesForProject = [];
let showAllExpenses = false; 
let activeDataRequest = 0;
let isUserAdmin = false;

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

const resetRequestModal = document.getElementById('reset-request-modal');
const closeResetRequestBtn = document.getElementById('close-reset-request-btn');
const resetRequestForm = document.getElementById('reset-request-form');
const setNewPasswordModal = document.getElementById('set-new-password-modal');
const setNewPasswordForm = document.getElementById('set-new-password-form');

expenseForm?.addEventListener('submit', e => e.preventDefault());
editExpenseForm?.addEventListener('submit', e => e.preventDefault());
editProjectForm?.addEventListener('submit', e => e.preventDefault());
addProjectFormModal?.addEventListener('submit', e => e.preventDefault());

const escapeHTML = (str) => { const div = document.createElement('div'); div.appendChild(document.createTextNode(str || '')); return div.innerHTML; };

function pushModalState() { history.pushState({ modalOpen: true }, ''); }

window.addEventListener('popstate', () => {
    closeAddExpenseModal();
    closeEditModal();
    closeEditProjectModal();
    closeAddProjectModal();
    closeInfoModal();
    resetRequestModal?.classList.add('hidden');
    setNewPasswordModal?.classList.add('hidden');
    analyticsModal?.classList.add('hidden');
    closeMenu();
});

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDisplayTime = (timeStr) => {
    if(!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(h, m);
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const setDateValue = (inputId, rawDateStr) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.dataset.rawDate = rawDateStr;
    el.type = 'text';
    if (rawDateStr) {
        const [y, m, d] = rawDateStr.split('-');
        el.value = `${d}/${m}/${y}`;
    } else {
        el.value = '';
    }
};

const setTimeValue = (inputId, rawTimeStr) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.dataset.rawTime = rawTimeStr;
    el.type = 'text';
    if (rawTimeStr) {
        el.value = formatDisplayTime(rawTimeStr);
    } else {
        el.value = '';
    }
};

const applyDateDisplay = (inputId) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('blur', (e) => {
        if (e.target.type === 'date') setDateValue(inputId, e.target.value);
    });
    input.addEventListener('focus', (e) => {
        if (e.target.type === 'text') {
            e.target.type = 'date';
            e.target.value = e.target.dataset.rawDate || '';
            e.target.showPicker && e.target.showPicker();
        }
    });
};

const applyTimeDisplay = (inputId) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('blur', (e) => {
        if (e.target.type === 'time') setTimeValue(inputId, e.target.value);
    });
    input.addEventListener('focus', (e) => {
        if (e.target.type === 'text') {
            e.target.type = 'time';
            e.target.value = e.target.dataset.rawTime || '';
            e.target.showPicker && e.target.showPicker();
        }
    });
};

applyDateDisplay('date');
applyDateDisplay('edit-date');
applyTimeDisplay('time');
applyTimeDisplay('edit-time');


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

function showToast(message, type = 'error') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  let icon = type === 'error' ? 
      `<svg class="w-5 h-5 text-ios-red mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` : 
      `<svg class="w-5 h-5 text-ios-green mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

  toast.className = `bg-white text-ios-label px-5 py-3.5 rounded-full shadow-ios flex items-center text-[15px] font-medium tracking-wide transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto border border-ios-separator/20`;
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
        track.style.width = `3.5rem`;
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
        track.style.width = `calc(3.5rem + ${currentX}px)`;
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
            track.style.width = `3.5rem`;
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
    overlay.className = 'absolute inset-0 bg-black/10 backdrop-blur-md z-[150] flex flex-col justify-end opacity-0 transition-opacity duration-300';

    const modal = document.createElement('div');
    modal.className = 'bg-[#F2F2F7] pb-8 rounded-t-[32px] shadow-2xl w-full text-left transform translate-y-full transition-transform duration-300';

    modal.innerHTML = `
    <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-4"></div>
    <div class="px-6 flex justify-between items-center mb-6">
        <h3 class="text-[22px] font-semibold text-ios-label tracking-tight flex-1 pr-4 leading-tight">${title}</h3>
        <button id="confirm-cancel-btn" class="w-8 h-8 rounded-full bg-ios-grayLight flex items-center justify-center shrink-0 text-ios-gray active:opacity-70 focus:outline-none">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><path d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    </div>
    <div class="px-6 pb-2 flex flex-col items-center">
        <div class="w-full relative h-[56px] bg-ios-grayLight rounded-full flex items-center overflow-hidden select-none touch-none shadow-inner">
            <div class="absolute inset-0 flex items-center justify-center text-[17px] font-medium pointer-events-none z-0">
                <span id="swipe-text" class="swipe-text text-ios-gray transition-opacity duration-300">Slide to delete</span>
            </div>
            <div id="swipe-track" class="absolute left-0 top-0 bottom-0 bg-ios-red rounded-full z-10 pointer-events-none flex items-center justify-center overflow-hidden transition-all" style="width: 3.5rem;">
                <svg id="swipe-spinner" class="w-5 h-5 animate-spin opacity-0 transition-opacity text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </div>
            <div id="swipe-thumb" class="absolute left-1 w-[48px] h-[48px] bg-white rounded-full shadow cursor-grab active:cursor-grabbing flex items-center justify-center z-20 text-ios-red transition-transform">
                <svg class="w-6 h-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 5l7 7-7 7"></path></svg>
            </div>
        </div>
    </div>`;

    overlay.appendChild(modal);
    targetParent.appendChild(overlay);

    const cancelBtn = modal.querySelector('#confirm-cancel-btn');
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

    cancelBtn.addEventListener('click', () => closeAndResolve(false));
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
        swipeTrack.style.width = `calc(3.5rem + ${currentX}px)`;
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
                    swipeTrack.style.width = `3.5rem`;
                }
            } else {
                closeAndResolve(true);
            }
        } else {
            swipeThumb.style.transform = `translateX(0px)`;
            swipeTrack.style.width = `3.5rem`;
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
  if (event === 'PASSWORD_RECOVERY') {
      if (setNewPasswordModal) {
          pushModalState();
          setNewPasswordModal.classList.remove('hidden');
      }
  }

  const user = session?.user;
  currentUser = user;

  const routeUser = async () => {
    if (user) {
      setupUIForUser(user);
      
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

emailForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!navigator.onLine) { showToast("Please connect to the internet", "error"); return; }

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!password) { showToast('Please enter a password.', 'error'); return; }

  setAuthButtonLoading(true);

  const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
  
  if (!loginError) {
    showToast("Login successful!", "success");
    setAuthButtonLoading(false);
  } else {
    if (loginError.message.includes("Invalid login")) {
        const { error: signupError } = await supabase.auth.signUp({ email, password });
        if (!signupError) {
            showToast("Account created successfully!", "success");
            setAuthButtonLoading(false);
        } else {
            setAuthButtonLoading(false);
            showToast(signupError.message || "Something went wrong.", 'error');
        }
    } else {
        setAuthButtonLoading(false);
        showToast(loginError.message, 'error');
    }
  }
});

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

forgotPasswordLink?.addEventListener('click', e => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const emailInputModal = document.getElementById('reset-request-email');
    
    if (email && emailInputModal) {
        emailInputModal.value = email;
    }
    
    pushModalState();
    resetRequestModal?.classList.remove('hidden');
});

closeResetRequestBtn?.addEventListener('click', () => {
    resetRequestModal?.classList.add('hidden');
});

resetRequestForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!navigator.onLine) { showToast("Please connect to the internet", "error"); return; }

    const email = document.getElementById('reset-request-email').value.trim();
    const btnText = document.getElementById('reset-request-btn-text');
    const btnSpinner = document.getElementById('reset-request-btn-spinner');
    const submitBtn = document.getElementById('reset-request-submit-btn');

    btnText.classList.add('opacity-0');
    btnSpinner.classList.remove('opacity-0');
    submitBtn.disabled = true;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin 
    });

    btnText.classList.remove('opacity-0');
    btnSpinner.classList.add('opacity-0');
    submitBtn.disabled = false;

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('Password reset email sent!', 'success');
        resetRequestModal?.classList.add('hidden');
        resetRequestForm.reset();
    }
});

setNewPasswordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!navigator.onLine) { showToast("Please connect to the internet", "error"); return; }

    const newPassword = document.getElementById('new-password-input').value;
    const btnText = document.getElementById('set-new-password-btn-text');
    const btnSpinner = document.getElementById('set-new-password-btn-spinner');
    const submitBtn = document.getElementById('set-new-password-submit-btn');

    btnText.classList.add('opacity-0');
    btnSpinner.classList.remove('opacity-0');
    submitBtn.disabled = true;

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    btnText.classList.remove('opacity-0');
    btnSpinner.classList.add('opacity-0');
    submitBtn.disabled = false;

    if (error) {
        showToast(error.message, 'error');
    } else {
        showToast('Password updated successfully!', 'success');
        setNewPasswordModal?.classList.add('hidden');
        setNewPasswordForm.reset();
    }
});

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
                dropdown.innerHTML = data.map(d => `<li class="px-4 py-3 border-b border-ios-separator/30 last:border-b-0 hover:bg-ios-bg cursor-pointer text-[17px] font-medium text-ios-label">${escapeHTML(d.material)}</li>`).join('');
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

// iOS Switch logic for optional fields
toggleAddOptional?.addEventListener('click', () => {
    const isHidden = addOptionalFields.classList.contains('hidden');
    const track = document.getElementById('optional-switch-track');
    const thumb = document.getElementById('optional-switch-thumb');
    
    if (isHidden) {
        addOptionalFields.classList.remove('hidden');
        track.classList.add('bg-ios-green');
        track.classList.remove('bg-ios-grayLight');
        thumb.classList.add('translate-x-5');
    } else {
        addOptionalFields.classList.add('hidden');
        track.classList.remove('bg-ios-green');
        track.classList.add('bg-ios-grayLight');
        thumb.classList.remove('translate-x-5');
    }
});


// --- UI Setup & Mobile Menu ---
function setupUIForUser(user) {
  const photo = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=007AFF&color=fff`;

  if (headerAvatar) headerAvatar.src = photo;
  
  if (userProfileMobile) userProfileMobile.innerHTML = `<div class="flex items-center"><div class="w-14 h-14 rounded-full overflow-hidden mr-4 shadow-sm"><img src="${photo}" alt="User photo" class="w-full h-full object-cover"></div><div><p class="font-semibold text-[20px] text-ios-label">${escapeHTML(user.user_metadata?.full_name || 'User')}</p><p class="text-[15px] text-ios-gray font-medium truncate">${escapeHTML(user.email)}</p></div></div>`;

  if (navigator.onLine) {
    updateStatusUI('welcome');
  } else {
    updateStatusUI('offline');
  }
  
  const dateInput = document.getElementById('date');
  if (dateInput) {
      dateInput.value = formatDate(new Date());
      setDateValue('date', dateInput.value);
  }
}

const openMenu = () => {
  pushModalState();
  mobileMenuBackdrop?.classList.remove('pointer-events-none', 'opacity-0');
  mobileMenu?.classList.remove('translate-x-full');
};
const closeMenu = () => {
  mobileMenuBackdrop?.classList.add('pointer-events-none', 'opacity-0');
  mobileMenu?.classList.add('translate-x-full');
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
            
            const backupOwnerId = data.projects[0]?.user_id || data.expenses[0]?.user_id;
            if (backupOwnerId && backupOwnerId !== currentUser.id) {
                throw new Error("This backup belongs to a different account.");
            }
            
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

const applyFilters = async (animate = false) => {
    if (!activeProjectId) return;
    const currentRequestId = ++activeDataRequest;

    const searchTerm = searchInput?.value.trim() || null;
    const startDate = startDateInput?.dataset?.rawDate || startDateInput?.value || null;
    const endDate = endDateInput?.dataset?.rawDate || endDateInput?.value || null;
    const minAmount = minAmountInput?.value || null;
    const maxAmount = maxAmountInput?.value || null;

    const isFiltering = searchTerm || startDate || endDate || minAmount || maxAmount;
    
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
    if (minAmount) query = query.gte('cost', minAmount);
    if (maxAmount) query = query.lte('cost', maxAmount);
    
    query = query.order('date', { ascending: false }).order('time', { ascending: false });

    if (!isFiltering && !showAllExpenses) query = query.limit(5);

    const summaryPromise = supabase.rpc('get_filtered_summary', {
        p_project_id: activeProjectId,
        p_search_term: searchTerm,
        p_start_date: startDate,
        p_end_date: endDate,
        p_start_time: null,
        p_end_time: null,
        p_min_amount: minAmount ? parseFloat(minAmount) : null,
        p_max_amount: maxAmount ? parseFloat(maxAmount) : null
    });

    const d = new Date(); 
    d.setDate(d.getDate() - 7);
    const weekStr = formatDate(d);
    
    const recentStatsPromise = supabase.from('expenses')
        .select('cost, type, date')
        .eq('project_id', activeProjectId)
        .gte('date', weekStr);

    const [expensesRes, summaryRes, recentStatsRes] = await Promise.all([query, summaryPromise, recentStatsPromise]);

    if (currentRequestId !== activeDataRequest) return;

    allExpensesForProject = expensesRes.data || [];
    const exactCount = expensesRes.count || 0;
    
    if (!isFiltering && !showAllExpenses && exactCount > 5) {
        if (viewAllBtn) viewAllBtn.style.display = 'block';
    } else {
        if (viewAllBtn) viewAllBtn.style.display = 'none';
    }

    renderExpenses(allExpensesForProject, animate);
    renderSummaries(summaryRes.data, recentStatsRes.data, animate);
};

let filterTimeout;
const debouncedApplyFilters = (animate = false) => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => applyFilters(animate), 300);
};
[searchInput, startDateInput, endDateInput, minAmountInput, maxAmountInput].forEach(el => el?.addEventListener('input', () => debouncedApplyFilters(false)));


async function fetchProjects(uid) {
  const { data } = await supabase.from('projects').select('*').eq('user_id', uid).order('created_at', { ascending: true });
  return data || [];
}

async function processProjects(uid, fetchedProjects) {
  projects = fetchedProjects;
  if (projects.length === 0 && navigator.onLine) {
    const { data: newProject } = await supabase.from('projects').insert([{ name: "General", user_id: uid }]).select();
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
            <div class="flex items-center space-x-2">
                <button data-project-id="${p.id}" data-project-name="${escapeHTML(p.name)}" class="edit-project-btn p-1.5 text-ios-blue active:opacity-70"><svg class="w-[18px] h-[18px] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg></button>
                <button data-project-id="${p.id}" data-project-name="${escapeHTML(p.name)}" class="delete-project-btn p-1.5 text-ios-red active:opacity-70"><svg class="w-[18px] h-[18px] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
            </div>`;
        return `
            <div class="flex justify-between items-center group active:bg-ios-bg border-b border-ios-separator/30 last:border-b-0 px-4 transition-colors">
                <a href="#" data-project-id="${p.id}" class="sidebar-project-link block py-2.5 text-[16px] font-medium flex-grow truncate text-ios-label">${escapeHTML(p.name)}</a>
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
            link.classList.add('text-ios-blue');
            link.classList.remove('text-ios-label');
            link.parentElement.classList.add('bg-ios-blue/5');
        } else {
            link.classList.remove('text-ios-blue');
            link.classList.add('text-ios-label');
            link.parentElement.classList.remove('bg-ios-blue/5');
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
        filterPanel.classList.remove('max-h-0', 'opacity-0');
        filterPanel.classList.add('max-h-[500px]', 'opacity-100');
        filterBtn.classList.add('text-ios-blue');
    } else {
        filterPanel.classList.add('max-h-0', 'opacity-0');
        filterPanel.classList.remove('max-h-[500px]', 'opacity-100');
        filterBtn.classList.remove('text-ios-blue');
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
        renderSummaries(null, null, false);
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
    setDateValue('start-date-input', formatDate(startDate));
    setDateValue('end-date-input', formatDate(endDate));
    applyFilters(false);
};

document.getElementById('last-week')?.addEventListener('click', () => setDateFilter('last-week'));
document.getElementById('last-month')?.addEventListener('click', () => setDateFilter('last-month'));
document.getElementById('last-year')?.addEventListener('click', () => setDateFilter('last-year'));

// --- Modal Display Flows ---
fabAddExpense?.addEventListener('click', () => { 
    pushModalState();
    const now = new Date();
    
    setDateValue('date', formatDate(now));
    setTimeValue('time', now.toTimeString().slice(0, 5));

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
    
    const dateInput = document.getElementById('date');
    const date = dateInput.dataset.rawDate || dateInput.value;
    
    const timeInput = document.getElementById('time');
    const time = timeInput.dataset.rawTime || timeInput.value;
    
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

function renderExpenses(expenses, animate = false) {
    if (!expenseList) return;
    if (expenses.length === 0) {
        expenseList.innerHTML = `<div class="text-center py-6 text-ios-gray text-[15px] font-medium">No transactions found.</div>`;
        return;
    }
    
    expenseList.innerHTML = expenses.map((expense, index) => {
        const isIncome = expense.type === 'income';
        const costSign = '';
        const parentCostColor = isIncome ? 'text-ios-green' : 'text-ios-label';
        const splitCostColor = isIncome ? 'text-ios-green' : 'text-ios-red';
        const iconBgColor = isIncome ? 'bg-ios-green/10 text-ios-green' : 'bg-ios-grayLight/50 text-ios-label';
        const iconSvg = isIncome 
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"></path></svg>';
        
        const animationStyle = animate ? `style="animation-fill-mode: both; animation-delay: ${index * 30}ms;"` : '';
        const animationClass = animate ? `animate-fade-in` : '';

        const splitRegex = /([a-zA-Z0-9_]+)#(\d+(?:\.\d+)?)/g;
        let cleanInfo = expense.info || '';
        let match;
        const matches = [];

        if (expense.info) {
            while ((match = splitRegex.exec(expense.info)) !== null) {
                matches.push({ name: match[1], amount: parseFloat(match[2]) });
            }
            
            if (matches.length > 0) {
                cleanInfo = cleanInfo.replace(/[a-zA-Z0-9_]+#\d+(?:\.\d+)?/g, '');
                cleanInfo = cleanInfo.replace(/,\s*(?=[, ]|$)/g, ' ').replace(/\s+/g, ' ').trim();
                
                const splitsHtml = `<div class="mt-2 flex flex-wrap gap-1.5 w-full">` + 
                    matches.map(m => `
                        <div class="bg-ios-grayLight/50 px-2 py-1 rounded-[8px] inline-flex items-center text-[13px] border border-ios-separator/30">
                            <span class="text-ios-secondaryLabel font-medium mr-1.5">${escapeHTML(m.name)}</span>
                            <span class="${splitCostColor} font-semibold">₹${m.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                        </div>
                    `).join('') + `</div>`;
                
                if (cleanInfo) {
                    cleanInfo = `<p class="text-[14px] mt-1 break-words whitespace-normal leading-relaxed text-ios-secondaryLabel"><span class="font-semibold">${escapeHTML(cleanInfo)}</span></p>` + splitsHtml;
                } else {
                    cleanInfo = splitsHtml;
                }
            } else {
                cleanInfo = `<p class="text-[14px] mt-1 break-words whitespace-normal leading-relaxed text-ios-secondaryLabel">${escapeHTML(cleanInfo)}</p>`;
            }
        }

        return `
        <div class="relative bg-white border-b border-ios-separator/30 last:border-b-0 swipe-item ${animationClass}" ${animationStyle} data-id="${expense.id}">
            
            <div class="absolute inset-y-0 left-0 w-1/2 bg-ios-blue flex items-center pl-6 text-white text-[15px] font-semibold">
                Edit
            </div>
            <div class="absolute inset-y-0 right-0 w-1/2 bg-ios-red flex items-center justify-end pr-6 text-white text-[15px] font-semibold">
                Delete
            </div>

            <div class="relative bg-white px-4 py-3 flex flex-col group transition-transform duration-200 swipe-front z-10 w-full touch-pan-y">
                <div class="flex items-start justify-between w-full">
                    <div class="flex items-start gap-3 flex-1 min-w-0">
                        <div class="w-[38px] h-[38px] rounded-full ${iconBgColor} flex items-center justify-center shrink-0 mt-0.5">
                            ${iconSvg}
                        </div>
                        <div class="overflow-hidden flex-1 pointer-events-none pb-1">
                            <h4 class="font-semibold text-[17px] text-ios-label leading-tight truncate">${escapeHTML(expense.material)}</h4>
                            <div class="flex items-center text-[13px] text-ios-gray mt-0.5 space-x-1">
                                <span>${new Date(expense.date).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                <span>&bull;</span>
                                <span>${formatDisplayTime(expense.time)}</span>
                            </div>
                            ${expense.info ? cleanInfo : ''}
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-3 pointer-events-none mt-0.5">
                        <p class="font-semibold text-[17px] ${parentCostColor}">${costSign}₹${Math.abs(expense.cost).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');

    document.querySelectorAll('.swipe-front').forEach(el => {
        let startX = 0, startY = 0, currentX = 0, isSwiping = false, isScrolling = false;

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

            if (!isScrolling && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 5) {
                isScrolling = true;
                isSwiping = false; 
                el.style.transform = `translateX(0px)`;
                return;
            }

            if (isScrolling) return;

            currentX = deltaX;
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
                el.style.transform = `translateX(100px)`;
                setTimeout(() => {
                    el.style.transform = `translateX(0px)`;
                    handleEdit({ currentTarget: { dataset: { id: expenseId } } });
                }, 150);
            } else if (currentX < -threshold) {
                el.style.transform = `translateX(-100px)`;
                setTimeout(() => {
                    el.style.transform = `translateX(0px)`;
                    handleDelete({ currentTarget: { dataset: { id: expenseId } } });
                }, 150);
            } else {
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
    
    const costStr = `₹${Math.abs(expense.cost).toLocaleString('en-IN')}`;
    const modalTitle = `Delete "${escapeHTML(expense.material)}"?`;

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
    
    if (expense.date) {
        setDateValue('edit-date', expense.date);
    } else {
        setDateValue('edit-date', '');
    }
    
    if (expense.time) {
        setTimeValue('edit-time', expense.time.slice(0, 5));
    } else {
        setTimeValue('edit-time', '');
    }

    const infoInput = document.getElementById('edit-additional-info');
    if(infoInput) infoInput.value = expense.info || '';
    
    editModal.classList.remove('hidden');
}

let editExpenseSwipeObj = initSwipeButton('edit-expense-swipe', async () => {
    if (!editExpenseForm.reportValidity()) throw new Error("Validation failed");
    if (!navigator.onLine) { showToast("Offline: Cannot update.", "error"); throw new Error("Offline"); }
    
    const id = document.getElementById('edit-expense-id').value;
    const editTimeInput = document.getElementById('edit-time');
    const editDateInput = document.getElementById('edit-date');
    
    const updatedData = {
        type: document.querySelector('input[name="edit-entry-type"]:checked').value,
        material: document.getElementById('edit-material-name').value.trim(),
        cost: parseFloat(document.getElementById('edit-cost').value),
        date: editDateInput.dataset.rawDate || editDateInput.value,
        time: editTimeInput.dataset.rawTime || editTimeInput.value,
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
    
    addOptionalFields?.classList.add('hidden');
    const track = document.getElementById('optional-switch-track');
    const thumb = document.getElementById('optional-switch-thumb');
    if(track) {
        track.classList.remove('bg-ios-green');
        track.classList.add('bg-ios-grayLight');
    }
    if(thumb) {
        thumb.classList.remove('translate-x-5');
    }
    
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
        content: `<h4 class="font-semibold text-ios-label mb-1">1. Introduction</h4><p class="mb-4">We are committed to protecting your personal data when you use HisapBook.</p><h4 class="font-semibold text-ios-label mb-1">2. Data We Collect</h4><p class="mb-4">We collect basic Identity Data (email, profile) and Financial Data (expenses, incomes, budgets) to provide our service.</p><h4 class="font-semibold text-ios-label mb-1">3. Storage & Security</h4><p>Your data is authenticated and securely stored using Supabase, accessible only by you.</p>`
    },
    'contact-link': {
        title: 'Contact Us',
        content: `<p class="mb-4">We're here to help! Whether you have a question about a feature, need technical support, or want to provide feedback.</p><div class="bg-white p-4 rounded-[14px] shadow-sm"><h4 class="font-semibold text-ios-label mb-2">Email Support</h4><a href="mailto:support@fintrack.app" class="text-ios-blue font-semibold hover:opacity-80">support@expensetracker.app</a><p class="text-[12px] uppercase text-ios-gray mt-2 font-medium">We aim to respond within 24-48 hours.</p></div>`
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

const summaryToggleBtn = document.getElementById('summary-toggle-btn');
const summaryContentWrapper = document.getElementById('summary-content-wrapper');
const summaryChevron = document.getElementById('summary-chevron');

summaryToggleBtn?.addEventListener('click', () => {
    const isClosed = summaryContentWrapper.classList.contains('max-h-0');
    if (isClosed) {
        summaryContentWrapper.classList.remove('max-h-0', 'opacity-0');
        summaryContentWrapper.classList.add('max-h-[2000px]', 'opacity-100');
        summaryChevron.classList.add('rotate-180');
    } else {
        summaryContentWrapper.classList.add('max-h-0', 'opacity-0');
        summaryContentWrapper.classList.remove('max-h-[2000px]', 'opacity-100');
        summaryChevron.classList.remove('rotate-180');
    }
});

function renderSummaries(data, recentStats, animate = false) {
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

    const twContainer = document.getElementById('summary-today-weekly');
    if (twContainer) {
        let label = "Today";
        let tInc = 0, tExp = 0;
        const todayStr = formatDate(new Date());
        
        if (recentStats && recentStats.length > 0) {
            const todayStats = recentStats.filter(e => e.date === todayStr);
            if (todayStats.length > 0) {
                todayStats.forEach(e => { if(e.type === 'income') tInc += e.cost; else tExp += e.cost; });
            } else {
                label = "Week";
                recentStats.forEach(e => { if(e.type === 'income') tInc += e.cost; else tExp += e.cost; });
            }
            
            if (tInc > 0 || tExp > 0) {
                let extraHtml = `<span class="text-ios-gray">${label}</span>`;
                if (tExp > 0) extraHtml += `<span class="text-ios-label font-semibold ml-1.5">₹${tExp.toLocaleString('en-IN')}</span>`;
                if (tInc > 0) extraHtml += `<span class="text-ios-green font-semibold ml-1.5">₹${tInc.toLocaleString('en-IN')}</span>`;
                twContainer.innerHTML = extraHtml;
            } else {
                twContainer.innerHTML = '';
            }
        } else {
            twContainer.innerHTML = '';
        }
    }

    const matTotals = data.material_totals || [];
    const initialWrapper = document.getElementById('material-summary-initial');
    const expandedWrapper = document.getElementById('material-summary-expanded');
    
    if (matTotals.length === 0) {
        if (initialWrapper) initialWrapper.innerHTML = `<p class="text-ios-gray py-2">No summary available yet.</p>`;
        if (expandedWrapper) expandedWrapper.innerHTML = '';
        return;
    }

    matTotals.sort((a, b) => {
        if (a.is_split === b.is_split) return Math.abs(b.net_amount) - Math.abs(a.net_amount);
        return a.is_split ? 1 : -1;
    });

    const generateItemHTML = (item, index, animate) => {
        const netAmount = item.net_amount;
        const colorClass = netAmount > 0 ? 'text-ios-red' : (netAmount < 0 ? 'text-ios-green' : 'text-ios-label');
        const displayName = item.material_name;
        
        const animationStyle = animate ? `style="animation-fill-mode: both; animation-delay: ${index * 30}ms"` : '';
        const animationClass = animate ? `animate-fade-in` : '';

        const splitIcon = item.is_split 
            ? `<svg class="w-4 h-4 mr-2 text-ios-gray inline-block shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>` 
            : '';

        return `<div class="flex justify-between items-center py-2.5 border-b border-ios-separator/30 last:border-b-0 ${animationClass}" ${animationStyle}>
                    <span class="font-medium text-ios-label flex items-center leading-tight text-[17px]">
                        ${splitIcon}${escapeHTML(displayName)}
                    </span>
                    <span class="font-semibold ${colorClass} text-[17px] ml-3">₹${Math.abs(netAmount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
                </div>`;
    };

    if (initialWrapper && expandedWrapper) {
        initialWrapper.innerHTML = matTotals.slice(0, 5).map((item, index) => generateItemHTML(item, index, animate)).join('');
        expandedWrapper.innerHTML = matTotals.slice(5).map((item, index) => generateItemHTML(item, index + 5, animate)).join('');
        
        const toggleBtn = document.getElementById('summary-toggle-btn');
        const chevron = document.getElementById('summary-chevron');
        
        if (matTotals.length <= 5) {
            chevron.style.display = 'none';
            toggleBtn.classList.remove('cursor-pointer', 'active:bg-ios-bg');
        } else {
            chevron.style.display = 'block';
            toggleBtn.classList.add('cursor-pointer', 'active:bg-ios-bg');
        }
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
                    '#007AFF', '#34C759', '#FF9500', '#FF3B30', 
                    '#5856D6', '#5AC8FA', '#FF2D55', '#8E8E93'
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
                    backgroundColor: '#34C759',
                    borderRadius: 4
                },
                {
                    label: 'Expenses',
                    data: Object.values(monthlyExpenseTotals),
                    backgroundColor: '#FF3B30',
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
            <span class="w-2.5 h-2.5 bg-ios-red rounded-full animate-pulse"></span>
            <span class="text-[11px] font-semibold tracking-wider">Offline</span>
            `;
        } else if (state === 'online') {
            userStatusDisplay.innerHTML = `
            <span class="relative flex size-2.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-ios-blue opacity-75"></span>
            <span class="relative inline-flex size-2.5 rounded-full bg-ios-blue"></span>
            </span>
            <span class="text-[11px] font-semibold tracking-wider">Back Online</span>
            `;
            statusTimeout = setTimeout(() => updateStatusUI('welcome'), 5000);
        } else if (state === 'welcome') {
            const name = currentUser?.user_metadata?.full_name || currentUser?.email.split('@')[0] || 'User';
            userStatusDisplay.innerHTML = `<span class="text-[11px] font-semibold tracking-wider">Welcome, ${escapeHTML(name)}</span>`;
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

const APP_VERSION = "3.7.0: Fix Auth Modals & Adjust Blur";
const appVersionEl = document.getElementById("app-version");
if (appVersionEl) appVersionEl.textContent = `Version ${APP_VERSION}`;
