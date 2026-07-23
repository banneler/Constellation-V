import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userPrompt, product_names, industry } = await req.json();
    if (!userPrompt) throw new Error("Missing required parameter: userPrompt is required.");

    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
    
    // 1. Initialize Supabase Admin to fetch Dynamic Configs
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Fetch the Dynamic AI Configuration for this specific function
    const { data: config } = await supabaseAdmin
      .from('ai_configs')
      .select('persona, voice, custom_instructions')
      .eq('function_id', 'custom-user-social-post')
      .single();

    const persona = config?.persona || "You are a senior GPC Product Marketing Specialist.";
    const voice = config?.voice || "Authoritative yet approachable. Focus on outcomes.";
    const evolution = config?.custom_instructions || "";

    // 3. Technical Foundation: Product Verbiage Fetching
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    let productVerbiageContext = "";
    if (product_names && product_names.length > 0) {
      const { data, error } = await supabaseUser.functions.invoke('fetch-product-verbiage', {
        body: { product_names, industry: industry || 'General' }
      });
      if (!error && data) productVerbiageContext = data.verbiageContext;
    }

    // 4. Construct the Integrated Prompt
    const prompt = `
      ${persona}
      
      **Tone and Voice:**
      ${voice}

      **User-Defined Special Instructions:**
      ${evolution}

      **The Task:**
      Create a LinkedIn post based on the following topic: "${userPrompt}"

      ${productVerbiageContext ? `
      ---
      TECHNICAL PRODUCT CONTEXT:
      Use the following verified product details to add authority to the post. Focus on local reliability.
      ${productVerbiageContext}
      ---
      ` : ''}

      **Technical Formatting Requirements:**
      1. 'post_body': Professional LinkedIn format with whitespace between paragraphs.
      2. 'hashtags': A string of 3-4 niche hashtags starting with #.
      3. Return ONLY a raw JSON object with keys: "post_body" and "hashtags".
    `;

    // 5. Execute Gemini Request
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_api_key}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        responseMimeType: "application/json"
      }
    };

    const apiResponse = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const responseJson = await apiResponse.json();
    const finalData = JSON.parse(responseJson.candidates[0].content.parts[0].text);

    return new Response(JSON.stringify(finalData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (err) {
    console.error("Custom Social Post Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});