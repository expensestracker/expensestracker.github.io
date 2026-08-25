import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = 'https://qbdzwwqkcjnfcqlgnknc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZHp3d3FrY2puZmNxbGdua25jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzgyNTEsImV4cCI6MjEwMzAxNDI1MX0.GgeDNJCZwQdbfe9pKsDiV8Ld6rgJm_WkccI7iGbB4mg';
const supabase = createClient(supabaseUrl, supabaseKey);

// DOM Elements
const kpiProjects = document.getElementById('kpi-projects');
const kpiIncome = document.getElementById('kpi-income');
const kpiExpenses = document.getElementById('kpi-expenses');
const kpiTransactions = document.getElementById('kpi-transactions');
const globalTransactionsList = document.getElementById('global-transactions-list');
const logoutBtn = document.getElementById('admin-logout-btn');

let activityChartInstance = null;

async function initAdminDashboard() {
    try {
        // 1. Fetch Aggregated Projects Data
        const { count: projectCount, error: projError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true });
            
        if (projError) throw projError;
        kpiProjects.textContent = projectCount || 0;

        // 2. Fetch Aggregated Expenses/Income Data
        // To prevent loading massive datasets into memory, a real production app uses Postgres RPCs. 
        // Here we fetch a large batch for client-side calculation.
        const { data: allTransactions, error: txError } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false })
            .limit(1000); 

        if (txError) throw txError;

        processKPIs(allTransactions);
        renderRecentTransactions(allTransactions.slice(0, 8)); // Show top 8
        renderChart(allTransactions);

    } catch (error) {
        console.error("Admin Dashboard Load Error:", error);
        alert("Failed to load dashboard data. Ensure your RLS policies allow admin read access.");
    }
}

function processKPIs(transactions) {
    let totalInc = 0;
    let totalExp = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') {
            totalInc += Number(tx.cost);
        } else {
            totalExp += Number(tx.cost);
        }
    });

    kpiTransactions.textContent = transactions.length;
    kpiIncome.textContent = `₹${totalInc.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    kpiExpenses.textContent = `₹${totalExp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function renderRecentTransactions(transactions) {
    if (!transactions || transactions.length === 0) {
        globalTransactionsList.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">No transactions found.</td></tr>`;
        return;
    }

    globalTransactionsList.innerHTML = transactions.map(tx => {
        const isIncome = tx.type === 'income';
        const badgeClass = isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
        const costClass = isIncome ? 'text-emerald-600' : 'text-slate-800';

        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 font-mono text-xs text-slate-400">${tx.id.substring(0, 8)}...</td>
            <td class="px-6 py-4 text-slate-600 truncate max-w-[150px]">${tx.project_id || 'N/A'}</td>
            <td class="px-6 py-4 font-semibold text-slate-700">${tx.material}</td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeClass}">
                    ${tx.type || 'expense'}
                </span>
            </td>
            <td class="px-6 py-4 text-right font-bold ${costClass}">
                ₹${Number(tx.cost).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </td>
            <td class="px-6 py-4 text-slate-500 font-medium">
                ${new Date(tx.date).toLocaleDateString('en-IN')}
            </td>
        </tr>
        `;
    }).join('');
}

function renderChart(transactions) {
    // Group transactions by date for the last 30 days
    const last30Days = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last30Days[d.toISOString().split('T')[0]] = { income: 0, expense: 0 };
    }

    transactions.forEach(tx => {
        const dateStr = tx.date;
        if (last30Days[dateStr]) {
            if (tx.type === 'income') last30Days[dateStr].income += Number(tx.cost);
            else last30Days[dateStr].expense += Number(tx.cost);
        }
    });

    const labels = Object.keys(last30Days).map(date => {
        return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    });
    const incomeData = Object.values(last30Days).map(d => d.income);
    const expenseData = Object.values(last30Days).map(d => d.expense);

    const ctx = document.getElementById('platform-activity-chart').getContext('2d');
    
    if (activityChartInstance) activityChartInstance.destroy();

    activityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Income (₹)',
                    data: incomeData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Expenses (₹)',
                    data: expenseData,
                    borderColor: '#EF4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#e2e8f0' } },
                x: { grid: { display: false } }
            }
        }
    });
}

logoutBtn?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});

// Initialize on load
document.addEventListener('DOMContentLoaded', initAdminDashboard);
