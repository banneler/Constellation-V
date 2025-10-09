import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    showModal,
    hideModal,
    setupUserMenuAndAuth,
    loadSVGs,
    // Note: Removed unused imports like updateActiveNavLink
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        allPosts: [],
        products: [],
        userInteractions: new Set()
    };
    
    // --- DOM SELECTORS ---
    const marketingContainer = document.getElementById('marketing-posts-container');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalTitle = document.getElementById('modal-title');
    const aiProductPostBtn = document.getElementById('ai-product-post-btn');

    // --- DATA FETCHING ---
    async function loadSocialContent() {
        if (!state.currentUser) return;
        try {
            // Only fetch marketing posts now
            const { data: posts, error: postsError } = await supabase.from('social_hub_posts').select('*').eq('type', 'marketing_post').order('created_at', { ascending: false });
            if (postsError) throw postsError;
            state.allPosts = posts || [];

            const { data: interactions, error: interactionsError } = await supabase.from('user_post_interactions').select('post_id').eq('user_id', state.currentUser.id);
            if (interactionsError) throw interactionsError;
            state.userInteractions = new Set(interactions.map(i => i.post_id));

            const { data: productData, error: productError } = await supabase.from('product_knowledge').select('product_name');
            if (productError) throw productError;
            state.products = [...new Set(productData.map(p => p.product_name))].sort();

            renderSocialContent();
        } catch (error) {
            console.error("Error fetching Social Hub content:", error);
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderSocialContent() {
        marketingContainer.innerHTML = '';
        const visiblePosts = state.allPosts.filter(post => !state.userInteractions.has(post.id));
        
        if (visiblePosts.length === 0) {
            marketingContainer.innerHTML = `<p class="placeholder-text">The marketing team is busy creating content. Stay tuned for new posts!</p>`;
        } else {
            visiblePosts.forEach(item => marketingContainer.appendChild(createSocialCard(item)));
        }
    }

    function createSocialCard(item) {
        const card = document.createElement('div');
        card.className = 'alert-card';
        card.id = `post-card-${item.id}`;

        card.innerHTML = `
            <div class="alert-header"><span class="alert-trigger-type">Campaign Asset</span></div>
            <h5 class="alert-headline">${item.title} ${item.is_dynamic_link ? '<span class="dynamic-link-indicator">✨</span>' : ''}</h5>
            <p class="alert-summary">${(item.summary || item.approved_copy).replace(/\n/g, '<br>')}</p>
            <div class="alert-footer">
                <span class="alert-source">Source: <a href="${item.link}" target="_blank">Marketing Team</a></span>
                <span class="alert-date">${formatDate(item.created_at)}</span>
            </div>
            <div class="alert-actions">
                <button class="btn-secondary dismiss-post-btn" data-post-id="${item.id}">Dismiss</button>
                <button class="btn-primary prepare-post-btn" data-post-id="${item.id}">Prepare Post</button>
            </div>
        `;
        
        card.querySelector('.prepare-post-btn').addEventListener('click', () => openPostModal(item));
        card.querySelector('.dismiss-post-btn').addEventListener('click', () => handleDismissPost(item.id));
        return card;
    }

    async function showAIProductPostModal() {
        const productCheckboxes = state.products.map(product => `
            <div style="display: flex; align-items: center; margin-bottom: 12px; padding: 0;">
                <input type="checkbox" id="social-prod-${product.replace(/\s+/g, '-')}" class="ai-product-checkbox" value="${product}" style="margin: 0 8px 0 0; width: auto; height: auto;">
                <label for="social-prod-${product.replace(/\s+/g, '-')}" style="margin: 0; padding: 0; font-weight: normal;">${product}</label>
            </div>
        `).join('');

        const industries = ['General', 'Healthcare', 'Financial', 'Retail', 'Manufacturing', 'K-12 Education'];
        const industryOptions = industries.map(ind => `<option value="${ind}">${ind}</option>`).join('');

        const modalBody = `
            <div id="ai-custom-post-prompt-container">
                <label style="font-weight: 600;">Post Goal/Topic:</label>
                <textarea id="ai-post-prompt" rows="3" placeholder="e.g., 'Announce a new feature for Managed Wi-Fi'"></textarea>
                <div style="margin-top: 1.5rem;">
                    <div style="border: none; padding: 0; margin: 0;">
                        <p style="font-weight: 600; margin-bottom: 12px;">Include Product Info</p>
                        ${productCheckboxes}
                    </div>
                    <div style="margin-top: 20px;">
                        <label for="ai-industry-select" style="font-weight: 600; display: block; margin-bottom: 10px;">Target Industry</label>
                        <select id="ai-industry-select">${industryOptions}</select>
                    </div>
                </div>
            </div>
        `;

        showModal('Create Custom Product Post', modalBody, generateProductPostWithAI, true, `<button id="modal-confirm-btn" class="btn-primary">Generate Post</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }

    async function generateProductPostWithAI() {
        const userPrompt = document.getElementById('ai-post-prompt').value;
        if (!userPrompt) {
            alert("Please enter a prompt for the post topic.");
            return false;
        }

        const selectedProducts = Array.from(document.querySelectorAll('.ai-product-checkbox:checked')).map(cb => cb.value);
        const selectedIndustry = document.getElementById('ai-industry-select').value;
        
        const modalBody = document.getElementById('modal-body');
        const modalActions = document.getElementById('modal-actions');
        modalBody.innerHTML = `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">AI is drafting your post...</p>`;
        modalActions.innerHTML = ''; 

        try {
            const { data, error } = await supabase.functions.invoke('custom-user-social-post', {
                body: { userPrompt, product_names: selectedProducts, industry: selectedIndustry }
            });

            if (error) throw error;
            hideModal();
            
            const generatedPost = {
                title: "AI-Generated Custom Post",
                link: "https://gpcom.com/business/#products-services",
                approved_copy: `${data.post_body}\n\n${data.hashtags}`,
                isPreGenerated: true
            };
            openPostModal(generatedPost);

        } catch (error) {
            console.error("Error generating custom post:", error);
            hideModal();
            alert("Sorry, there was an error generating the post. Please try again.");
        }
        
        return false;
    }

    async function openPostModal(item) {
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const modalActions = document.getElementById('modal-actions');

        modalTitle.textContent = item.title;

        modalBody.innerHTML = `
            <p style="margin-bottom: 15px;"><strong>Sharing Link:</strong> <a id="modal-article-link" href="${item.link}" target="_blank" rel="noopener noreferrer">${item.link}</a></p>
            <label for="post-text">Post Text:</label>
            <textarea id="post-text" rows="8"></textarea>
        `;
        document.getElementById('post-text').value = item.approved_copy;

        modalActions.innerHTML = `
            <button id="copy-text-btn-result" class="btn-secondary">Copy Text</button>
            <button id="post-to-linkedin-btn-result" class="btn-primary">Post to LinkedIn</button>
            <button id="modal-close-btn-result" class="btn-secondary">Close</button>
        `;

        document.getElementById('copy-text-btn-result').addEventListener('click', () => {
            navigator.clipboard.writeText(document.getElementById('post-text').value);
            // Visual feedback for copy
        });
        document.getElementById('post-to-linkedin-btn-result').addEventListener('click', () => {
             window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(item.link)}`, '_blank', 'noopener,noreferrer');
        });
        document.getElementById('modal-close-btn-result').addEventListener('click', hideModal);

        modalBackdrop.classList.remove('hidden');
    }

    async function handleDismissPost(postId) {
        try {
            await supabase.from('user_post_interactions').insert({ user_id: state.currentUser.id, post_id: postId, status: 'dismissed' });
            const cardToRemove = document.getElementById(`post-card-${postId}`);
            if (cardToRemove) {
                cardToRemove.style.transition = 'opacity 0.5s';
                cardToRemove.style.opacity = '0';
                setTimeout(() => cardToRemove.remove(), 500);
            }
            state.userInteractions.add(postId);
        } catch (error) {
            console.error("Error dismissing post:", error);
            alert("Could not dismiss the post. Please try again.");
        }
    }

    function setupPageEventListeners() {
        if (aiProductPostBtn) {
            aiProductPostBtn.addEventListener('click', showAIProductPostModal);
        }
    }

    async function initializePage() {
        await loadSVGs();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            await setupUserMenuAndAuth(supabase, state);
            setupPageEventListeners();
            await loadSocialContent(); 
        } else {
            window.location.href = "index.html";
        }
    }
    initializePage();
});
