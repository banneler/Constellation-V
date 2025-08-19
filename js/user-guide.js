// This file handles the logic for the user guide page.
// It is designed to match the structure and functionality of other page scripts like marketing-hub.js,
// using shared constants and a consistent approach for UI management.

// Import common helper functions and constants from the shared file.
import {
    setupModalListeners,
    setupUserMenuAndAuth,
    loadSVGs
} from './shared_constants.js';

// === User Guide Content ===
// This object will hold the content for each section of the user guide.
// The keys match the 'data-section' attributes in the HTML nav links.
const userGuideContent = {
    "overview": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">Part 1: Overview</h2>
            <p>This section provides a high-level understanding of each major module within Constellation, outlining their purpose and key features.</p>
        </div>
    `,
    "command-center": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">1. The Command Center: Your Daily Hub</h2>
            <p>The Command Center is your home base. It’s the first page you see after logging in and is designed to show you exactly what you need to focus on for the day, from manual tasks to automated sequence steps.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">Key Features:</h3>
            <ul class="list-disc list-inside ml-4">
                <li><b>My Tasks:</b> This table lists all tasks you've manually created. Tasks that are past their due date are highlighted so you can prioritize them.</li>
                <li><b>Add New Task Button:</b> Quickly create new tasks and link them to contacts or accounts.</li>
                <li><b>Sequence Steps Due:</b> Your automated to-do list, showing sequence steps due today or overdue.</li>
                <li><b>Actionable Steps:</b> Dedicated buttons for streamlining sequence steps (e.g., "Go to LinkedIn," "Send Email").</li>
                <li><b>Upcoming Sequence Steps:</b> A forward-looking view of automated outreach, helping you prepare for future engagements.</li>
                <li><b>Recent Activities:</b> A live feed of your latest logged activities.</li>
            </ul>
        </div>
    `,
    "deals": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">2. Deals: Managing Your Pipeline</h2>
            <p>The Deals page is where you track your sales pipeline from start to finish. It provides both a detailed table of your deals and high-level visual insights to help you forecast accurately.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">Key Features:</h3>
            <ul class="list-disc list-inside ml-4">
                <li><b>Metric Cards:</b> Real-time snapshots of key sales figures, including committed forecast and total pipeline value. Managers can toggle between "My Deals" and "My Team's Deals."</li>
                <li><b>Deals Table:</b> A comprehensive, sortable list of all your deals.</li>
                <li><b>Editable Deals:</b> Directly edit deal details or navigate to the associated account page.</li>
                <li><b>"Committed" Checkbox:</b> A key feature for forecasting, including a deal's value in your "Current Commit."</li>
                <li><b>Deal Insights Charts:</b> Visual breakdowns of your pipeline, showing "Deals by Stage" and a "30/60/90 Day Funnel."</li>
                <li><b>Deal Integrity:</b> Deals cannot be deleted to ensure accurate historical reporting; instead, move lost deals to the "Closed Lost" stage.</li>
            </ul>
        </div>
    `,
    "contacts-accounts": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">3. Contacts & Accounts: Your Address Book</h2>
            <p>The Contacts and Accounts pages use a powerful and consistent split-screen layout. On the left, you have a searchable list of all your records, and on the right, a detailed panel to view and edit information.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">Key Features:</h3>
            <ul class="list-disc list-inside ml-4">
                <li><b>Searchable List:</b> Quickly find any contact or account.</li>
                <li><b>CSV Templates:</b> Downloadable templates for bulk imports are available in the Command Center.</li>
                <li><b>Details Panel:</b> View and edit all information for a contact or account.</li>
                <li><b>Account-Specific Fields:</b> Track additional details for accounts like Quantity of Sites, Employee Count, and Customer status.</li>
                <li><b>Action Buttons:</b> Quickly Log Activity, Assign a Sequence, or Add a Task from contact pages; create a New Deal or Add a Task from account pages.</li>
                <li><b>Sequence Status:</b> On the Contacts page, see if a contact is in an automated sequence and manage their enrollment.</li>
                <li><b>Related Information:</b> View associated contacts, activities, and deals to keep all information connected.</li>
                <li><b>Persistent Activity History:</b> All logged activities are permanent records for an auditable history.</li>
                <li><b>Logging Emails from Your Inbox:</b> Automatically log emails sent from external clients by BCCing bcc@constellation-crm.com.</li>
            </ul>
            <h3 class="text-2xl font-bold mt-4 mb-2">AI Contact Import (from Email Signatures & Business Cards)</h3>
            <p>This feature allows you to quickly add new contacts or enrich existing ones by simply capturing an image of an email signature or a business card.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">AI Activity Insight (Contact & Account Summaries)</h3>
            <p>Get instant summaries of interaction history and suggested next steps for your contacts and accounts.</p>
        </div>
    `,
    "campaigns": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">4. Campaigns: Targeted Outreach at Scale</h2>
            <p>The Campaigns page allows you to create and execute targeted outreach efforts to a filtered list of your contacts, perfect for product announcements, event invitations, or promotions.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">Key Features:</h3>
            <ul class="list-disc list-inside ml-4">
                <li><b>Campaign Types:</b> Create Call Blitz, Email Merge, or Guided Email campaigns.</li>
                <li><b>Dynamic Contact Filtering:</b> Precisely target contacts based on account industry or customer/prospect status.</li>
                <li><b>Campaign Execution:</b> Workflow UI guides you through calls or emails, allowing you to log notes and track progress.</li>
                <li><b>Email Template Management:</b> Create, edit, and delete email templates, using placeholders like [FirstName], [LastName], and [AccountName] for personalization.</li>
            </ul>
        </div>
    `,
    "sequences": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">5. Sequences: Automate Your Outreach</h2>
            <p>The Sequences page is where you build multi-step, automated outreach plans to ensure consistent follow-up with your prospects.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">Key Features:</h3>
            <ul class="list-disc list-inside ml-4">
                <li><b>Personal vs. Marketing Sequences:</b> You can create your own Personal Sequences from scratch or Import Marketing Sequences that have been pre-built and shared by your marketing team, ensuring brand consistency.</li>
                <li><b>Building Your Sequence:</b> Add various steps like sending an email, making a phone call, or a generic task.</li>
                <li><b>Setting Delays:</b> Define delays in days for each step to control pacing.</li>
            </ul>
            <h3 class="text-2xl font-bold mt-4 mb-2">AI Generated Sequences</h3>
            <p>Effortlessly create multi-step sales sequences by defining your goals and letting AI draft the content.</p>
        </div>
    `,
    "cognito-social-hub": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">6. Cognito & Social Hub: AI-Powered Selling</h2>
            <p>Cognito and the Social Hub are your integrated tools for modern, intelligent selling.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">Key Features:</h3>
            <ul class="list-disc list-inside ml-4">
                <li><b>Cognito Intelligence Alerts:</b> AI sales intelligence agent monitors news and events for buying signals.</li>
                <li><b>The Action Center:</b> Clicking the "Action" button on an alert opens the Action Center. Here, Cognito uses AI to draft a personalized outreach email based on the news alert. You can use this AI-generated draft, or Refine with Custom Prompt to regenerate the text with your own instructions. You can also log the sent email and create follow-up tasks without leaving the page.</li>
                <li><b>The Social Hub:</b> The Social Hub provides you with AI-curated news articles and pre-approved posts from your marketing team. Content is clearly tagged as "News Article" or "Campaign Asset" to help you differentiate. It helps you easily find relevant content to share with your professional network on platforms like LinkedIn, amplifying your voice and building your brand.</li>
            </ul>
        </div>
    `,
    "how-to-guides": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">Part 2: How-To Guides</h2>
            <p>This section provides step-by-step instructions for performing key actions and utilizing specific features within Constellation CRM.</p>
        </div>
    `,
    "how-to-tasks": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Manage Tasks (Command Center)</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Adding a New Task:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Command Center page, click the "Add New Task" button.</li>
                <li>In the pop-up, enter the task Description.</li>
                <li>Optionally, select a Due Date.</li>
                <li>Optionally, link the task to a Contact or Account using the dropdowns.</li>
                <li>Click "Add Task".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Completing a Task:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>In the "My Tasks" table on the Command Center, locate the task.</li>
                <li>Click the "Complete" button in the "Actions" column. The task will be marked as completed and moved from your active tasks.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Editing/Deleting a Task:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>In the "My Tasks" table, locate the task.</li>
                <li>Click the "Edit" or "Delete" button in the "Actions" column.</li>
                <li>Follow the prompts in the modal to update or confirm deletion.</li>
            </ol>
        </div>
    `,
    "how-to-deals": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Manage Deals</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Creating a New Deal:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to the Deals page.</li>
                <li>Click the "Add New Deal" button.</li>
                <li>Fill in the deal Name, Term, Stage, Monthly Recurring Revenue (MRC), Close Month, and Products.</li>
                <li>Click "Create Deal".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Editing Deal Details:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Deals page, locate the deal in the table.</li>
                <li>Click the "Edit" button in the "Actions" column.</li>
                <li>In the modal, update any desired fields.</li>
                <li>Click "Save".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Marking a Deal as Committed:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Deals page, locate the deal in the table.</li>
                <li>Check the "Committed" checkbox in the first column. This will automatically update your committed forecast.</li>
            </ol>
        </div>
    `,
    "how-to-contacts": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Manage Contacts</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Adding a New Contact (Manual):</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to the Contacts page.</li>
                <li>Click the "Add New Contact" button.</li>
                <li>In the modal, enter the First Name and Last Name.</li>
                <li>Click "Create Contact". The contact will be added, and their details panel will open for further editing.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Editing Contact Details:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Contacts page, select a contact from the list on the left.</li>
                <li>In the details panel on the right, update fields like Email, Phone, Title, Account, or Notes.</li>
                <li>Click "Save Changes".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Bulk Import Contacts from CSV:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Contacts page, click the "Bulk Import from CSV" button.</li>
                <li>Select your prepared CSV file. (A template is available in the Command Center.)</li>
                <li>The contacts will be imported automatically.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Logging Activity for a Contact:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Contacts page, select a contact.</li>
                <li>Click the "Log Activity" button in the "Action Buttons" section.</li>
                <li>Select the Activity Type and enter a Description.</li>
                <li>Click "Log Activity".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Assigning a Sequence to a Contact:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Contacts page, select a contact.</li>
                <li>Click the "Assign Sequence" button.</li>
                <li>Select the desired sequence from the dropdown.</li>
                <li>Click "Assign".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Adding a Task for a Contact:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Contacts page, select a contact.</li>
                <li>Click the "Add Task" button.</li>
                <li>Enter the Description and optionally a Due Date.</li>
                <li>Click "Add Task".</li>
            </ol>
        </div>
    `,
    "how-to-accounts": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Manage Accounts</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Adding a New Account (Manual):</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to the Accounts page.</li>
                <li>Click the "Add New Account" button.</li>
                <li>In the modal, enter the Account Name.</li>
                <li>Click "Create Account". The account will be added, and its details panel will open for further editing.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Editing Account Details:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Accounts page, select an account from the list on the left.</li>
                <li>In the details panel on the right, update fields like Website, Industry, Phone, Address, Quantity of Sites, Employee Count, or toggle "Is this a Customer?".</li>
                <li>Click "Save Changes".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Bulk Import Accounts from CSV:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Accounts page, click the "Bulk Import from CSV" button.</li>
                <li>Select your prepared CSV file. (A template is available in the Command Center.)</li>
                <li>The accounts will be imported automatically.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Creating a New Deal from Account Page:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Accounts page, select an account.</li>
                <li>Click the "New Deal" button.</li>
                <li>Fill in the deal details (Name, Term, Stage, MRC, Close Month, Products).</li>
                <li>Click "Create Deal".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Adding a Task for an Account:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Accounts page, select an account.</li>
                <li>Click the "Add Task" button.</li>
                <li>Enter the Description and optionally a Due Date.</li>
                <li>Click "Add Task".</li>
            </ol>
        </div>
    `,
    "how-to-ai-contact-import": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: AI Contact Import (from Email Signatures & Business Cards)</h2>
            <p>This feature allows you to quickly add new contacts or enrich existing ones by simply capturing an image of an email signature or a business card.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">How to Use:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to the Contacts page.</li>
                <li>Click the "Import Contact Screenshot" button located in the left-hand panel.</li>
                <li>A modal window will appear, providing instructions:
                    <ul class="list-disc list-inside ml-4">
                        <li><b>For Screenshots:</b> Take a screenshot of an email signature (e.g., from Outlook or a webpage). Then, with the modal open, press CTRL+V (Windows) or CMD+V (Mac) to paste the image.</li>
                        <li><b>For Mobile Camera Capture:</b> If you are on a mobile device, an additional "Take Picture of Signature" button will be visible. Click this button, and your device's camera will open. Take a clear picture of a business card or email signature.</li>
                    </ul>
                </li>
                <li>Once the image is detected, a loading spinner will appear as the AI analyzes the content.</li>
                <li>Upon successful analysis, the AI will extract key information: First Name, Last Name, Email Address, Phone Number(s), Title, and Company Name.</li>
                <li>Constellation will then attempt to automatically link the contact to an existing Account in your CRM if the extracted "Company Name" matches an existing account name (case-insensitively).</li>
                <li>The extracted data will populate the Contact Details form on the right side of the page.</li>
                <li>Review the populated fields, make any necessary adjustments, and click "Save Changes" to add or update the contact in your CRM.</li>
            </ol>
        </div>
    `,
    "how-to-ai-activity-insight": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: AI Activity Insight (Contact & Account Summaries)</h2>
            <p>Get instant summaries of interaction history and suggested next steps for your contacts and accounts.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">How to Use:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to either the Contacts page or the Accounts page.</li>
                <li>Select a specific contact or account from the list on the left.</li>
                <li>In the details panel on the right, locate and click the "AI Activity Insight" button (on the Contacts page) or "AI Account Insight" button (on the Accounts page).</li>
                <li>A loading modal will appear as the AI processes the activity log.</li>
                <li>A new modal will then display:
                    <ul class="list-disc list-inside ml-4">
                        <li><b>Summary:</b> A concise paragraph summarizing all relevant activities (calls, emails, tasks, LinkedIn messages, etc.) for that contact or account.</li>
                        <li><b>Suggested Next Steps:</b> A clear, actionable list of recommendations for what your sales representative should do next.</li>
                    </ul>
                </li>
                <li>Review the insights and use them to inform your next actions.</li>
            </ol>
        </div>
    `,
    "how-to-campaigns": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Manage Campaigns</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Creating a Call Blitz Campaign:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Campaigns page, click "Add New Campaign".</li>
                <li>Select "Call Blitz" as the campaign type.</li>
                <li>Define your Campaign Name and Description.</li>
                <li>Use the Dynamic Contact Filtering options (Industry, Customer Status) to select your target audience.</li>
                <li>Click "Create Campaign".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Executing a Call Blitz:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Campaigns page, select an active Call Blitz campaign.</li>
                <li>The details panel will transform into a workflow UI.</li>
                <li>Follow the prompts to call each contact, log notes, and mark completion.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Creating an Email Merge Campaign:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Campaigns page, click "Add New Campaign".</li>
                <li>Select "Email Merge" as the campaign type.</li>
                <li>Define your Campaign Name and Description.</li>
                <li>Use the Dynamic Contact Filtering options to select your target audience.</li>
                <li>Click "Create Campaign".</li>
                <li>Export the filtered contacts and your email template for use in a mail merge.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Creating a Guided Email Campaign:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Campaigns page, click "Add New Campaign".</li>
                <li>Select "Guided Email" as the campaign type.</li>
                <li>Define your Campaign Name and Description.</li>
                <li>Use the Dynamic Contact Filtering options to select your target audience.</li>
                <li>Click "Create Campaign".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Executing a Guided Email Campaign:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Campaigns page, select an active Guided Email campaign.</li>
                <li>The details panel will transform into a workflow UI.</li>
                <li>Review the pre-populated email for each contact, personalize as needed, and send.</li>
            </ol>
        </div>
    `,
    "how-to-email-templates": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Manage Email Templates</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Creating a New Email Template:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Campaigns page, click "Manage Email Templates".</li>
                <li>Click "Add New Template".</li>
                <li>Enter a Template Name, Subject, and the Email Body.</li>
                <li>Use placeholders like [FirstName], [LastName], and [AccountName] for dynamic content.</li>
                <li>Click "Save Template".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Editing/Deleting Email Templates:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Email Template Manager (accessed via "Manage Email Templates" button), locate the template in the list.</li>
                <li>Click "Edit" to modify its details or "Delete" to remove it.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Using Merge Fields in Templates:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>When creating or editing an email template, type the placeholders (e.g., [FirstName]) directly into the Subject or Email Body.</li>
                <li>Constellation will automatically replace these with the relevant contact or user data when the email is sent.</li>
            </ol>
        </div>
    `,
    "how-to-sequences": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Manage Sequences</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Creating a Personal Sequence (Manual):</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to the Sequences page.</li>
                <li>Click the "Add New Sequence" button.</li>
                <li>Enter a Sequence Name in the modal.</li>
                <li>Click "Create Sequence".</li>
                <li>The sequence details panel will open, allowing you to add steps.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Adding Steps to a Sequence (Manual):</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Sequences page, select a sequence.</li>
                <li>Click the "Add New Step" button.</li>
                <li>Define the Step Number, Type (e.g., Email, Call, LinkedIn, Task), Subject (for emails), Message, and Delay (Days) after the previous step.</li>
                <li>Click "Add Step".</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Editing/Deleting Sequence Steps:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Sequences page, select a sequence.</li>
                <li>In the "Sequence Steps" table, click "Edit" or "Delete" next to the desired step.</li>
                <li>Follow the prompts to update or confirm deletion.</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Importing Sequence Steps from CSV:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On the Sequences page, select an existing sequence.</li>
                <li>Click the "Bulk Import Steps from CSV" button.</li>
                <li>Select your prepared CSV file. (A template is available in the Command Center.)</li>
                <li>The steps will be imported and appended to your selected sequence.</li>
            </ol>
        </div>
    `,
    "how-to-ai-sequences": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: AI Generated Sequences</h2>
            <p>Effortlessly create multi-step sales sequences by defining your goals and letting AI draft the content.</p>
            <h3 class="text-2xl font-bold mt-4 mb-2">How to Use:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to the Sequences page.</li>
                <li>Scroll down to the "AI Generate New Sequence" section.</li>
                <li>Fill in the following details:
                    <ul class="list-disc list-inside ml-4">
                        <li><b>Sequence Goal/Topic:</b> Describe the main purpose or topic of this sequence (e.g., "Cold outreach for cloud solutions," "Follow-up after webinar," "Customer onboarding").</li>
                        <li><b>Number of Steps:</b> Define how many steps you want in the sequence (e.g., 5).</li>
                        <li><b>Total Sequence Duration (Days):</b> Specify the approximate total length of the sequence in days (e.g., 14 days).</li>
                        <li><b>Step Types:</b> Select the types of steps you want the AI to include (Email, LinkedIn Message, Call, Task). You can select multiple.</li>
                        <li><b>Other:</b> If you have a custom step type (e.g., "Gift," "Door Pull"), check "Other" and type its name into the adjacent input field.</li>
                        <li><b>Persona & Voice Prompt:</b> Describe the persona and tone for the AI-generated content (e.g., "Friendly, expert, B2B SaaS sales rep specializing in cloud infrastructure," "Direct, results-oriented, telecommunications specialist").</li>
                    </ul>
                </li>
                <li>Click the "Generate Sequence with AI" button.</li>
                <li>A loading modal will appear while the AI drafts the sequence.</li>
                <li>Once generated, the "AI Generated Sequence Preview" section will become visible, displaying a table of the proposed steps.</li>
                <li><b>Review and Edit:</b>
                    <ul class="list-disc list-inside ml-4">
                        <li>Each generated step is editable. Click the "Edit" button next to a step to modify its Type, Delay, Subject, or Message.</li>
                        <li>Click "Save" to confirm your edits or "Cancel" to revert to the AI's original suggestion for that step.</li>
                    </ul>
                </li>
                <li><b>Save or Discard:</b>
                    <ul class="list-disc list-inside ml-4">
                        <li>If you are satisfied with the generated and edited steps, click "Save AI Generated Sequence." A modal will prompt you to provide a New Sequence Name. Enter a unique name and confirm.</li>
                        <li>If you want to discard the generated sequence and start over, click "Cancel AI Generation."</li>
                    </ul>
                </li>
                <li>Upon saving, the new sequence and its steps will be added to your personal sequences list.</li>
            </ol>
        </div>
    `,
    "how-to-cognito": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Use Cognito Intelligence Alerts</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Understanding Alerts:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to the Cognito page.</li>
                <li>Review the Alert Cards which provide summaries of important buying signals related to your accounts (e.g., new executive hires, company expansion).</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Using the Action Center (AI Email Drafting):</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>On a Cognito Alert Card, click the "Action" button.</li>
                <li>The Action Center modal will open. Cognito's AI will draft a personalized outreach email based on the alert.</li>
                <li>Review the AI-generated draft. You can "Refine with Custom Prompt" to regenerate the text with your own instructions.</li>
                <li>Once satisfied, you can choose to log the sent email or create follow-up tasks directly from the modal.</li>
            </ol>
        </div>
    `,
    "how-to-social-hub": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">How-To: Use the Social Hub</h2>
            <h3 class="text-2xl font-bold mt-4 mb-2">Finding Relevant Content:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Navigate to the Social Hub page.</li>
                <li>Browse through the AI-curated news articles and pre-approved posts from your marketing team.</li>
                <li>Content is clearly tagged as "News Article" or "Campaign Asset."</li>
            </ol>
            <h3 class="text-2xl font-bold mt-4 mb-2">Sharing Campaign Assets:</h3>
            <ol class="list-decimal list-inside ml-4">
                <li>Identify a relevant "Campaign Asset" from the Social Hub.</li>
                <li>Use the provided options (if any, or manually copy) to share this content with your professional network on platforms like LinkedIn, amplifying your voice and building your brand.</li>
            </ol>
        </div>
    `,
    "download-templates": `
        <div class="p-8">
            <h2 class="text-3xl font-bold mb-4">Download CSV Templates</h2>
            <p>Use these templates to ensure your data is formatted correctly for bulk imports.</p>
            <ul class="list-disc list-inside ml-4">
                <li>Download Contacts Template</li>
                <li>Download Accounts Template</li>
                <li>Download Sequence Steps Template</li>
            </ul>
        </div>
    `
};

// === State Management ===
// A simple state object to hold current application data.
const state = {
    currentUser: null
};

// --- DOM Element Selectors ---
const authContainer = document.getElementById("auth-container");
const mainAppContainer = document.querySelector(".page-container"); // Assuming .page-container holds the main app
const navList = document.getElementById('user-guide-nav');
const contentPane = document.getElementById('user-guide-content');

// --- Functions ---

/**
 * Loads the content for a given section ID into the main content pane.
 * @param {string} sectionId The ID of the section to load, e.g., "link1".
 */
const loadContent = (sectionId) => {
    const content = userGuideContent[sectionId];
    if (content) {
        contentPane.innerHTML = content;
    } else {
        // Display an error message if the content is not found
        contentPane.innerHTML = \`
            <div class="p-8 text-center text-red-500">
                <h2 class="text-3xl font-bold mb-4">Error</h2>
                <p>Content for this section could not be found.</p>
            </div>
        \`;
    }
};

/**
 * Sets up all page-specific event listeners.
 */
function setupPageEventListeners() {
    setupModalListeners();

    // Listener for clicks on the navigation list
    if (navList) {
        navList.addEventListener('click', (event) => {
            event.preventDefault();
            
            const navButton = event.target.closest('.nav-button');
            if (navButton) {
                // Remove the 'active' class from all buttons
                document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
                // Add the 'active' class to the clicked button
                navButton.classList.add('active');

                const sectionId = navButton.dataset.section;
                loadContent(sectionId);
            }
        });
    }

    if (document.getElementById("logout-btn")) {
        document.getElementById("logout-btn").addEventListener("click", async () => {
            await window.supabase.auth.signOut();
        });
    }
}

/**
 * Initializes the page by loading necessary assets and setting up auth state.
 */
async function initializePage() {
    await loadSVGs();
    
    const { data: { session } } = await window.supabase.auth.getSession();
    
    if (session) {
        state.currentUser = session.user;
        if (authContainer) authContainer.classList.add('hidden');
        if (mainAppContainer) mainAppContainer.classList.remove('hidden');
        await setupUserMenuAndAuth(window.supabase, state);
        setupPageEventListeners();
        
        // Load the content for the first link when the page first loads
        const initialSection = navList.querySelector('.nav-button.active');
        if (initialSection) {
            loadContent(initialSection.dataset.section);
        }

    } else {
        if (authContainer) authContainer.classList.remove('hidden');
        if (mainAppContainer) mainAppContainer.classList.add('hidden');
        setupPageEventListeners();
    }

    // This listener handles changes to the auth state (e.g., login, logout).
    window.supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            state.currentUser = session.user;
            if (authContainer) authContainer.classList.add('hidden');
            if (mainAppContainer) mainAppContainer.classList.remove('hidden');
            await setupUserMenuAndAuth(window.supabase, state);
        } else {
            state.currentUser = null;
            if (authContainer) authContainer.classList.remove('hidden');
            if (mainAppContainer) mainAppContainer.classList.add('hidden');
        }
    });
}

// === App Initialization ===
document.addEventListener("DOMContentLoaded", initializePage);
