import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Parse incoming request body
    const body = await req.json();
    const { originalSuggestion, userInstruction } = body;

    // 2. SAFETY CHECK: Ensure the required data exists before proceeding
    if (!originalSuggestion || !originalSuggestion.subject) {
      console.error("Missing or malformed 'originalSuggestion' in payload:", body);
      return new Response(
        JSON.stringify({ error: "Missing required field: 'originalSuggestion.subject'" }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
    
    // 3. Initialize Supabase clients
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!, 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!, 
      Deno.env.get('SUPABASE_ANON_KEY')!, 
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    // 4. Fetch User and Config
    const { data: { user } } = await supabaseUser.auth.getUser();

    const { data: config } = await supabaseAdmin
      .from('ai_configs')
      .select('persona, voice, custom_instructions')
      .eq('function_id', 'generate-custom-suggestion')
      .or(`user_id.eq.${user?.id},user_id.is.null`)
      .order('user_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    // 5. Construct AI Prompt
    const prompt = `
      ${config?.persona || "You are a senior sales communications coach."}
      Voice: ${config?.voice || "Direct and instruction-led."}
      
      Current Email Draft: 
      Subject: ${originalSuggestion.subject}
      Body: ${originalSuggestion.body}

      User Feedback: "${userInstruction}"

      Task: Refine the email based on feedback. 
      CRITICAL: Keep the [FirstName] placeholder. No signature.
      Return ONLY raw JSON with keys "subject" and "body".
    `;

    // 6. Call Gemini API
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_api_key}`;
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!apiResponse.ok) {
        const apiError = await apiResponse.text();
        throw new Error(`Gemini API Error: ${apiResponse.status} - ${apiError}`);
    }

    // 7. Parse and Clean Response
    const responseJson = await apiResponse.json();
    const cleanJson = responseJson.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
    
    return new Response(cleanJson, { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    // 8. THE GHOST ERROR FIX: Log the error so it shows up in the Supabase Dashboard
    console.error("Edge Function Error:", err); 
    
    return new Response(
      JSON.stringify({ error: err.message || "An unexpected error occurred" }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});