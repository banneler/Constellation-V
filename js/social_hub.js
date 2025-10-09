// banneler/constellation-v/Constellation-V-8d825689cc599d5206d1e49b4f0dafe9c5ecc390/js/social_hub.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate, // Import formatDate
    showModal,
    updateActiveNavLink,
    setupUserMenuAndAuth,
    loadSVGs,
    setupGlobalSearch,
    updateLastVisited,
    checkAndSetNotifications
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        allPosts: [],
        products: [], // <-- ADD THIS
        userInteractions: new Set()
    };
    
    // --- DOM SELECTORS ---
    const aiContainer = document.getElementById('ai-articles-container');
    const marketingContainer = document.getElementById('marketing-posts-container');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalTitle = document.getElementById('modal-title');
    const modalArticleLink = document.getElementById('modal-article-link');
    const postTextArea = document.getElementById('post-text');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const postToLinkedInBtn = document.getElementById('post-to-linkedin-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const customPromptInput = document.getElementById('custom-prompt-input');
    const generateCustomBtn = document.getElementById('generate-custom-btn');
    const aiProductPostBtn = document.getElementById('ai-product-post-btn');

    // --- DATA FETCHING ---
   async function loadSocialContent() {
    if (!state.currentUser) return;
    try {
        const { data: posts, error: postsError } = await supabase.from('social_hub_posts').select('*').order('created_at', { ascending: false });
        if (postsError) throw postsError;
        state.allPosts = posts || [];

        const { data: interactions, error: interactionsError } = await supabase.from('user_post_interactions').select('post_id').eq('user_id', state.currentUser.id);
        if (interactionsError) throw interactionsError;
        state.userInteractions = new Set(interactions.map(i => i.post_id));

        // Fetch product data
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
        aiContainer.innerHTML = '';
        marketingContainer.innerHTML = '';
        const visiblePosts = state.allPosts.filter(post => !state.userInteractions.has(post.id));
        const aiArticles = visiblePosts.filter(p => p.type === 'ai_article');
        const marketingPosts = visiblePosts.filter(p => p.type === 'marketing_post');
        
        if (aiArticles.length === 0) { aiContainer.innerHTML = `<p class="placeholder-text">Cognito is searching for relevant articles. Check back soon!</p>`; } 
        else { aiArticles.forEach(item => aiContainer.appendChild(createSocialCard(item))); }

        if (marketingPosts.length === 0) { marketingContainer.innerHTML = `<p class="placeholder-text">The marketing team is busy creating content. Stay tuned for new posts!</p>`; }
        else { marketingPosts.forEach(item => marketingContainer.appendChild(createSocialCard(item))); }
    }

    function createSocialCard(item) {
        const headline = item.title;
        const link = item.link;
        const summary = item.summary || item.approved_copy;
        const sourceName = item.source_name || 'Marketing Team';
        const triggerType = item.type === 'marketing_post' ? 'Campaign Asset' : 'News Article';
        const dynamicLinkIndicator = item.is_dynamic_link ? `<span class="dynamic-link-indicator" title="This link will generate a rich preview on LinkedIn">✨</span>` : '';

        const card = document.createElement('div');
        card.className = 'alert-card';
        card.id = `post-card-${item.id}`;

        // Create the card structure but leave the summary paragraph empty for now
        card.innerHTML = `
            <div class="alert-header"><span class="alert-trigger-type">${triggerType}</span></div>
            <h5 class="alert-headline">${headline} ${dynamicLinkIndicator}</h5>
            <p class="alert-summary"></p> 
            <div class="alert-footer">
                <span class="alert-source">Source: <a href="${link}" target="_blank">${sourceName}</a></span>
                <span class="alert-date">${formatDate(item.created_at)}</span>
            </div>
            <div class="alert-actions">
                <button class="btn-secondary dismiss-post-btn" data-post-id="${item.id}">Dismiss</button>
                <button class="btn-primary prepare-post-btn" data-post-id="${item.id}">Prepare Post</button>
            </div>
        `;

        // --- THIS IS THE FIX ---
        // Find the empty summary paragraph.
        const summaryP = card.querySelector('.alert-summary');
        // Replace newline characters (\n) with HTML line break tags (<br>)
        const formattedSummary = summary.replace(/\n/g, '<br>');
        // Set the innerHTML with the formatted text.
        summaryP.innerHTML = formattedSummary;

        // Re-attach event listeners
        card.querySelector('.prepare-post-btn').addEventListener('click', () => openPostModal(item));
        card.querySelector('.dismiss-post-btn').addEventListener('click', () => handleDismissPost(item.id));
        return card;
    }
async function showAIProductPostModal() {
    // Re-use the inline style technique for a guaranteed layout
    const productCheckboxes = state.products.map(product => `
        <div style="display: flex; align-items: center; margin-bottom: 12px; padding: 0;">
            <input 
                type="checkbox" 
                id="social-prod-${product.replace(/\s+/g, '-')}" 
                class="ai-product-checkbox" 
                value="${product}" 
                style="margin: 0 8px 0 0; width: auto; height: auto;"
            >
            <label 
                for="social-prod-${product.replace(/\s+/g, '-')}" 
                style="margin: 0; padding: 0; font-weight: normal;"
            >
                ${product}
            </label>
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
                    <select id="ai-industry-select">
                        ${industryOptions}
                    </select>
                </div>
            </div>
        </div>
    `;

    // We will pass the generation logic as the onConfirm callback
    showModal(
        `Create Custom Product Post`,
        modalBody,
        generateProductPostWithAI, // Pass the function reference here
        true,
        `<button id="modal-confirm-btn" class="btn-primary">Generate Post</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`
    );
}

async function generateProductPostWithAI() {
    const userPrompt = document.getElementById('ai-post-prompt').value;
    if (!userPrompt) {
        alert("Please enter a prompt for the post topic.");
        return false; // Prevent modal from closing
    }

    const selectedProducts = Array.from(document.querySelectorAll('.ai-product-checkbox:checked')).map(cb => cb.value);
    const selectedIndustry = document.getElementById('ai-industry-select').value;
    
    // Show a temporary loading state in the main modal
    const modalBody = document.getElementById('modal-body');
    const modalActions = document.getElementById('modal-actions');
    modalBody.innerHTML = `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">AI is drafting your post...</p>`;
    modalActions.innerHTML = ''; // Hide buttons during generation

    try {
        const { data, error } = await supabase.functions.invoke('custom-user-social-post', {
            body: {
                userPrompt,
                product_names: selectedProducts,
                industry: selectedIndustry
            }
        });

        if (error) throw error;

        // Hide the generation modal
        hideModal();
        
        // Re-use the existing post modal to show the results!
        const generatedPost = {
            title: "AI-Generated Custom Post",
            link: "https://gpcom.com", // A placeholder link
            approved_copy: `${data.post_body}\n\n${data.hashtags}`,
            type: 'marketing_post' // Treat it like a marketing post for the modal's logic
        };
        openPostModal(generatedPost);

    } catch (error) {
        console.error("Error generating custom post:", error);
        // If it fails, just hide the modal. The user can try again.
        hideModal();
        alert("Sorry, there was an error generating the post. Please try again.");
    }
    
    return false; // We handle all modal closing manually, so return false.
}
    // --- MODAL & ACTION LOGIC ---
    async function openPostModal(item) {
        modalTitle.textContent = item.title;
        modalArticleLink.href = item.link;
        modalArticleLink.textContent = item.link;
        postToLinkedInBtn.dataset.url = item.link;

        postTextArea.value = "Generating AI suggestion...";
        modalBackdrop.classList.remove('hidden');

        if (item.type === 'marketing_post') {
            postTextArea.value = item.approved_copy; // Use pre-approved copy directly
        } else {
            // Call the Edge Function to get an initial suggestion
            const { data, error } = await supabase.functions.invoke('generate-social-post', { body: { article: item } });
            if (error) {
                postTextArea.value = "Error generating suggestion. Please write your own or try again.";
                console.error("Edge function error:", error);
            } else {
                postTextArea.value = data.suggestion;
            }
        }
    }

    function hideModal() { modalBackdrop.classList.add('hidden'); }

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

    // --- EVENT LISTENER SETUP ---
    function setupPageEventListeners() {
        modalCloseBtn.addEventListener('click', hideModal);
    
        copyTextBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(postTextArea.value).then(() => {
                copyTextBtn.textContent = 'Copied!';
                setTimeout(() => { copyTextBtn.textContent = 'Copy Text'; }, 2000);
            });
        });

        postToLinkedInBtn.addEventListener('click', function() {
            const url = this.dataset.url;
            if (!url) return;
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
        });
if (aiProductPostBtn) {
        aiProductPostBtn.addEventListener('click', showAIProductPostModal);
    }
        // Event listener for the "Refine" button
        generateCustomBtn.addEventListener('click', async () => {
            const originalText = postTextArea.value;
            const customPrompt = customPromptInput.value.trim();
            if (!customPrompt) {
                alert("Please enter a prompt to refine the text.");
                return;
            }

            generateCustomBtn.textContent = 'Regenerating...';
            generateCustomBtn.disabled = true;

            const { data, error } = await supabase.functions.invoke('refine-social-post', { body: { originalText, customPrompt } });
            
            if (error) {
                alert("Error refining post. Please check the console.");
            } else {
                postTextArea.value = data.suggestion;
                customPromptInput.value = ''; // Clear prompt input
            }

            generateCustomBtn.textContent = 'Regenerate';
            generateCustomBtn.disabled = false;
        });
    }

     // --- INITIALIZATION ---
async function initializePage() {
    await loadSVGs();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        state.currentUser = session.user;
        await setupUserMenuAndAuth(supabase, state);
        updateActiveNavLink();
        setupPageEventListeners();
        await setupGlobalSearch(supabase, state.currentUser);
        await loadSocialContent(); 

        // NUKE-LEVEL FIX: Await the check, THEN update the visit time.
        await checkAndSetNotifications(supabase); 
        updateLastVisited(supabase, 'social_hub'); 
    } else {
        window.location.href = "index.html";
    }
}
initializePage();
});
