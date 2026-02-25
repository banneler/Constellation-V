// banneler/constellation-v/Constellation-V-8d825689cc599d5206d1e49b4f0dafe9c5ecc390/js/social_hub.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    formatDate,
    updateActiveNavLink,
    setupUserMenuAndAuth,
    initializeAppState,
    getState,
    loadSVGs,
    setupGlobalSearch,
    updateLastVisited,
    checkAndSetNotifications,
    injectGlobalNavigation
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    injectGlobalNavigation();
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        allPosts: [],
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

    // --- DATA FETCHING ---
    async function loadSocialContent() {
        if (!state.currentUser) return;
        try {
            const { data: posts, error: postsError } = await supabase.from('social_hub_posts').select('*').order('created_at', { ascending: false });
            if (postsError) throw postsError;
            state.allPosts = posts || [];

            const { data: interactions, error: interactionsError } = await supabase.from('user_post_interactions').select('post_id').eq('user_id', getState().effectiveUserId);
            if (interactionsError) throw interactionsError;
            
            state.userInteractions = new Set(interactions.map(i => i.post_id));
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

    async function fetchSuggestedPost(item) {
        if (item.type === 'marketing_post') return item.approved_copy || '';
        const { data, error } = await supabase.functions.invoke('generate-social-post', { body: { article: item } });
        if (error) {
            console.error("Edge function error:", error);
            return "Error generating suggestion. Please write your own or try again.";
        }
        return data?.suggestion || "No suggestion returned. Please write your own.";
    }

    function setCardLoadingState(card, isLoading, message = 'Generating AI post suggestion...') {
        if (!card) return;
        if (isLoading) {
            card.dataset.originalHtml = card.innerHTML;
            card.classList.add('social-card-loading');
            card.innerHTML = `
                <div class="social-card-loading-state">
                    <div class="social-card-loading-spinner" aria-hidden="true"></div>
                    <p class="social-card-loading-title">Preparing Post</p>
                    <p class="social-card-loading-subtitle">${message}</p>
                </div>
            `;
            return;
        }
        if (card.dataset.originalHtml) {
            card.innerHTML = card.dataset.originalHtml;
            delete card.dataset.originalHtml;
        }
        card.classList.remove('social-card-loading');
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

        card.innerHTML = `
            <div class="alert-header"><span class="alert-trigger-type">${triggerType}</span></div>
            <h5 class="alert-headline">${headline} ${dynamicLinkIndicator}</h5>
            <p class="alert-summary"></p>
            <div class="alert-footer">
                <span class="alert-source">Source: <a href="${link}" target="_blank">${sourceName}</a></span>
                <span class="alert-date">${formatDate(item.created_at)}</span>
            </div>
            <div class="alert-actions">
                <button class="btn-primary prepare-post-btn" data-post-id="${item.id}"><i class="fa-solid fa-wand-magic-sparkles"></i><span>Prepare Post</span></button>
                <button class="btn-secondary dismiss-post-btn" data-post-id="${item.id}"><i class="fa-solid fa-xmark"></i><span>Dismiss</span></button>
            </div>
        `;

        const summaryP = card.querySelector('.alert-summary');
        const formattedSummary = summary.replace(/\n/g, '<br>');
        summaryP.innerHTML = formattedSummary;

        const prepareBtn = card.querySelector('.prepare-post-btn');
        const dismissBtn = card.querySelector('.dismiss-post-btn');

        prepareBtn.addEventListener('click', async () => {
            setCardLoadingState(card, true);
            const suggestion = await fetchSuggestedPost(item);
            setCardLoadingState(card, false);
            openPostModal(item, suggestion, '');
        });

        dismissBtn.addEventListener('click', () => handleDismissPost(item.id));
        return card;
    }

    // --- MODAL & ACTION LOGIC ---
    async function openPostModal(item, prefetchedText = null, prefetchedPrompt = '') {
        modalTitle.textContent = item.title;
        modalArticleLink.href = item.link;
        modalArticleLink.textContent = item.link;
        postToLinkedInBtn.dataset.url = item.link;
        customPromptInput.value = prefetchedPrompt || '';

        postTextArea.value = prefetchedText || "Generating AI suggestion...";
        modalBackdrop.classList.remove('hidden');

        if (item.type === 'marketing_post') {
            postTextArea.value = prefetchedText || item.approved_copy; // Use pre-approved copy directly
        } else {
            if (!prefetchedText || prefetchedText === 'Generating AI suggestion...') {
                const suggestion = await fetchSuggestedPost(item);
                postTextArea.value = suggestion;
            }
        }
    }

    function hideModal() { modalBackdrop.classList.add('hidden'); }

    async function handleDismissPost(postId) {
        try {
            await supabase.from('user_post_interactions').insert({ user_id: getState().effectiveUserId, post_id: postId, status: 'dismissed' });
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
                copyTextBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                copyTextBtn.title = 'Copied';
                setTimeout(() => {
                    copyTextBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
                    copyTextBtn.title = 'Copy Text';
                }, 2000);
            });
        });

        postToLinkedInBtn.addEventListener('click', function() {
            const url = this.dataset.url;
            if (!url) return;
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
        });

        // Event listener for the "Refine" button
        generateCustomBtn.addEventListener('click', async () => {
            const originalText = postTextArea.value;
            const customPrompt = customPromptInput.value.trim();
            if (!customPrompt) {
                alert("Please enter a prompt to refine the text.");
                return;
            }

            generateCustomBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Regenerating...</span>';
            generateCustomBtn.disabled = true;

            const { data, error } = await supabase.functions.invoke('refine-social-post', { body: { originalText, customPrompt } });
            
            if (error) {
                alert("Error refining post. Please check the console.");
            } else {
                postTextArea.value = data.suggestion;
                customPromptInput.value = ''; // Clear prompt input
            }

            generateCustomBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>Regenerate</span>';
            generateCustomBtn.disabled = false;
        });
    }

     // --- INITIALIZATION ---
async function initializePage() {
    await loadSVGs();
    const appState = await initializeAppState(supabase);
    if (!appState.currentUser) return;
    state.currentUser = appState.currentUser;
    await setupUserMenuAndAuth(supabase, getState());
    updateActiveNavLink();
    setupPageEventListeners();
    await setupGlobalSearch(supabase, state.currentUser);
    await loadSocialContent();
    window.addEventListener('effectiveUserChanged', loadSocialContent);
    await checkAndSetNotifications(supabase);
    updateLastVisited(supabase, 'social_hub');
}
initializePage();
});
