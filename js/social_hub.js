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
        aiArticles: [],
        marketingPosts: []
    };
    
    // --- MOCK DATA (to be replaced with API calls to your Mac mini server) ---
    const mockAiArticles = [
        {
            type: 'ai',
            title: "Nebraska Announces New $50M Tech Startup Fund",
            url: "https://www.nebraska-tech-news.com/story1",
            source: "Nebraska Tech News",
            summary: "A new state-backed initiative aims to bolster the local tech ecosystem by providing seed funding to promising startups in the telecommunications and agriculture tech sectors."
        },
        {
            type: 'ai',
            title: "Omaha-Based FiberNet Completes City-Wide Network Upgrade",
            url: "https://www.telecom-journal.net/omaha-fibernet",
            source: "Telecom Journal",
            summary: "FiberNet has successfully finished its multi-year project to bring 10-gigabit fiber optic internet access to every neighborhood in Omaha."
        }
    ];

    const mockMarketingPosts = [
        {
            type: 'marketing',
            title: "We're Hiring! Join Our Innovative Engineering Team",
            link: "https://www.constellation-careers.com/engineering",
            approvedCopy: "Ready to build the future of telecommunications? We're looking for passionate engineers to join our growing team. Make your mark on the industry. #Hiring #NebraskaJobs #TechCareers #Engineering"
        }
    ];

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
        // TODO: Replace mock data with fetch calls to your local server
        // Example: const response = await fetch('http://your-mac-mini-ip/ai-articles');
        state.aiArticles = mockAiArticles;
        state.marketingPosts = mockMarketingPosts;

        renderSocialContent();
    }

    // --- RENDER FUNCTIONS ---
    function renderSocialContent() {
        aiContainer.innerHTML = '';
        marketingContainer.innerHTML = '';

        if (state.aiArticles.length === 0) {
            aiContainer.innerHTML = `<p class="placeholder-text">No new articles found by the scraper.</p>`;
        } else {
            state.aiArticles.forEach(item => aiContainer.appendChild(createSocialCard(item)));
        }

        if (state.marketingPosts.length === 0) {
            marketingContainer.innerHTML = `<p class="placeholder-text">No new posts from the marketing team.</p>`;
        } else {
            state.marketingPosts.forEach(item => marketingContainer.appendChild(createSocialCard(item)));
        }
    }

    function createSocialCard(item) {
        const isMarketing = item.type === 'marketing';
        const headline = item.title;
        const link = item.url || item.link;
        const summary = isMarketing ? item.approvedCopy : item.summary;
        const sourceName = isMarketing ? 'Marketing Team' : item.source;
        const triggerType = isMarketing ? 'Campaign Asset' : 'News Article';

        const card = document.createElement('div');
        card.className = 'alert-card'; // Reusing your existing CSS class for consistency

        card.innerHTML = `
            <div class="alert-header">
                <span class="alert-trigger-type">${triggerType}</span>
            </div>
            <h5 class="alert-headline">${headline}</h5>
            <p class="alert-summary">${summary}</p>
            <div class="alert-footer">
                <span class="alert-source">Source: <a href="${link}" target="_blank">${sourceName}</a></span>
            </div>
            <div class="alert-actions">
                <button class="btn-primary prepare-post-btn">Prepare Post</button>
            </div>
        `;

        card.querySelector('.prepare-post-btn').addEventListener('click', () => {
            openPostModal(item);
        });
        
        return card;
    }

    // --- MODAL LOGIC ---
    function openPostModal(item) {
        const isMarketing = item.type === 'marketing';
        const link = item.url || item.link;
        
        modalTitle.textContent = item.title;
        modalArticleLink.href = link;
        modalArticleLink.textContent = link;
        
        postTextArea.value = isMarketing 
            ? item.approvedCopy 
            : `Sharing an interesting article from ${item.source}:\n\n"${item.summary}"\n\n#NebraskaTech #Telecommunications`;

        postToLinkedInBtn.dataset.url = link;
        modalBackdrop.classList.remove('hidden');
    }

    function hideModal() {
        modalBackdrop.classList.add('hidden');
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
                const originalText = copyTextBtn.textContent;
                copyTextBtn.textContent = 'Copied!';
                setTimeout(() => { copyTextBtn.textContent = originalText; }, 2000);
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
            await setupUserMenuAndAuth(supabase, state); // From shared_constants.js
            updateActiveNavLink(); // From shared_constants.js
            setupPageEventListeners();
            await loadSocialContent();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
