// js/user-guide.js
import {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    setupModalListeners,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper style for inline buttons to make them look good in the guide
const btnStyle = `style="display: inline-block; pointer-events: none; margin: 0 4px; transform: scale(0.9);"`;
// Helper style for screenshots
const imgStyle = `style="width: 100%; max-width: 800px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--border-color);"`;

const userGuideContent = {
    "introduction": `
        <div>
            <div class="guide-card">
                <h2>Introduction</h2>
                <p>Welcome to Constellation, your all-in-one platform for intelligent sales and customer relationship management. This guide will walk you through the core features of the application to help you streamline your workflow and close more deals.</p>
            </div>
            <div class="guide-card">
                <h2>Part 1: The Features</h2>
                <p>This section provides a detailed look at each major module within Constellation, outlining its purpose, key features, and step-by-step instructions for use.</p>
            </div>
        </div>
    `,
    "command-center": `
        <div>
            <div class="guide-card">
                <img src="assets/user-guide/command-center.PNG" alt="Command Center Screenshot" ${imgStyle}>
                <h2>1. The Command Center: Your Daily Hub</h2>
                <p>The Command Center is your home base. It’s the first page you see after logging in and is designed to show you exactly what you need to focus on for the day, from manual tasks to automated sequence steps.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>My Tasks</strong>: This table lists all tasks you've manually created. Tasks that are past their due date are highlighted so you can prioritize them.</li>
                    <li><strong>Add New Task Button</strong>: Quickly create new tasks and link them to contacts or accounts.</li>
                    <li><strong>Sequence Steps Due</strong>: Your automated to-do list, showing sequence steps due today or overdue.</li>
                    <li><strong>Actionable Steps</strong>: Dedicated buttons for streamlining sequence steps (e.g., "Go to LinkedIn," "Send Email").</li>
                    <li><strong>Upcoming Sequence Steps</strong>: A forward-looking view of automated outreach, helping you prepare for future engagements.</li>
                    <li><strong>Recent Activities</strong>: A live feed of your latest logged activities.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Tasks (Command Center)</h3>
                <h4>Adding a New Task:</h4>
                <ol>
                    <li>On the Command Center page, click the <button class="btn-primary" ${btnStyle}>Add New Task</button> button.</li>
                    <li>In the pop-up, enter the task Description.</li>
                    <li>Optionally, select a Due Date.</li>
                    <li>Optionally, link the task to a Contact or Account using the dropdowns.</li>
                    <li>Click "Add Task".</li>
                </ol>
                <h4>Completing a Task:</h4>
                <ol>
                    <li>In the "My Tasks" table on the Command Center, locate the task.</li>
                    <li>Click the <button class="btn-primary" ${btnStyle}>Complete</button> button in the "Actions" column. The task will be marked as completed and moved from your active tasks.</li>
                </ol>
                <h4>Editing/Deleting a Task:</h4>
                <ol>
                    <li>In the "My Tasks" table, locate the task.</li>
                    <li>Click the <button class="btn-secondary" ${btnStyle}>Edit</button> or <button class="btn-danger" ${btnStyle}>Delete</button> button in the "Actions" column.</li>
                    <li>Follow the prompts in the modal to update or confirm deletion.</li>
                </ol>
            </div>
            <div class="guide-card">
                <h3>How-To: Complete Sequence Steps (Command Center)</h3>
                <ol>
                    <li><strong>Review Steps</strong>: In the "Sequence Steps Due" table, identify the contact and the required action (e.g., Email, LinkedIn, Call).</li>
                    <li><strong>Execute the Step</strong>:
                        <ul>
                            <li>For <strong>Email</strong> steps, click <button class="btn-primary" ${btnStyle}>Send Email</button>. This will open a modal where you can review and edit the AI-personalized email draft before opening it in your default email client.</li>
                            <li>For <strong>LinkedIn</strong> steps, click <button class="btn-primary" ${btnStyle}>Go to LinkedIn</button>. This will open a new tab to the contact's profile. After you've taken your action (e.g., sent a message, connection request), return to Constellation.</li>
                            <li>For <strong>Call</strong> or other generic steps, perform the action as required.</li>
                        </ul>
                    </li>
                    <li><strong>Mark as Complete</strong>: After executing the step, click the <button class="btn-primary" ${btnStyle}>Complete</button> button for that row. This logs the activity and automatically advances the contact to the next step in the sequence.</li>
                </ol>
            </div>
        </div>
    `,
    "deals": `
        <div>
            <div class="guide-card">
                <img src="assets/user-guide/deals.PNG" alt="Deals Page Screenshot" ${imgStyle}>
                <h2>2. Deals: Managing Your Pipeline</h2>
                <p>The Deals page is where you track your sales pipeline from start to finish. It provides both a detailed table of your deals and high-level visual insights to help you forecast accurately.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Metric Cards</strong>: Real-time snapshots of key sales figures, including committed forecast and total pipeline value. Managers can toggle between "My Deals" and "My Team's Deals."</li>
                    <li><strong>Deals Table</strong>: A comprehensive, sortable list of all your deals.</li>
                    <li><strong>Editable Deals</strong>: Directly edit deal details or navigate to the associated account page.</li>
                    <li><strong>"Committed" Checkbox</strong>: A key feature for forecasting, including a deal's value in your "Current Commit."</li>
                    <li><strong>Deal Insights Charts</strong>: Visual breakdowns of your pipeline, showing "Deals by Stage" and a "30/60/90 Day Funnel."</li>
                    <li><strong>Deal Integrity</strong>: Deals cannot be deleted to ensure accurate historical reporting; instead, move lost deals to the "Closed Lost" stage.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Deals</h3>
                <h4>Creating a New Deal:</h4>
                <ol>
                    <li>Navigate to the <strong>Accounts</strong> page and select the account for which you want to create a deal.</li>
                    <li>In the account's detail panel, click the <button class="btn-secondary" ${btnStyle}>New Deal</button> button.</li>
                    <li>Fill in the deal Name, Term, Stage, Monthly Recurring Revenue (MRC), Close Month, and Products.</li>
                    <li>Click "Create Deal".</li>
                </ol>
                <h4>Editing Deal Details:</h4>
                <ol>
                    <li>On the Deals page, locate the deal in the table.</li>
                    <li>Click the <button class="btn-secondary" ${btnStyle}>Edit</button> button in the "Actions" column.</li>
                    <li>In the modal, update any desired fields.</li>
                    <li>Click "Save".</li>
                </ol>
                <h4>Marking a Deal as Committed:</h4>
                <ol>
                    <li>On the Deals page, locate the deal in the table.</li>
                    <li>Check the "Committed" checkbox in the first column. This will automatically update your committed forecast.</li>
                </ol>
            </div>
        </div>
    `,
    "contacts": `
        <div>
            <div class="guide-card">
                <img src="assets/user-guide/contacts.PNG" alt="Contacts Page Screenshot" ${imgStyle}>
                <h2>3. Contacts: Your Relationship Hub</h2>
                <p>The Contacts page uses a powerful split-screen layout. On the left is a searchable list of all your individual contacts, and on the right is a detailed panel to view and edit their information.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Searchable List</strong>: Quickly find any contact.</li>
                    <li><strong>Details Panel</strong>: View and edit all information for a contact, including their associated Account.</li>
                    <li><strong>Action Buttons</strong>: Quickly Log Activity, Assign a Sequence, or Add a Task.</li>
                    <li><strong>Sequence Status</strong>: See if a contact is in an automated sequence and manage their enrollment.</li>
                    <li><strong>Related Information</strong>: View a complete history of activities for the selected contact.</li>
                    <li><strong>Logging Emails from Your Inbox</strong>: Automatically log emails sent from external clients by BCCing bcc@constellation-crm.com.</li>
                    <li><strong>AI Contact Import</strong>: Quickly add new contacts or enrich existing ones by capturing an image of an email signature or a business card.</li>
                    <li><strong>AI Activity Insight</strong>: Get instant summaries of interaction history and suggested next steps for your contacts.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Contacts</h3>
                <h4>Adding a New Contact (Manual):</h4>
                <ol>
                    <li>Navigate to the Contacts page.</li>
                    <li>Click the <button class="btn-primary" ${btnStyle}>Add New Contact</button> button.</li>
                    <li>In the modal, enter the First Name and Last Name.</li>
                    <li>Click "Create Contact". The details panel will open for further editing.</li>
                </ol>
                <h4>Editing Contact Details:</h4>
                <ol>
                    <li>On the Contacts page, select a contact from the list.</li>
                    <li>In the details panel, update fields like Email, Phone, Title, Account, or Notes.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Save Changes</button>.</li>
                </ol>
                <h4>Sorting the Contact List:</h4>
                <ol>
                    <li>Above the contact list, click the <button class="btn-secondary" ${btnStyle}>First Name</button> or <button class="btn-secondary" ${btnStyle}>Last Name</button> toggle buttons to sort the list accordingly.</li>
                </ol>
                <h4>Bulk Import Contacts from CSV:</h4>
                <ol>
                    <li>On the Contacts page, click the <button class="btn-secondary" ${btnStyle}>Bulk Import from CSV</button> button.</li>
                    <li>Select your prepared CSV file. (A template is available in the Command Center.)</li>
                </ol>
                <h4>AI Contact Import (from Email Signatures & Business Cards):</h4>
                <ol>
                    <li>Navigate to the Contacts page and click the <button class="btn-secondary" ${btnStyle}>Import Contact Screenshot</button> button.</li>
                    <li>A modal will appear. For screenshots, paste the image (CTRL+V/CMD+V). For mobile, use the "Take Picture of Signature" button.</li>
                    <li>The AI will analyze the image and populate the contact's details.</li>
                    <li>Review the populated fields and click <button class="btn-primary" ${btnStyle}>Save Changes</button>.</li>
                </ol>
                <h4>AI Activity Insight:</h4>
                <ol>
                    <li>On the Contacts page, select a contact.</li>
                    <li>Click the <button class="btn-primary" ${btnStyle}>AI Activity Insight</button> button.</li>
                    <li>A modal will display a summary of activities and suggested next steps.</li>
                </ol>
            </div>
        </div>
    `,
    "accounts": `
        <div>
            <div class="guide-card">
                <img src="assets/user-guide/accounts.PNG" alt="Accounts Page Screenshot" ${imgStyle}>
                <h2>4. Accounts: Your 360-Degree Company View</h2>
                <p>The Accounts page is your central repository for all company-level information, using the same powerful split-screen layout as the Contacts page.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Searchable List</strong>: Quickly find any account.</li>
                    <li><strong>Details Panel</strong>: View and edit all company-level information.</li>
                    <li><strong>Account-Specific Fields</strong>: Track details like Quantity of Sites, Employee Count, and Customer status.</li>
                    <li><strong>Action Buttons</strong>: Create a New Deal or Add a Task directly from an account's page.</li>
                    <li><strong>Related Information</strong>: View all associated contacts, activities, and deals for a complete picture.</li>
                    <li><strong>AI Activity Insight</strong>: Get instant summaries of interaction history and suggested next steps for your accounts.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Accounts</h3>
                <h4>Adding a New Account (Manual):</h4>
                <ol>
                    <li>Navigate to the Accounts page.</li>
                    <li>Click the <button class="btn-primary" ${btnStyle}>Add New Account</button> button.</li>
                    <li>In the modal, enter the Account Name.</li>
                    <li>Click "Create Account". The details panel will open for further editing.</li>
                </ol>
                <h4>Editing Account Details:</h4>
                <ol>
                    <li>On the Accounts page, select an account from the list.</li>
                    <li>In the details panel, update fields like Website, Industry, or Phone.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Save Changes</button>.</li>
                </ol>
                <h4>Bulk Import Accounts from CSV:</h4>
                <ol>
                    <li>On the Accounts page, click the <button class="btn-secondary" ${btnStyle}>Bulk Import from CSV</button> button.</li>
                    <li>Select your prepared CSV file. (A template is available in the Command Center.)</li>
                </ol>
                <h4>Creating a New Deal from Account Page:</h4>
                <ol>
                    <li>On the Accounts page, select an account.</li>
                    <li>Click the <button class="btn-secondary" ${btnStyle}>New Deal</button> button.</li>
                    <li>Fill in the deal details (Name, Term, Stage, MRC, etc.).</li>
                    <li>Click "Create Deal".</li>
                </ol>
                <h4>AI Activity Insight:</h4>
                <ol>
                    <li>On the Accounts page, select an account.</li>
                    <li>Click the <button class="btn-secondary" ${btnStyle}>AI Account Insight</button> button.</li>
                    <li>A modal will display a summary of activities and suggested next steps for the entire account.</li>
                </ol>
            </div>
        </div>
    `,
    "campaigns": `
        <div>
            <div class="guide-card">
                <img src="assets/user-guide/campaigns.PNG" alt="Campaigns Page Screenshot" ${imgStyle}>
                <h2>5. Campaigns: Targeted Outreach at Scale</h2>
                <p>The Campaigns page allows you to create and execute targeted outreach efforts to a filtered list of your contacts, perfect for product announcements, event invitations, or promotions.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Campaign Types</strong>: Create Call Blitz, Email Merge, or Guided Email campaigns.</li>
                    <li><strong>Dynamic Contact Filtering</strong>: Precisely target contacts based on account industry or customer/prospect status.</li>
                    <li><strong>Campaign Execution</strong>: Workflow UI guides you through calls or emails, allowing you to log notes and track progress.</li>
                    <li><strong>Email Template Management</strong>: Create, edit, and delete email templates, using placeholders like [FirstName], [LastName], and [AccountName] for personalization.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Campaigns</h3>
                <h4>Creating a Campaign:</h4>
                <ol>
                    <li>On the Campaigns page, click <button class="btn-primary" ${btnStyle}>Create New Campaign</button> and select a type.</li>
                    <li>Define your Campaign Name and use the filters to select your target audience.</li>
                    <li>Click "Create Campaign".</li>
                </ol>
                <h4>Executing a Call Blitz Campaign:</h4>
                <ol>
                    <li>Select an active Call Blitz campaign from the list.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Start Calling</button>. The UI will present one contact at a time.</li>
                    <li>Make the call, enter your notes in the text area provided.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Log Call & Next</button> to save the activity and move to the next contact, or <button class="btn-secondary" ${btnStyle}>Skip & Next</button> to move on without logging.</li>
                </ol>
                <h4>Executing a Guided Email Campaign:</h4>
                <ol>
                    <li>Select an active Guided Email campaign from the list.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Start Guided Emails</button>. The UI will present one contact at a time with the email template populated.</li>
                    <li>Review and personalize the email text.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Open in Email Client & Next</button> to open the email in your default mail app and advance to the next contact.</li>
                </ol>
                <h4>Executing an Email Merge Campaign:</h4>
                <ol>
                    <li>Select an active Email Merge campaign from the list.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Download Contacts (.csv)</button> to get a list of your filtered contacts.</li>
                    <li>Click <button class="btn-secondary" ${btnStyle}>Download Email Template (.txt)</button> to get the email body.</li>
                    <li>Use these two files with an external mail merge tool.</li>
                </ol>
                <h4>Managing Email Templates:</h4>
                <ol>
                    <li>On the Campaigns page, click <button class="btn-secondary" ${btnStyle}>Manage Email Templates</button>.</li>
                    <li>Click "Add New Template" or "Edit"/"Delete" on an existing one.</li>
                    <li>Use placeholders like [FirstName] for dynamic content and save.</li>
                </ol>
            </div>
        </div>
    `,
    "sequences": `
       <div>
            <div class="guide-card">
                <img src="assets/user-guide/sequences.PNG" alt="Sequences Page Screenshot" ${imgStyle}>
                <h2>6. Sequences: Automate Your Outreach</h2>
                <p>The Sequences page is where you build multi-step, automated outreach plans to ensure consistent follow-up with your prospects.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Personal vs. Marketing Sequences</strong>: Create your own Personal Sequences or Import pre-built Marketing Sequences.</li>
                    <li><strong>Building Your Sequence</strong>: Add steps like sending an email, making a phone call, or a generic task.</li>
                    <li><strong>Setting Delays</strong>: Define delays in days for each step to control pacing.</li>
                    <li><strong>AI Generated Sequences</strong>: Effortlessly create multi-step sales sequences by defining your goals and letting AI draft the content.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Sequences</h3>
                <h4>Creating a Personal Sequence (Manual):</h4>
                <ol>
                    <li>Navigate to the Sequences page and click <button class="btn-primary" ${btnStyle}>Add New Sequence</button>.</li>
                    <li>Enter a Sequence Name and click "Create Sequence".</li>
                    <li>With the sequence selected, click <button class="btn-secondary" ${btnStyle}>Add New Step</button> and define its parameters.</li>
                </ol>
                <h4>Importing Sequence Steps from CSV:</h4>
                <ol>
                    <li>Select an existing sequence and click <button class="btn-secondary" ${btnStyle}>Bulk Import Steps from CSV</button>.</li>
                    <li>Select your prepared CSV file. The steps will be appended to your sequence.</li>
                </ol>
                <h4>AI Generated Sequences:</h4>
                <ol>
                    <li>Scroll down to the "AI Generate New Sequence" section.</li>
                    <li>Fill in the details: Goal, Number of Steps, Duration, Step Types, and Persona.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Generate Sequence with AI</button>.</li>
                    <li>Review and edit the generated steps in the preview table.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Save AI Generated Sequence</button> and provide a unique name.</li>
                </ol>
            </div>
        </div>
    `,
    "cognito": `
        <div>
            <div class="guide-card">
                <img src="assets/user-guide/cognito.PNG" alt="Cognito Page Screenshot" ${imgStyle}>
                <h2>7. Cognito: Your AI-Powered Intelligence Agent</h2>
                <p>Cognito is your integrated tool for modern, intelligent selling, monitoring the web for timely buying signals.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Cognito Intelligence Alerts</strong>: An AI agent monitors news and events for buying signals related to your accounts.</li>
                    <li><strong>The Action Center</strong>: Clicking "Action" on an alert opens a modal where Cognito's AI drafts a personalized outreach email based on the news. You can use this draft, refine it with a custom prompt, log the interaction, and create follow-up tasks all in one place.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Use Cognito Intelligence Alerts</h3>
                <h4>Understanding Alerts:</h4>
                <ol>
                    <li>Navigate to the Cognito page.</li>
                    <li>Review the Alert Cards which provide summaries of important buying signals.</li>
                </ol>
                <h4>Using the Action Center (AI Email Drafting):</h4>
                <ol>
                    <li>On a Cognito Alert Card, click the <button class="btn-primary" ${btnStyle}>Action</button> button.</li>
                    <li>The Action Center modal will open with an AI-drafted email.</li>
                    <li>Review the draft. Use the <button class="btn-tertiary" ${btnStyle}>Refine with Custom Prompt</button> button to regenerate the text.</li>
                    <li>Once satisfied, log the sent email or create follow-up tasks directly from the modal.</li>
                </ol>
            </div>
        </div>
    `,
    "social-hub": `
        <div>
            <div class="guide-card">
                <img src="assets/user-guide/social-hub.PNG" alt="Social Hub Page Screenshot" ${imgStyle}>
                <h2>8. Social Hub: Build Your Brand</h2>
                <p>The Social Hub makes it effortless to build your professional brand by providing a steady stream of high-quality, relevant content to share.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Curated Content</strong>: The Hub provides AI-curated news articles and pre-approved posts from your marketing team, clearly tagged as "News Article" or "Campaign Asset".</li>
                    <li><strong>AI-Assisted Posting</strong>: When you prepare a post, the AI will generate suggested text which you can refine before sharing.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Use the Social Hub</h3>
                <h4>Finding and Sharing Content:</h4>
                <ol>
                    <li>Navigate to the Social Hub page and browse the content.</li>
                    <li>Click <button class="btn-primary" ${btnStyle}>Prepare Post</button> on a relevant item.</li>
                    <li>A modal will open with AI-generated copy.</li>
                    <li>Click <button class="btn-secondary" ${btnStyle}>Copy Text</button> and then <button class="btn-primary" ${btnStyle}>Post to LinkedIn</button> to easily share with your network.</li>
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
