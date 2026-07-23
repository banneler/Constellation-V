import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { contactName, accountName, userPrompt, product_names, industry } = await req.json();
    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
    
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    const { data: { user } } = await supabaseUser.auth.getUser();

    // 1. Fetch Identity & Personalized Voice
    const { data: userData } = await supabaseUser.from('user_quotas').select('full_name, title').eq('id', user?.id).single();
    
    const { data: config } = await supabaseAdmin
      .from('ai_configs')
      .select('persona, voice, custom_instructions')
      .eq('function_id', 'generate-prospect-email')
      .or(`user_id.eq.${user?.id},user_id.is.null`)
      .order('user_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    // 2. Fetch Product Verbiage
    let productContext = "";
    if (product_names?.length > 0) {
      const { data } = await supabaseUser.functions.invoke('fetch-product-verbiage', { 
        body: { product_names, industry: industry || 'General' } 
      });
      productContext = data?.verbiageContext || "";
    }

    const prompt = `
      ${config?.persona || `You are ${userData?.full_name || 'a rep'}, ${userData?.title || 'at GPC'}.`}
      Voice: ${config?.voice || "Professional and approachable."}
      Directive: ${config?.custom_instructions || "Concise and value-first."}

      Goal: ${userPrompt}
      Recipient: ${contactName} at ${accountName}
      ${productContext ? `Technical context to use: ${productContext}` : ""}

      Constraints: Use [FirstName]. No signature. Return JSON with "subject" and "body".
    `;

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_api_key}`;
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const responseJson = await apiResponse.json();
    const cleanJson = responseJson.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    
    return new Response(cleanJson, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 });
  }
});