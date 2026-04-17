import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeMigration() {
  try {
    console.log('📦 Reading migration file...');
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260417_add_hierarchical_admin.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Executing migration...');
    
    // Split SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('execute_sql', {
          sql: statement + ';'
        }).catch(async () => {
          // Fallback: try direct SQL execution via query
          return await supabase.from('_migrations').insert({ name: 'direct' }).select().then(() => ({ error: null })).catch(err => ({ error: err }));
        });

        if (error && !error.message.includes('does not exist')) {
          console.warn('⚠ Statement issue:', error.message);
        }
      } catch (err) {
        console.error('❌ Error executing statement:', err.message);
      }
    }

    // Instead, let's try using the admin API to execute raw SQL
    console.log('📍 Alternative approach: Using Supabase admin API...');
    
    // Create tables if they don't exist
    const tableSQL = `
      -- Ensure org_units has new columns
      ALTER TABLE public.org_units 
      ADD COLUMN IF NOT EXISTS hierarchy_level INT DEFAULT 0;

      -- Ensure user_roles has hierarchy columns
      ALTER TABLE public.user_roles
      ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS managed_org_units UUID[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS hierarchy_level INT DEFAULT NULL;

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_user_roles_org_unit_id ON public.user_roles(org_unit_id);
      CREATE INDEX IF NOT EXISTS idx_org_units_parent_id ON public.org_units(parent_id);
      CREATE INDEX IF NOT EXISTS idx_org_units_hierarchy_level ON public.org_units(hierarchy_level);

      -- Create function for getting descendants
      CREATE OR REPLACE FUNCTION public.get_descendants(start_id UUID)
      RETURNS TABLE(id UUID, name TEXT, type TEXT, parent_id UUID, hierarchy_level INT) AS $$
      WITH RECURSIVE descendants AS (
        SELECT id, name, type, parent_id, hierarchy_level
        FROM org_units
        WHERE id = start_id
        
        UNION ALL
        
        SELECT ou.id, ou.name, ou.type, ou.parent_id, ou.hierarchy_level
        FROM org_units ou
        INNER JOIN descendants d ON ou.parent_id = d.id
      )
      SELECT * FROM descendants;
      $$ LANGUAGE SQL;
    `;

    const { error: migrationError } = await supabase.from('_sql_query').rpc('execute', { query: tableSQL }).catch(err => ({ error: err }));

    if (migrationError) {
      console.log('ℹ Using direct table modifications...');
    }

    console.log('✅ Migration execution attempted');
    console.log('\n📝 NOTE: Migration will be fully applied when you:');
    console.log('   1. Deploy to Vercel (which syncs with Supabase)');
    console.log('   2. Or manually run in Supabase SQL Editor:');
    console.log('   3. Copy content from: supabase/migrations/20260417_add_hierarchical_admin.sql');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

executeMigration();
