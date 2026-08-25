import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = 'https://qbdzwwqkcjnfcqlgnknc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZHp3d3FrY2puZmNxbGdua25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzgyNTEsImV4cCI6MjEwMzAxNDI1MX0.GgeDNJCZwQdbfe9pKsDiV8Ld6rgJm_WkccI7iGbB4mg';
const supabase = createClient(supabaseUrl, supabaseKey);

// DOM Elements
const adminBody = document.getElementById('admin-body');
const logoutBtn = document.getElementById('admin-logout-btn');
const usersTableBody = document.getElementById('users-table-body');
const settingsForm = document.getElementById('admin-settings-form');
const maintenanceToggle = document.getElementById('maintenance-toggle');
const notificationInput = document.getElementById('global-notification-input');

// Modal Elements
const manageModal = document.getElementById('manage-user-modal');
const manageContent = document.getElementById('manage-modal-content');
const closeManageModalBtn = document.getElementById('close-manage-modal');
const editUserForm = document.getElementById('edit-user-form');
const muId = document.getElementById('mu-id');
const muName = document.getElementById('mu-name');
const muEmail = document.getElementById('mu-email');
const muStatusToggle = document.getElementById('mu-status-toggle');
const muStatusText = document.getElementById('mu-status-text');

// Custom Toast
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    let icon = type === 'error' ? 
        `<svg class="w-5 h-5 text-red-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>` : 
        `<svg class="w-5 h-5 text-emerald-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  
    toast.className = `bg-slate-800 text-white px-5 py-3 rounded-full shadow-2xl flex items-center text-sm font-bold tracking-wide transition-all duration-300 translate-y-10 opacity-0 pointer-events-auto border border-slate-700/50`;
    toast.innerHTML = `${icon}<span>${message}</span>`;
    toastContainer.appendChild(toast);
  
    requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }));
  
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-10', 'opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// Initialize Admin Panel
async function initAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) { window.location.replace('index.html'); return; }

    const { data: roleData, error: roleError } = await supabase
        .from('user_roles').select('is_admin').eq('user_id', session.user.id).maybeSingle();

    // Silent Redirect without alert
    if (roleError || !roleData || !roleData.is_admin) {
        window.location.replace('index.html');
        return;
    }

    adminBody.classList.remove('hidden');

    await Promise.all([loadStats(), loadUsers(), loadSettings()]);
    setupRealtime();
}

// Supabase Realtime Listener
function setupRealtime() {
    supabase.channel('admin-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => { loadStats(); loadUsers(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadStats())
        .subscribe();
}

async function loadStats() {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
    if (error) return;

    document.getElementById('stat-users').textContent = data.total_users;
    document.getElementById('stat-projects').textContent = data.total_projects;
    document.getElementById('stat-volume').textContent = `₹${data.global_volume.toLocaleString('en-IN')}`;
    document.getElementById('stat-income').textContent = `₹${data.total_income.toLocaleString('en-IN')}`;
}

async function loadUsers() {
    const { data, error } = await supabase.rpc('get_admin_users_list');
    if (error) return;

    usersTableBody.innerHTML = data.map(user => {
        const nameDisplay = user.full_name || 'No Name Set';
        const adminBadge = user.is_admin ? `<span class="ml-2 inline-flex items-center rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-700/10">Admin</span>` : '';
        const statusBadge = user.is_banned 
            ? `<span class="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">Suspended</span>`
            : `<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">Active</span>`;

        const safePayload = JSON.stringify({
            id: user.id, 
            email: user.email, 
            name: user.full_name||'', 
            banned: user.is_banned,
            isAdmin: user.is_admin
        }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-5 py-4">
                <p class="text-sm font-bold text-slate-800 flex items-center">${user.email} ${adminBadge}</p>
                <p class="text-xs text-slate-500 font-medium mt-0.5 truncate max-w-[200px]">${nameDisplay}</p>
            </td>
            <td class="px-5 py-4 text-sm font-black text-slate-700 text-center">${user.project_count}</td>
            <td class="px-5 py-4 text-center">${statusBadge}</td>
            <td class="px-5 py-4 text-right">
                <button onclick="openManageModal('${safePayload}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-xl transition-colors">Manage</button>
            </td>
        </tr>
    `}).join('');
}

async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (data) {
        maintenanceToggle.checked = data.maintenance_mode;
        notificationInput.value = data.global_notification || '';
    }
}

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-settings-btn');
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    
    const { error } = await supabase.rpc('update_app_settings', {
        p_maintenance: maintenanceToggle.checked,
        p_notification: notificationInput.value.trim() || null
    });

    if (error) showToast("Failed to save settings.", "error");
    else showToast("Settings broadcasted live!", "success");
    
    btn.textContent = originalText;
});


// --- Manage User Modal Logic ---

window.openManageModal = (payloadStr) => {
    const user = JSON.parse(payloadStr);
    
    muId.value = user.id;
    muEmail.value = user.email;
    muName.value = user.name;
    
    muStatusToggle.checked = user.banned;
    
    // Protect Admin Accounts from UI Modifications
    const deleteBtn = document.getElementById('btn-delete-user');
    if (user.isAdmin) {
        deleteBtn.classList.add('hidden');
        muStatusToggle.disabled = true;
        muStatusText.textContent = "Active (Admin cannot be suspended)";
        muStatusText.classList.replace('text-rose-500', 'text-indigo-600');
        muStatusText.classList.replace('text-slate-500', 'text-indigo-600');
    } else {
        deleteBtn.classList.remove('hidden');
        muStatusToggle.disabled = false;
        updateStatusText();
    }

    manageModal.classList.remove('hidden');
    manageModal.classList.add('flex');
    setTimeout(() => {
        manageModal.classList.remove('opacity-0');
        manageContent.classList.remove('scale-95');
    }, 10);
};

const closeManageModal = () => {
    manageModal.classList.add('opacity-0');
    manageContent.classList.add('scale-95');
    setTimeout(() => {
        manageModal.classList.add('hidden');
        manageModal.classList.remove('flex');
    }, 300);
};

closeManageModalBtn.addEventListener('click', closeManageModal);
manageModal.addEventListener('click', (e) => { if(e.target === manageModal) closeManageModal(); });

muStatusToggle.addEventListener('change', updateStatusText);
function updateStatusText() {
    if (muStatusToggle.disabled) return;
    if(muStatusToggle.checked) {
        muStatusText.textContent = "Currently Suspended (No Login)";
        muStatusText.classList.replace('text-slate-500', 'text-rose-500');
        muStatusText.classList.replace('text-indigo-600', 'text-rose-500');
    } else {
        muStatusText.textContent = "Currently Active";
        muStatusText.classList.replace('text-rose-500', 'text-slate-500');
        muStatusText.classList.replace('text-indigo-600', 'text-slate-500');
    }
}

// Edit Info & Toggle Status Save
editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('mu-save-btn');
    btn.textContent = "Saving...";

    const p1 = supabase.rpc('admin_update_user_info', { target_user_id: muId.value, new_email: muEmail.value, new_name: muName.value });
    const p2 = supabase.rpc('admin_toggle_user_status', { target_user_id: muId.value, is_disabled: muStatusToggle.checked });

    const [res1, res2] = await Promise.all([p1, p2]);

    if(res1.error || res2.error) {
        showToast(res2.error?.message || "Error updating user.", "error");
    } else {
        showToast("User updated successfully.", "success");
        closeManageModal();
        loadUsers(); 
    }
    btn.textContent = "Save Changes";
});

// Auth Emails
document.getElementById('btn-reset-pw').addEventListener('click', async () => {
    const email = muEmail.value;
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if(error) showToast(error.message, "error");
    else showToast(`Reset link sent to ${email}`, "success");
});

document.getElementById('btn-verify-email').addEventListener('click', async () => {
    const email = muEmail.value;
    const { error } = await supabase.auth.resend({ type: 'signup', email: email });
    if(error) showToast(error.message, "error");
    else showToast(`Verification resent to ${email}`, "success");
});

// Delete User
document.getElementById('btn-delete-user').addEventListener('click', async () => {
    const email = muEmail.value;
    const confirmed = confirm(`CRITICAL WARNING\n\nAre you sure you want to permanently delete [${email}] and ALL associated data? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: muId.value });
    
    if (error) {
        showToast(error.message || "Deletion failed.", "error");
    } else {
        showToast("User permanently deleted.", "success");
        closeManageModal();
        loadStats();
        loadUsers();
    }
});


logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('index.html');
});

initAdmin();
