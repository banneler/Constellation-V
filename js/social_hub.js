// js/social_hub.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    updateActiveNavLink,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
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

            const { data: interactions, error: interactionsError } = await supabase.from('user_post_interactions').select('post_id').eq('user_id', state.currentUser.id);
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
        
        if (aiArticles.length === 0) { aiContainer.innerHTML = `<p class="placeholder-text">No new articles found.</p>`; } 
        else { aiArticles.forEach(item => aiContainer.appendChild(createSocialCard(item))); }

        if (marketingPosts.length === 0) { marketingContainer.innerHTML = `<p class="placeholder-text">No new posts from the marketing team.</p>`; }
        else { marketingPosts.forEach(item => marketingContainer.appendChild(createSocialCard(item))); }
    }

    function createSocialCard(item) {
    // This is the main card container
    const card = document.createElement('div');
    // --- THIS IS THE FIX ---
    // We are changing 'alert-card' to a new, unique class: 'social-post-card'
    card.className = 'social-post-card'; 
    card.dataset.postId = item.id;

    // Header for the card
    const header = document.createElement('div');
    header.className = 'social-post-header';

    const platformIcon = document.createElement('i');
    platformIcon.className = `fa-brands fa-${item.platform.toLowerCase()}`;
    header.appendChild(platformIcon);

    const postDate = document.createElement('span');
    postDate.className = 'social-post-date';
    postDate.textContent = new Date(item.created_at).toLocaleDateString();
    header.appendChild(postDate);

    card.appendChild(header);

    // Body of the card
    const body = document.createElement('div');
    body.className = 'social-post-body';
    body.textContent = item.content;
    card.appendChild(body);

    // Footer with action buttons
    const footer = document.createElement('div');
    footer.className = 'social-post-footer';

    const editButton = document.createElement('button');
    editButton.className = 'btn-secondary';
    editButton.innerHTML = '<i class="fa-solid fa-pencil"></i>';
    editButton.onclick = () => openEditModal(item);
    footer.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-danger';
    deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    deleteButton.onclick = () => deletePost(item.id);
    footer.appendChild(deleteButton);

    card.appendChild(footer);

    return card;
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
        modalBackdrop.addEventListener('click', (event) => {
            if (event.target === modalBackdrop) hideModal();
        });

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
        await loadSVGs(); // Call this first to load icons
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            await setupUserMenuAndAuth(supabase, state);
            updateActiveNavLink();
            setupPageEventListeners();
            await loadSocialContent();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
