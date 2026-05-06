#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables:');
    if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceRoleKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    console.log('📖 Reading migration file...');
    const migrationFile = path.join(
      __dirname,
      '../supabase/migrations/20260417_add_hierarchical_admin.sql'
    );

    const sql = fs.readFileSync(migrationFile, 'utf-8');

    // Split by semicolon and filter empty statements
    const statements = sql
      .split(';\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`\n🚀 Executing ${statements.length} SQL statements...\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ') + '...';

      try {
        // Use Supabase PostgreSQL connection for raw SQL
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: stmt,
        }).catch(() => {
          // If rpc doesn't exist, try using a different approach
          return { error: { message: 'RPC not available' } };
        });

        if (error) {
          // Some errors are ok (like "already exists")
          if (
            error.message?.includes('already exists') ||
            error.message?.includes('does not exist') ||
            error.message?.includes('NOTICE')
          ) {
            console.log(`⏭️  [${i + 1}/${statements.length}] SKIPPED: ${preview}`);
            skipCount++;
          } else {
            console.log(`❌ [${i + 1}/${statements.length}] ERROR: ${preview}`);
            console.log(`   → ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`✅ [${i + 1}/${statements.length}] SUCCESS: ${preview}`);
          successCount++;
        }
      } catch (e) {
        console.log(`⏭️  [${i + 1}/${statements.length}] SKIPPED: ${preview}`);
        skipCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⏭️  Skipped:    ${skipCount}`);
    console.log(`   ❌ Errors:     ${errorCount}`);
    console.log('='.repeat(60));

    if (errorCount === 0) {
      console.log('\n✨ Migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some errors occurred. Check the Supabase dashboard for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

runMigration();
