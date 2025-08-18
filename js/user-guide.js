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
            <h2>Introduction to Constellation</h2>
            <p>Welcome to Constellation, your all-in-one platform for intelligent sales and customer relationship management. This guide will walk you through the core features of the application to help you streamline your workflow and close more deals.</p>
        </div>
    `,
    "command-center": `
        <div>
            <h2>The Command Center</h2>
            <p>The Command Center is your home base. It's the first page you see after logging in and is designed to show you exactly what you need to focus on for the day.</p>
            <h4>Key Features</h4>
            <ul>
                <li><strong>My Tasks:</strong> A list of all manually created tasks. Overdue tasks are highlighted for prioritization.</li>
                <li><strong>Sequence Steps Due:</strong> Your automated to-do list, showing sequence steps that are due today or overdue, with action buttons to streamline your workflow.</li>
                <li><strong>Upcoming Sequence Steps:</strong> A forward-looking view of automated outreach to help you prepare for future engagements.</li>
                <li><strong>Recent Activities:</strong> A live feed of your latest logged activities across all contacts and accounts.</li>
            </ul>
            <hr class="guide-divider">
            <h3>How-To: Manage Tasks</h3>
            <h4>Adding a New Task</h4>
            <ol>
                <li>From the Command Center, click "Add New Task".</li>
                <li>Enter the task Description and optionally set a Due Date.</li>
                <li>Optionally, link the task to a Contact or Account.</li>
                <li>Click "Add Task".</li>
            </ol>
            <h4>Completing a Task</h4>
            <p>In the "My Tasks" table, simply click the "Complete" button in the Actions column.</p>
        </div>
    `,
    "contacts-accounts": `
        <div>
            <h2>Contacts & Accounts</h2>
            <p>The Contacts and Accounts pages use a powerful split-screen layout. On the left is a searchable list of records, and on the right is a detailed panel to view and edit information.</p>
            <h4>Key Features</h4>
            <ul>
                <li><strong>Action Buttons:</strong> Quickly log activity, assign a sequence, add a task, or create a new deal directly from the details panel.</li>
                <li><strong>Related Information:</strong> View associated contacts, activities, and deals to keep all information connected.</li>
                <li><strong>Persistent Activity History:</strong> All logged activities are permanent for an auditable history.</li>
                <li><strong>Log Emails from Inbox:</strong> Automatically log emails sent from external clients (like Outlook or Gmail) by BCCing <strong>bcc@constellation-crm.com</strong>.</li>
            </ul>
            <hr class="guide-divider">
            <h3>How-To: Manage Contacts & Accounts</h3>
            <h4>Assigning a Sequence to a Contact</h4>
            <ol>
                <li>On the Contacts page, select a contact from the list.</li>
                <li>In the details panel, click the "Assign Sequence" button.</li>
                <li>Select the desired sequence from the dropdown and click "Assign".</li>
            </ol>
            <h4>AI Contact Import (from Signatures & Business Cards)</h4>
            <ol>
                <li>Navigate to the Contacts page and click the "Import Contact Screenshot" button.</li>
                <li>In the modal, paste a screenshot (CTRL+V or CMD+V) or use your mobile camera to take a picture.</li>
                <li>The AI will analyze the image and extract the contact's details. Review the populated fields and click "Save Changes".</li>
            </ol>
            <h4>AI Activity Insight</h4>
            <ol>
                <li>Navigate to the Contacts or Accounts page and select a record.</li>
                <li>In the details panel, click the "AI Activity Insight" or "AI Account Insight" button.</li>
                <li>A modal will appear with a concise summary of all logged activities and a list of actionable, suggested next steps.</li>
            </ol>
        </div>
    `,
    "deals": `
        <div>
            <h2>Deals</h2>
            <p>The Deals page is where you track your sales pipeline from start to finish. It provides both a detailed table of your deals and high-level visual insights to help you forecast accurately.</p>
            <h4>Key Features</h4>
            <ul>
                <li><strong>Metric Cards:</strong> Real-time snapshots of key sales figures, including your committed forecast and total pipeline value.</li>
                <li><strong>Deals Table:</strong> A comprehensive, sortable list of all your deals, which can be edited directly.</li>
                <li><strong>"Committed" Checkbox:</strong> A key feature for forecasting. Checking this box includes a deal's value in your "Current Commit" metric.</li>
                <li><strong>Deal Insights Charts:</strong> Visual breakdowns of your pipeline by stage and a 30/60/90 day funnel view.</li>
                <li><strong>Deal Integrity:</strong> To ensure accurate historical reporting, deals cannot be deleted. Instead, move lost deals to the "Closed Lost" stage.</li>
            </ul>
            <hr class="guide-divider">
            <h3>How-To: Manage Deals</h3>
            <h4>Creating a New Deal</h4>
            <ol>
                <li>Navigate to the Deals page and click "Add New Deal".</li>
                <li>Fill in the deal Name, Term, Stage, Monthly Recurring Revenue (MRC), and other details.</li>
                <li>Click "Create Deal".</li>
            </ol>
            <h4>Marking a Deal as Committed</h4>
            <p>On the Deals page, locate the deal in the table and check the "Committed" checkbox in the first column. This will automatically update your committed forecast.</p>
        </div>
    `,
    "sequences": `
         <div>
            <h2>Sequences</h2>
            <p>The Sequences page is where you build multi-step, automated outreach plans to ensure consistent follow-up with your prospects.</p>
            <h4>Key Features</h4>
            <ul>
                <li><strong>Personal vs. Marketing:</strong> Create your own Personal Sequences or import pre-built Marketing Sequences to ensure brand consistency.</li>
                <li><strong>Multi-Step Builder:</strong> Add various steps like sending an email, making a phone call, or a generic task.</li>
                <li><strong>Time Delays:</strong> Define delays in days for each step to control the pacing of your outreach.</li>
            </ul>
            <hr class="guide-divider">
            <h3>How-To: AI Sequence Generation</h3>
            <p>Effortlessly create multi-step sales sequences by defining your goals and letting our AI draft the content.</p>
            <ol>
                <li>Navigate to the Sequences page and scroll down to the "AI Generate New Sequence" section.</li>
                <li>Fill in the details: Sequence Goal, Number of Steps, Duration, Step Types, and a Persona/Voice Prompt.</li>
                <li>Click "Generate Sequence with AI".</li>
                <li>A preview of the AI-generated steps will appear. You can edit any step before saving.</li>
                <li>Click "Save AI Generated Sequence", give it a unique name, and it will be added to your personal sequences list.</li>
            </ol>
        </div>
    `,
    "campaigns": `
        <div>
            <h2>Campaigns</h2>
            <p>The Campaigns page allows you to create and execute targeted outreach efforts to a filtered list of your contacts, perfect for product announcements, event invitations, or promotions.</p>
            <h4>Key Features</h4>
            <ul>
                <li><strong>Campaign Types:</strong> Create Call Blitz, Email Merge, or Guided Email campaigns.</li>
                <li><strong>Dynamic Contact Filtering:</strong> Precisely target contacts based on account industry or customer/prospect status.</li>
                <li><strong>Guided Execution:</strong> A workflow UI guides you through calls or emails, allowing you to log notes and track progress efficiently.</li>
                <li><strong>Email Template Management:</strong> Create, edit, and delete email templates using placeholders like [FirstName] for personalization.</li>
            </ul>
            <hr class="guide-divider">
            <h3>How-To: Manage Campaigns</h3>
            <h4>Creating a Campaign</h4>
            <ol>
                <li>On the Campaigns page, click "Add New Campaign".</li>
                <li>Select a type (e.g., "Call Blitz", "Guided Email").</li>
                <li>Define your Campaign Name and use the filters to select your target audience.</li>
                <li>Click "Create Campaign".</li>
            </ol>
            <h4>Executing a Campaign</h4>
            <p>Select an active campaign from the list. The details panel will transform into a guided workflow UI to help you execute the calls or emails efficiently.</p>
        </div>
    `,
    "cognito-social": `
        <div>
            <h2>Cognito & Social Hub</h2>
            <p>Cognito and the Social Hub are your integrated tools for modern, intelligent selling.</p>
            <h4>Cognito Intelligence Alerts</h4>
            <p>Your AI sales intelligence agent that monitors news and events for buying signals. When an alert appears, click the "Action" button to open the <strong>Action Center</strong>. Here, the AI will draft a personalized outreach email based on the news. You can use it as-is or refine it with a custom prompt.</p>
            <h4>The Social Hub</h4>
            <p>The Social Hub provides you with AI-curated news articles and pre-approved posts from your marketing team. It helps you easily find relevant content to share with your professional network on platforms like LinkedIn, amplifying your voice and building your brand.</p>
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
