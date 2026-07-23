import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // ADDED: x-supabase-client-platform
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { internalData } = await req.json();
    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
    
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

    const { data: { user } } = await supabaseUser.auth.getUser();

    // 1. Fetch Personalized Config with Global Fallback
    const { data: config } = await supabaseAdmin
      .from('ai_configs')
      .select('persona, voice, custom_instructions')
      .eq('function_id', 'get-account-briefing')
      .or(`user_id.eq.${user?.id},user_id.is.null`)
      .order('user_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    // 2. The Strategic Prompt
    const prompt = `
      ${config?.persona || "You are an AI Sales Assistant for GPC out of Nebraska."}
      Voice: ${config?.voice || "Professional and strategic."}
      Additional Instructions: ${config?.custom_instructions || ""}

      ### ENTERPRISE STRATEGIC LOGIC:
      1. INFRASTRUCTURE & REAL ESTATE: Always cross-reference infrastructure quotes (like the 100G Wave circuit) with known corporate real estate projects. For instance, if working with Mutual of Omaha, tie network requirements to the "Project Beacon" headquarters timeline and the planned Fall 2026 move-in.
      2. LEADERSHIP MANDATES: Prioritize public modernization goals from the CIO (e.g., Michael Lechtenberger's focus on retiring legacy systems to enable AI and machine learning readiness). 
      3. VALUE PROPOSITION: Position technical POCs not just as product tests, but as foundational steps in achieving these larger modernization and "AI-readiness" roadmaps.

      ### CRITICAL DATA INTERPRETATION RULES:
      1. LOG ENTRIES TAGGED AS "AI-Generated Email": These are system labels indicating the tool used to draft the content. Do NOT assume the representative is discussing "Artificial Intelligence" with the client. Determine the actual business topic from the "Subject" or "Description" (e.g., POC status, infrastructure quotes, or project updates).
      2. IGNORE SYSTEM TAGS: Treat labels like "AI-Generated" as metadata only.

      Account Name: ${internalData.accountName}
      CRM Data Context: ${JSON.stringify(internalData)}

      ### Task Requirements:
      - Use search tools for news (last 60 days), decision makers, and icebreakers.
      - summary: Focus on the actual business relationship, such as active Proof of Concepts (POC).
      - activity_highlights: Provide a scannable, bulleted list of recent interactions. Start each line with a bullet (•).
      - key_players: Return a single comma-separated string of names and titles.
      - recommendation: Strategic next steps that align technical needs with executive modernization goals.
      - Return ONLY a raw JSON object.
    `;

    // 3. API Call with Hardened Response Schema
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_api_key}`;
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ "google_search": {} }],
        // google_search is incompatible with responseMimeType/responseSchema on 2.5-flash
      })
    });

    const responseJson = await apiResponse.json();
    
    // Safety check in case Gemini returns an error structure instead of content
    if (!responseJson.candidates || !responseJson.candidates[0]) {
       throw new Error(JSON.stringify(responseJson));
    }

    let text = responseJson.candidates[0].content.parts[0].text;
    
    // Hardened cleaner: strip markdown fences and extract JSON object if wrapped in prose
    let cleanJson = text.replace(/```json|```/g, "").trim();
    const jsonStart = cleanJson.indexOf("{");
    const jsonEnd = cleanJson.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleanJson = cleanJson.slice(jsonStart, jsonEnd + 1);
    }

    return new Response(cleanJson, { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err) {
    console.error("Account Briefing Function Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Ensure Content-Type is set on error too
      status: 500 
    });
  }
});