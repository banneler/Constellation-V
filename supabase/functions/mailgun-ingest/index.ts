// supabase/functions/mailgun-ingest/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Helper function to verify the request is from Mailgun
async function verifyMailgunRequest(key, token, timestamp, signature) {
  const encoder = new TextEncoder();
  const data = encoder.encode(timestamp + token);
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), {
    name: 'HMAC',
    hash: 'SHA-256',
  }, false, [
    'sign'
  ]);
  const signatureArrayBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const signatureHex = Array.from(new Uint8Array(signatureArrayBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatureHex === signature;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method Not Allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const mailgunSigningKey = Deno.env.get('MAILGUN_WEBHOOK_KEY');
    const formData = await req.formData();
    const signature = formData.get('signature');
    const token = formData.get('token');
    const timestamp = formData.get('timestamp');

    if (!signature || !token || !timestamp || !mailgunSigningKey) {
      throw new Error('Missing authentication data or environment variable.');
    }

    const isAuthentic = await verifyMailgunRequest(mailgunSigningKey, token.toString(), timestamp.toString(), signature.toString());
    if (!isAuthentic) {
      return new Response(JSON.stringify({
        error: 'Forbidden: Invalid signature'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
      global: {
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
      },
    });

    // --- Handle Attachments ---
    const contentIdMapString = formData.get('content-id-map')?.toString() || '{}';
    const contentIdMap = JSON.parse(contentIdMapString);
    const inlineAttachmentKeys = new Set(Object.values(contentIdMap));
    const attachments = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('attachment-') && value instanceof File) {
        if (inlineAttachmentKeys.has(key)) {
          console.log(`Skipping inline attachment: ${value.name} (key: ${key})`);
          continue;
        }

        const messageId = formData.get('Message-Id')?.toString().replace(/[<>]/g, '');
        if (!messageId) {
          console.error('Message-Id not found, skipping attachment upload.');
          continue;
        }

        const filePath = `mailgun-attachments/${messageId}/${value.name}`;
        const { error: uploadError } = await supabaseClient.storage.from('email-attachments').upload(filePath, value, {
          contentType: value.type,
        });

        if (uploadError) {
          console.error(`Error uploading file ${value.name}:`, uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabaseClient.storage.from('email-attachments').getPublicUrl(filePath);
        attachments.push({
          fileName: value.name,
          url: publicUrl,
        });
      }
    }

    // --- DATABASE LOGGING (Corrected & Hardened) ---
    const toHeader = formData.get('To')?.toString() || '';
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6})/gi;
    const recipientsWithDuplicates = toHeader.match(emailRegex) || [];

    // De-duplicate and normalize the recipients array using a Set
    const recipients = [
      ...new Set(recipientsWithDuplicates.map((email) => email.toLowerCase().trim())),
    ];

    if (recipients.length > 0) {
      const logEntries = recipients.map((recipientEmail) => ({
        sender: formData.get('sender'),
        recipient: recipientEmail, // Already normalized
        subject: formData.get('subject'),
        body_text: formData.get('body-plain'),
        message_id: formData.get('Message-Id'),
        attachments,
      }));
      
      // FINAL FIX: Use the 'ignoreDuplicates' option to handle conflicts.
      // This is the correct syntax for the supabase-js v2 library.
      const { error } = await supabaseClient
        .from('email_log')
        .insert(logEntries, { ignoreDuplicates: true });

      if (error) {
        // This error will now only be for unexpected database issues.
        throw error;
      }
    } else {
      console.warn("No recipients found in 'To' header. Skipping email log insert.");
    }
    
    return new Response(JSON.stringify({
      status: 'ok'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    let errorMessage = 'An unknown error occurred.';
    if (err && typeof err === 'object' && 'message' in err) {
      errorMessage = String(err.message);
    }
    console.error(`Function failed. Error: ${errorMessage}`);
    console.error('Full error details:', JSON.stringify(err, null, 2));

    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      details: errorMessage
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});