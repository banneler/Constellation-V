import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. DATA EXTRACTION (Matches your working briefingPayload structure)
    const { briefingPayload } = await req.json();
    const { tasks, sequenceSteps, deals, cognitoAlerts, nurtureAccounts, contacts, accounts, sequences, sequence_steps } = briefingPayload;

    if (!tasks || !deals || !cognitoAlerts) {
      throw new Error("Required CRM data fields are missing.");
    }

    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
    
    // 2. AUTH & CONFIG (The New Fallback Logic)
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    });
    const { data: { user } } = await supabaseUser.auth.getUser();

    const { data: config } = await supabaseAdmin
      .from('ai_configs')
      .select('persona, voice, custom_instructions')
      .eq('function_id', 'get-daily-briefing')
      .or(`user_id.eq.${user?.id},user_id.is.null`)
      .order('user_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    // 3. YOUR SECRET SAUCE (Formatting Helpers)
    const findRelatedInfo = (item) => {
      let contact, account, deal;
      if (item.contact_id) {
        contact = contacts.find((c) => c.id === item.contact_id);
        if (contact?.account_id) account = accounts.find((a) => a.id === contact.account_id);
      } else if (item.account_id) {
        account = accounts.find((a) => a.id === item.account_id);
      }
      if (item.deal_id) deal = deals.find((d) => d.id === item.deal_id);
      return { contact, account, deal };
    };

    const formattedTasks = tasks.map((t) => {
      const { contact, account, deal } = findRelatedInfo(t);
      return `- Task: "${t.description}". Due: ${t.due_date}. Linked to: ${contact ? contact.first_name : 'No Contact'}, ${account ? account.name : 'No Account'}.${deal ? ` (Deal: ${deal.name})` : ''}`;
    }).join('\n') || "No pending tasks.";

    const formattedDeals = deals.map((d) => {
      const account = accounts.find((a) => a.id === d.account_id);
      return `- Deal: "${d.name}" (${account?.name || 'Unknown'}) is in "${d.stage}" with MRC $${d.mrc || '0'}.`;
    }).join('\n') || "No open deals.";

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const actionableAlerts = cognitoAlerts.filter((a) => a.status?.toLowerCase() === 'new' && new Date(a.created_at) > sevenDaysAgo);
    
    const formattedAlerts = actionableAlerts.map((a) => {
      const account = accounts.find((ac) => ac.id === a.account_id);
      return `- **New Cognito Alert** for ${account?.name || 'Unknown'}: "${a.headline}". Details: ${a.summary || 'No description.'}`;
    }).join('\n') || "No new Cognito Alerts.";

    // 4. THE PROMPT (Blending your Framework with Dynamic Persona)
    const prompt = `
      ${config?.persona || "You are an expert sales consultant for Great Plains Communications."}
      Voice: ${config?.voice || "Strategic, direct, and commanding."}
      Strategic Directive: ${config?.custom_instructions || "Focus on high-impact signals first."}

      **Framework:**
      1. Priority: Cognito Buying Signals.
      2. Priority: Late-Stage Deals (Proposal/Negotiation) with high MRC.
      3. Momentum: Pending Tasks.

      **Today's Data:**
      - Cognito Alerts: ${formattedAlerts}
      - Open Deals: ${formattedDeals}
      - Pending Tasks: ${formattedTasks}

      Your entire response MUST be a raw JSON object with a single key "priorities", which is an array of objects.
      Each object must have "title" (action) and "reason" (strategic justified why).
    `;

    // 5. THE FETCH
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
              "priorities": {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: { "title": { "type": "STRING" }, "reason": { "type": "STRING" } },
                  required: ["title", "reason"]
                }
              }
            },
            required: ["priorities"]
          }
        }
      })
    });

    const responseJson = await apiResponse.json();
    const cleanJson = responseJson.candidates[0].content.parts[0].text;
    
    return new Response(cleanJson, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});