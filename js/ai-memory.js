export async function callAiApi(supabase, routeName, body) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const token = sessionData?.session?.access_token;
    if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
    }

    const response = await fetch(`/api/ai/${routeName}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {})
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `AI request failed with status ${response.status}.`);
    }

    return data;
}

export async function createPersonalContext(supabase, { userId, prompt, response }) {
    if (!userId || !prompt || !response) return null;

    const { data, error } = await supabase
        .from('personal_context')
        .insert({
            user_id: userId,
            prompt,
            response,
            processed: false
        })
        .select('id')
        .single();

    if (error) {
        console.error('Unable to create Personal Context row:', error);
        return null;
    }

    return data?.id || null;
}

export function renderAIFeedback(contextId, label = 'Was this AI response useful?') {
    if (!contextId) return '';

    return `
        <div class="ai-feedback" data-context-id="${contextId}" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-color);">
            <label style="display: block; margin-bottom: 8px;">${escapeHtml(label)}</label>
            <div class="ai-feedback-rating" role="group" aria-label="AI response rating" style="display: flex; gap: 6px; margin-bottom: 8px;">
                ${[1, 2, 3, 4, 5].map((rating) => `
                    <button type="button" class="btn-secondary ai-feedback-rating-btn" data-rating="${rating}" title="${rating} out of 5">${rating}</button>
                `).join('')}
            </div>
            <textarea class="ai-feedback-text" rows="3" placeholder="Optional feedback to improve future AI responses..."></textarea>
            <button type="button" class="btn-primary ai-feedback-submit" style="width: 100%; margin-top: 8px;">Submit Feedback</button>
            <p class="ai-feedback-status placeholder-text" aria-live="polite" style="margin-top: 8px;"></p>
        </div>
    `;
}

export function attachAIFeedbackHandler(root, supabase) {
    if (!root) return;

    root.querySelectorAll('.ai-feedback').forEach((feedbackEl) => {
        if (feedbackEl.dataset.feedbackBound === 'true') return;
        feedbackEl.dataset.feedbackBound = 'true';

        let selectedRating = null;
        const statusEl = feedbackEl.querySelector('.ai-feedback-status');
        const submitBtn = feedbackEl.querySelector('.ai-feedback-submit');

        feedbackEl.querySelectorAll('.ai-feedback-rating-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                selectedRating = Number(btn.dataset.rating);
                feedbackEl.querySelectorAll('.ai-feedback-rating-btn').forEach((ratingBtn) => {
                    ratingBtn.classList.toggle('btn-primary', ratingBtn === btn);
                    ratingBtn.classList.toggle('btn-secondary', ratingBtn !== btn);
                });
                if (statusEl) statusEl.textContent = '';
            });
        });

        submitBtn?.addEventListener('click', async () => {
            const contextId = feedbackEl.dataset.contextId;
            const feedback = feedbackEl.querySelector('.ai-feedback-text')?.value?.trim() || null;

            if (!contextId) {
                if (statusEl) statusEl.textContent = 'Feedback cannot be saved for this response.';
                return;
            }
            if (!selectedRating) {
                if (statusEl) statusEl.textContent = 'Select a rating before submitting.';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving...';

            const { error } = await supabase
                .from('personal_context')
                .update({ rating: selectedRating, feedback })
                .eq('id', contextId);

            if (error) {
                console.error('Unable to save AI feedback:', error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Feedback';
                if (statusEl) statusEl.textContent = 'Unable to save feedback. Please try again.';
                return;
            }

            feedbackEl.querySelectorAll('button, textarea').forEach((el) => {
                el.disabled = true;
            });
            if (statusEl) statusEl.textContent = 'Thanks. Your feedback will improve future AI responses.';
        });
    });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
