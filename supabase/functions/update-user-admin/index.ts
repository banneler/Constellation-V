import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check for the secrets first to ensure they are loaded
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const { target_user_id, full_name, monthly_quota, is_manager, exclude_from_reporting } = await req.json()

    // Create the admin client using the secrets
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // Operation 1: Update Auth User Metadata
    const { error: userError } = await supabaseAdmin.auth.admin.updateUserById(
      target_user_id,
      { user_metadata: { is_manager: is_manager, exclude_from_reporting: exclude_from_reporting } }
    )
    if (userError) {
      throw new Error(`Failed on auth update: ${userError.message}`);
    }

    // Operation 2: Update Public User Quotas Table
    const { error: quotaError } = await supabaseAdmin
      .from('user_quotas')
      .update({
        full_name: full_name,
        monthly_quota: monthly_quota,
      })
      .eq('user_id', target_user_id)
      
    if (quotaError) {
      throw new Error(`Failed on quotas update: ${quotaError.message}`);
    }
    
    return new Response(JSON.stringify({ message: "User updated successfully" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('An error occurred in the function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})