// /supabase/functions/generate-sequence-steps/index.ts
// FINAL CORRECTED VERSION: Your code + Product Awareness logic
// --- ADDITION 1: Import the Supabase client ---
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
function generateDynamicExample(stepTypes) {
  const exampleSteps = stepTypes.map((type, index)=>{
    const delay = index * 2 + 1; // Create a simple delay pattern
    switch(type){
      case 'Email':
        return {
          type: 'Email',
          delay_days: delay,
          subject: 'Example Email Subject for [AccountName]',
          message: 'This is a sample message for an email step directed to [FirstName].'
        };
      case 'Call':
        return {
          type: 'Call',
          delay_days: delay,
          subject: '',
          message: 'Objective for the call: Follow up with [FirstName] regarding our previous email.'
        };
      case 'LinkedIn':
        return {
          type: 'LinkedIn',
          delay_days: delay,
          subject: '',
          message: 'Connect with [FirstName] on LinkedIn with a personalized note about their work at [AccountName].'
        };
      case 'Task':
        return {
          type: 'Task',
          delay_days: delay,
          subject: 'Prepare for upcoming call',
          message: 'Research [AccountName] and [FirstName] for relevant talking points.'
        };
      default:
        return {
          type: type,
          delay_days: delay,
          subject: `Custom Step: ${type}`,
          message: `This is a sample message for the custom step type: ${type}.`
        };
    }
  });
  return JSON.stringify({
    steps: exampleSteps
  }, null, 2);
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // --- ADDITION 2: Accept new parameters from the request body ---
    const { sequenceGoal, numSteps, totalDuration, stepTypes, personaPrompt, product_names, industry } = await req.json();
    if (!sequenceGoal || !numSteps || !totalDuration || !stepTypes || stepTypes.length === 0 || !personaPrompt) {
      throw new Error("Missing required parameters: sequenceGoal, numSteps, totalDuration, stepTypes, or personaPrompt.");
    }
    const gemini_api_key = Deno.env.get("GEMINI_API_KEY");
    if (!gemini_api_key) {
      throw new Error("GEMINI_API_KEY secret is not set in Supabase environment variables.");
    }
    // --- ADDITION 3: The block to fetch product-specific verbiage ---
    let productVerbiageContext = "";
    if (product_names && product_names.length > 0) {
      const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization')
          }
        }
      });
      const { data, error } = await supabaseClient.functions.invoke('fetch-product-verbiage', {
        body: {
          product_names,
          industry: industry || 'General'
        }
      });
      if (error) {
        console.error("Error fetching product verbiage:", error.message);
      } else if (data) {
        productVerbiageContext = data.verbiageContext;
      }
    }
    // --- END ADDITION 3 ---
    const dynamicExample = generateDynamicExample(stepTypes);
    // --- ADDITION 4: Enhance the prompt with the fetched context ---
    const prompt = `
      You are an expert sales sequence strategist and content writer for Great Plains Communications, specializing in telecommunications sales.
      Your goal is to generate a sales outreach sequence of ${numSteps} steps.
      The overall duration of the sequence should be approximately ${totalDuration} days.
      The primary goal/topic of this sequence is: "${sequenceGoal}".
      
      **CRITICAL INSTRUCTION:** The sequence MUST ONLY include a mix of the following step types: ${stepTypes.join(', ')}. Do not use any other step types.

      ${productVerbiageContext ? `
      **PRODUCT CONTEXT:**
      You MUST strategically incorporate information about the following products into the sequence steps, particularly for email and LinkedIn content. With that said, use caution to not overuse stock verbiage that clouds the intent of the message. Be careful not to duplicate verbiage from sequence step to sequence step.
      ${productVerbiageContext}
      ` : ''}

      **CONTENT INSTRUCTIONS:**
      - For each step, provide a realistic 'delay_days' (days after the previous step, starting with 0 or 1 for the first step).
      - For 'Email' types, provide a concise 'subject' and a compelling 'message'.
      - For 'LinkedIn' types, provide a 'message' for the outreach (e.g., connection request, InMail). The 'subject' should be empty.
      - For 'Call' and 'Task' types, provide a 'message' that describes the action or objective. The 'subject' should be empty.

      Adopt the following persona and voice for all generated content: "${personaPrompt}"

      IMPORTANT: You can use the following placeholders in the 'subject' and 'message' fields for personalization:
      - [FirstName]: The contact's first name.
      - [LastName]: The contact's last name.
      - [AccountName]: The contact's associated account name.

      The output MUST be a raw JSON object with a single key "steps", where the value is an array of step objects.
      Each step object MUST have the following keys: "type" (string), "delay_days" (integer), "subject" (string, can be empty), and "message" (string).

      Example JSON structure:
      ${dynamicExample}
    `;
    // --- All of your original logic below this point remains untouched ---
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_api_key}`;
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "steps": {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  "type": {
                    "type": "STRING"
                  },
                  "delay_days": {
                    "type": "INTEGER"
                  },
                  "subject": {
                    "type": "STRING"
                  },
                  "message": {
                    "type": "STRING"
                  }
                },
                required: [
                  "type",
                  "delay_days",
                  "message"
                ]
              }
            }
          },
          required: [
            "steps"
          ]
        }
      }
    };
    const apiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error(`Google API Error: ${apiResponse.status} ${apiResponse.statusText} - ${errorBody}`);
      throw new Error(`Failed to get response from Gemini API: ${apiResponse.statusText}`);
    }
    const responseJson = await apiResponse.json();
    let extractedText = "";
    if (responseJson.candidates && responseJson.candidates[0].content && responseJson.candidates[0].content.parts && responseJson.candidates[0].content.parts.length > 0) {
      extractedText = responseJson.candidates[0].content.parts[0].text;
    } else {
      if (responseJson.promptFeedback && responseJson.promptFeedback.blockReason) {
        throw new Error(`Gemini API blocked response: ${responseJson.promptFeedback.blockReason}`);
      }
      throw new Error("Gemini API response did not contain expected content or was empty.");
    }
    const parsedStepsData = JSON.parse(extractedText.trim());
    return new Response(JSON.stringify(parsedStepsData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error("Error in Edge Function:", error.message);
    return new Response(JSON.stringify({
      error: `Failed to generate sequence steps: ${error.message}`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
