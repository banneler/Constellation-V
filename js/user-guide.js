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
                <p><strong>Our Core Philosophy:</strong> To have you spend less time on data entry and more time building relationships and winning business. Every feature is built to make you more efficient, effective, and intelligent in your sales approach. Use the navigation on the left to explore each module.</p>
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
                    <li><strong>My Tasks:</strong> This is your personal to-do list for all manually created action items. Tasks that are past their due date are highlighted, ensuring you never miss a critical follow-up.</li>
                    <li><strong>Sequence Steps Due:</strong> This is your automated action list. It shows you every automated outreach step that is due today or overdue, turning your sales playbook into a daily checklist.</li>
                    <li><strong>Upcoming Sequence Steps:</strong> A forward-looking view of your automated outreach, helping you prepare for future engagements and manage your time effectively.</li>
                    <li><strong>Recent Activities:</strong> A live feed of your latest logged activities, providing a quick overview of your recent work and engagement across all your accounts and contacts.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Tasks & Sequence Steps</h3>
                <h4>Creating a New Task</h4>
                <ol>
                    <li>From the Command Center, click the <button class="btn-primary" disabled>Add New Task</button> button.</li>
                    <li>In the pop-up, enter a clear and concise task <strong>Description</strong> (e.g., "Follow up with Jane Doe about proposal").</li>
                    <li>Optionally, select a <strong>Due Date</strong> to keep your work organized.</li>
                    <li>To maintain a complete record, you can link the task to a specific <strong>Contact</strong> or <strong>Account</strong> using the dropdowns.</li>
                    <li>Click <button class="btn-primary" disabled>Add Task</button>. The new task will immediately appear in your "My Tasks" list.</li>
                </ol>
                <h4>Managing Sequence Steps Due</h4>
                <p>This section transforms your automated sequences into a simple, actionable workflow.</p>
                <ol>
                    <li><strong>Review the Step:</strong> Each row shows you the Contact, the Sequence they are in, and the specific step that is due (e.g., "Email", "LinkedIn").</li>
                    <li><strong>Use Action Buttons:</strong>
                        <ul>
                            <li><button class="btn-secondary" disabled>Send Email</button>: Opens a modal with the pre-written email from your sequence template. You can edit it for personalization before opening it in your default email client.</li>
                            <li><button class="btn-secondary" disabled>Go to LinkedIn</button>: Opens a new tab directly to the generic LinkedIn feed as a prompt to complete your outreach.</li>
                            <li><button class="btn-primary" disabled>Complete</button>: Once you've performed the action, click this. This logs the activity and advances the contact to the next step in the sequence automatically.</li>
                        </ul>
                    </li>
                </ol>
            </div>
        </div>
    `,
    "accounts": `
        <div>
            <div class="guide-card">
                <h2>Accounts: Your 360-Degree Company View</h2>
                <p><strong>Value Proposition:</strong> The Accounts page is your central repository for all company-level information. It's designed for quick access and provides a complete picture of your relationship with each company, including all associated contacts, deals, and activities.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>Smart Filters:</strong> Use the dropdown to instantly filter your list to show only "Hot Accounts" (those with recent activity), accounts with open deals, customers, or prospects.</li>
                    <li><strong>Visual Indicators:</strong> At a glance, icons next to an account name tell you its status:
                        <ul>
                            <li><i class="fas fa-fire" style="color: #f0ad4e;"></i>: Indicates recent activity within the last 30 days.</li>
                            <li><i class="fas fa-dollar-sign" style="color: #5cb85c;"></i>: Shows that there is at least one open deal associated with this account.</li>
                        </ul>
                    </li>
                    <li><strong>Unsaved Changes Warning:</strong> The system protects your work. If you make edits in the details panel and try to navigate away or click another account without saving, a warning will appear, preventing you from losing your changes.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Accounts</h3>
                <h4>Creating and Editing an Account</h4>
                <ol>
                    <li>Click the <button class="btn-primary" disabled>Add New Account</button> button at the top of the list.</li>
                    <li>In the details panel on the right, you can update any field, such as Website, Industry, Phone, Address, or toggle the "Is this a Customer?" switch.</li>
                    <li>After making your changes, click the <button class="btn-primary" disabled>Save Changes</button> button.</li>
                </ol>
                <h4>Action Hub</h4>
                <p>From a saved Account record, you can:</p>
                <ul>
                    <li><button class="btn-secondary" disabled>New Deal</button>: Create a new sales opportunity linked to this account.</li>
                     <li><button class="btn-primary" disabled>Add Task</button>: Create a follow-up task.</li>
                      <li><button class="btn-secondary" disabled>AI Account Insight</button>: Get an AI-powered summary of all recent activities and suggested next steps for the account.</li>
                </ul>
            </div>
        </div>
    `,
    "contacts": `
        <div>
            <div class="guide-card">
                <h2>Contacts: Your Relationship Hub</h2>
                <p><strong>Value Proposition:</strong> The Contacts page is where you manage your relationships with the individuals at your target accounts. It provides all the tools you need to engage effectively and keep a complete record of your interactions.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>AI-Powered Import:</strong> Use the <button class="btn-secondary" disabled>Import Contact Screenshot</button> button to leverage AI. Paste a screenshot of an email signature, and Cognito will parse the information to create or update a contact for you.</li>
                     <li><strong>Organic Indicator:</strong> Click the star icon ★ at the top right of a contact's details to mark them as an "organic" lead—a contact you sourced yourself.</li>
                    <li><strong>Sequence Status Ring:</strong> The ring chart visually represents a contact's progress through an active sequence, showing completed steps versus total steps.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Engage with Contacts</h3>
                <h4>Action Buttons</h4>
                 <p>From a saved Contact record, you can:</p>
                <ul>
                    <li><button class="btn-secondary" disabled>Log Activity</button>: Manually record any interaction like a call or meeting.</li>
                    <li><button class="btn-secondary" disabled>Assign Sequence</button>: Enroll the contact into one of your automated outreach sequences.</li>
                    <li><button class="btn-secondary" disabled>Add Task</button>: Create a specific to-do for this person.</li>
                    <li><button class="btn-primary" disabled>AI Activity Insight</button>: Get a concise summary and suggested next steps based on the entire activity history with this contact.</li>
                    <li><button class="btn-primary" disabled>Write Email with AI</button>: Open a modal to generate a personalized email draft based on a prompt you provide.</li>
                </ul>
            </div>
        </div>
    `,
    "deals": `
        <div>
            <div class="guide-card">
                <h2>Deals: Your Sales Pipeline Command Center</h2>
                <p><strong>Value Proposition:</strong> The Deals page provides a clear, real-time view of your entire sales pipeline, helping you forecast accurately and focus on the deals that matter most. Deals are managed here, but they are created from the Account page to ensure every deal is properly associated with a company.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>Metric Cards:</strong> At-a-glance snapshots of your most important sales figures, including your <strong>Committed Forecast</strong> and <strong>Total Pipeline Value</strong>.</li>
                    <li><strong>Manager's View:</strong> For users with managerial roles, a toggle appears allowing you to switch between "My Deals" and "My Team's Deals", providing a comprehensive overview of your team's performance.</li>
                    <li><strong>Interactive Charts:</strong> The "Deals by Stage" and "30/60/90 Day Funnel" charts give you a visual understanding of your pipeline's health and where your future revenue is concentrated.</li>
                </ul>
            </div>
        </div>
    `,
    "sequences": `
       <div>
            <div class="guide-card">
                <h2>Sequences: Your Automated Outreach Engine</h2>
                <p><strong>Value Proposition:</strong> Sequences are your primary tool for automating outreach and ensuring consistent, timely follow-up with every prospect without letting anyone fall through the cracks.</p>
                <h4>Key Features</h4>
                <ul>
                    <li><strong>Personal vs. Marketing Sequences:</strong> You can create your own <strong>Personal Sequences</strong> from scratch, or save time and ensure brand consistency by importing <strong>Marketing Sequences</strong> that have been pre-built and shared by your marketing team.</li>
                    <li><strong>Bulk Assign Contacts:</strong> From a saved sequence, use the <button class="btn-primary" disabled>Bulk Assign Contacts</button> feature to enroll multiple contacts into the sequence at once.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: AI Sequence Generation</h3>
                <p><strong>Value Proposition:</strong> Go from a sales goal to a complete, multi-step outreach plan in minutes. Let our AI act as your sales copywriter and strategist.</p>
                <ol>
                    <li>Navigate to the Sequences page and scroll down to the "AI Generate New Sequence" section.</li>
                    <li>Fill in the details: a clear <strong>Sequence Goal/Topic</strong>, the desired <strong>Number of Steps</strong>, the <strong>Total Sequence Duration</strong> in days, the <strong>Step Types</strong> to include, and a <strong>Persona & Voice Prompt</strong> to define the tone.</li>
                    <li>Click the <button class="btn-primary" disabled>Generate Sequence with AI</button> button.</li>
                    <li>A preview of the AI-generated steps will appear. You can review and edit any part of any step before saving.</li>
                    <li>Click <button class="btn-primary" disabled>Save AI Generated Sequence</button>, give it a unique name, and it will be instantly added to your personal sequences list, ready to be assigned to contacts.</li>
                </ol>
            </div>
        </div>
    `,
    "campaigns": `
        <div>
            <div class="guide-card">
                <h2>Campaigns: Targeted Outreach at Scale</h2>
                <p><strong>Value Proposition:</strong> Campaigns allow you to create and execute highly targeted, one-time outreach efforts to a specific list of your contacts. This is perfect for product announcements, event invitations, or special promotions.</p>
                 <h4>Campaign Types</h4>
                <ul>
                    <li><strong>Call Blitz:</strong> Creates a focused list of contacts to call. The UI presents you with one contact at a time, allowing you to log notes and efficiently work through your list.</li>
                    <li><strong>Guided Email:</strong> A workflow that lets you send personalized emails one by one. It presents a pre-filled email for each contact, allowing you to review and customize it before sending.</li>
                    <li><strong>Email Merge:</strong> For mass emailing. This exports a filtered contact list as a CSV for use in an external mail merge tool.</li>
                </ul>
            </div>
        </div>
    `,
    "cognito": `
        <div>
            <div class="guide-card">
                <h2>Cognito: Your AI-Powered Intelligence Agent</h2>
                <p><strong>Value Proposition:</strong> Cognito gives you an unfair advantage by transforming public information into private intelligence. It acts as your personal research assistant, automatically scanning the web daily for news and events related to your accounts and alerting you to timely, actionable buying signals.</p>
            </div>
            <div class="guide-card">
                <h3>How-To: Act on Cognito Alerts</h3>
                <p><strong>Value Proposition:</strong> The Action Center closes the loop from intelligence to action in a single click, allowing you to respond to buying signals in minutes, not hours.</p>
                <ol>
                    <li><strong>Review Alerts:</strong> On the Cognito page, review your new alerts. Each card shows the Account, the news headline, a summary, and a relevance score.</li>
                    <li><strong>Open the Action Center:</strong> Click the <button class="btn-primary" disabled>Action</button> button on any alert.</li>
                    <li><strong>Use the AI-Drafted Email:</strong> The Action Center opens with a personalized outreach email already written for you by the AI, referencing the specific news event.</li>
                     <li><strong>Refine (Optional):</strong> Click <button class="btn-tertiary" disabled>Refine with Custom Prompt</button> to have the AI rewrite the email based on your specific instructions.</li>
                    <li><strong>Log Your Action & Create Follow-ups:</strong> After you send the email, use the "Log Actions" section to record your activity and create a follow-up task in Constellation, all without leaving the modal.</li>
                </ol>
            </div>
        </div>
    `,
    "social-hub": `
        <div>
            <div class="guide-card">
                <h2>The Social Hub: Build Your Brand</h2>
                <p><strong>Value Proposition:</strong> The Social Hub makes it effortless to build your professional brand and stay top-of-mind with your network. It provides a steady stream of high-quality, relevant content for you to share, positioning you as a knowledgeable expert in your field.</p>
                <h4>How it Works</h4>
                <p>The Social Hub is populated daily with two types of content:</p>
                <ul>
                    <li><strong>News Articles:</strong> AI-curated articles from around the web that are relevant to your industry.</li>
                    <li><strong>Campaign Assets:</strong> Pre-approved posts provided by your marketing team.</li>
                </ul>
            </div>
             <div class="guide-card">
                <h3>How-To: Use the Social Hub</h3>
                <ol>
                    <li>On the Social Hub page, review the available content.</li>
                    <li>Click <button class="btn-primary" disabled>Prepare Post</button> on any item.</li>
                    <li>A modal will appear with a suggested social media post written for you by the AI, summarizing the article or asset.</li>
                    <li>Use the "Refine" feature to have the AI rewrite the post with a different tone based on your prompt.</li>
                    <li>Click <button class="btn-secondary" disabled>Copy Text</button>, then <button class="btn-primary" disabled>Post to LinkedIn</button> to open a new tab where you can paste your post and share it with your network.</li>
                </ol>
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
    const content = userGuideContent[sectionId] || \`<h2>Content Not Found</h2>\`;
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
