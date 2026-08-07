// supabase/functions/global-search/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Add logging at each step to see where it fails
  try {
    console.log("Function invoked. Parsing request body...");
    const { searchTerm } = await req.json();
    console.log(`Search term received: "${searchTerm}"`);

    if (!searchTerm || searchTerm.length < 2) {
      return new Response(JSON.stringify({ error: "Search term is required." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log("Creating authenticated Supabase client...");
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    console.log("Client created. Executing database queries...");

    const [accountsRes, contactsRes, dealsRes] = await Promise.all([
      supabaseClient.from('accounts').select('id, name').ilike('name', `%${searchTerm}%`).limit(5),
      supabaseClient.from('contacts').select('id, first_name, last_name').or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`).limit(5),
      supabaseClient.from('deals').select('id, name').ilike('name', `%${searchTerm}%`).limit(5)
    ]);
    console.log("Queries finished. Checking for errors...");

    // **THIS IS THE CRITICAL FIX**
    // We must check the .error property of each query result.
    if (accountsRes.error) throw accountsRes.error;
    if (contactsRes.error) throw contactsRes.error;
    if (dealsRes.error) throw dealsRes.error;
    
    console.log("No query errors found. Processing results...");

    const results = [];
    if (accountsRes.data) {
      accountsRes.data.forEach(a => results.push({ type: 'Account', name: a.name, url: `accounts.html?accountId=${a.id}` }));
    }
    if (contactsRes.data) {
      contactsRes.data.forEach(c => results.push({ type: 'Contact', name: `${c.first_name} ${c.last_name}`, url: `contacts.html?contactId=${c.id}` }));
    }
    if (dealsRes.data) {
      dealsRes.data.forEach(d => results.push({ type: 'Deal', name: d.name, url: `deals.html?dealId=${d.id}` }));
    }
    console.log("Returning successful response.");

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // This will now catch the database errors and log them properly.
    console.error("Error caught in function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});