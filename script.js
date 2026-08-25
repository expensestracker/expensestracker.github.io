/**
 * @fileoverview HisapBook Main Application Logic
 * @architecture MVC / Namespace Pattern for Vanilla JS
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================
const CONFIG = {
    // In a real production app (Vite/Next.js), these would be process.env.VITE_SUPABASE_URL
    SUPABASE_URL: 'https://qbdzwwqkcjnfcqlgnknc.supabase.co',
    SUPABASE_ANON_KEY: 'EyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZHp3d3FrY2puZmNxbGdua25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzgyNTEsImV4cCI6MjEwMzAxNDI1MX0.GgeDNJCZwQdbfe9pKsDiV8Ld6rgJm_WkccI7iGbB4mg',
    CURRENCY: { locale: 'en-IN', symbol: '₹' },
    TOAST_DURATION_MS: 3000,
    SEARCH_DEBOUNCE_MS: 300
};

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ==========================================
// 2. CENTRALIZED STATE MANAGEMENT
// ==========================================
const STATE = {
    user: null,
    projects: [],
    activeProjectId: null,
    expenses: [],
    showAllExpenses: false,
    subscriptions: {
        projects: null,
        expenses: null
    },
    charts: {
        category: null,
        monthly: null
    }
};

// ==========================================
// 3. UTILITIES
// ==========================================
const UTILS = {
    escapeHTML: (str) => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str || ''));
        return div.innerHTML;
    },
    formatCurrency: (amount) => {
        return `${CONFIG.CURRENCY.symbol}${Math.abs(amount).toLocaleString(CONFIG.CURRENCY.locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    },
    formatDate: (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    debounce: (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(null, args), delay);
        };
    }
};

// ==========================================
// 4. API / DATABASE SERVICE
// ==========================================
const API = {
    async handleAuth(action, email, password) {
        try {
            const { data, error } = action === 'login' 
                ? await supabase.auth.signInWithPassword({ email, password })
                : await supabase.auth.signUp({ email, password });
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },
    async getProjects(userId) {
        const { data, error } = await supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    },
    async getExpenses(projectId) {
        const { data, error } = await supabase.from('expenses').select('*').eq('project_id', projectId).order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    },
    async getServerSummaries(projectId) {
        const { data, error } = await supabase.rpc('get_project_summary', { p_project_id: projectId });
        if (error) throw error;
        return data;
    },
    async getServerAnalytics(projectId) {
        const { data, error } = await supabase.rpc('get_project_analytics', { p_project_id: projectId });
        if (error) throw error;
        return data;
    },
    async addRecord(table, payload) {
        const { error } = await supabase.from(table).insert([payload]);
        if (error) throw error;
    },
    async updateRecord(table, id, payload) {
        const { error } = await supabase.from(table).update(payload).eq('id', id);
        if (error) throw error;
    },
    async deleteRecord(table, id) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
    },
    async deleteProjectCascade(projectId) {
        // Explicitly clear dependencies to ensure clean deletion
        await supabase.from('expenses').delete().eq('project_id', projectId);
        await supabase.from('projects').delete().eq('id', projectId);
    }
};

// ==========================================
// 5. UI CONTROLLER (DOM MANIPULATION)
// ==========================================
const UI = {
    elements: {
        views: { splash: document.getElementById('splash-view'), auth: document.getElementById('auth-view'), app: document.getElementById('app-view') },
        auth: { form: document.getElementById('email-form'), email: document.getElementById('email-input'), pass: document.getElementById('password-input'), btnText: document.getElementById('btn-text'), btnSpinner: document.getElementById('btn-spinner'), btn: document.getElementById('email-action-btn') },
        header: { avatar: document.getElementById('header-avatar'), name: document.getElementById('header-user-name'), status: document.getElementById('user-status-display') },
        menu: { backdrop: document.getElementById('mobile-menu-backdrop'), panel: document.getElementById('mobile-menu'), projectList: document.getElementById('sidebar-project-list'), addBtn: document.getElementById('sidebar-add-project-btn') },
        dashboard: { container: document.getElementById('expense-dashboard'), noProject: document.getElementById('no-project-message'), finalExp: document.getElementById('final-expenses'), incCopy: document.getElementById('card-income-copy'), expCopy: document.getElementById('card-expense-copy'), matSummary: document.getElementById('material-summary'), title: document.getElementById('project-summary-title'), expList: document.getElementById('expense-list'), viewAll: document.getElementById('view-all') },
        filters: { search: document.getElementById('search-input'), start: document.getElementById('start-date-input'), end: document.getElementById('end-date-input'), panel: document.getElementById('filter-panel'), btn: document.getElementById('filter-btn') },
        modals: { addExp: document.getElementById('add-expense-sheet'), editExp: document.getElementById('edit-modal'), editProj: document.getElementById('edit-project-modal'), addProj: document.getElementById('add-project-modal'), analytics: document.getElementById('analytics-modal') },
        charts: { category: document.getElementById('category-chart'), monthly: document.getElementById('monthly-chart') }
    },

    showToast(message, type = 'error') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        const icon = type === 'error' 
            ? `<svg class="w-5 h-5 text-red-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` 
            : `<svg class="w-5 h-5 text-green-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        
        toast.className = `bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl flex items-center text-sm font-bold tracking-wide transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto border border-slate-700/50`;
        toast.innerHTML = `${icon}<span>${UTILS.escapeHTML(message)}</span>`;
        container.appendChild(toast);

        requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0')));
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            toast.addEventListener('transitionend', () => toast.remove());
        }, CONFIG.TOAST_DURATION_MS);
    },

    switchView(viewName) {
        Object.values(UI.elements.views).forEach(v => v?.classList.add('hidden'));
        const target = UI.elements.views[viewName];
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('active', 'animate-fade-in');
            if (viewName === 'app') target.classList.add('flex');
        }
    },

    setAuthLoading(isLoading) {
        if (!UI.elements.auth.btn) return;
        if (isLoading) {
            UI.elements.auth.btnText.classList.add('opacity-0');
            UI.elements.auth.btnSpinner.classList.remove('opacity-0');
            UI.elements.auth.btn.disabled = true;
        } else {
            UI.elements.auth.btnText.classList.remove('opacity-0');
            UI.elements.auth.btnSpinner.classList.add('opacity-0');
            UI.elements.auth.btn.disabled = false;
        }
    },

    updateUserProfile(user) {
        const photo = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=e0e7ff&color=4f46e5`;
        if (UI.elements.header.avatar) UI.elements.header.avatar.src = photo;
        if (UI.elements.header.name) UI.elements.header.name.textContent = UTILS.escapeHTML(user.user_metadata?.full_name || user.email.split('@')[0] || 'User');
        
        const mobileProfile = document.getElementById('user-profile-mobile');
        if (mobileProfile) mobileProfile.innerHTML = `<div class="flex items-center"><div class="w-12 h-12 rounded-full border-2 border-indigo-100 overflow-hidden mr-3"><img src="${photo}" alt="User photo" class="w-full h-full object-cover"></div><div><p class="font-bold text-slate-800">${UTILS.escapeHTML(user.user_metadata?.full_name || 'User')}</p><p class="text-sm text-slate-500 font-medium truncate">${UTILS.escapeHTML(user.email)}</p></div></div>`;
    },

    setStatusUI(state) {
        if (!UI.elements.header.status) return;
        UI.elements.header.status.classList.add('opacity-0');
        setTimeout(() => {
            if (state === 'offline') {
                UI.elements.header.status.innerHTML = `<span class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span><span class="text-sm font-semibold">Offline</span>`;
            } else if (state === 'online') {
                UI.elements.header.status.innerHTML = `<span class="relative flex size-3"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span><span class="relative inline-flex size-3 rounded-full bg-sky-500"></span></span><span class="text-sm font-semibold">Back Online</span>`;
                setTimeout(() => UI.setStatusUI('welcome'), 5000);
            } else {
                const name = STATE.user?.user_metadata?.full_name || STATE.user?.email.split('@')[0] || 'User';
                UI.elements.header.status.innerHTML = `<span class="text-sm text-gray-700">Welcome, <strong>${UTILS.escapeHTML(name)}</strong></span>`;
            }
            UI.elements.header.status.classList.remove('opacity-0');
        }, 300);
    },

    renderProjectList(projects) {
        if (!UI.elements.menu.projectList) return;
        UI.elements.menu.projectList.innerHTML = projects.map(p => {
            return `
            <div class="flex justify-between items-center group rounded-xl hover:bg-slate-50 transition-colors ${p.id === STATE.activeProjectId ? 'bg-indigo-50' : ''}">
                <a href="#" data-project-id="${p.id}" class="sidebar-project-link block py-2.5 px-3 text-sm font-semibold flex-grow truncate ${p.id === STATE.activeProjectId ? 'text-indigo-600' : 'text-slate-600'}">${UTILS.escapeHTML(p.name)}</a>
                <div class="flex items-center space-x-1">
                    <button data-project-id="${p.id}" data-project-name="${UTILS.escapeHTML(p.name)}" class="edit-project-btn p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"></path></svg></button>
                    <button data-project-id="${p.id}" data-project-name="${UTILS.escapeHTML(p.name)}" class="delete-project-btn p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50"><svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </div>
            </div>`;
        }).join('');
        EVENTS.bindDynamicProjectEvents();
    },

    renderExpenses(expenses) {
        if (!UI.elements.dashboard.expList) return;
        if (expenses.length === 0) {
            UI.elements.dashboard.expList.innerHTML = `<div class="text-center py-6 text-slate-400 text-sm font-medium">No transactions found.</div>`;
            return;
        }
        UI.elements.dashboard.expList.innerHTML = expenses.map(expense => {
            const isIncome = expense.type === 'income';
            const costColor = isIncome ? 'text-emerald-600' : 'text-slate-700';
            const iconBgColor = isIncome ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500';
            const iconSvg = isIncome 
                ? '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>'
                : '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"></path></svg>';
            
            return `
            <div class="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100 hover:border-indigo-100">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-xl ${iconBgColor} flex items-center justify-center shrink-0">${iconSvg}</div>
                    <div class="overflow-hidden flex-1">
                        <h4 class="font-bold text-slate-700 truncate">${UTILS.escapeHTML(expense.material)}</h4>
                        <p class="text-sm font-bold tracking-wider text-slate-500 mt-0.5">${new Date(expense.date).toLocaleDateString(CONFIG.CURRENCY.locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                </div>
                <div class="text-right shrink-0 ml-3">
                    <p class="font-bold ${costColor}">${UTILS.formatCurrency(expense.cost)}</p>
                    <div class="flex gap-4 mt-1 justify-end">
                        <button data-id="${expense.id}" class="edit-btn text-sm text-indigo-600 hover:text-slate-700 font-bold tracking-wider">Edit</button>
                        <button data-id="${expense.id}" class="delete-btn text-sm text-rose-600 hover:text-slate-600 font-bold tracking-wider">Delete</button>
                    </div>
                </div>
            </div>`;
        }).join('');
        EVENTS.bindDynamicExpenseEvents();
    },

    renderSummaries(data) {
        if (!data) data = { net_balance: 0, total_income: 0, total_expense: 0, material_totals: [] };
        
        if(UI.elements.dashboard.finalExp) UI.elements.dashboard.finalExp.textContent = UTILS.formatCurrency(data.net_balance);
        if(UI.elements.dashboard.incCopy) UI.elements.dashboard.incCopy.textContent = UTILS.formatCurrency(data.total_income);
        if(UI.elements.dashboard.expCopy) UI.elements.dashboard.expCopy.textContent = UTILS.formatCurrency(data.total_expense);

        const matTotals = data.material_totals || [];
        if (matTotals.length === 0) {
            if (UI.elements.dashboard.matSummary) UI.elements.dashboard.matSummary.innerHTML = `<p class="text-slate-400 py-2">No summary available yet.</p>`;
            return;
        }

        if (UI.elements.dashboard.matSummary) {
            UI.elements.dashboard.matSummary.innerHTML = matTotals.map(item => {
                const colorClass = item.net_amount > 0 ? 'text-red-500' : (item.net_amount < 0 ? 'text-green-700' : 'text-slate-900');
                return `<div class="flex justify-between items-center py-1"><span class="font-semibold text-slate-700 truncate">${UTILS.escapeHTML(item.material_name)}</span><span class="font-bold ${colorClass} ml-3">${UTILS.formatCurrency(item.net_amount)}</span></div>`;
            }).join('');
        }
    },

    renderCharts(categoryTotals, monthlyExpenseTotals, monthlyIncomeTotals) {
        if (STATE.charts.category) STATE.charts.category.destroy();
        if (STATE.charts.monthly) STATE.charts.monthly.destroy();
        
        const ctxCategory = UI.elements.charts.category.getContext('2d');
        STATE.charts.category = new Chart(ctxCategory, {
            type: 'doughnut',
            data: { labels: Object.keys(categoryTotals), datasets: [{ data: Object.values(categoryTotals), backgroundColor: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#3B82F6', '#EC4899', '#64748B'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });

        const ctxMonthly = UI.elements.charts.monthly.getContext('2d');
        STATE.charts.monthly = new Chart(ctxMonthly, {
            type: 'bar',
            data: {
                labels: Object.keys(monthlyExpenseTotals).map(date => new Date(date + '-01').toLocaleDateString(CONFIG.CURRENCY.locale, { month: 'short', year: 'numeric' })),
                datasets: [
                    { label: 'Income', data: Object.values(monthlyIncomeTotals), backgroundColor: '#10B981', borderRadius: 4 },
                    { label: 'Expenses', data: Object.values(monthlyExpenseTotals), backgroundColor: '#EF4444', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { callback: (val) => CONFIG.CURRENCY.symbol + val.toLocaleString(CONFIG.CURRENCY.locale) } } }
            }
        });
    }
};

// ==========================================
// 6. SWIPE COMPONENT FACTORY
// ==========================================
const SWIPE_ACTIONS = {
    init(containerId, onConfirmAsync) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const thumb = container.querySelector('.swipe-thumb');
        const track = container.querySelector('.swipe-track');
        const spinner = container.querySelector('.swipe-spinner');

        let isDragging = false, isConfirmed = false, startX = 0, currentX = 0;

        const reset = () => {
            isConfirmed = false;
            thumb.classList.remove('pointer-events-none');
            spinner.classList.add('opacity-0');
            thumb.style.transform = `translateX(0px)`;
            track.style.width = `3.25rem`;
        };

        const onDragStart = (e) => {
            if (isConfirmed) return;
            isDragging = true;
            startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
            thumb.style.transition = track.style.transition = 'none';
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
            thumb.style.transition = track.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            
            if (currentX >= maxDrag * 0.95) {
                isConfirmed = true;
                thumb.style.transform = `translateX(${maxDrag}px)`;
                track.style.width = '100%';
                thumb.classList.add('pointer-events-none');
                spinner.classList.remove('opacity-0');
                
                try { await onConfirmAsync(); } 
                catch (err) { reset(); }
            } else { reset(); }
        };

        thumb.addEventListener('mousedown', onDragStart);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        thumb.addEventListener('touchstart', onDragStart, {passive: true});
        document.addEventListener('touchmove', onDragMove, {passive: false});
        document.addEventListener('touchend', onDragEnd);

        return { reset };
    }
};

// ==========================================
// 7. APP CONTROLLER (ORCHESTRATION)
// ==========================================
const APP = {
    async init() {
        let isInitialLoad = true;
        
        // Listen to network status
        window.addEventListener('offline', () => UI.setStatusUI('offline'));
        window.addEventListener('online', () => UI.setStatusUI('online'));

        // Handle Auth State
        supabase.auth.onAuthStateChange((event, session) => {
            STATE.user = session?.user || null;
            const routeUser = () => {
                if (STATE.user) {
                    UI.switchView('app');
                    UI.updateUserProfile(STATE.user);
                    UI.setStatusUI(navigator.onLine ? 'welcome' : 'offline');
                    APP.loadWorkspace();
                } else {
                    UI.switchView('auth');
                    APP.cleanup();
                }
            };

            if (isInitialLoad) { isInitialLoad = false; setTimeout(routeUser, 1000); } 
            else { routeUser(); }
        });

        EVENTS.bindStaticEvents();
    },

    cleanup() {
        STATE.activeProjectId = null;
        if (STATE.subscriptions.projects) supabase.removeChannel(STATE.subscriptions.projects);
        if (STATE.subscriptions.expenses) supabase.removeChannel(STATE.subscriptions.expenses);
    },

    async loadWorkspace() {
        try {
            await APP.refreshProjects();
            // Realtime Sync
            if (!STATE.subscriptions.projects) {
                STATE.subscriptions.projects = supabase.channel('public:projects')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${STATE.user.id}` }, APP.refreshProjects)
                    .subscribe();
            }
        } catch (error) {
            UI.showToast("Failed to load workspace", "error");
        }
    },

    async refreshProjects() {
        const data = await API.getProjects(STATE.user.id);
        STATE.projects = data;
        
        if (STATE.projects.length === 0 && navigator.onLine) {
            await API.addRecord('projects', { name: "General Project", user_id: STATE.user.id });
            return; // Channel will auto-trigger re-fetch
        }

        UI.renderProjectList(STATE.projects);
        
        const savedId = localStorage.getItem('lastActiveProjectId');
        STATE.activeProjectId = savedId && STATE.projects.find(p => p.id === savedId) ? savedId : STATE.projects[0]?.id;
        
        if (STATE.activeProjectId) {
            localStorage.setItem('lastActiveProjectId', STATE.activeProjectId);
            const activeProject = STATE.projects.find(p => p.id === STATE.activeProjectId);
            if (UI.elements.dashboard.title) UI.elements.dashboard.title.textContent = activeProject.name;
            APP.loadProjectData(STATE.activeProjectId);
        } else {
            UI.elements.dashboard.container.style.display = 'none';
            UI.elements.dashboard.noProject.style.display = 'block';
        }
    },

    async loadProjectData(projectId) {
        UI.elements.dashboard.container.style.display = 'block';
        UI.elements.dashboard.noProject.style.display = 'none';

        if (STATE.subscriptions.expenses) {
            supabase.removeChannel(STATE.subscriptions.expenses);
        }

        await APP.refreshExpenses(projectId);

        STATE.subscriptions.expenses = supabase.channel('public:expenses')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `project_id=eq.${projectId}` }, () => APP.refreshExpenses(projectId))
            .subscribe();
    },

    async refreshExpenses(projectId) {
        try {
            STATE.expenses = await API.getExpenses(projectId);
            const summaries = await API.getServerSummaries(projectId);
            
            APP.applyFilters();
            UI.renderSummaries(summaries);
        } catch (error) {
            UI.showToast("Failed to sync expenses", "error");
        }
    },

    applyFilters() {
        const term = UI.elements.filters.search.value.toLowerCase();
        const start = UI.elements.filters.start.value;
        const end = UI.elements.filters.end.value;

        const isFiltering = term !== '' || start !== '' || end !== '';
        let filtered = STATE.expenses;

        if (isFiltering) {
            filtered = STATE.expenses.filter(e => 
                (e.material.toLowerCase().includes(term)) &&
                (!start || e.date >= start) &&
                (!end || e.date <= end)
            );
        } else {
            filtered = STATE.showAllExpenses ? STATE.expenses : STATE.expenses.slice(0, 5);
        }

        if (!isFiltering && !STATE.showAllExpenses && STATE.expenses.length > 5) {
            UI.elements.dashboard.viewAll.style.display = 'block';
        } else {
            UI.elements.dashboard.viewAll.style.display = 'none';
        }
        UI.renderExpenses(filtered);
    }
};

// ==========================================
// 8. EVENT BINDINGS
// ==========================================
const EVENTS = {
    // Stores refs to initialized swipe buttons
    swipes: {},

    bindStaticEvents() {
        // Auth Submit
        UI.elements.auth.form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!navigator.onLine) return UI.showToast("Offline", "error");
            
            UI.setAuthLoading(true);
            const { error } = await API.handleAuth('login', UI.elements.auth.email.value, UI.elements.auth.pass.value);
            if (error && error.message.includes("Invalid login")) {
                const signup = await API.handleAuth('signup', UI.elements.auth.email.value, UI.elements.auth.pass.value);
                if (signup.error) {
                    UI.showToast(signup.error.message, "error");
                } else {
                    UI.showToast("Account created!", "success");
                }
            } else if (error) {
                UI.showToast(error.message, "error");
            }
            UI.setAuthLoading(false);
        });

        // Search Filters (Debounced)
        const runFilter = UTILS.debounce(() => APP.applyFilters(), CONFIG.SEARCH_DEBOUNCE_MS);
        UI.elements.filters.search?.addEventListener('input', runFilter);
        UI.elements.filters.start?.addEventListener('change', runFilter);
        UI.elements.filters.end?.addEventListener('change', runFilter);

        // View All
        UI.elements.dashboard.viewAll?.addEventListener('click', () => {
            STATE.showAllExpenses = true;
            APP.applyFilters();
        });

        // Initialize Swipe Actions
        EVENTS.swipes.addProject = SWIPE_ACTIONS.init('add-project-swipe', async () => {
            const name = document.getElementById('new-project-name-modal').value.trim();
            if (!name) throw new Error("Invalid");
            await API.addRecord('projects', { name, user_id: STATE.user.id });
            UI.elements.modals.addProj.classList.add('hidden');
            document.getElementById('add-project-form-modal').reset();
            UI.showToast("Project created", "success");
            await APP.refreshProjects();
            EVENTS.swipes.addProject.reset();
        });

        EVENTS.swipes.addExpense = SWIPE_ACTIONS.init('add-expense-swipe', async () => {
            const payload = {
                type: document.querySelector('input[name="entry-type"]:checked').value,
                material: document.getElementById('material-name').value.trim(),
                cost: parseFloat(document.getElementById('cost').value),
                date: document.getElementById('date').value,
                info: document.getElementById('additional-info').value.trim(),
                project_id: STATE.activeProjectId,
                user_id: STATE.user.id
            };
            if(!payload.material || isNaN(payload.cost) || !payload.date) throw new Error("Invalid");
            
            await API.addRecord('expenses', payload);
            document.getElementById('expense-form').reset();
            UI.elements.modals.addExp.classList.add('hidden');
            UI.showToast("Expense added", "success");
            await APP.refreshExpenses(STATE.activeProjectId);
            EVENTS.swipes.addExpense.reset();
        });
        
        EVENTS.swipes.editExpense = SWIPE_ACTIONS.init('edit-expense-swipe', async () => {
            const id = document.getElementById('edit-expense-id').value;
            const payload = {
                type: document.querySelector('input[name="edit-entry-type"]:checked').value,
                material: document.getElementById('edit-material-name').value.trim(),
                cost: parseFloat(document.getElementById('edit-cost').value),
                date: document.getElementById('edit-date').value,
                info: document.getElementById('edit-additional-info').value.trim()
            };
            await API.updateRecord('expenses', id, payload);
            UI.elements.modals.editExp.classList.add('hidden');
            UI.showToast("Updated successfully", "success");
            await APP.refreshExpenses(STATE.activeProjectId);
            EVENTS.swipes.editExpense.reset();
        });

        // Analytics Trigger
        document.getElementById('go-to-analytics-btn')?.addEventListener('click', async () => {
            if (!STATE.activeProjectId) return;
            const data = await API.getServerAnalytics(STATE.activeProjectId);
            
            const exp = {}, inc = {};
            Object.keys(data.monthly_data || {}).sort().forEach(m => {
                exp[m] = data.monthly_data[m].expense;
                inc[m] = data.monthly_data[m].income;
            });

            UI.renderCharts(data.category_totals || {}, exp, inc);
            UI.elements.modals.analytics.classList.remove('hidden');
        });
        
        // Modal Closers
        document.querySelectorAll('#close-add-expense-btn, #close-edit-btn, #close-edit-project-btn, #close-add-project-btn, #close-analytics-btn').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.absolute.inset-0').classList.add('hidden'));
        });
    },

    bindDynamicProjectEvents() {
        document.querySelectorAll('.sidebar-project-link').forEach(link => link.addEventListener('click', e => {
            e.preventDefault();
            STATE.activeProjectId = e.currentTarget.dataset.projectId;
            localStorage.setItem('lastActiveProjectId', STATE.activeProjectId);
            STATE.showAllExpenses = false;
            APP.loadProjectData(STATE.activeProjectId);
            UI.elements.menu.backdrop.click(); // Close menu
            // Sidebar UI update
            document.querySelectorAll('.sidebar-project-link').forEach(l => {
                const isActive = l.dataset.projectId === STATE.activeProjectId;
                l.classList.toggle('text-indigo-600', isActive);
                l.classList.toggle('bg-indigo-50', isActive);
                l.classList.toggle('text-slate-600', !isActive);
            });
        }));

        document.querySelectorAll('.delete-project-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            const { projectId } = e.currentTarget.dataset;
            if(confirm("Delete this project and all its expenses?")) { // Replaced complex DOM confirm for standard native confirm for reliability
                await API.deleteProjectCascade(projectId);
                UI.showToast("Project deleted", "success");
                await APP.refreshProjects();
            }
        }));
    },

    bindDynamicExpenseEvents() {
        document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if(confirm("Delete this transaction?")) {
                await API.deleteRecord('expenses', id);
                UI.showToast("Transaction deleted", "success");
                await APP.refreshExpenses(STATE.activeProjectId);
            }
        }));

        document.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const exp = STATE.expenses.find(ex => ex.id === id);
            if (!exp) return;
            
            document.getElementById('edit-expense-id').value = exp.id;
            document.querySelector(`input[name="edit-entry-type"][value="${exp.type}"]`).checked = true;
            document.getElementById('edit-material-name').value = exp.material;
            document.getElementById('edit-cost').value = exp.cost;
            document.getElementById('edit-date').value = exp.date;
            document.getElementById('edit-additional-info').value = exp.info || '';
            UI.elements.modals.editExp.classList.remove('hidden');
        }));
    }
};

// ==========================================
// 9. BOOTSTRAP
// ==========================================
APP.init();

// Footer version
document.getElementById("app-version").textContent = `Version 2.0.0 (Enterprise Build)`;
