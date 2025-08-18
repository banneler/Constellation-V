// js/user-guide.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupModalListeners,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const userGuideContent = {
    "introduction": `
        <div>
            <div class="guide-card">
                <h2>Introduction to Constellation</h2>
                <p>Welcome to Constellation, your all-in-one platform for intelligent sales and customer relationship management. This guide is your comprehensive resource for understanding and mastering the powerful features designed to streamline your workflow, automate outreach, and help you close more deals, faster.</p>
            </div>
        </div>
    `,
    "command-center": `
        <div>
            <div class="guide-card">
                <h2>The Command Center: Your Daily Hub</h2>
                <p><strong>Value Proposition:</strong> The Command Center is your home base, designed to eliminate guesswork and show you exactly what needs your attention the moment you log in. It separates your manual tasks from your automated sequence steps, giving you a clear, prioritized view of your day.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>My Tasks:</strong> This is your personal to-do list for all manually created action items. Tasks that are past their due date are highlighted in red, ensuring you never miss a critical follow-up.</li>
                    <li><strong>Sequence Steps Due:</strong> This is your automated action list. It shows you every automated outreach step that is due today or overdue, turning your sales playbook into a daily checklist.</li>
                    <li><strong>Upcoming Sequence Steps:</strong> A forward-looking view of your automated outreach, helping you prepare for future engagements and manage your time effectively.</li>
                    <li><strong>Recent Activities:</strong> A live feed of your latest logged activities, providing a quick overview of your recent work and engagement across all your accounts and contacts.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Tasks</h3>
                <h4>Adding a New Task</h4>
                <ol>
                    <li>From the Command Center, click the "Add New Task" button.</li>
                    <li>In the pop-up, enter a clear and concise task <strong>Description</strong> (e.g., "Follow up with Jane Doe about proposal").</li>
                    <li>Optionally, select a <strong>Due Date</strong> to keep your work organized.</li>
                    <li>To maintain a complete record, you can link the task to a specific <strong>Contact</strong> or <strong>Account</strong> using the dropdowns.</li>
                    <li>Click "Add Task". The new task will immediately appear in your "My Tasks" list.</li>
                </ol>
                <h4>Completing, Editing, or Deleting a Task</h4>
                <p>In the "My Tasks" table, use the buttons in the "Actions" column to manage your tasks. Clicking "Complete" will mark the task as done and remove it from your active list. "Edit" allows you to change any details, and "Delete" will permanently remove the task.</p>
            </div>
        </div>
    `,
    "contacts-accounts": `
        <div>
            <div class="guide-card">
                <h2>Contacts & Accounts: Your Intelligent Address Book</h2>
                <p><strong>Value Proposition:</strong> This is more than just a list of names. It's a dynamic, 360-degree view of your relationships. The powerful split-screen layout allows for rapid searching and detailed editing without ever losing context.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>Advanced Sorting & Filtering (Accounts):</strong> The Accounts list isn't static. Use the dropdown menus at the top to instantly sort your entire list by <strong>Account Name</strong>, <strong>Last Activity Date</strong>, or <strong>Creation Date</strong>, allowing you to easily surface top-priority accounts.</li>
                    <li><strong>"Organic" Star (<i class="fas fa-star" style="color: #4CAF50;"></i>):</strong> Mark an Account as "Organic" to signify that it was sourced through inbound marketing or other non-sales efforts. This helps with accurate reporting on which channels are driving the most business.</li>
                    <li><strong>Comprehensive Details:</strong> Track critical account information like Quantity of Sites, Employee Count, and Customer Status to better qualify and segment your prospects.</li>
                    <li><strong>Log Emails from Your Inbox:</strong> Keep your activity history complete without extra work. By simply BCCing <strong>bcc@constellation-crm.com</strong> on any email you send from an external client (like Outlook or Gmail), the email will be automatically logged as an activity for that contact in Constellation.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: The Intelligent CSV Import Engine</h3>
                <p><strong>Value Proposition:</strong> Our import tool protects your data integrity. It doesn't just blindly add new records; it intelligently detects potential duplicates or updates to existing records and gives you full control over every change.</p>
                <ol>
                    <li>On the Contacts or Accounts page, click "More Actions" and select "Bulk Import from CSV". A downloadable template is available on the Command Center to ensure your data is formatted correctly.</li>
                    <li>After uploading your file, the system will present you with an interactive preview.</li>
                    <li><strong>Review Changes:</strong> For each row, the system will display a status: "New Record", "Potential Duplicate", or "Update to Existing".</li>
                    <li><strong>Accept or Reject:</strong> You have row-by-row control. Use the checkboxes to accept the suggested changes or skip a specific row if you don't want to import it. This prevents accidental overwrites or duplicate entries.</li>
                    <li>Click "Confirm Import" to finalize the process.</li>
                </ol>
            </div>
            <div class="guide-card">
                <h3>How-To: AI-Powered Contact Management</h3>
                <h4>AI Contact Import (from Signatures & Business Cards)</h4>
                <p><strong>Value Proposition:</strong> Stop manual data entry. Create new contacts or enrich existing ones in seconds from anywhere.</p>
                <ol>
                    <li>Navigate to the Contacts page and click the "Import Contact Screenshot" button.</li>
                    <li>In the modal, paste a screenshot of an email signature (CTRL+V or CMD+V) or, if on mobile, use your camera to take a clear picture of a business card.</li>
                    <li>The AI will analyze the image, extract the contact's details (name, email, phone, title, company), and populate the fields for you.</li>
                    <li>Review the extracted data and click "Save Changes".</li>
                </ol>
                <h4>AI Activity Insight</h4>
                <p><strong>Value Proposition:</strong> Get up to speed on any contact or account instantly. This feature is perfect for preparing for a call or handing off an account to a colleague.</p>
                <ol>
                    <li>Navigate to the Contacts or Accounts page and select a record.</li>
                    <li>In the details panel, click the "AI Activity Insight" or "AI Account Insight" button.</li>
                    <li>A modal will appear with a concise, AI-generated summary of all logged activities and a list of clear, actionable suggested next steps.</li>
                </ol>
            </div>
        </div>
    `,
    "deals": `
        <div>
            <div class="guide-card">
                <h2>Deals: Your Sales Pipeline Command Center</h2>
                <p><strong>Value Proposition:</strong> The Deals page provides a clear, real-time view of your entire sales pipeline, helping you forecast accurately and focus on the deals that matter most.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>Metric Cards:</strong> At-a-glance snapshots of your most important sales figures, including your <strong>Committed Forecast</strong> and <strong>Total Pipeline Value</strong>.</li>
                    <li><strong>Manager's View:</strong> For users with managerial roles, a toggle appears allowing you to switch between "My Deals" and "My Team's Deals", providing a comprehensive overview of your team's performance.</li>
                    <li><strong>"Recently Closed" View:</strong> Celebrate your victories! Toggle from the "Active Pipeline" view to "Recently Closed" to see a list of all your "Closed Won" deals. This is perfect for reporting and recognizing success.</li>
                    <li><strong>Deal Integrity:</strong> To ensure accurate historical reporting and protect your data, deals cannot be deleted. Instead, move lost deals to the "Closed Lost" stage to maintain a complete record of your sales efforts.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Deals</h3>
                <h4>Creating a New Deal</h4>
                <ol>
                    <li>Navigate to the Deals page and click "Add New Deal", or create one directly from an Account page.</li>
                    <li>Fill in the deal <strong>Name</strong>, <strong>Term</strong>, <strong>Stage</strong>, <strong>Monthly Recurring Revenue (MRC)</strong>, <strong>Close Month</strong>, and associated <strong>Products</strong>.</li>
                    <li>Click "Create Deal".</li>
                </ol>
                <h4>Marking a Deal as Committed for Forecasting</h4>
                <p>On the Deals page, locate the deal in the "Active Pipeline" table and check the "Committed" checkbox in the first column. This action tells Constellation to include this deal's value in your "Current Commit" metric card, providing a real-time, accurate forecast.</p>
            </div>
        </div>
    `,
    "sequences": `
         <div>
            <div class="guide-card">
                <h2>Sequences: Your Automated Outreach Engine</h2>
                <p><strong>Value Proposition:</strong> The Sequences page is where you build multi-step, automated outreach plans to ensure consistent, timely follow-up with every prospect without letting anyone fall through the cracks.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>Personal vs. Marketing Sequences:</strong> You can create your own <strong>Personal Sequences</strong> from scratch, or save time and ensure brand consistency by importing <strong>Marketing Sequences</strong> that have been pre-built and shared by your marketing team.</li>
                    <li><strong>Multi-Step, Multi-Channel Builder:</strong> Add various step types to your sequence, including sending an email, making a phone call, a LinkedIn interaction, or a generic task.</li>
                    <li><strong>Intelligent Pacing:</strong> Define delays in days for each step to control the timing and cadence of your outreach, ensuring prospects are contacted at the optimal interval.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: AI Sequence Generation</h3>
                <p><strong>Value Proposition:</strong> Go from a sales goal to a complete, multi-step outreach plan in minutes. Let our AI act as your sales copywriter and strategist.</p>
                <ol>
                    <li>Navigate to the Sequences page and scroll down to the "AI Generate New Sequence" section.</li>
                    <li>Fill in the details: a clear <strong>Sequence Goal/Topic</strong>, the desired <strong>Number of Steps</strong>, the <strong>Total Sequence Duration</strong> in days, the <strong>Step Types</strong> to include, and a <strong>Persona & Voice Prompt</strong> to define the tone.</li>
                    <li>Click "Generate Sequence with AI".</li>
                    <li>A preview of the AI-generated steps will appear. You can review and edit any part of any step before saving.</li>
                    <li>Click "Save AI Generated Sequence", give it a unique name, and it will be instantly added to your personal sequences list, ready to be assigned to contacts.</li>
                </ol>
            </div>
        </div>
    `,
    "campaigns": `
        <div>
            <div class="guide-card">
                <h2>Campaigns: Targeted Outreach at Scale</h2>
                <p><strong>Value Proposition:</strong> Campaigns allow you to create and execute highly targeted, one-time outreach efforts to a specific list of your contacts. This is perfect for product announcements, event invitations, or special promotions.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>Multiple Campaign Types:</strong> Create a <strong>Call Blitz</strong> for a focused calling effort, an <strong>Email Merge</strong> for a large-scale email blast, or a <strong>Guided Email</strong> campaign for a more personalized, one-by-one approach.</li>
                    <li><strong>Dynamic Contact Filtering:</strong> Precisely target the right audience by filtering your contacts based on account industry or their customer/prospect status.</li>
                    <li><strong>Guided Execution Workflow:</strong> When you execute a campaign, a dedicated UI guides you through the calls or emails, allowing you to log notes and track your progress efficiently without leaving the page.</li>
                    <li><strong>Email Template Management:</strong> Create, edit, and manage a library of email templates. Use placeholders like [FirstName], [LastName], and [AccountName] for easy personalization.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Campaigns</h3>
                <h4>Creating and Executing a Campaign</h4>
                <ol>
                    <li>On the Campaigns page, click "Add New Campaign" and select a campaign type.</li>
                    <li>Define your Campaign Name and use the dynamic filters to build your target contact list.</li>
                    <li>Click "Create Campaign".</li>
                    <li>To begin, select the active campaign from your list. The details panel will transform into the guided workflow UI to help you execute your outreach.</li>
                </ol>
            </div>
        </div>
    `,
    "cognito-social": `
        <div>
            <div class="guide-card">
                <h2>Cognito & Social Hub: Your AI-Powered Selling Tools</h2>
                <p><strong>Value Proposition:</strong> These are Constellation's most advanced features, designed to give you a competitive edge by transforming real-time market intelligence into immediate, actionable sales opportunities.</p>
                <h4>Notification Bell Icon <i class="fas fa-bell"></i></h4>
                <p>To ensure you never miss a timely update, a bell icon will appear next to the Cognito or Social Hub link in the main navigation sidebar whenever new intelligence alerts or social content have been added since your last visit to that page.</p>
                <h4>Cognito: Your Personal Intelligence Agent</h4>
                <p>Cognito constantly scans the web for news and events related to your target accounts and alerts you to critical buying signals. When an alert appears, click the "Action" button to open the <strong>Action Center</strong>. Here, the AI drafts a personalized outreach email based on the news, allowing you to log the interaction and create follow-up tasks without ever leaving the page. It closes the loop from intelligence to action in a single click.</p>
                <h4>The Social Hub: Build Your Brand</h4>
                <p>The Social Hub is a curated feed of relevant news articles and pre-approved marketing content. It helps you easily find and share valuable content on your professional social media networks (like LinkedIn). Click "Prepare Post" on any item, and our AI will generate a suggested social media post for you, which you can use as-is or refine with a custom prompt.</p>
            </div>
        </div>
    `
};

const state = { currentUser: null };

const authContainer = document.getElementById("auth-container");
const mainAppContainer = document.getElementById("user-guide-container");
const navList = document.getElementById('user-guide-nav');
const contentPane = document.getElementById('user-guide-content');

const loadContent = (sectionId) => {
    if (!contentPane) return;
    const content = userGuideContent[sectionId] || `<h2>Content Not Found</h2>`;
    contentPane.innerHTML = content;
};

function setupPageEventListeners() {
    setupModalListeners();
    if (navList) {
        navList.addEventListener('click', (event) => {
            event.preventDefault();
            const navButton = event.target.closest('.nav-button');
            if (navButton) {
                document.querySelectorAll('#user-guide-nav .nav-button').forEach(btn => btn.classList.remove('active'));
                navButton.classList.add('active');
                const sectionId = navButton.dataset.section;
                loadContent(sectionId);
            }
        });
    }
}

async function initializePage() {
    await loadSVGs();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            state.currentUser = session.user;
            if (authContainer) authContainer.classList.add('hidden');
            if (mainAppContainer) mainAppContainer.classList.remove('hidden');
            await setupUserMenuAndAuth(supabase, state);
            const initialSection = navList?.querySelector('.nav-button.active');
            if (initialSection) {
                loadContent(initialSection.dataset.section);
            }
        } else {
            state.currentUser = null;
            if (authContainer) authContainer.classList.remove('hidden');
            if (mainAppContainer) mainAppContainer.classList.add('hidden');
        }
    });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        if (authContainer) authContainer.classList.remove('hidden');
        if (mainAppContainer) mainAppContainer.classList.add('hidden');
    }
    setupPageEventListeners();
}

document.addEventListener("DOMContentLoaded", initializePage);
