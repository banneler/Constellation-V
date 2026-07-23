// File: supabase/functions/fetch-product-verbiage/index.ts
// Corrected Version - Self-Contained

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers directly inside the function file
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // This is needed if you're calling this function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { product_names, industry } = await req.json()

    // It's crucial to use the ANON_KEY for row-level security.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Build the query dynamically
    let query = supabaseClient
      .from('product_knowledge')
      .select('title, content, verbiage_type, product_name')
      .in('product_name', product_names)

    // Apply industry filter:
    // If a specific industry is chosen, get verbiage for that industry AND general verbiage (where industry is null).
    // If 'General' is chosen, ONLY get general verbiage.
    if (industry && industry !== 'General') {
      query = query.or(`industry.eq.${industry},industry.is.null`)
    } else {
      query = query.is('industry', null)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Format the data into a clean string for the AI prompt
    let verbiageContext = 'Relevant Product Information:\n\n'
    data.forEach(item => {
      verbiageContext += `---
Product: ${item.product_name}
Category: ${item.verbiage_type}
Title: ${item.title || 'N/A'}
Content: ${item.content}
---\n\n`
    })

    return new Response(JSON.stringify({ verbiageContext }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})