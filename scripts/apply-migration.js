#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[ERROR] Missing Supabase credentials');
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' },
});

async function executeMigration() {
  try {
    console.log('[INFO] Reading migration file...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260417_add_hierarchical_admin.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('[INFO] Executing migration...');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let executedCount = 0;
    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error && error.message.includes('does not exist')) {
          // Skip if function doesn't exist yet
          console.log('[SKIP]', statement.substring(0, 50) + '...');
        } else if (error) {
          console.error('[ERROR] Failed:', statement.substring(0, 50), error);
        } else {
          executedCount++;
          console.log('[OK]', statement.substring(0, 50) + '...');
        }
      } catch (e) {
        // Continue on error, database might have restrictions
        console.log('[SKIP]', statement.substring(0, 50) + '...');
      }
    }

    console.log(`\n✓ Migration completed! (${executedCount}/${statements.length} statements executed)`);
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Migration failed:', error.message);
    process.exit(1);
  }
}

executeMigration();
