/**
 * user-guide.js
 * * This script provides the functionality for the User Guide page.
 * It populates the sidebar with navigation links that anchor to sections on the page
 * and enables smooth scrolling.
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if the essential elements are on the page before running the script
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) {
        console.error("Sidebar element not found. User guide script will not run.");
        return;
    }

    // Define the navigation links specifically for the user guide page.
    // These links point to anchors within this same page.
    const userGuideNavLinks = [
        { name: 'Introduction', href: '#introduction', icon: 'fa-book-open' },
        { name: 'Command Center', href: '#command-center', icon: 'fa-rocket' },
        { name: 'Deals', href: '#deals', icon: 'fa-handshake' },
        { name: 'Contacts & Accounts', href: '#contacts-accounts', icon: 'fa-address-book' },
        { name: 'Campaigns', href: '#campaigns', icon: 'fa-bullhorn' },
        { name: 'Sequences', href: '#sequences', icon: 'fa-cogs' },
        { name: 'Cognito & Social Hub', href: '#cognito-social', icon: 'fa-brain' },
    ];

    /**
     * Populates the sidebar with navigation links specific to the user guide.
     * This function replaces the standard site navigation.
     */
    function populateUserGuideNav() {
        const navContainer = sidebar.querySelector('nav');
        if (!navContainer) {
            console.error("Sidebar nav container not found!");
            return;
        }

        // Clear any existing navigation links that might have been populated by the main script.
        navContainer.innerHTML = '';

        const ul = document.createElement('ul');
        ul.classList.add('space-y-2');

        userGuideNavLinks.forEach(link => {
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="${link.href}" class="flex items-center p-2 text-gray-300 rounded-md hover:bg-gray-700 transition-colors duration-200">
                    <i class="fas ${link.icon} w-6 text-center"></i>
                    <span class="ml-3">${link.name}</span>
                </a>
            `;
            ul.appendChild(li);
        });

        navContainer.appendChild(ul);
    }

    /**
     * Sets up smooth scrolling for all anchor links on the page.
     * When a nav link is clicked, the page will scroll smoothly to the corresponding section.
     */
    function setupSmoothScrolling() {
        // Select all links that start with '#'
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                // Prevent the default anchor link behavior
                e.preventDefault();

                const targetId = this.getAttribute('href');
                try {
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        // Scroll the target element into view with a smooth animation
                        targetElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                } catch (error) {
                    // Catch potential invalid selector errors
                    console.error(`Could not find element with selector: ${targetId}`, error);
                }
            });
        });
    }

    // Execute the functions to build the page dynamics
    populateUserGuideNav();
    setupSmoothScrolling();
});

