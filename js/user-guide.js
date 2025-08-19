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
                <h3>How-To: Manage Sequence Steps Due</h3>
                <p><strong>Value Proposition:</strong> This section transforms your automated sequences into a simple, actionable workflow, ensuring you execute every step of your sales playbook with precision and speed.</p>
                <ol>
                    <li><strong>Review the Step:</strong> Each row shows you the Contact, the Sequence they are in, and the specific step that is due (e.g., "Email", "LinkedIn").</li>
                    <li><strong>Use Action Buttons:</strong>
                        <ul>
                            <li><strong>Send Email:</strong> Opens your default email client with the contact's email address pre-filled.</li>
                            <li><strong>Go to LinkedIn:</strong> Opens a new tab directly to the contact's LinkedIn profile (if available).</li>
                            <li><strong>Complete:</strong> Once you've performed the action, click this button. A modal will appear allowing you to log notes about the interaction (e.g., "Left a voicemail," "Sent connection request"). This logs the activity and advances the contact to the next step in the sequence.</li>
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
                    <li><strong>Advanced Sorting:</strong> The Accounts list isn't static. Use the dropdown menu at the top to instantly sort your entire list by <strong>Account Name</strong>, <strong>Last Activity Date</strong>, or <strong>Creation Date</strong>, allowing you to easily surface top-priority accounts.</li>
                    <li><strong>"Organic" Star (<i class="fas fa-star" style="color: #4CAF50;"></i>):</strong> Mark an Account as "Organic" to signify that it was sourced through inbound marketing or other non-sales efforts. This helps with accurate reporting on which channels are driving the most business.</li>
                    <li><strong>Comprehensive Details:</strong> Track critical account information like Quantity of Sites, Employee Count, and Customer Status to better qualify and segment your prospects.</li>
                </ul>
            </div>
             <div class="guide-card">
                <h3>How-To: The Intelligent CSV Import Engine</h3>
                <p><strong>Value Proposition:</strong> Our import tool protects your data integrity. It doesn't just blindly add new records; it intelligently detects potential duplicates or updates to existing records and gives you full control over every change.</p>
                <ol>
                    <li>On the Accounts page, click "More Actions" and select "Bulk Import from CSV". A downloadable template is available on the Command Center to ensure your data is formatted correctly.</li>
                    <li>After uploading your file, the system will present you with an interactive preview.</li>
                    <li><strong>Review Changes:</strong> For each row, the system will display a status: "New Record", "Potential Duplicate", or "Update to Existing".</li>
                    <li><strong>Accept or Reject:</strong> You have row-by-row control. Use the checkboxes to accept the suggested changes or skip a specific row if you don't want to import it. This prevents accidental overwrites or duplicate entries.</li>
                    <li>Click "Confirm Import" to finalize the process.</li>
                </ol>
            </div>
            <div class="guide-card">
                <h3>How-To: AI Account Insight</h3>
                <p><strong>Value Proposition:</strong> Get up to speed on any account instantly. This feature is perfect for preparing for a call or handing off an account to a colleague.</p>
                <ol>
                    <li>Navigate to the Accounts page and select a record from the list.</li>
                    <li>In the details panel on the right, click the "AI Account Insight" button.</li>
                    <li>A modal will appear with a concise, AI-generated summary of all logged activities for that account and a list of clear, actionable suggested next steps.</li>
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
                    <li><strong>Action Buttons:</strong> From a contact's detail view, you can instantly <strong>Log Activity</strong>, <strong>Assign a Sequence</strong>, or <strong>Add a Task</strong>.</li>
                    <li><strong>Sequence Status:</strong> See at a glance if a contact is currently active in a sequence and which one.</li>
                    <li><strong>Log Emails from Your Inbox:</strong> Keep your activity history complete without extra work. By simply BCCing <strong>bcc@constellation-crm.com</strong> on any email you send from an external client (like Outlook or Gmail), the email will be automatically logged as an activity for that contact in Constellation.</li>
                </ul>
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
                <h4>AI Write Email</h4>
                <p><strong>Value Proposition:</strong> Overcome writer's block and craft the perfect outreach email in seconds, directly from the contact's page.</p>
                <ol>
                    <li>Select a contact from the list.</li>
                    <li>In the details panel, click the "AI Write Email" button.</li>
                    <li>A modal will appear. Enter a simple prompt describing your goal (e.g., "Write a follow-up email asking for a 15-minute meeting next week").</li>
                    <li>The AI will generate a complete, professional email draft. You can copy it, or refine it further with another prompt.</li>
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
                    <li><strong>Deal Integrity:</strong> To ensure accurate historical reporting and protect your data, deals cannot be deleted. Instead, move lost deals to the "Closed Lost" stage to maintain a complete record of your sales efforts.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Deals</h3>
                <h4>Editing a Deal</h4>
                <ol>
                    <li>Navigate to the Deals page.</li>
                    <li>In the "Active Pipeline" table, find the deal you wish to update and click the "Edit" button.</li>
                    <li>In the modal, you can update the <strong>Name</strong>, <strong>Term</strong>, <strong>Stage</strong>, <strong>MRC</strong>, and any other relevant fields.</li>
                    <li>Click "Save".</li>
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
                <h3>How-To: Create and Manage Sequences</h3>
                <h4>Creating a Sequence Manually</h4>
                <ol>
                    <li>Navigate to the Sequences page and click "Add New Sequence".</li>
                    <li>Give the sequence a name and click "Create".</li>
                    <li>In the details panel, click "Add New Step" to build your sequence, defining the type, message, and delay for each step.</li>
                </ol>
                <h4>Importing Sequence Steps from CSV</h4>
                 <ol>
                    <li>Select an existing sequence.</li>
                    <li>Click "More Actions" and choose "Bulk Import Steps from CSV".</li>
                    <li>Select your prepared CSV file (a template is available on the Command Center). The steps will be appended to your sequence.</li>
                </ol>
                <h4>Bulk Assigning Contacts to a Sequence</h4>
                 <ol>
                    <li>From the <strong>Contacts</strong> page, use the checkboxes to select multiple contacts.</li>
                    <li>Click the "Bulk Assign Sequence" button that appears at the top of the list.</li>
                    <li>Select the desired sequence from the dropdown menu and confirm. All selected contacts will be enrolled.</li>
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
                    <li><strong>Multiple Campaign Types:</strong>
                        <ul>
                            <li><strong>Call Blitz:</strong> A focused calling effort with a guided workflow to track calls and log notes.</li>
                            <li><strong>Email Merge:</strong> For large-scale email blasts. You can export the targeted contact list for use in an external mail merge tool.</li>
                            <li><strong>Guided Email:</strong> A more personalized, one-by-one approach where you can review and customize each email before sending.</li>
                        </ul>
                    </li>
                    <li><strong>Dynamic Contact Filtering:</strong> Precisely target the right audience by filtering your contacts based on account industry or their customer/prospect status.</li>
                </ul>
            </div>
            <div class="guide-card">
                <h3>How-To: Manage Campaigns & Templates</h3>
                <h4>Creating and Executing a Campaign</h4>
                <ol>
                    <li>On the Campaigns page, click "Add New Campaign" and select a campaign type.</li>
                    <li>Define your Campaign Name and use the dynamic filters to build your target contact list.</li>
                    <li>Click "Create Campaign".</li>
                    <li>To begin, select the active campaign from your list. The details panel will transform into the guided workflow UI to help you execute your outreach.</li>
                </ol>
                <h4>Managing Email Templates</h4>
                <p>On the Campaigns page, click "Manage Email Templates". From here, you can create new templates, edit existing ones, or delete them. Use placeholders like [FirstName], [LastName], and [AccountName] for easy personalization.</p>
            </div>
        </div>
    `,
    "cognito": `
        <div>
            <div class="guide-card">
                <h2>Cognito: Your AI-Powered Intelligence Agent</h2>
                <p><strong>Value Proposition:</strong> Cognito gives you an unfair advantage by transforming public information into private intelligence. It acts as your personal research assistant, automatically scanning the web for news and events related to your accounts and alerting you to timely, actionable buying signals.</p>
                <h4>How it Works</h4>
                <p>Every day, Cognito's AI engine monitors thousands of sources for events like executive hires, funding rounds, acquisitions, and major company announcements. When it finds a relevant event for one of your accounts, it generates a concise alert and places it on your Cognito page.</p>
                <h4>Notification Bell Icon <i class="fas fa-bell"></i></h4>
                <p>To ensure you never miss a timely update, a bell icon will appear next to the Cognito link in the main navigation sidebar whenever new intelligence alerts have been added since your last visit.</p>
            </div>
            <div class="guide-card">
                <h3>How-To: Act on Cognito Alerts</h3>
                <p><strong>Value Proposition:</strong> The Action Center closes the loop from intelligence to action in a single click, allowing you to respond to buying signals in minutes, not hours.</p>
                <ol>
                    <li><strong>Review Alerts:</strong> On the Cognito page, review your new alerts. Each card shows the Account, the headline of the news, and a brief summary.</li>
                    <li><strong>Open the Action Center:</strong> Click the "Action" button on any alert.</li>
                    <li><strong>Use the AI-Drafted Email:</strong> The Action Center will open with a personalized outreach email already written for you by the AI, referencing the specific news event.</li>
                    <li><strong>Refine (Optional):</strong> If you want to adjust the tone or message, use the "Refine with Custom Prompt" feature to have the AI rewrite the email based on your instructions.</li>
                    <li><strong>Log and Create Tasks:</strong> After you've sent the email, you can log the interaction and create a follow-up task (e.g., "Follow up in 1 week") without ever leaving the Action Center.</li>
                    <li><strong>Dismiss:</strong> If an alert is not relevant, simply click "Dismiss" to remove it from your feed.</li>
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
                    <li><strong>Campaign Assets:</strong> Pre-approved posts, images, and links provided by your marketing team, ensuring your messaging is always on-brand.</li>
                </ul>
                <h4>Notification Bell Icon <i class="fas fa-bell"></i></h4>
                <p>A bell icon will appear next to the Social Hub link in the main navigation sidebar whenever new content has been added since your last visit.</p>
            </div>
            <div class="guide-card">
                <h3>How-To: Use the Social Hub</h3>
                <p><strong>Value Proposition:</strong> Go from finding content to posting it on your social media in under a minute, with AI assistance to craft the perfect message.</p>
                <ol>
                    <li><strong>Browse the Feed:</strong> On the Social Hub page, review the available content.</li>
                    <li><strong>Prepare Your Post:</strong> Click the "Prepare Post" button on any item.</li>
                    <li><strong>Use the AI-Generated Copy:</strong> A modal will appear with a suggested social media post written for you by the AI, summarizing the article or asset.</li>
                    <li><strong>Refine (Optional):</strong> Use the "Refine" feature to have the AI rewrite the post with a different tone or style based on your prompt.</li>
                    <li><strong>Copy and Share:</strong> Click the "Copy Text" button, then click "Post to LinkedIn" to open a new tab where you can paste your perfectly crafted post and share it with your network.</li>
                    <li><strong>Dismiss:</strong> Click "Dismiss" on any item to remove it from your feed.</li>
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
