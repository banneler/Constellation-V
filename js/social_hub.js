// js/social_hub.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    updateActiveNavLink,
    setupUserMenuAndAuth
} from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        allPosts: [], // Will hold all posts from the DB
        userInteractions: new Set() // Will hold IDs of posts the user has dismissed
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

    // --- DATA FETCHING ---
    async function loadSocialContent() {
        if (!state.currentUser) return;

        try {
            console.log("Fetching data from Supabase...");

            // 1. Fetch all posts from the Social Hub table
            const { data: posts, error: postsError } = await supabase
                .from('social_hub_posts')
                .select('*')
                .order('created_at', { ascending: false });

            if (postsError) throw postsError;
            state.allPosts = posts || [];

            // 2. Fetch all of the current user's interactions
            const { data: interactions, error: interactionsError } = await supabase
                .from('user_post_interactions')
                .select('post_id')
                .eq('user_id', state.currentUser.id);
            
            if (interactionsError) throw interactionsError;
            
            // Store the IDs of interacted posts in a Set for quick lookups
            state.userInteractions = new Set(interactions.map(i => i.post_id));
            
            console.log(`Found ${state.allPosts.length} total posts.`);
            console.log(`User has interacted with ${state.userInteractions.size} posts.`);

            renderSocialContent();

        } catch (error) {
            console.error("Error fetching Social Hub content:", error);
            aiContainer.innerHTML = `<p class="placeholder-text">Error loading content. Please check the console.</p>`;
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderSocialContent() {
        aiContainer.innerHTML = '';
        marketingContainer.innerHTML = '';

        // Filter out posts that the user has already interacted with
        const visiblePosts = state.allPosts.filter(post => !state.userInteractions.has(post.id));

        const aiArticles = visiblePosts.filter(p => p.type === 'ai_article');
        const marketingPosts = visiblePosts.filter(p => p.type === 'marketing_post');
        
        if (aiArticles.length === 0) {
            aiContainer.innerHTML = `<p class="placeholder-text">No new articles found.</p>`;
        } else {
            aiArticles.forEach(item => aiContainer.appendChild(createSocialCard(item)));
        }

        if (marketingPosts.length === 0) {
            marketingContainer.innerHTML = `<p class="placeholder-text">No new posts from the marketing team.</p>`;
        } else {
            marketingPosts.forEach(item => marketingContainer.appendChild(createSocialCard(item)));
        }
    }

    function createSocialCard(item) {
        const headline = item.title;
        const link = item.link;
        const summary = item.summary || item.approved_copy;
        const sourceName = item.source_name || 'Marketing Team';
        const triggerType = item.type === 'marketing_post' ? 'Campaign Asset' : 'News Article';

        const dynamicLinkIndicator = item.is_dynamic_link
            ? `<span class="dynamic-link-indicator" title="This link will generate a rich preview on LinkedIn">✨</span>`
            : '';

        const card = document.createElement('div');
        card.className = 'alert-card';
        card.id = `post-card-${item.id}`; // Add an ID to the card for easy removal

        card.innerHTML = `
            <div class="alert-header">
                <span class="alert-trigger-type">${triggerType}</span>
            </div>
            <h5 class="alert-headline">${headline} ${dynamicLinkIndicator}</h5>
            <p class="alert-summary">${summary}</p>
            <div class="alert-footer">
                <span class="alert-source">Source: <a href="${link}" target="_blank">${sourceName}</a></span>
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

    // --- MODAL & ACTION LOGIC ---
    function openPostModal(item) {
        modalTitle.textContent = item.title;
        modalArticleLink.href = item.link;
        modalArticleLink.textContent = item.link;
        
        postTextArea.value = item.approved_copy || `Sharing an interesting article from ${item.source_name}:\n\n"${item.summary}"\n\n#NebraskaTech #Telecommunications`;

        postToLinkedInBtn.dataset.url = item.link;
        modalBackdrop.classList.remove('hidden');
    }

    function hideModal() {
        modalBackdrop.classList.add('hidden');
    }

    async function handleDismissPost(postId) {
        try {
            // Add a record to the user_post_interactions table
            const { error } = await supabase.from('user_post_interactions').insert({
                user_id: state.currentUser.id,
                post_id: postId,
                status: 'dismissed'
            });

            if (error) {
                // Handle potential unique constraint violation gracefully (e.g., user double-clicks)
                if (error.code === '23505') { // Unique violation code for PostgreSQL
                    console.log("Interaction already logged for this post.");
                } else {
                    throw error;
                }
            }

            // Visually remove the card from the UI
            const cardToRemove = document.getElementById(`post-card-${postId}`);
            if (cardToRemove) {
                cardToRemove.style.transition = 'opacity 0.5s';
                cardToRemove.style.opacity = '0';
                setTimeout(() => cardToRemove.remove(), 500);
            }
            
            // Add the post ID to our local state to prevent re-rendering if data is re-loaded
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
            if (event.target === modalBackdrop) {
                hideModal();
            }
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
            const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            window.open(linkedInUrl, '_blank', 'noopener,noreferrer');
        });
    }

    // --- INITIALIZATION ---
    async function initializePage() {
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
