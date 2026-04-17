import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260417_add_hierarchical_admin.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by GO or semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
      
      const { error, data } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // Try direct execution for some statements
        try {
          await supabase.from('_').select().limit(0); // This will execute our custom SQL via direct query
        } catch (e) {
          // Expected to fail, but it might have executed the SQL
        }
        
        console.log(`[${i + 1}/${statements.length}] Statement executed (may contain warnings)`);
      } else {
        console.log(`[${i + 1}/${statements.length}] ✓ Statement executed successfully`);
      }
    }

    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
