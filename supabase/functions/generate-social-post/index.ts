import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    // Support every possible argument from your social_hub.js
    const { userPrompt, product_names, article, originalText, customPrompt, industry } = payload;
    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
    
    // Determine the ID based on the UI action
    const fid = originalText ? 'refine-social-post' : (article ? 'generate-social-post' : 'custom-user-social-post');

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });

    const { data: { user } } = await supabaseUser.auth.getUser();

    // 1. Fetch Configuration with User Fallback
    const { data: config } = await supabaseAdmin
      .from('ai_configs')
      .select('persona, voice, custom_instructions')
      .eq('function_id', fid)
      .or(`user_id.eq.${user?.id},user_id.is.null`)
      .order('user_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    // 2. Fetch Product Context if needed
    let productContext = "";
    if (product_names?.length > 0) {
      const { data } = await supabaseUser.functions.invoke('fetch-product-verbiage', { 
        body: { product_names, industry: industry || 'General' } 
      });
      productContext = data?.verbiageContext || "";
    }

    // 3. The Prompt - Forcing a "Multi-Key" JSON Response
    const prompt = `
      ${config?.persona || "You are a LinkedIn thought leader for GPC."}
      Voice: ${config?.voice || "Professional and engaging."}
      Directive: ${config?.custom_instructions || ""}

      Task: ${originalText ? `Refine this post: "${originalText}" based on: "${customPrompt}"` : `Create a post about: "${userPrompt || article?.summary}"`}
      ${productContext ? `GPC Context: ${productContext}` : ""}

      Requirements:
      - LinkedIn whitespace/formatting.
      - Return ONLY a raw JSON object.
      - Put the main content into BOTH "post_body" AND "suggestion" keys.
      - Put the hashtags into the "hashtags" key.
    `;

    // 4. API Call with Strict Schema to satisfy ALL social_hub.js variables
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_api_key}`;
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              "post_body": { "type": "STRING" },
              "suggestion": { "type": "STRING" },
              "hashtags": { "type": "STRING" }
            },
            required: ["post_body", "suggestion", "hashtags"]
          }
        }
      })
    });

    const responseJson = await apiResponse.json();
    const rawText = responseJson.candidates[0].content.parts[0].text;
    
    // 5. Nuke-level JSON Cleaning
    const cleanJson = rawText.replace(/```json|```/g, "").trim();

    return new Response(cleanJson, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("Social Hub Crash:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: corsHeaders, 
      status: 500 
    });
  }
});