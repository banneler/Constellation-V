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

const userGuideContent = {
    "introduction": `
        <div>
            <div class="guide-card">
                <h2>Welcome to the Mission! <i class="fa-solid fa-rocket"></i></h2>
                <p>Let's be honest. Modern sales can feel like trying to navigate an asteroid field in a spaceship held together with duct tape. You're juggling tasks, chasing leads, fighting off writer's block, and trying to find that one golden nugget of information that'll close the deal. It's... a lot.</p>
                <p><strong>That's where Constellation comes in.</strong></p>
                <p>Think of it less as a CRM and more as your mission control. It’s the co-pilot that’s had three cups of coffee before you've even had one. It's designed to clear the clutter from your dashboard so you can focus on what you actually do best: building relationships and closing deals.</p>
            </div>
            <div class="guide-card">
                <h4>What's the big idea?</h4>
                <p>We built Constellation around three core principles:</p>
                <ul>
                    <li><strong>Clarity Over Chaos:</strong> Your <strong>Command Center</strong> tells you exactly what to do and when. No more guessing games, just a clear flight path for your day.</li>
                    <li><strong>Automate the Annoying Stuff:</strong> With <strong>Sequences</strong> and <strong>Campaigns</strong>, you can build powerful outreach engines that work for you, ensuring no prospect ever falls through the cracks just because you got busy.</li>
                    <li><strong>Intelligence is Your Superpower:</strong> With <strong>Cognito</strong> and our other AI tools, you get an unfair advantage. We'll find the buying signals, help you write the perfect email, and even take notes from a business card for you. It's like having a secret research team at your beck and call.</li>
                </ul>
                <p>This guide will walk you through every button, feature, and AI-powered trick in the book. So grab your helmet, strap in, and let's get ready to launch. Your sales universe is about to get a whole lot bigger (and easier to manage).</p>
            </div>
        </div>
    `,
    "command-center": `
        <div>
            <div class="guide-card">
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
                    <li><strong>Download Templates</strong>: You can download CSV templates for bulk importing data into the Contacts, Accounts, and Sequences pages.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Your Day from the Command Center</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h4>Managing Manual Tasks:</h4>
                        <ol>
                            <li>On the Command Center page, click the <button class="btn-primary" ${btnStyle}>Add New Task</button> button.</li>
                            <li>In the pop-up, enter the task Description, an optional Due Date, and link it to a Contact or Account.</li>
                            <li>Click "Add Task".</li>
                            <li>To complete, edit, or delete a task, use the <button class="btn-primary" ${btnStyle}>Complete</button>, <button class="btn-secondary" ${btnStyle}>Edit</button>, or <button class="btn-danger" ${btnStyle}>Delete</button> buttons in the "Actions" column.</li>
                        </ol>
                        <h4>Completing Sequence Steps:</h4>
                        <ol>
                            <li>In the "Sequence Steps Due" table, identify the contact and the required action.</li>
                            <li>Use the action buttons like <button class="btn-primary" ${btnStyle}>Send Email</button> or <button class="btn-primary" ${btnStyle}>Go to LinkedIn</button> to execute the step.</li>
                            <li>After completing the action, click the final <button class="btn-primary" ${btnStyle}>Complete</button> button for that row to log the activity and advance the contact in the sequence.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/command-center.PNG" alt="Command Center Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
            </div>
        </div>
    `,
    "deals": `
        <div>
            <div class="guide-card">
                <h2>2. Deals: Managing Your Pipeline</h2>
                <p>The Deals page is where you track your sales pipeline from start to finish. It provides both a detailed table of your deals and high-level visual insights to help you forecast accurately.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Metric Cards</strong>: Real-time snapshots of key sales figures: your current commit, best case, total funnel, and month-to-date closed-won revenue. Managers can toggle between "My Deals" and "My Team's Deals."</li>
                    <li><strong>Deals Table</strong>: A comprehensive, sortable list of all your deals. Click any column header to sort the table.</li>
                    <li><strong>"Committed" Checkbox</strong>: A key feature for forecasting.</li>
                    <li><strong>Deal Insights Charts</strong>: Visual breakdowns of your pipeline by Stage and a 30/60/90 Day Funnel.</li>
                    <li><strong>Deal Integrity</strong>: Deals cannot be deleted; move lost deals to the "Closed Lost" stage to maintain accurate history.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Deals</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h4>Creating a New Deal:</h4>
                        <ol>
                            <li>Navigate to the <strong>Accounts</strong> page and select an account.</li>
                            <li>In the account's detail panel, click the <button class="btn-secondary" ${btnStyle}>New Deal</button> button.</li>
                            <li>Fill in the deal details and click "Create Deal".</li>
                        </ol>
                        <h4>Editing & Committing Deals:</h4>
                        <ol>
                            <li>On the Deals page, locate the deal in the table.</li>
                            <li>Click the <button class="btn-secondary" ${btnStyle}>Edit</button> button to update details in the modal.</li>
                            <li>Check the "Committed" checkbox in the first column to include the deal in your forecast.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/deals.PNG" alt="Deals Page Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
            </div>
        </div>
    `,
    "contacts": `
        <div>
            <div class="guide-card">
                <h2>3. Contacts: Your Relationship Hub</h2>
                <p>The Contacts page uses a powerful split-screen layout. On the left is a searchable list of contacts, and on the right is a detailed panel to view and edit their information.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Contact List Icons</strong>: See key information at a glance: a `★` indicates an organic contact, a `🔥` means recent activity, and a `✈️` means they are in an active sequence.</li>
                    <li><strong>Action Buttons</strong>: Quickly <button class="btn-secondary" ${btnStyle}>Log Activity</button>, <button class="btn-secondary" ${btnStyle}>Assign Sequence</button>, or <button class="btn-secondary" ${btnStyle}>Add Task</button>.</li>
                    <li><strong>Contact Sorting</strong>: Easily sort the contact list by `First Name` or `Last Name` using the toggle buttons above the list.</li>
                    <li><strong>Sequence Status</strong>: See if a contact is in an automated sequence and manage their enrollment.</li>
                    <li><strong>Logging Emails from Your Inbox</strong>: Automatically log emails by BCCing bcc@constellation-crm.com.</li>
                    <li><strong>AI Tools</strong>: Use <button class="btn-secondary" ${btnStyle}>Import Contact Screenshot</button> for data entry and <button class="btn-primary" ${btnStyle}>AI Activity Insight</button> for summaries.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Contacts</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h4>Adding & Editing:</h4>
                        <ol>
                            <li>Click <button class="btn-primary" ${btnStyle}>Add New Contact</button> to create a new record.</li>
                            <li>Select a contact and edit their details in the right-hand panel, then click <button class="btn-primary" ${btnStyle}>Save Changes</button>.</li>
                        </ol>
                        <h4>Sorting & Importing:</h4>
                        <ol>
                            <li>Use the <button class="btn-secondary" ${btnStyle}>First Name</button> or <button class="btn-secondary" ${btnStyle}>Last Name</button> toggles to sort the list.</li>
                            <li>Click <button class="btn-secondary" ${btnStyle}>Bulk Import from CSV</button> to upload a file.</li>
                        </ol>
                        <h4>Using AI Tools:</h4>
                        <ol>
                            <li>Click <button class="btn-secondary" ${btnStyle}>Import Contact Screenshot</button> and paste an image of a signature or use your camera for a business card.</li>
                            <li>Select a contact and click <button class="btn-primary" ${btnStyle}>AI Activity Insight</button> for an instant summary and next-step suggestions.</li>
                        </ol>
                        <h4>Viewing Logged Emails:</h4>
                        <ol>
                            <li>Select a contact to view a list of logged emails in the 'Logged Emails' section.</li>
                            <li>Click the <button class="btn-secondary" ${btnStyle}>View</button> button to open a modal with the full email content.</li>
                            <li>If attachments were logged, you can click the attachment links in the modal to download them.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/contacts.PNG" alt="Contacts Page Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
            </div>
        </div>
    `,
    "accounts": `
        <div>
            <div class="guide-card">
                <h2>4. Accounts: Your 360-Degree Company View</h2>
                <p>The Accounts page is your central repository for all company-level information, using the same powerful split-screen layout as the Contacts page.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Account List Icons</strong>: See key information at a glance: a `$` indicates an open deal, and a `🔥` means recent activity.</li>
                    <li><strong>Account Filtering</strong>: Use the dropdown menu above the account list to filter by `Hot Accounts`, `Accounts with Open Deals`, `Customers`, or `Prospects`.</li>
                    <li><strong>Action Buttons</strong>: <button class="btn-secondary" ${btnStyle}>New Deal</button> or <button class="btn-primary" ${btnStyle}>Add Task</button> directly from an account's page.</li>
                    <li><strong>Related Information</strong>: View all associated contacts, activities, and deals for a complete picture.</li>
                    <li><strong>AI Account Insight</strong>: Get instant summaries of interaction history for the entire account.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Accounts</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h4>Adding & Editing:</h4>
                        <ol>
                            <li>Click <button class="btn-primary" ${btnStyle}>Add New Account</button> to create a new record.</li>
                            <li>Select an account, edit details in the right-hand panel, and click <button class="btn-primary" ${btnStyle}>Save Changes</button>.</li>
                        </ol>
                        <h4>Importing & Actions:</h4>
                        <ol>
                            <li>Click <button class="btn-secondary" ${btnStyle}>Bulk Import from CSV</button> to upload a file.</li>
                            <li>Select an account and click <button class="btn-secondary" ${btnStyle}>New Deal</button> to create a new sales opportunity.</li>
                            <li>Click <button class="btn-secondary" ${btnStyle}>AI Account Insight</button> for a summary of all activities related to the account.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/accounts.PNG" alt="Accounts Page Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
            </div>
        </div>
    `,
    "campaigns": `
        <div>
            <div class="guide-card">
                <h2>5. Campaigns: Targeted Outreach at Scale</h2>
                <p>The Campaigns page allows you to create and execute targeted outreach efforts to a filtered list of your contacts, perfect for product announcements, event invitations, or promotions.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Campaign Types</strong>: Create Call Blitz, Email Merge, or Guided Email campaigns.</li>
                    <li><strong>Dynamic Contact Filtering</strong>: Precisely target contacts based on account industry or customer/prospect status when creating a new campaign.</li>
                    <li><strong>Campaign Execution</strong>: A dedicated workflow UI guides you through each step.</li>
                    <li><strong>Email Template Management</strong>: Create, edit, and delete reusable email templates.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Campaigns</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h4>Creating a Campaign:</h4>
                        <ol>
                            <li>Click <button class="btn-primary" ${btnStyle}>Create New Campaign</button>, select a type, name it, and use filters to build your audience.</li>
                        </ol>
                        <h4>Executing a Call Blitz:</h4>
                        <ol>
                            <li>Select an active Call Blitz and click <button class="btn-primary" ${btnStyle}>Start Calling</button>.</li>
                            <li>The UI presents contacts one-by-one. Log notes and click <button class="btn-primary" ${btnStyle}>Log Call & Next</button>.</li>
                        </ol>
                        <h4>Executing a Guided Email Campaign:</h4>
                        <ol>
                            <li>Select an active Guided Email campaign and click <button class="btn-primary" ${btnStyle}>Start Guided Emails</button>.</li>
                            <li>Review and personalize each email, then click <button class="btn-primary" ${btnStyle}>Open in Email Client & Next</button>.</li>
                        </ol>
                        <h4>Executing an Email Merge:</h4>
                        <ol>
                            <li>Select an active Email Merge campaign.</li>
                            <li>Click <button class="btn-primary" ${btnStyle}>Download Contacts (.csv)</button> and <button class="btn-secondary" ${btnStyle}>Download Email Template (.txt)</button> for use in an external tool.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/campaigns.PNG" alt="Campaigns Page Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
            </div>
        </div>
    `,
    "sequences": `
       <div>
            <div class="guide-card">
                <h2>6. Sequences: Automate Your Outreach</h2>
                <p>The Sequences page is where you build multi-step, automated outreach plans to ensure consistent follow-up with your prospects.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Personal vs. Marketing Sequences</strong>: Create your own or import pre-built templates.</li>
                    <li><strong>Multi-Step Builder</strong>: Add steps like emails, calls, or LinkedIn interactions. The step table allows you to edit, delete, or reorder steps.</li>
                    <li><strong>Pacing Delays</strong>: Define delays in days between each step.</li>
                    <li><strong>AI Generation</strong>: Effortlessly create entire sequences by defining your goals and letting AI draft the content.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Sequences</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h4>Creating a Sequence Manually:</h4>
                        <ol>
                            <li>Click <button class="btn-primary" ${btnStyle}>Add New Sequence</button>, give it a name, and click "Create".</li>
                            <li>With the sequence selected, click <button class="btn-secondary" ${btnStyle}>Add New Step</button> to build it out. You can also reorder steps using the arrows in the action column.</li>
                        </ol>
                        <h4>Importing a Marketing Sequence:</h4>
                        <ol>
                            <li>Click <button class="btn-secondary" ${btnStyle}>Import Marketing Sequence</button> to see a list of pre-built templates created by your marketing team.</li>
                            <li>Select a template and click 'Import' to create a personal copy.</li>
                        </ol>
                        <h4>Using AI to Generate a Sequence:</h4>
                        <ol>
                            <li>Scroll to the "AI Generate New Sequence" section.</li>
                            <li>Fill in the details (Goal, Steps, Duration, Persona).</li>
                            <li>Click <button class="btn-primary" ${btnStyle}>Generate Sequence with AI</button>.</li>
                            <li>Review, edit, and click <button class="btn-primary" ${btnStyle}>Save AI Generated Sequence</button>.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/sequences.PNG" alt="Sequences Page Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
            </div>
        </div>
    `,
    "cognito": `
        <div>
            <div class="guide-card">
                <h2>7. Cognito: Your AI-Powered Intelligence Agent</h2>
                <p>Cognito is your integrated tool for modern, intelligent selling, monitoring the web for timely buying signals.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Intelligence Alerts</strong>: An AI agent monitors news for buying signals related to your accounts. The Cognito nav button will display a bell icon (🔔) if there are new, unread alerts.</li>
                    <li><strong>Filters</strong>: The New Alerts section can be filtered by Trigger Type, Relevance, and Account to help you find the most important alerts.</li>
                    <li><strong>The Action Center</strong>: Clicking "Action" on an alert opens a modal where Cognito's AI drafts a personalized outreach email based on the news.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Use Cognito Intelligence Alerts</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <h4>Acting on an Alert:</h4>
                        <ol>
                            <li>Navigate to the Cognito page and review the Alert Cards.</li>
                            <li>On a relevant alert, click the <button class="btn-primary" ${btnStyle}>Action</button> button.</li>
                            <li>The Action Center modal opens with an AI-drafted email.</li>
                            <li>Review the draft, use the <button class="btn-tertiary" ${btnStyle}>Refine with Custom Prompt</button> button to regenerate it if needed.</li>
                            <li>Once satisfied, log the email and create follow-up tasks directly from the modal.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/cognito.PNG" alt="Cognito Page Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
            </div>
        </div>
    `,
    "social-hub": `
        <div>
            <div class="guide-card">
                <h2>8. Social Hub: Build Your Brand</h2>
                <p>The Social Hub makes it effortless to build your professional brand by providing a steady stream of high-quality, relevant content to share.</p>
                <h4>Key Features:</h4>
                <ul>
                    <li><strong>Curated Content</strong>: The Hub provides AI-curated news articles and pre-approved posts from your marketing team, clearly tagged as "News Article" or "Campaign Asset". The Social Hub nav button will display a bell icon (🔔) if there is new content to view.</li>
                    <li><strong>AI-Assisted Posting</strong>: When you prepare a post, the AI will generate suggested text which you can refine before sharing.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Share AI-Curated News</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <ol>
                            <li>Navigate to the Social Hub page.</li>
                            <li>Find a post tagged as "News Article".</li>
                            <li>Click <button class="btn-primary" ${btnStyle}>Prepare Post</button>.</li>
                            <li>A modal will open with AI-generated copy. You can refine this with a custom prompt.</li>
                            <li>Click <button class="btn-secondary" ${btnStyle}>Copy Text</button> and then <button class="btn-primary" ${btnStyle}>Post to LinkedIn</button> to share.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/social-hub.PNG" alt="Social Hub Page Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
            </div>
            <div class="guide-card">
                <h3>How-To: Share Marketing-Generated Posts</h3>
                <div style="display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 300px;">
                        <ol>
                            <li>Find a post tagged as "Campaign Asset". These are pre-approved by your marketing team.</li>
                            <li>Click <button class="btn-primary" ${btnStyle}>Prepare Post</button>.</li>
                            <li>The modal will open with the pre-approved text, ready to go.</li>
                            <li>Click <button class="btn-secondary" ${btnStyle}>Copy Text</button> and then <button class="btn-primary" ${btnStyle}>Post to LinkedIn</button>.</li>
                        </ol>
                    </div>
                    <div style="flex: 1; min-width: 300px; max-width: 700px;">
                        <img src="assets/user-guide/social-hub-II.PNG" alt="Social Hub Marketing Post Screenshot" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color);">
                    </div>
                </div>
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
