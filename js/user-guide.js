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
                            <li><button class="btn-secondary" disabled>Send Email</button>: Opens your default email client with the contact's email address pre-filled.</li>
                            <li><button class="btn-secondary" disabled>Go to LinkedIn</button>: Opens a new tab directly to the contact's LinkedIn profile (if available).</li>
                            <li><button class="btn-primary" disabled>Complete</button>: Once you've performed the action, click this. A modal will appear allowing you to log notes about the interaction (e.g., "Left a voicemail," "Sent connection request"). This logs the activity and advances the contact to the next step in the sequence.</li>
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
                    <li><strong>Clickable Sorting:</strong> The Accounts list isn't static. Click on the column headers for <strong>Account Name</strong>, <strong>Last Activity</strong>, or <strong>Created</strong> to instantly sort the entire list in ascending or descending order.</li>
                    <li><strong>Visual Indicators:</strong> At a glance, icons next to an account name tell you its status:
                        <ul>
                            <li><i class="fas fa-fire" style="color: var(--hot-orange);"></i>: Indicates recent activity within the last 7 days.</li>
                            <li><i class="fas fa-dollar-sign" style="color: var(--success-green);"></i>: Shows that there is at least one open deal associated with this account.</li>
                        </ul>
                    </li>
                    <li><strong>Unsaved Changes Warning:</strong> The system protects your work. If you make edits in the details panel and try to navigate away or click another account without saving, a warning will appear, preventing you from losing your changes.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Accounts</h3>
                <h4>Creating a New Account</h4>
                <ol>
                    <li>Click the <button class="btn-primary" disabled>Add New Account</button> button at the top of the list.</li>
                    <li>Enter the <strong>Account Name</strong> in the modal and click <button class="btn-primary" disabled>Create Account</button>.</li>
                    <li>The new account is added to the list, and its details panel automatically opens on the right, ready for you to add more information.</li>
                </ol>
                <h4>Editing an Account</h4>
                <ol>
                    <li>Select an account from the list on the left.</li>
                    <li>In the details panel on the right, you can update any field, such as Website, Industry, Phone, Address, or toggle the "Is this a Customer?" switch.</li>
                    <li>After making your changes, click the <button class="btn-primary" disabled>Save Changes</button> button.</li>
                </ol>
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
                    <li><strong>Action Buttons:</strong> From a contact's detail view, you can instantly <button class="btn-secondary" disabled>Log Activity</button>, <button class="btn-secondary" disabled>Assign Sequence</button>, or <button class="btn-secondary" disabled>Add Task</button>.</li>
                    <li><strong>Sequence Status:</strong> See at a glance if a contact is currently active in a sequence and which one.</li>
                    <li><strong>Unsaved Changes Warning:</strong> Just like the Accounts page, the system will warn you if you try to leave with unsaved edits, protecting your work.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Contacts</h3>
                <h4>Creating a New Contact</h4>
                <ol>
                    <li>Click the <button class="btn-primary" disabled>Add New Contact</button> button at the top of the list.</li>
                    <li>Enter the <strong>First Name</strong> and <strong>Last Name</strong> and click <button class="btn-primary" disabled>Create Contact</button>.</li>
                    <li>The new contact is added, and their details panel opens on the right for you to add their title, email, associated account, and other information.</li>
                </ol>
                <h4>Editing a Contact</h4>
                <ol>
                    <li>Select a contact from the list on the left.</li>
                    <li>In the details panel on the right, update any field.</li>
                    <li>Click the <button class="btn-primary" disabled>Save Changes</button> button to commit your edits.</li>
                </ol>
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
                    <li><strong>"Recently Closed" View:</strong> Celebrate your victories! Toggle from the "Active Pipeline" view to "Recently Closed" to see a list of all your "Closed Won" deals. This is perfect for reporting and recognizing success.</li>
                </ul>
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
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Create and Manage Sequences</h3>
                <h4>Creating a Sequence Manually</h4>
                <ol>
                    <li>Navigate to the Sequences page and click <button class="btn-primary" disabled>Add New Sequence</button>.</li>
                    <li>Give the sequence a name and click "Create".</li>
                    <li>In the details panel, click <button class="btn-secondary" disabled>Add New Step</button> to build your sequence, defining the type, message, and delay for each step.</li>
                </ol>
                <h4>Importing Sequence Steps from CSV</h4>
                 <ol>
                    <li>Select an existing sequence.</li>
                    <li>Click "More Actions" and choose "Bulk Import Steps from CSV".</li>
                    <li>Select your prepared CSV file (a template is available on the Command Center). The steps will be appended to your sequence.</li>
                </ol>
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
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Campaigns & Templates</h3>
                <h4>Creating a Campaign</h4>
                <ol>
                    <li>On the Campaigns page, click <button class="btn-primary" disabled>Add New Campaign</button>.</li>
                    <li>Select a campaign type, define your Campaign Name, and use the dynamic filters to build your target contact list.</li>
                    <li>Click <button class="btn-primary" disabled>Create Campaign</button>.</li>
                </ol>
                <h4>Executing Different Campaign Types</h4>
                <ul>
                    <li><strong>Call Blitz:</strong> Select the campaign. The workflow UI will present one contact at a time. Click the phone number to dial (if your device supports it), log notes in the text area, and click <button class="btn-primary" disabled>Log and Next</button> to save the activity and move to the next contact.</li>
                    <li><strong>Guided Email:</strong> Select the campaign. The workflow UI will show a pre-populated email for each contact. You can make edits directly in the text area for personalization, then click <button class="btn-primary" disabled>Open & Log</button> to open the email in your mail client and automatically log the activity.</li>
                    <li><strong>Email Merge:</strong> This type is for mass emailing. After creating the campaign, you will be prompted to export the filtered contact list as a CSV, ready for use in an external mail merge tool.</li>
                </ul>
                <h4>Managing Email Templates</h4>
                <p>On the Campaigns page, click <button class="btn-secondary" disabled>Manage Email Templates</button>. From here, you can create new templates, edit existing ones, or delete them. Use placeholders like [FirstName], [LastName], and [AccountName] for easy personalization.</p>
            </div>
        </div>
    `,
    "cognito": `
        <div>
            <div class="guide-card">
                <h2>Cognito: Your AI-Powered Intelligence Agent</h2>
                <p><strong>Value Proposition:</strong> Cognito gives you an unfair advantage by transforming public information into private intelligence. It acts as your personal research assistant, automatically scanning the web daily for news and events related to your accounts and alerting you to timely, actionable buying signals.</p>
                <h4>Notification Bell Icon <i class="fas fa-bell"></i></h4>
                <p>To ensure you never miss a timely update, a bell icon will appear next to the Cognito link in the main navigation sidebar whenever new intelligence alerts have been added since your last visit.</p>
            </div>
            <div class="guide-card">
                <h3>How-To: Act on Cognito Alerts</h3>
                <p><strong>Value Proposition:</strong> The Action Center closes the loop from intelligence to action in a single click, allowing you to respond to buying signals in minutes, not hours.</p>
                <ol>
                    <li><strong>Review Alerts:</strong> On the Cognito page, review your new alerts. Each card shows the Account, the headline of the news, and a brief summary.</li>
                    <li><strong>Open the Action Center:</strong> Click the <button class="btn-primary" disabled>Action</button> button on any alert.</li>
                    <li><strong>Use the AI-Drafted Email:</strong> The Action Center will open with a personalized outreach email already written for you by the AI, referencing the specific news event.</li>
                    <li><strong>Log Your Action (Required):</strong> The AI provides the suggestion, but you must take the action. After sending the email, it's crucial to log your work. Enter notes in the "Log an Interaction" text area and click <button class="btn-secondary" disabled>Log to Constellation</button>.</li>
                    <li><strong>Create a Follow-Up (Optional):</strong> To ensure you don't forget the next step, you can create a reminder task directly from the Action Center. Fill in the "Create a Task" fields and click <button class="btn-primary" disabled>Create in Constellation</button>. This task will then appear in your "My Tasks" list on the Command Center.</li>
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
                    <li><strong>News Articles:</strong> AI-curated articles from around the web that are relevant to your industry and target market.</li>
                    <li><strong>Campaign Assets:</strong> Pre-approved posts, images, and links provided by your marketing team, ensuring your messaging is always on-brand. These are clearly marked to differentiate them from general news.</li>
                </ul>
                <h4>Notification Bell Icon <i class="fas fa-bell"></i></h4>
                <p>A bell icon will appear next to the Social Hub link in the main navigation sidebar whenever new content has been added since your last visit.</p>
            </div>
            <div class="guide-card">
                <h3>How-To: Use the Social Hub</h3>
                <p><strong>Value Proposition:</strong> Go from finding content to posting it on your social media in under a minute, with AI assistance to craft the perfect message.</p>
                <ol>
                    <li><strong>Browse the Feed:</strong> On the Social Hub page, review the available content.</li>
                    <li><strong>Prepare Your Post:</strong> Click the <button class="btn-primary" disabled>Prepare Post</button> button on any item.</li>
                    <li><strong>Use the AI-Generated Copy:</strong> A modal will appear with a suggested social media post written for you by the AI, summarizing the article or asset.</li>
                    <li><strong>Refine (Optional):</strong> Use the "Refine" feature to have the AI rewrite the post with a different tone or style based on your prompt.</li>
                    <li><strong>Copy and Share:</strong> Click the <button class="btn-secondary" disabled>Copy Text</button> button, then click <button class="btn-primary" disabled>Post to LinkedIn</button> to open a new tab where you can paste your perfectly crafted post and share it with your network.</li>
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
