// Firebase Imports - Added doc, getDoc
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('projectId');

if (!projectId) {
  alert("No project selected. Redirecting to dashboard.");
  window.location.href = 'index.html';
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await fetchAndRenderAnalytics(user.uid, projectId);
  } else {
    window.location.href = 'index.html';
  }
});

async function fetchAndRenderAnalytics(uid, projectId) {
  const appId = "construction-expenses";
  
  try {
    // 1. Fetch Project Details to get the Project Name
    const projectRef = doc(db, `artifacts/${appId}/users/${uid}/projects`, projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      document.getElementById('project-name-display').textContent = `${projectSnap.data().name}`;
    } else {
      document.getElementById('project-name-display').textContent = `Project Analytics`;
    }

    // 2. Fetch Expenses
    const expensesRef = collection(db, `artifacts/${appId}/users/${uid}/expenses`);
    const q = query(expensesRef, where("projectId", "==", projectId));
    const snapshot = await getDocs(q);
    
    const expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    document.getElementById('loading-indicator').classList.add('hidden');
    document.getElementById('back-btn').classList.remove('hidden');
    document.getElementById('analytics-content').classList.remove('hidden');
    
    processAnalyticsData(expenses);

  } catch (error) {
    console.error("Error fetching analytics:", error);
    alert("Failed to load data.");
  }
}

function processAnalyticsData(expenses) {
  // 1. Calculate All-Time Total Spent
  const allTimeTotal = expenses.reduce((sum, exp) => sum + exp.cost, 0);
  document.getElementById('total-spent').textContent = `₹${allTimeTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // 2. Calculate Summary Cards (Current Month)
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const thisMonthExpenses = expenses.filter(exp => exp.date.startsWith(currentMonthStr));
  const monthTotal = thisMonthExpenses.reduce((sum, exp) => sum + exp.cost, 0);
  
  const daysPassed = now.getDate() || 1; 
  const dailyAvg = monthTotal / daysPassed;

  document.getElementById('month-total').textContent = `₹${monthTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  document.getElementById('daily-avg').textContent = `₹${dailyAvg.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // 3. Prepare Category Data (Doughnut Chart)
  const categoryTotals = {};
  expenses.forEach(exp => {
    const mat = exp.material.trim().charAt(0).toUpperCase() + exp.material.trim().slice(1).toLowerCase();
    categoryTotals[mat] = (categoryTotals[mat] || 0) + exp.cost;
  });

  // 4. Prepare Daily Data (Line Chart - Last 30 Days)
  const dailyTotals = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateString = d.toISOString().split('T')[0];
    dailyTotals[dateString] = 0; 
  }
  
  // 5. Prepare Monthly Data (Bar Chart)
  const monthlyTotals = {};
  
  expenses.forEach(exp => {
    // Populate Daily
    if (dailyTotals[exp.date] !== undefined) {
      dailyTotals[exp.date] += exp.cost;
    }
    // Populate Monthly (Group by YYYY-MM)
    const monthKey = exp.date.substring(0, 7);
    monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + exp.cost;
  });

  // Sort months chronologically
  const sortedMonths = Object.keys(monthlyTotals).sort();
  const sortedMonthlyTotals = {};
  sortedMonths.forEach(key => {
    sortedMonthlyTotals[key] = monthlyTotals[key];
  });

  renderCharts(categoryTotals, dailyTotals, sortedMonthlyTotals);
}

function renderCharts(categoryTotals, dailyTotals, monthlyTotals) {
  // Common Chart.js options for currency formatting
  const currencyFormatter = (value) => '₹' + value.toLocaleString('en-IN');

  // Category Doughnut Chart
  const ctxCategory = document.getElementById('category-chart').getContext('2d');
  new Chart(ctxCategory, {
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

  // Daily Line Chart
  const ctxDaily = document.getElementById('daily-chart').getContext('2d');
  new Chart(ctxDaily, {
    type: 'line',
    data: {
      labels: Object.keys(dailyTotals).map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }), 
      datasets: [{
        label: 'Daily Spend',
        data: Object.values(dailyTotals),
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 2
      }]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { callback: currencyFormatter } }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Monthly Bar Chart
  const ctxMonthly = document.getElementById('monthly-chart').getContext('2d');
  new Chart(ctxMonthly, {
    type: 'bar',
    data: {
      labels: Object.keys(monthlyTotals).map(date => {
        // Convert "YYYY-MM" to "Mon YYYY"
        const d = new Date(date + '-01'); 
        return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      }),
      datasets: [{
        label: 'Monthly Spend',
        data: Object.values(monthlyTotals),
        backgroundColor: '#10B981',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { callback: currencyFormatter } }
      },
      plugins: { legend: { display: false } }
    }
  });
}
