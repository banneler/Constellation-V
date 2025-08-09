/**
 * user-guide.js
 * This script creates a Single Page Application (SPA) experience for the User Guide.
 * It dynamically renders content into the main area based on sidebar navigation,
 * mimicking the functionality of other hub pages like marketing-hub.html.
 */
document.addEventListener('DOMContentLoaded', function() {
    // Essential DOM elements for the SPA functionality
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');

    // Pre-flight checks to ensure the page structure is correct
    if (!sidebar || !mainContent) {
        console.error("Required elements (sidebar or main-content) not found. User guide SPA cannot initialize.");
        return;
    }

    // Navigation links for the user guide sidebar
    const userGuideNavLinks = [
        { id: 'introduction', name: 'Introduction', icon: 'fa-book-open' },
        { id: 'command-center', name: 'Command Center', icon: 'fa-rocket' },
        { id: 'deals', name: 'Deals', icon: 'fa-handshake' },
        { id: 'contacts-accounts', name: 'Contacts & Accounts', icon: 'fa-address-book' },
        { id: 'campaigns', name: 'Campaigns', icon: 'fa-bullhorn' },
        { id: 'sequences', name: 'Sequences', icon: 'fa-cogs' },
        { id: 'cognito-social', name: 'Cognito & Social Hub', icon: 'fa-brain' },
    ];

    // Store the HTML content for each "page" of the user guide
    const guideContent = {
        introduction: `
            <h1 class="text-3xl font-bold text-gray-800 mb-8">Constellation User Guide</h1>
            <section class="bg-white p-6 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">Introduction</h2>
                <p class="text-gray-600 leading-relaxed">
                    Welcome to Constellation, your all-in-one platform for intelligent sales and customer relationship management. This guide will walk you through the core features of the application to help you streamline your workflow, automate outreach, and close more deals.
                </p>
            </section>`,
        'command-center': `
            <h1 class="text-3xl font-bold text-gray-800 mb-8">Command Center</h1>
            <section class="bg-white p-6 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">The Command Center: Your Daily Hub</h2>
                <p class="text-gray-600 mb-4">The Command Center is your home base. It's the first page you see after logging in and is designed to show you exactly what you need to focus on for the day, from manual tasks to automated sequence steps.</p>
                <h3 class="text-xl font-semibold text-gray-700 mt-6 mb-3">Key Features</h3>
                <ul class="list-disc list-inside text-gray-600 space-y-2">
                    <li><strong>My Tasks:</strong> Lists all manually created tasks. Overdue tasks are highlighted for prioritization.</li>
                    <li><strong>Sequence Steps Due:</strong> Your automated to-do list, showing sequence steps due today or overdue with dedicated action buttons.</li>
                    <li><strong>Upcoming Sequence Steps:</strong> A forward-looking view of automated outreach to help you prepare for future engagements.</li>
                    <li><strong>Recent Activities:</strong> A live feed of your latest logged activities across all records.</li>
                </ul>
            </section>`,
        deals: `
            <h1 class="text-3xl font-bold text-gray-800 mb-8">Deals</h1>
            <section class="bg-white p-6 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">Deals: Managing Your Pipeline</h2>
                <p class="text-gray-600 mb-4">The Deals page is where you track your sales pipeline from start to finish. It provides both a detailed table of your deals and high-level visual insights to help you forecast accurately.</p>
                <h3 class="text-xl font-semibold text-gray-700 mt-6 mb-3">Key Features</h3>
                <ul class="list-disc list-inside text-gray-600 space-y-2">
                    <li><strong>Metric Cards:</strong> Real-time snapshots of key sales figures, including committed forecast and total pipeline value.</li>
                    <li><strong>Deals Table:</strong> A comprehensive, sortable, and editable list of all your deals.</li>
                    <li><strong>"Committed" Checkbox:</strong> A key feature for forecasting, including a deal's value in your "Current Commit."</li>
                    <li><strong>Deal Insights Charts:</strong> Visual breakdowns of your pipeline, showing "Deals by Stage" and a "30/60/90 Day Funnel."</li>
                    <li><strong>Deal Integrity:</strong> Deals cannot be deleted to ensure accurate historical reporting; instead, move lost deals to the "Closed Lost" stage.</li>
                </ul>
            </section>`,
        'contacts-accounts': `
            <h1 class="text-3xl font-bold text-gray-800 mb-8">Contacts & Accounts</h1>
            <section class="bg-white p-6 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">Contacts & Accounts: Your Address Book</h2>
                <p class="text-gray-600 mb-4">The Contacts and Accounts pages use a powerful split-screen layout. On the left is a searchable list, and on the right is a detailed panel to view and edit information.</p>
                <h3 class="text-xl font-semibold text-gray-700 mt-6 mb-3">How-To Guides</h3>
                <div class="space-y-4 text-gray-600">
                    <p><strong>AI Contact Import:</strong> Quickly add new contacts by pasting a screenshot of an email signature or taking a picture of a business card. The AI extracts the information and fills out the contact form for you.</p>
                    <p><strong>Complex Contact Import:</strong> Use the "Bulk Import from CSV" feature for large uploads. After uploading your file, you'll be prompted to map the columns from your CSV to the corresponding fields in Constellation, allowing for flexible and accurate data migration.</p>
                    <p><strong>Bulk Sequence Assignment:</strong> From the contacts list, select multiple contacts using the checkboxes. A bulk action bar will appear at the top of the list. Click "Assign Sequence," choose the desired sequence, and enroll all selected contacts at once.</p>
                    <p><strong>Write an Email with AI:</strong> When viewing a contact, click the AI icon next to their email address. In the compose window, provide a simple prompt (e.g., "Follow up on our call and mention the new pricing"), and the AI will draft a professional email for you to review, edit, and send.</p>
                    <p><strong>Logging Emails from Your Inbox:</strong> Automatically log emails sent from external clients like Outlook or Gmail by BCCing your unique address: <code class="bg-gray-200 p-1 rounded">bcc@constellation-crm.com</code>.</p>
                </div>
            </section>`,
        campaigns: `
            <h1 class="text-3xl font-bold text-gray-800 mb-8">Campaigns</h1>
            <section class="bg-white p-6 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">Campaigns: Targeted Outreach at Scale</h2>
                <p class="text-gray-600 mb-4">The Campaigns page allows you to create and execute targeted outreach efforts to a filtered list of your contacts, perfect for product announcements, event invitations, or promotions.</p>
                <h3 class="text-xl font-semibold text-gray-700 mt-6 mb-3">Key Features</h3>
                <ul class="list-disc list-inside text-gray-600 space-y-2">
                    <li><strong>Campaign Types:</strong> Create Call Blitz, Email Merge, or Guided Email campaigns.</li>
                    <li><strong>Dynamic Contact Filtering:</strong> Precisely target contacts based on account industry or customer/prospect status.</li>
                    <li><strong>Guided Workflow UI:</strong> The system guides you through calls or emails, allowing you to log notes and track progress efficiently.</li>
                    <li><strong>Email Template Management:</strong> Create, edit, and delete email templates, using placeholders like [FirstName] for personalization.</li>
                </ul>
            </section>`,
        sequences: `
            <h1 class="text-3xl font-bold text-gray-800 mb-8">Sequences</h1>
            <section class="bg-white p-6 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">Sequences: Automate Your Outreach</h2>
                <p class="text-gray-600 mb-4">The Sequences page is where you build multi-step, automated outreach plans to ensure consistent follow-up with your prospects.</p>
                <h3 class="text-xl font-semibold text-gray-700 mt-6 mb-3">Key Features</h3>
                <ul class="list-disc list-inside text-gray-600 space-y-2">
                    <li><strong>Build Your Sequence:</strong> Add various steps like sending an email, making a phone call, connecting on LinkedIn, or a generic task.</li>
                    <li><strong>Set Delays:</strong> Define delays in days for each step to control the pacing of your outreach.</li>
                    <li><strong>AI Generated Sequences:</strong> Effortlessly create multi-step sales sequences by defining your goals and letting AI draft the content and structure for you.</li>
                </ul>
            </section>`,
        'cognito-social': `
            <h1 class="text-3xl font-bold text-gray-800 mb-8">Cognito & Social Hub</h1>
            <section class="bg-white p-6 rounded-lg shadow">
                <h2 class="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">Cognito & Social Hub: AI-Powered Selling</h2>
                <p class="text-gray-600 mb-4">These are your integrated tools for modern, intelligent selling.</p>
                <h3 class="text-xl font-semibold text-gray-700 mt-6 mb-3">Key Features</h3>
                <ul class="list-disc list-inside text-gray-600 space-y-2">
                    <li><strong>Cognito Intelligence Alerts:</strong> An AI sales agent monitors news and events for buying signals related to your accounts.</li>
                    <li><strong>Cognito Action Center:</strong> Click "Action" on an alert, and Cognito's AI will draft a personalized outreach email based on the news. You can refine the draft with custom prompts before sending.</li>
                    <li><strong>The Social Hub:</strong> Provides AI-curated news articles and pre-approved marketing posts, helping you easily find relevant content to share with your professional network.</li>
                </ul>
            </section>`,
    };

    /**
     * Renders the content for a given page ID into the main content area.
     * @param {string} pageId - The ID of the content to render.
     */
    function renderContent(pageId) {
        mainContent.innerHTML = guideContent[pageId] || `<p>Content not found.</p>`;
        updateActiveNavLink(pageId);
    }

    /**
     * Updates the sidebar navigation to highlight the currently active page.
     * @param {string} pageId - The ID of the currently active page.
     */
    function updateActiveNavLink(pageId) {
        const links = sidebar.querySelectorAll('nav a');
        links.forEach(link => {
            if (link.getAttribute('href') === `#${pageId}`) {
                link.classList.add('bg-gray-700', 'text-white');
            } else {
                link.classList.remove('bg-gray-700', 'text-white');
            }
        });
    }

    /**
     * Populates the sidebar with navigation links.
     */
    function populateUserGuideNav() {
        const navContainer = sidebar.querySelector('nav');
        navContainer.innerHTML = ''; // Clear existing nav
        const ul = document.createElement('ul');
        ul.classList.add('space-y-2');

        userGuideNavLinks.forEach(link => {
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="#${link.id}" class="flex items-center p-2 text-gray-300 rounded-md hover:bg-gray-700 transition-colors duration-200">
                    <i class="fas ${link.icon} w-6 text-center"></i>
                    <span class="ml-3">${link.name}</span>
                </a>
            `;
            ul.appendChild(li);
        });
        navContainer.appendChild(ul);
    }

    /**
     * Handles routing logic on page load and on hash change.
     */
    function handleRouteChange() {
        // Get the page ID from the URL hash, or default to 'introduction'
        const pageId = window.location.hash.substring(1) || 'introduction';
        if (guideContent[pageId]) {
            renderContent(pageId);
        } else {
            // If the hash is invalid, default to the introduction page
            renderContent('introduction');
            window.location.hash = 'introduction';
        }
    }

    // --- INITIALIZATION ---
    populateUserGuideNav();
    // Listen for hash changes (e.g., browser back/forward buttons)
    window.addEventListener('hashchange', handleRouteChange);
    // Initial route handling on page load
    handleRouteChange();
});
