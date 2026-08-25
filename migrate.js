import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// --- 1. CONFIGURATION ---

// Path to your downloaded Firebase Service Account JSON file
const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));

// Supabase Credentials[span_3](start_span)[span_3](end_span)
const SUPABASE_URL = 'https://qbdzwwqkcjnfcqlgnknc.supabase.co';
// 🛑 IMPORTANT: Use your SERVICE_ROLE key here, NOT the anon key, to bypass RLS rules.
// Find this in Supabase Dashboard -> Project Settings -> API
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiZHp3d3FrY2puZmNxbGdua25jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzQzODI1MSwiZXhwIjoyMTAzMDE0MjUxfQ.aElu1nW4iq7ejWTChdRFpqCyNQIR5Qn4zsn9DUMhxnw'; 

const APP_ID = 'construction-expenses'; //[span_4](start_span)[span_4](end_span)

// --- 2. INITIALIZATION ---

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- 3. MIGRATION LOGIC ---

async function migrateData() {
  console.log('🚀 Starting migration from Firebase to Supabase...');

  try {
    // Fetch all user documents from Firebase[span_5](start_span)[span_5](end_span)
    const usersSnapshot = await db.collection(`artifacts/${APP_ID}/users`).get();
    console.log(`Found ${usersSnapshot.size} users to migrate.`);

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      console.log(`\n👤 Migrating user: ${uid}`);

      // Optional: If you have a custom users table in Supabase, you can upsert user data here
      // const userData = userDoc.data();
      // await supabase.from('users').upsert({ id: uid, email: userData.email, ...userData });

      // --- Migrate Projects ---
      const projectsRef = db.collection(`artifacts/${APP_ID}/users/${uid}/projects`);
      const projectsSnapshot = await projectsRef.get();

      if (!projectsSnapshot.empty) {
        // Map Firebase schema to Supabase schema[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span)
        const projectsToInsert = projectsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          user_id: uid
        }));

        // Using upsert prevents duplicate data if you have to run the script multiple times
        const { error: projectErr } = await supabase.from('projects').upsert(projectsToInsert);
        if (projectErr) throw new Error(`Project Migration Error: ${projectErr.message}`);
        
        console.log(`✅ Migrated ${projectsToInsert.length} projects.`);
      }

      // --- Migrate Expenses ---
      const expensesRef = db.collection(`artifacts/${APP_ID}/users/${uid}/expenses`);
      const expensesSnapshot = await expensesRef.get();

      if (!expensesSnapshot.empty) {
        // Map Firebase schema to Supabase schema, handling camelCase to snake_case[span_8](start_span)[span_8](end_span)[span_9](start_span)[span_9](end_span)
        const expensesToInsert = expensesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            material: data.material,
            cost: data.cost,
            date: data.date,
            type: data.type,
            info: data.info || null,
            project_id: data.projectId, // Mapping projectId to project_id[span_10](start_span)[span_10](end_span)[span_11](start_span)[span_11](end_span)
            user_id: uid
          };
        });

        const { error: expenseErr } = await supabase.from('expenses').upsert(expensesToInsert);
        if (expenseErr) throw new Error(`Expense Migration Error: ${expenseErr.message}`);
        
        console.log(`✅ Migrated ${expensesToInsert.length} expenses.`);
      }
    }

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  }
}

migrateData();
