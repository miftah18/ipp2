import { createClient } from '@supabase/supabase-js';

async function verifySetup() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔍 Verifying hierarchical admin system setup...\n');

    // Check org_units table
    console.log('1. Checking org_units table columns...');
    const { data: orgUnitsInfo, error: orgError } = await supabase
      .from('org_units')
      .select()
      .limit(1);

    if (orgError) {
      console.error('   ❌ Error accessing org_units:', orgError.message);
    } else {
      console.log('   ✓ org_units table exists');
    }

    // Check user_roles table
    console.log('2. Checking user_roles table columns...');
    const { data: userRolesInfo, error: rolesError } = await supabase
      .from('user_roles')
      .select()
      .limit(1);

    if (rolesError) {
      console.error('   ❌ Error accessing user_roles:', rolesError.message);
    } else {
      console.log('   ✓ user_roles table exists');
    }

    // Check if new columns exist
    console.log('3. Checking hierarchy columns in user_roles...');
    const { data: sampleUser, error: sampleError } = await supabase
      .from('user_roles')
      .select('user_id, role, org_unit_id, managed_org_units, hierarchy_level')
      .limit(1);

    if (!sampleError) {
      console.log('   ✓ Hierarchy columns (org_unit_id, managed_org_units, hierarchy_level) exist');
    } else {
      console.log('   ⚠ Note: user_roles table needs migration. Run: supabase db push');
    }

    // Check hierarchy_info view
    console.log('4. Checking hierarchy_info view...');
    const { data: viewData, error: viewError } = await supabase
      .from('hierarchy_info')
      .select()
      .limit(1);

    if (!viewError) {
      console.log('   ✓ hierarchy_info view exists');
    } else {
      console.log('   ⚠ hierarchy_info view not found (will be created by migration)');
    }

    console.log('\n✅ Verification complete!');
    console.log('\nNext steps:');
    console.log('1. Run "supabase db push" to apply migrations');
    console.log('2. Update your org_units with hierarchy data');
    console.log('3. Assign users to org_units with appropriate roles');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifySetup();
