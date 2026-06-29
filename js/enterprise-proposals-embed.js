
        const renderZones = document.getElementById('render-zones');
        const ASSETS_BASE = new URL('Proposal_Assets/', window.location.href).href;
        const GPC_TITLE_BG = ASSETS_BASE + '01_Title_Page.svg';
        const GPC_INTERIOR_BG = ASSETS_BASE + 'GPC_Blank_Letterhead.svg';
        const REFERENCES_CONTENT_MAX_WIDTH_PX = 450;

        function showToast(message, type) {
            type = type === 'error' ? 'error' : 'success';
            var container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'toast-container pointer-events-none';
                container.setAttribute('aria-live', 'polite');
                document.body.appendChild(container);
            }
            var el = document.createElement('div');
            el.className = 'toast toast-' + type + ' pointer-events-auto';
            var span = document.createElement('span');
            span.className = 'toast-message';
            span.textContent = message;
            el.appendChild(span);
            container.appendChild(el);
            setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
        }

        function findBracketedPlaceholders() {
            const re = /\[[^\[\]]{2,}\]/g;
            const found = [];
            var cover = document.getElementById('cover-body');
            if (cover && cover.value) {
                var m; while ((m = re.exec(cover.value)) !== null) {
                    if (found.indexOf(m[0]) === -1) found.push(m[0]);
                }
            }
            document.querySelectorAll('.custom-text-body').forEach(function(ta) {
                if (!ta.value) return;
                re.lastIndex = 0;
                var m; while ((m = re.exec(ta.value)) !== null) {
                    if (found.indexOf(m[0]) === -1) found.push(m[0]);
                }
            });
            return found;
        }

        var isDirty = false, _suppressDirty = false;
        /** When set, proposal was loaded from DB; "Save to account" will UPDATE this row instead of INSERT. Cleared when loading from file. */
        var loadedProposalId = null;
        /** Saved proposal name, used to pre-fill the save modal when updating. */
        var loadedProposalName = null;
        /** When loaded from DB, the account_id of that proposal (for "Save as new" default). */
        var loadedProposalAccountId = null;
        function setDirty(value) {
            isDirty = !!value;
            var header = document.getElementById('main-header');
            var msg = document.getElementById('header-unsaved-msg');
            if (header) {
                header.classList.toggle('is-dirty', isDirty);
            }
            if (msg) msg.classList.toggle('hidden', !isDirty);
        }
        window.addEventListener('beforeunload', function(e) {
            var coverBody = document.getElementById('cover-body');
            var hasData = document.getElementById('global-rfp').value ||
                document.getElementById('global-biz').value ||
                (coverBody && coverBody.value || '').trim().length > 0;
            if (isDirty || hasData) { e.preventDefault(); e.returnValue = ''; }
        });
        document.body.addEventListener('input', function(e) {
            if (_suppressDirty) return;
            var t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') && t.id !== 'passcode-input' && t.id !== 'custom-pdf-upload' && t.id !== 'usac-upload') setDirty(true);
        });
        document.body.addEventListener('change', function(e) {
            if (_suppressDirty) return;
            var t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') && t.id !== 'passcode-input' && t.id !== 'custom-pdf-upload' && t.id !== 'usac-upload') setDirty(true);
        });

        async function captureZoneWithSnapdom(zoneId) {
            const zone = document.getElementById(zoneId);
            if (!zone || !renderZones) return null;
            renderZones.classList.remove('absolute', 'top-[-9999px]', 'left-[-9999px]');
            await new Promise(r => requestAnimationFrame(r));
            const capture = await snapdom(zone, { scale: 2, backgroundColor: 'transparent' });
            const canvas = await capture.toCanvas();
            const imgData = canvas.toDataURL('image/png');
            renderZones.classList.add('absolute', 'top-[-9999px]', 'left-[-9999px]');
            return imgData;
        } 

        // --- Plain text areas (paste preserves paragraph breaks via white-space: pre-wrap) ---
        function escapeHtmlLite(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function parseBulletLine(line) {
            var m = String(line).match(/^(\s*)([-•*])\s*(.*)$/);
            if (!m) return null;
            var indent = m[1].replace(/\t/g, '  ').length;
            return { level: Math.floor(indent / 2), text: m[3] };
        }

        function renderBulletLineHtml(item, compact) {
            var itemMargin = compact ? '0 0 0.15em 0' : '0 0 0.25em 0';
            var padLeft = (1.1 + item.level * 1.0) + 'em';
            return '<div style="margin: ' + itemMargin + '; padding-left: ' + padLeft + '; text-indent: -0.65em;"><span aria-hidden="true">&#8226;&nbsp;</span>' + escapeHtmlLite(item.text) + '</div>';
        }

        function renderBulletList(items, compact) {
            if (!items.length) return '';
            var blockMargin = compact ? '0 0 0.35em 0' : '0 0 0.75em 0';
            return '<div style="margin: ' + blockMargin + ';">' + items.map(function(item) {
                return renderBulletLineHtml(item, compact);
            }).join('') + '</div>';
        }

        function plainTextToPdfHtml(s, options) {
            options = options || {};
            if (s == null || String(s).trim() === '') return '';
            var compact = !!options.compact;
            var paraMargin = compact ? '0 0 0.35em 0' : '0 0 0.75em 0';
            var lines = String(s).replace(/\r\n/g, '\n').split('\n');
            var output = [];
            var paraLines = [];
            var bulletItems = [];

            function flushParagraph() {
                if (!paraLines.length) return;
                output.push('<p style="margin: ' + paraMargin + ';">' + paraLines.map(escapeHtmlLite).join('<br>') + '</p>');
                paraLines = [];
            }

            function flushBullets() {
                if (!bulletItems.length) return;
                output.push(renderBulletList(bulletItems, compact));
                bulletItems = [];
            }

            lines.forEach(function(line) {
                if (!line.trim()) {
                    flushBullets();
                    flushParagraph();
                    return;
                }
                var bullet = parseBulletLine(line);
                if (bullet != null) {
                    flushParagraph();
                    bulletItems.push(bullet);
                } else {
                    flushBullets();
                    paraLines.push(line);
                }
            });

            flushBullets();
            flushParagraph();
            return output.join('');
        }

        function textToHtml(s, options) {
            return plainTextToPdfHtml(s, options);
        }

        function formatProdTextForPdf(s) {
            return textToHtml(s, { compact: true });
        }

        function checkCustomTextHeight() {
            document.querySelectorAll('.custom-text-body').forEach(function(ta) {
                var section = ta.closest('.custom-text-section');
                var warn = section && section.querySelector('.warning-customText');
                if (!warn) return;
                if (ta.scrollHeight > 600) warn.classList.remove('hidden'); else warn.classList.add('hidden');
            });
        }
        document.addEventListener('input', function(e) {
            if (e.target && e.target.classList && e.target.classList.contains('custom-text-body')) checkCustomTextHeight();
        });

        const GPC_COVER_SNIPPETS = [
            { label: 'Exceptional customer service', text: 'You gain a team of knowledgeable experts dedicated to building a tailored, endtoend solution that fits your business. From initial contact through design, turnup, testing, and ongoing maintenance, you work with a local team committed to creating solutions that support your goals. Because our teams live and work in the communities we serve, we\'re invested in helping them thrive -- including your organization.' },
            { label: 'Scalable fiber-driven technology', text: 'Our technology is designed to meet the needs of small storefronts and medium-to-large enterprises. Our network and products are fully scalable, backed by fiber-driven technology services that will accelerate the success of your business.' },
            { label: 'Why Us - Local Team & Custom Solutions', text: 'Experience a true partnership with GPC, a proven provider that delivers stable, future-proof solutions backed by over 100 years of expertise. Our teams are strategically placed across our network footprint that stretches Nebraska, Colorado, Iowa and Southeast Indiana. Powered by our 20,000-mile MEF-certified, high-capacity network, businesses and carriers benefit from state-of-the-art connectivity backed by custom-built strategies, expert engineering and local support.' },
            { label: '24/7 NOC', text: 'Local network monitoring in our Blair, Nebraska Network Operations Center (NOC) provides real time and rapid response to outages and alarms, ensuring optimal up-time and operational efficiency.' },
            { label: 'High-Performing Network - Midwest', text: 'Your business is our priority. We build reliable, scalable network solutions that meet your needs now and adapt seamlessly as they evolve. Keep operations running smoothly with the confidence that your connectivity is powered by one of the Midwest\'s largest privately owned business internet providers.' },
            { label: 'Network Differentiators', text: 'GPC\'s fiber network spans over 20,000 miles and is 99% buried, featuring unique routes and ringed redundancy to ensure maximum uptime. The MEF-certified network delivers 99.99% core reliability, and its secure design provides scalability and flexibility. GPC maintains a strong local presence, with technicians strategically located across Nebraska and Indiana for rapid outage resolutions.' },
            { label: 'Business Internet', text: 'GPC offers flexible business internet solutions built to meet the demands of your organization. From 10 Mbps to 400 Gbps, our high-performing network delivers the reliability and speeds your business depends on to ensure you have the bandwidth to operate efficiently and grow confidently.' },
            { label: 'Managed Ethernet', text: 'Increase efficiency and cost savings, with scalable, secure transport across your different business locations.' }
        ];
        const GPC_CUSTOM_PAGE_SNIPPETS = [
            { label: 'Executive Summary - General', text: `Great Plains Communications (GPC) is pleased to present this proposal for enterprise-grade connectivity and managed services. From small storefronts to large enterprises, our fully scalable, fiber-driven technology services are designed to accelerate the success of your business. We are one of the largest privately owned internet service providers for businesses in the Midwest, with a high-performing network built for redundancy and scalability to meet your needs today and grow with you tomorrow.

What sets our company apart is our exceptional customer service. From the first customer contact through design, turn-up, testing, and maintenance, you will work with a local team committed to developing custom solutions to help you achieve your business goals. Our Nebraska- and Indiana-based teams provide a true local presence, with technicians strategically located in communities across Nebraska and Southeast Indiana. We combine a high-performing network with high-performing people and 24/7 tech support so you can focus on what matters most.

Our network differentiators include 99% buried fiber, unique routes, and MEF-certified reliability with 99.99% availability on the core. We operate a 20,000+ mile fiber-optic network—including over 500 miles in the Omaha area—with a secure, fiber-ringed design built for redundancy, scalability, and flexibility. Our fully meshed transport core and 24/7 Network Operations Center in Blair, Nebraska, provide local network monitoring, rapid response to outages and alarms, and a central point of contact for network maintenance and dispatch.

We offer reliable, high-performance dedicated business internet from 10 Mbps to 400 Gbps; managed Ethernet for scalable, secure transport across multiple locations with cost savings and efficiency; managed business Wi-Fi for fast, reliable wireless connectivity; and business voice solutions that combine voice, video, chat, and file sharing in a single platform. Wireless internet backup keeps your business running during outages with automatic failover and 24/7 support. GPC Managed Firewall, DDoS protection, Cloud Connect, and SD-WAN round out our portfolio for improved performance, lower cost, and always-on reliability.

We look forward to working with you and helping you reach your goals. Tell one of our local team members about your business and we will help determine the solution that will best fit your needs.` },
            { label: 'Executive Summary - Education', text: `Great Plains Communications is pleased to present this executive summary for your organization's connectivity and technology needs in the education sector. From small storefronts to large enterprises, our fully scalable, fiber-driven technology services are designed to accelerate success—and that includes enabling schools, libraries, and community learning spaces to lead in innovation and digital access.

What sets our company apart is our exceptional customer service. From the first contact through design, turn-up, testing, and maintenance, you will work with a local team committed to developing custom solutions for your unique environment. Our Nebraska- and Indiana-based teams provide a true local presence, with technicians strategically located across our service footprint. We have been a key partner to education-focused organizations: for example, Do Space—one of the first community spaces in the country to offer a gigabit of bandwidth free to its members—has relied on Great Plains Communications to help enable Omaha to lead the nation in innovation. We combine a high-performing network with high-performing people and 24/7 tech support so your students, faculty, and staff can stay connected and productive.

Our network is built for reliability and scale. We operate a 20,000+ mile fiber-optic network with 99% buried fiber, MEF-certified design, and 99.99% availability on the core. Our 24/7 Network Operations Center in Blair, Nebraska, provides local monitoring, rapid response to outages and alarms, and a central point of contact for maintenance and dispatch. For education, that means dependable connectivity for learning management systems, video, collaboration tools, and campus-wide Wi-Fi.

We offer dedicated business internet from 10 Mbps to 400 Gbps; managed business Wi-Fi for fast, reliable coverage across campuses and buildings; managed Ethernet for secure transport between locations; and wireless internet backup to keep learning continuous during outages. Our team will work with you to design a solution that fits your budget and growth plans. We look forward to connecting with you and helping your organization reach its goals.` },
            { label: 'Executive Summary - Healthcare', text: `Great Plains Communications is pleased to present this executive summary for your organization's connectivity and network needs in the healthcare sector. Reliable, secure, and always-on connectivity is critical for patient care, clinical workflows, and compliance. From small practices to large enterprises, our fully scalable, fiber-driven technology services are designed to support the demanding requirements of healthcare environments.

What sets our company apart is our exceptional customer service. From the first contact through design, turn-up, testing, and maintenance, you will work with a local team committed to developing custom solutions that fit your workflows and security posture. Our Nebraska- and Indiana-based teams provide a true local presence, with technicians strategically located across our footprint. We combine a high-performing network with high-performing people and 24/7 tech support, so your staff can focus on patient care rather than connectivity issues.

Our network is built for reliability and security. We operate a 20,000+ mile fiber-optic network with 99% buried fiber, MEF-certified design, and 99.99% availability on the core. Our 24/7 Network Operations Center in Blair, Nebraska, provides round-the-clock monitoring, rapid response to outages and alarms, and a central point of contact for network maintenance and dispatch. Our secure, fiber-ringed network is designed with redundancy, scalability, and flexibility to support critical applications and protect sensitive data.

We offer dedicated business internet from 10 Mbps to 400 Gbps; managed Ethernet for scalable, secure transport between facilities; GPC Managed Firewall for round-the-clock network protection to safeguard sensitive data; and GPC DDoS Protection to help avoid disruptions and block high-volume attacks. Wireless internet backup with automatic failover and 24/7 support helps keep your business running during outages. GPC Cloud Connect and SD-WAN can deliver improved performance, lower cost, and always-on reliability across multiple delivery methods. We look forward to working with you to design a solution that meets your clinical and operational goals.` }
        ];
        function insertIntoCoverBody(text) {
            var ta = document.getElementById('cover-body');
            if (!ta) return;
            var start = ta.selectionStart, end = ta.selectionEnd, val = ta.value;
            ta.value = val.slice(0, start) + text + val.slice(end);
            ta.selectionStart = ta.selectionEnd = start + text.length;
            ta.focus();
        }
        function renderCoverSnippets() {
            const container = document.getElementById('cover-snippets');
            if (!container) return;
            container.innerHTML = '';
            GPC_COVER_SNIPPETS.forEach(function(s) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-orange-500 hover:bg-orange-50/80 text-slate-700 text-[11px] leading-tight transition shadow-sm';
                btn.textContent = s.label;
                btn.title = s.text.slice(0, 80) + (s.text.length > 80 ? '…' : '');
                btn.addEventListener('click', function() { insertIntoCoverBody(s.text); });
                container.appendChild(btn);
            });
        }
        function insertIntoCustomTextBody(text) {
            var ta = (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('custom-text-body')) ? document.activeElement : document.getElementById('custom-text-body');
            if (!ta) return;
            var start = ta.selectionStart, end = ta.selectionEnd, val = ta.value;
            ta.value = val.slice(0, start) + text + val.slice(end);
            ta.selectionStart = ta.selectionEnd = start + text.length;
            ta.focus();
        }
        function renderCustomPageSnippets() {
            const container = document.getElementById('custom-page-snippets');
            if (!container) return;
            container.innerHTML = '';
            GPC_CUSTOM_PAGE_SNIPPETS.forEach(function(s) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-orange-500 hover:bg-orange-50/80 text-slate-700 text-[11px] leading-tight transition shadow-sm';
                btn.textContent = s.label;
                btn.title = s.text.slice(0, 80) + (s.text.length > 80 ? '…' : '');
                btn.addEventListener('click', function() { insertIntoCustomTextBody(s.text); });
                container.appendChild(btn);
            });
        }
        renderCoverSnippets();
        renderCustomPageSnippets();
        function getReadinessControl(id) {
            const el = document.getElementById(id);
            if (!el) return null;
            return {
                el: el,
                get checked() { return el.classList.contains('is-active'); },
                set checked(value) {
                    const next = !!value;
                    el.classList.toggle('is-active', next);
                    el.setAttribute('aria-pressed', next ? 'true' : 'false');
                }
            };
        }
        function setupReadinessPills() {
            ['check-rfp-biz', 'check-cover', 'check-pricing', 'check-ready'].forEach(id => {
                const control = getReadinessControl(id);
                if (!control) return;
                control.el.addEventListener('click', () => {
                    control.checked = !control.checked;
                    if (!_suppressDirty) setDirty(true);
                });
            });
        }
        setupReadinessPills();

        // --- UI Visibility Toggles based on Slide Selection (use class to override Tailwind .hidden !important) ---
        function toggleSection(checkboxId, sectionId) {
            var checkbox = document.getElementById(checkboxId);
            var section = document.getElementById(sectionId);
            if (!checkbox || !section) return;
            function updateVisibility() {
                if (checkbox.checked) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            }
            checkbox.addEventListener('change', updateVisibility);
            updateVisibility(); // sync initial state
        }
        toggleSection('toggle-cover-letter', 'cover-letter-section');
        toggleSection('toggle-impact-roi', 'impact-roi-section');
        toggleSection('toggle-references', 'references-section');
        toggleSection('toggle-pricing', 'pricing-section');
        toggleSection('toggle-usac', 'usac-upload-section');

        function syncCustomSectionsVisibility() {
            var pagesContainer = document.getElementById('custom-pages-container');
            var pdfsContainer = document.getElementById('custom-pdfs-container');
            var anyPageChecked = false;
            document.querySelectorAll('#module-list li[data-filename="CUSTOM_TEXT"]').forEach(function(li) {
                var idx = li.getAttribute('data-custom-index');
                var section = document.getElementById('custom-text-section-' + idx);
                var checked = li.querySelector('.slide-toggle') && li.querySelector('.slide-toggle').checked;
                if (section) {
                    if (checked) { section.classList.remove('hidden'); anyPageChecked = true; } else section.classList.add('hidden');
                }
            });
            if (pagesContainer) pagesContainer.classList.toggle('hidden', !anyPageChecked);
            var anyPdfChecked = false;
            document.querySelectorAll('#module-list li[data-filename="CUSTOM_PDF"]').forEach(function(li) {
                var idx = li.getAttribute('data-custom-index');
                var section = document.getElementById('custom-pdf-section-' + idx);
                var checked = li.querySelector('.slide-toggle') && li.querySelector('.slide-toggle').checked;
                if (section) {
                    if (checked) { section.classList.remove('hidden'); anyPdfChecked = true; } else section.classList.add('hidden');
                }
            });
            if (pdfsContainer) pdfsContainer.classList.toggle('hidden', !anyPdfChecked);
        }
        document.getElementById('module-list').addEventListener('change', function(e) {
            if (!e.target || !e.target.classList || !e.target.classList.contains('slide-toggle')) return;
            var li = e.target.closest('li[data-filename="CUSTOM_TEXT"], li[data-filename="CUSTOM_PDF"]');
            if (li) syncCustomSectionsVisibility();
        });
        syncCustomSectionsVisibility();

        function updateCustomPageRowLabels() {
            document.querySelectorAll('#module-list li[data-filename="CUSTOM_TEXT"]').forEach(function(li, i) {
                var label = li.querySelector('.custom-page-label');
                if (label) label.textContent = i === 0 ? 'Custom Page' : 'Custom Page ' + (i + 1);
                var removeBtn = li.querySelector('.remove-custom-page-btn');
                if (removeBtn) removeBtn.classList.toggle('hidden', document.querySelectorAll('#module-list li[data-filename="CUSTOM_TEXT"]').length <= 1);
            });
        }
        function updateCustomPdfRowLabels() {
            document.querySelectorAll('#module-list li[data-filename="CUSTOM_PDF"]').forEach(function(li, i) {
                var label = li.querySelector('.custom-pdf-label');
                if (label) label.textContent = i === 0 ? 'Upload Custom PDF' : 'Upload Custom PDF ' + (i + 1);
                var removeBtn = li.querySelector('.remove-custom-pdf-btn');
                if (removeBtn) removeBtn.classList.toggle('hidden', document.querySelectorAll('#module-list li[data-filename="CUSTOM_PDF"]').length <= 1);
            });
        }
        document.getElementById('module-list').addEventListener('click', function(e) {
            var addPage = e.target && e.target.closest && e.target.closest('.add-custom-page-btn');
            var removePage = e.target && e.target.closest && e.target.closest('.remove-custom-page-btn');
            var addPdf = e.target && e.target.closest && e.target.closest('.add-custom-pdf-btn');
            var removePdf = e.target && e.target.closest && e.target.closest('.remove-custom-pdf-btn');
            if (addPage) {
                e.preventDefault();
                var lis = document.querySelectorAll('#module-list li[data-filename="CUSTOM_TEXT"]');
                var last = lis[lis.length - 1];
                var indices = Array.prototype.map.call(lis, function(li) { return parseInt(li.getAttribute('data-custom-index') || '0', 10); });
                var nextIdx = indices.length ? (1 + Math.max.apply(null, indices)) : 0;
                var newLi = document.createElement('li');
                newLi.className = 'flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm cursor-grab group border-l-4 border-l-blue-400';
                newLi.setAttribute('data-filename', 'CUSTOM_TEXT');
                newLi.setAttribute('data-custom-index', String(nextIdx));
                newLi.innerHTML = '<svg class="w-5 h-5 handle text-slate-400 group-hover:text-blue-500 transition cursor-grab mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"></path></svg><input type="checkbox" class="mr-3 w-4 h-4 text-blue-500 slide-toggle" data-pdf-id="CUSTOM_TEXT"><span class="flex-1 font-medium text-sm text-slate-700 custom-page-label">Custom Page ' + (nextIdx + 1) + '</span><div class="flex items-center gap-1 flex-shrink-0"><button type="button" class="add-custom-page-btn text-slate-400 hover:text-blue-500 p-1 rounded" title="Add another Custom Page">+</button><button type="button" class="remove-custom-page-btn text-slate-400 hover:text-red-500 p-1 rounded" title="Remove">−</button></div>';
                last.insertAdjacentElement('afterend', newLi);
                var container = document.getElementById('custom-pages-container');
                var section = document.createElement('div');
                section.id = 'custom-text-section-' + nextIdx;
                section.className = 'custom-text-section hidden bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 transition-all duration-300';
                section.setAttribute('data-custom-index', String(nextIdx));
                section.innerHTML = '<div class="flex items-center mb-4 border-b border-slate-100 pb-2 gap-2"><svg class="w-6 h-6 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><h3 class="text-2xl font-bold text-slate-800 custom-text-section-title">Custom Page ' + (nextIdx + 1) + '</h3></div><input type="text" id="custom-text-title-input-' + nextIdx + '" class="custom-text-title-input w-full border border-slate-300 p-2 rounded-lg mb-3 bg-slate-50 outline-none focus:border-orange-500 font-semibold text-slate-700" placeholder="Document Title (Leave blank for no header)"><div class="flex gap-6 flex-nowrap items-start"><div class="flex-1 min-w-[500px]"><textarea id="custom-text-body-' + nextIdx + '" class="custom-text-body w-full h-64 p-3 border border-slate-300 rounded-lg bg-white resize-y font-sans text-base focus:outline-none focus:border-orange-500" placeholder="Start typing custom content..." style="white-space: pre-wrap;"></textarea><p class="warning-customText hidden text-red-600 text-sm font-bold mt-2">⚠️ Warning: Text exceeds PDF page height and may be cut off. Please shorten.</p></div><div class="w-[280px] flex-shrink-0 rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-600 flex flex-col gap-4"><div><h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Click to add</h3><p class="text-xs text-slate-400 mb-2">Inserts at cursor in the custom page.</p><div class="custom-page-snippets space-y-2 overflow-auto min-h-0"></div></div></div></div>';
                container.appendChild(section);
                section.querySelectorAll('.custom-page-snippets').forEach(function(snip) {
                    GPC_CUSTOM_PAGE_SNIPPETS.forEach(function(s) {
                        var btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-orange-500 hover:bg-orange-50/80 text-slate-700 text-[11px] leading-tight transition shadow-sm';
                        btn.textContent = s.label;
                        btn.title = s.text.slice(0, 80) + (s.text.length > 80 ? '…' : '');
                        btn.addEventListener('click', function() { insertIntoCustomTextBody(s.text); });
                        snip.appendChild(btn);
                    });
                });
                updateCustomPageRowLabels();
                syncCustomSectionsVisibility();
                if (!_suppressDirty) setDirty(true);
            } else if (removePage) {
                e.preventDefault();
                var li = removePage.closest('li[data-filename="CUSTOM_TEXT"]');
                if (!li || document.querySelectorAll('#module-list li[data-filename="CUSTOM_TEXT"]').length <= 1) return;
                var idx = li.getAttribute('data-custom-index');
                li.remove();
                var section = document.getElementById('custom-text-section-' + idx);
                if (section) section.remove();
                updateCustomPageRowLabels();
                syncCustomSectionsVisibility();
                if (!_suppressDirty) setDirty(true);
            } else if (addPdf) {
                e.preventDefault();
                var lis = document.querySelectorAll('#module-list li[data-filename="CUSTOM_PDF"]');
                var last = lis[lis.length - 1];
                var indices = Array.prototype.map.call(lis, function(li) { return parseInt(li.getAttribute('data-custom-index') || '0', 10); });
                var nextIdx = indices.length ? (1 + Math.max.apply(null, indices)) : 0;
                var newLi = document.createElement('li');
                newLi.className = 'flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm cursor-grab group border-l-4 border-l-blue-400';
                newLi.setAttribute('data-filename', 'CUSTOM_PDF');
                newLi.setAttribute('data-custom-index', String(nextIdx));
                newLi.innerHTML = '<svg class="w-5 h-5 handle text-slate-400 group-hover:text-blue-500 transition cursor-grab mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"></path></svg><input type="checkbox" class="mr-3 w-4 h-4 text-blue-500 slide-toggle" data-pdf-id="CUSTOM_PDF"><span class="flex-1 font-medium text-sm text-slate-700 custom-pdf-label">Upload Custom PDF ' + (nextIdx + 1) + '</span><div class="flex items-center gap-1 flex-shrink-0"><button type="button" class="add-custom-pdf-btn text-slate-400 hover:text-blue-500 p-1 rounded" title="Add another Custom PDF">+</button><button type="button" class="remove-custom-pdf-btn text-slate-400 hover:text-red-500 p-1 rounded" title="Remove">−</button></div>';
                last.insertAdjacentElement('afterend', newLi);
                var container = document.getElementById('custom-pdfs-container');
                var section = document.createElement('div');
                section.id = 'custom-pdf-section-' + nextIdx;
                section.className = 'custom-pdf-section hidden bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 transition-all duration-300';
                section.setAttribute('data-custom-index', String(nextIdx));
                section.innerHTML = '<div class="flex items-center mb-4 border-b border-slate-100 pb-2 gap-2"><svg class="w-6 h-6 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg><h3 class="text-2xl font-bold text-slate-800 custom-pdf-section-title">Upload Custom PDF ' + (nextIdx + 1) + '</h3></div><div class="mb-4"><label class="block text-sm font-semibold text-slate-700 mb-1">Section name for Table of Contents</label><input type="text" id="custom-pdf-section-name-' + nextIdx + '" class="custom-pdf-section-name w-full border border-slate-300 p-2 rounded-lg bg-slate-50 focus:bg-white outline-none focus:border-orange-500 font-medium text-slate-700" maxlength="80" placeholder="e.g. Executive Summary"></div><input type="file" id="custom-pdf-upload-' + nextIdx + '" class="custom-pdf-upload hidden" accept="application/pdf"><div class="custom-pdf-dropzone border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-orange-50 hover:border-orange-400 transition cursor-pointer group" onclick="this.closest(\'.custom-pdf-section\').querySelector(\'.custom-pdf-upload\').click()"><svg class="mx-auto h-12 w-12 text-slate-400 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg><span class="custom-pdf-filename mt-2 block text-slate-600 font-medium group-hover:text-orange-600">Drag and drop Custom PDF here, or click to browse</span></div></div>';
                container.appendChild(section);
                updateCustomPdfRowLabels();
                syncCustomSectionsVisibility();
                if (!_suppressDirty) setDirty(true);
            } else if (removePdf) {
                e.preventDefault();
                var li = removePdf.closest('li[data-filename="CUSTOM_PDF"]');
                if (!li || document.querySelectorAll('#module-list li[data-filename="CUSTOM_PDF"]').length <= 1) return;
                var idx = li.getAttribute('data-custom-index');
                li.remove();
                var section = document.getElementById('custom-pdf-section-' + idx);
                if (section) section.remove();
                updateCustomPdfRowLabels();
                syncCustomSectionsVisibility();
                if (!_suppressDirty) setDirty(true);
            }
        });
        updateCustomPageRowLabels();
        updateCustomPdfRowLabels();

        new Sortable(document.getElementById('module-list'), { animation: 150, handle: '.handle', ghostClass: 'bg-slate-100', onEnd: function() { if (!_suppressDirty) setDirty(true); } });

        // --- File Upload Handlers ---
        document.getElementById('usac-upload').addEventListener('change', e => {
            document.getElementById('usac-filename').textContent = e.target.files[0] ? e.target.files[0].name : "Drag and drop USAC RFP PDF here";
        });
        var customPdfUploadEl = document.getElementById('custom-pdf-upload');
        if (customPdfUploadEl) customPdfUploadEl.addEventListener('change', function(e) {
            var section = e.target.closest('.custom-pdf-section');
            var fn = section && section.querySelector('.custom-pdf-filename');
            if (fn) fn.textContent = e.target.files[0] ? e.target.files[0].name : "Drag and drop Custom PDF here, or click to browse";
        });
        var customPdfsContainer = document.getElementById('custom-pdfs-container');
        if (customPdfsContainer) customPdfsContainer.addEventListener('change', function(e) {
            if (e.target && e.target.classList && e.target.classList.contains('custom-pdf-upload')) {
                var section = e.target.closest('.custom-pdf-section');
                var fn = section && section.querySelector('.custom-pdf-filename');
                if (fn) fn.textContent = e.target.files[0] ? e.target.files[0].name : "Drag and drop Custom PDF here, or click to browse";
            }
        });

        // --- Input Generation ---
        const refsContainer = document.getElementById('references-container');
        for(let i=1; i<=4; i++) {
            refsContainer.insertAdjacentHTML('beforeend', `
                <div class="space-y-2 border border-slate-200 p-5 rounded-xl bg-slate-50 shadow-sm ref-block">
                    <h4 class="font-bold text-slate-700 text-sm uppercase">Reference ${i}</h4>
                    <input type="text" placeholder="Reference Name" class="w-full border border-slate-300 p-2 rounded text-sm ref-name outline-none focus:border-orange-500">
                    <input type="text" placeholder="Organization Name" class="w-full border border-slate-300 p-2 rounded text-sm ref-org outline-none focus:border-orange-500">
                    <input type="text" placeholder="Organization Address" class="w-full border border-slate-300 p-2 rounded text-sm ref-addr outline-none focus:border-orange-500">
                    <div class="flex gap-2">
                        <input type="text" placeholder="Phone Number" class="w-1/2 border border-slate-300 p-2 rounded text-sm ref-phone outline-none focus:border-orange-500">
                        <input type="text" placeholder="Email Address" class="w-1/2 border border-slate-300 p-2 rounded text-sm ref-email outline-none focus:border-orange-500">
                    </div>
                </div>
            `);
        }

        // --- Dynamic Pricing UI (multi-option) ---
        var PRODUCT_SUGGESTIONS = [
            'Dedicated Internet Access (DIA)', 'Standard Internet Access (SIA)', 'Managed Ethernet', 'Business Voice',
            'Managed Business Wi-Fi', 'Wireless Internet Backup', 'GPC Managed Firewall', 'DDoS Protection',
            'Cloud Connect', 'SD-WAN', 'SIP Trunking', 'PRI', 'Dark Fiber', 'Colocation', 'Professional Services'
        ];

        function getBandwidthSuggestion(text) {
            if (!text || typeof text !== 'string') return null;
            var t = text.trim();
            var mMatch = t.match(/^(\d+(?:\.\d+)?)\s*m\s*$/i);
            if (mMatch) return mMatch[1] + ' Mbps';
            var gMatch = t.match(/^(\d+(?:\.\d+)?)\s*g\s*$/i);
            if (gMatch) return gMatch[1] + ' Gbps';
            return null;
        }

        function getProductSuggestions(text) {
            if (!text || typeof text !== 'string') return [];
            var t = text.trim().toLowerCase();
            return (PRODUCT_SUGGESTIONS || []).filter(function(name) {
                return name.toLowerCase().indexOf(t) !== -1;
            });
        }

        function getBandwidthPlusProductSuggestions(text) {
            if (!text || typeof text !== 'string') return [];
            var match = text.match(/^(\d+(?:\.\d+)?\s*(?:Mbps|Gbps))\s+(.+)$/i);
            if (!match) return [];
            var prefix = match[1];
            var suffix = match[2].trim();
            if (suffix.length < 2) return [];
            return getProductSuggestions(suffix).map(function(p) { return prefix + ' ' + p; });
        }

        function syncLocationSubtotalVisibility() {
            var cb = document.getElementById('pricing-enable-location-subtotals');
            var on = cb && cb.checked;
            document.querySelectorAll('.location-subtotal-row').forEach(function(el) {
                el.classList.toggle('hidden', !on);
            });
        }

        function pricingUsesDecimalPoints() {
            var cb = document.getElementById('pricing-enable-decimal-points-amy');
            return !!(cb && cb.checked);
        }

        function syncQuoteExpirationDaysVisibility() {
            var cb = document.getElementById('pricing-enable-quote-expiration');
            var wrap = document.getElementById('pricing-quote-expiration-days-wrap');
            if (wrap) wrap.classList.toggle('hidden', !(cb && cb.checked));
        }

        function buildPricingDisclaimerText() {
            var expCb = document.getElementById('pricing-enable-quote-expiration');
            var taxCb = document.getElementById('pricing-enable-taxes-fees-exclusion');
            var daysEl = document.getElementById('pricing-quote-expiration-days');
            var includeExp = !!(expCb && expCb.checked);
            var includeTax = !!(taxCb && taxCb.checked);
            if (!includeExp && !includeTax) return '';
            var days = (daysEl && daysEl.value.trim()) ? daysEl.value.trim() : 'XX';
            if (includeExp && includeTax) {
                return 'The pricing in this quote is valid for ' + days + ' days and does not include any applicable taxes, fees and surcharges.';
            }
            if (includeExp) {
                return 'The pricing in this quote is valid for ' + days + ' days.';
            }
            return 'The pricing in this quote does not include any applicable taxes, fees and surcharges.';
        }

        function buildPricingDisclaimerHtml() {
            var text = buildPricingDisclaimerText();
            if (!text) return '';
            return '<p style="text-align: center; font-size: 11px; color: #475569; margin-top: 0.5rem;">' + escapeHtmlLite(text) + '</p>';
        }

        function buildPricingTermLineHtml(contractTerm) {
            return '<p style="text-align: center; font-size: 11px; color: #475569; margin-top: 1rem;">Pricing based off ' + escapeHtmlLite(contractTerm) + '-month term</p>' + buildPricingDisclaimerHtml();
        }

        function formatPricingMoney(amount, useDecimals) {
            var n = parseFloat(amount);
            if (isNaN(n)) n = 0;
            if (useDecimals) {
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
            }
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.ceil(n));
        }

        function computeLineTotalRaw(unitPrice, qty) {
            var p = parseFloat(unitPrice) || 0;
            var q = parseInt(qty, 10) || 0;
            return p * q;
        }

        function formatLineListPriceDisplay(unitPrice) {
            var p = parseFloat(unitPrice) || 0;
            var useDecimals = pricingUsesDecimalPoints();
            if (useDecimals) return formatPricingMoney(p, true);
            return formatPricingMoney(Math.ceil(p), false);
        }

        function formatLineTotalDisplay(unitPrice, qty) {
            var raw = computeLineTotalRaw(unitPrice, qty);
            var useDecimals = pricingUsesDecimalPoints();
            if (useDecimals) return formatPricingMoney(raw, true);
            return formatPricingMoney(raw, false);
        }

        function refreshAllPricingMath() {
            document.querySelectorAll('.pricing-option-block').forEach(function(optionBlock) {
                optionBlock.querySelectorAll('.location-block').forEach(function(locBlock) {
                    locBlock.querySelectorAll('.line-items-body tr.pricing-row').forEach(function(row) {
                        updateMath(row, locBlock, optionBlock);
                    });
                });
                calculateOptionTotal(optionBlock);
            });
        }

        function normalizeCsvHeaderCell(h) {
            return String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
        }
        function parseCsvRows(text) {
            var rows = [];
            var i = 0;
            var field = '';
            var row = [];
            var inQ = false;
            var s = String(text || '');
            while (i < s.length) {
                var c = s[i];
                if (inQ) {
                    if (c === '"') {
                        if (s[i + 1] === '"') {
                            field += '"';
                            i += 2;
                            continue;
                        }
                        inQ = false;
                        i++;
                        continue;
                    }
                    field += c;
                    i++;
                    continue;
                }
                if (c === '"') {
                    inQ = true;
                    i++;
                    continue;
                }
                if (c === ',') {
                    row.push(field);
                    field = '';
                    i++;
                    continue;
                }
                if (c === '\r') {
                    i++;
                    continue;
                }
                if (c === '\n') {
                    row.push(field);
                    rows.push(row);
                    row = [];
                    field = '';
                    i++;
                    continue;
                }
                field += c;
                i++;
            }
            row.push(field);
            rows.push(row);
            return rows.filter(function(r) {
                return r.some(function(cell) { return String(cell).trim() !== ''; });
            });
        }
        function pickCsvColumnIndex(headersNorm, aliases) {
            var h = headersNorm;
            for (var a = 0; a < aliases.length; a++) {
                var want = aliases[a].toLowerCase();
                for (var j = 0; j < h.length; j++) {
                    if (h[j] === want) return j;
                }
            }
            for (var a2 = 0; a2 < aliases.length; a2++) {
                var w = aliases[a2].toLowerCase();
                for (var k = 0; k < h.length; k++) {
                    if (h[k].indexOf(w) !== -1) return k;
                }
            }
            return -1;
        }
        function parseMoneyCell(val) {
            if (val == null || val === '') return NaN;
            var t = String(val).replace(/[$,\s]/g, '').trim();
            if (t === '') return NaN;
            var n = parseFloat(t);
            return isNaN(n) ? NaN : n;
        }

        const optionsContainer = document.getElementById('pricing-options-container');
        let optionCount = 0;
        let locationCount = 0;
        var pricingSubtotalCheckboxPreserveChecked = null;
        var pricingAmyDecimalsPreserveChecked = null;
        var csvImportTargetOptionBlock = null;

        function ensurePricingSubtotalCheckboxPlacement() {
            var opts = document.querySelectorAll('.pricing-option-block');
            if (!opts.length) return;
            var row = opts[0].querySelector('.pricing-option-controls-row');
            if (!row) return;

            var group = row.querySelector('.pricing-option-checkboxes-wrap');
            var subWrap = row.querySelector('.pricing-location-subtotals-wrap');
            var amyWrap = row.querySelector('.pricing-amy-decimals-wrap');

            if (!group) {
                group = document.createElement('div');
                group.className = 'pricing-option-checkboxes-wrap shrink-0';
                group.insertAdjacentHTML('beforeend', '<label class="pricing-option-checkboxes-spacer block text-sm font-semibold text-slate-700 invisible select-none" aria-hidden="true">&nbsp;</label><div class="pricing-option-checkboxes-inner mt-1 flex flex-wrap items-center gap-2"></div>');
                var inner = group.querySelector('.pricing-option-checkboxes-inner');
                if (subWrap) {
                    inner.appendChild(subWrap);
                } else {
                    inner.insertAdjacentHTML('beforeend', '<label class="pricing-location-subtotals-wrap flex cursor-pointer items-center gap-2 select-none rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm hover:border-blue-300 transition shrink-0"><input type="checkbox" id="pricing-enable-location-subtotals" class="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"><span class="text-sm font-semibold text-slate-800 whitespace-nowrap">Enable Location Subtotals</span></label>');
                }
                if (amyWrap) {
                    inner.appendChild(amyWrap);
                } else {
                    inner.insertAdjacentHTML('beforeend', '<label class="pricing-amy-decimals-wrap flex cursor-pointer items-center gap-2 select-none rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm hover:border-blue-300 transition shrink-0"><input type="checkbox" id="pricing-enable-decimal-points-amy" class="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"><span class="text-sm font-semibold text-slate-800 whitespace-nowrap">Enable Decimal Points</span></label>');
                }
                var solutionWrap = row.querySelector('.pricing-solution-id-wrap');
                if (solutionWrap) solutionWrap.insertAdjacentElement('afterend', group);
                else row.appendChild(group);
            } else if (group.parentElement !== row) {
                var solutionAnchor = row.querySelector('.pricing-solution-id-wrap');
                if (solutionAnchor) solutionAnchor.insertAdjacentElement('afterend', group);
                else row.appendChild(group);
            }

            var checkboxInner = group.querySelector('.pricing-option-checkboxes-inner');
            if (!checkboxInner) {
                group.insertAdjacentHTML('afterbegin', '<label class="pricing-option-checkboxes-spacer block text-sm font-semibold text-slate-700 invisible select-none" aria-hidden="true">&nbsp;</label><div class="pricing-option-checkboxes-inner mt-1 flex flex-wrap items-center gap-2"></div>');
                checkboxInner = group.querySelector('.pricing-option-checkboxes-inner');
            }
            subWrap = group.querySelector('.pricing-location-subtotals-wrap');
            amyWrap = group.querySelector('.pricing-amy-decimals-wrap');
            if (checkboxInner) {
                if (subWrap && subWrap.parentElement !== checkboxInner) checkboxInner.prepend(subWrap);
                if (amyWrap && amyWrap.parentElement !== checkboxInner) checkboxInner.appendChild(amyWrap);
            }
            var amyLabel = group.querySelector('.pricing-amy-decimals-wrap span');
            if (amyLabel) amyLabel.textContent = 'Enable Decimal Points';

            var cb = document.getElementById('pricing-enable-location-subtotals');
            if (cb && pricingSubtotalCheckboxPreserveChecked !== null) cb.checked = pricingSubtotalCheckboxPreserveChecked;
            var amyCb = document.getElementById('pricing-enable-decimal-points-amy');
            if (amyCb && pricingAmyDecimalsPreserveChecked !== null) amyCb.checked = pricingAmyDecimalsPreserveChecked;
            pricingSubtotalCheckboxPreserveChecked = null;
            pricingAmyDecimalsPreserveChecked = null;
            syncLocationSubtotalVisibility();
        }

        if (optionsContainer) {
            optionsContainer.addEventListener('change', function(e) {
                if (e.target && e.target.id === 'pricing-enable-location-subtotals') {
                    syncLocationSubtotalVisibility();
                    if (!_suppressDirty) setDirty(true);
                }
                if (e.target && e.target.id === 'pricing-enable-decimal-points-amy') {
                    refreshAllPricingMath();
                    if (!_suppressDirty) setDirty(true);
                }
            });
            optionsContainer.addEventListener('click', function(e) {
                var btn = e.target.closest('.option-salesforce-csv-btn');
                if (!btn || !optionsContainer.contains(btn)) return;
                csvImportTargetOptionBlock = btn.closest('.pricing-option-block');
                var optInput = document.getElementById('salesforce-csv-input-option');
                if (optInput) optInput.click();
            });
        }

        var pricingDisclaimerEl = document.getElementById('pricing-pdf-disclaimer-options');
        if (pricingDisclaimerEl) {
            pricingDisclaimerEl.addEventListener('change', function(e) {
                if (e.target && e.target.id === 'pricing-enable-quote-expiration') {
                    syncQuoteExpirationDaysVisibility();
                    if (!_suppressDirty) setDirty(true);
                }
                if (e.target && e.target.id === 'pricing-enable-taxes-fees-exclusion') {
                    if (!_suppressDirty) setDirty(true);
                }
            });
            pricingDisclaimerEl.addEventListener('input', function(e) {
                if (e.target && e.target.id === 'pricing-quote-expiration-days') {
                    if (!_suppressDirty) setDirty(true);
                }
            });
        }

        function applySalesforceCsvText(csvText, targetOptionBlock) {
            var rows = parseCsvRows(csvText.replace(/^\uFEFF/, ''));
            if (rows.length < 2) {
                showToast('CSV has no data rows.', 'error');
                return;
            }
            var headersNorm = rows[0].map(normalizeCsvHeaderCell);
            var aliasesLoc = ['z location', 'service location', 'location name', 'site name', 'account name', 'ship to street', 'ship to address', 'shipping address', 'location', 'site address', 'customer name', 'detail name', 'quote line city'];
            var aliasesProd = ['product', 'product name', 'product title', 'product description', 'description'];
            var aliasesQty = ['quantity', 'qty'];
            var aliasesUnit = ['customer unit price', 'unit price', 'sales price', 'list price', 'monthly price', 'mrc', 'net unit price'];
            var aliasesTotal = ['total price', 'extended price', 'line total', 'net total', 'total'];

            var ixLoc = pickCsvColumnIndex(headersNorm, aliasesLoc);
            var ixProd = pickCsvColumnIndex(headersNorm, aliasesProd);
            var ixQty = pickCsvColumnIndex(headersNorm, aliasesQty);
            var ixUnit = pickCsvColumnIndex(headersNorm, aliasesUnit);
            var ixTotal = pickCsvColumnIndex(headersNorm, aliasesTotal);

            if (ixProd < 0) {
                showToast('Could not find a Product column in the CSV.', 'error');
                return;
            }

            var groups = {};
            var order = [];
            for (var r = 1; r < rows.length; r++) {
                var line = rows[r];
                var locKey = ixLoc >= 0 ? String(line[ixLoc] || '').trim() : 'Imported Location';
                if (!locKey) locKey = 'Imported Location';
                if (!groups[locKey]) {
                    groups[locKey] = [];
                    order.push(locKey);
                }
                var prod = String(line[ixProd] || '').trim();
                var qtyRaw = ixQty >= 0 ? line[ixQty] : '1';
                var qtyNum = parseFloat(String(qtyRaw).replace(/[^\d.-]/g, ''));
                if (isNaN(qtyNum) || qtyNum <= 0) qtyNum = 1;
                var qtyStr = String(qtyNum);
                var unit = ixUnit >= 0 ? parseMoneyCell(line[ixUnit]) : NaN;
                var total = ixTotal >= 0 ? parseMoneyCell(line[ixTotal]) : NaN;
                var priceNum = !isNaN(unit) ? unit : (!isNaN(total) ? total / qtyNum : NaN);
                var priceStr = !isNaN(priceNum) ? String(priceNum) : '';
                if (!prod && priceStr === '') continue;

                groups[locKey].push({
                    prod: prod,
                    price: priceStr,
                    qty: qtyStr,
                    nrcEnabled: false,
                    nrcDescription: '',
                    nrcAmount: ''
                });
            }

            if (!order.length) {
                showToast('No importable rows found.', 'error');
                return;
            }

            var targetOpt = targetOptionBlock || document.querySelector('.pricing-option-block');
            if (!targetOpt) {
                showToast('Pricing builder not ready.', 'error');
                return;
            }
            var locContainer = targetOpt.querySelector('.locations-container');
            if (!locContainer) {
                showToast('Pricing locations container missing.', 'error');
                return;
            }
            locContainer.innerHTML = '';

            order.forEach(function(key) {
                addLocationBlock(locContainer, targetOpt, key, groups[key], null);
            });

            calculateOptionTotal(targetOpt);
            syncLocationSubtotalVisibility();
            if (!_suppressDirty) setDirty(true);
            var titleElToast = targetOpt.querySelector('.option-title');
            var optLbl = titleElToast ? titleElToast.textContent.trim() : 'pricing option';
            showToast('Imported ' + order.length + ' location(s) into ' + optLbl + '.', 'success');
        }

        function handleSalesforceCsvFile(file, targetOptionBlock, filenameEl) {
            if (!file) return;
            var nameOk = /\.csv$/i.test(file.name);
            var typeOk = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === '';
            if (!nameOk && !typeOk) {
                showToast('Please choose a .csv file.', 'error');
                return;
            }
            var reader = new FileReader();
            reader.onload = function() {
                applySalesforceCsvText(String(reader.result || ''), targetOptionBlock);
                var lbl = filenameEl || document.getElementById('salesforce-csv-label');
                if (lbl) lbl.textContent = file.name;
            };
            reader.onerror = function() {
                showToast('Could not read CSV file.', 'error');
            };
            reader.readAsText(file);
        }

        function updateOptionTitles() {
            if (!optionsContainer) return;
            const options = optionsContainer.querySelectorAll('.pricing-option-block');
            options.forEach(function(opt, index) {
                const title = opt.querySelector('.option-title');
                const removeBtn = opt.querySelector('.remove-option-btn');
                const totalLabel = opt.querySelector('.option-total-label');
                if (options.length === 1) {
                    if (title) title.textContent = 'Proposed Pricing';
                    if (removeBtn) removeBtn.classList.add('hidden');
                    if (totalLabel) totalLabel.textContent = 'TOTAL MONTHLY COST:';
                } else {
                    if (title) title.textContent = 'Option ' + (index + 1);
                    if (removeBtn) removeBtn.classList.remove('hidden');
                    if (totalLabel) totalLabel.textContent = 'OPTION TOTAL MONTHLY COST:';
                }
            });
            ensurePricingSubtotalCheckboxPlacement();
        }

        function getPricingLineSubrows(tr) {
            var nrcRow = tr.nextElementSibling && tr.nextElementSibling.classList.contains('row-nrc-subline') ? tr.nextElementSibling : null;
            return { nrcRow: nrcRow };
        }

        function escapeTextareaContent(s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        }

        function getPricingRowPairs(tbody) {
            return Array.from(tbody.querySelectorAll('tr.pricing-row')).map(function(tr) {
                return { row: tr, nrcRow: getPricingLineSubrows(tr).nrcRow };
            });
        }

        function updateProductReorderButtons(tbody) {
            var pairs = getPricingRowPairs(tbody);
            pairs.forEach(function(pair, idx) {
                var upBtn = pair.row.querySelector('.product-move-up-btn');
                var downBtn = pair.row.querySelector('.product-move-down-btn');
                if (upBtn) upBtn.disabled = idx === 0;
                if (downBtn) downBtn.disabled = idx === pairs.length - 1;
            });
        }

        function moveProductRow(row, direction) {
            var tbody = row.closest('.line-items-body');
            if (!tbody) return;
            var pairs = getPricingRowPairs(tbody);
            var idx = pairs.findIndex(function(p) { return p.row === row; });
            if (idx < 0) return;

            function insertPairBefore(pair, beforeRow) {
                tbody.insertBefore(pair.row, beforeRow);
                if (pair.nrcRow) tbody.insertBefore(pair.nrcRow, pair.row.nextSibling);
            }

            if (direction === 'up' && idx > 0) {
                insertPairBefore(pairs[idx], pairs[idx - 1].row);
            } else if (direction === 'down' && idx < pairs.length - 1) {
                var target = pairs[idx + 1];
                var afterTarget = target.nrcRow ? target.nrcRow.nextSibling : target.row.nextSibling;
                var current = pairs[idx];
                tbody.insertBefore(current.row, afterTarget);
                if (current.nrcRow) tbody.insertBefore(current.nrcRow, current.row.nextSibling);
            } else {
                return;
            }
            updateProductReorderButtons(tbody);
            if (!_suppressDirty) setDirty(true);
        }

        function stripLegacyRowPromoFields(item) {
            if (!item || typeof item !== 'object') return item;
            var o = Object.assign({}, item);
            delete o.promoEnabled;
            delete o.promoDescription;
            delete o.promoAmount;
            return o;
        }

        function migrateLegacyRowPromosIntoLocationPromotions(items, promotions) {
            var promos = Array.isArray(promotions) ? promotions.slice() : [];
            (items || []).forEach(function(it) {
                if (it && it.promoEnabled && ((it.promoDescription && String(it.promoDescription).trim()) || (it.promoAmount != null && String(it.promoAmount).trim()))) {
                    promos.push({ description: it.promoDescription != null ? String(it.promoDescription) : '', amount: it.promoAmount != null ? String(it.promoAmount) : '' });
                }
            });
            return promos;
        }

        function readPricingItemsFromLocationBlock(block) {
            return Array.from(block.querySelectorAll('.line-items-body tr.pricing-row')).map(function(tr) {
                var sub = getPricingLineSubrows(tr);
                var nrcRow = sub.nrcRow;
                var nrcToggle = tr.querySelector('.row-nrc-toggle');
                return {
                    prod: tr.querySelector('.prod-name') ? tr.querySelector('.prod-name').value : '',
                    price: tr.querySelector('.price-input') ? tr.querySelector('.price-input').value : '',
                    qty: tr.querySelector('.qty-input') ? tr.querySelector('.qty-input').value : '1',
                    nrcEnabled: !!(nrcToggle && nrcToggle.checked),
                    nrcDescription: nrcRow && nrcRow.querySelector('.row-nrc-description') ? nrcRow.querySelector('.row-nrc-description').value : '',
                    nrcAmount: nrcRow && nrcRow.querySelector('.row-nrc-amount') ? nrcRow.querySelector('.row-nrc-amount').value : ''
                };
            });
        }

        function cloneOptionDataFromBlock(optionBlock) {
            if (!optionBlock) return null;
            var termEl = optionBlock.querySelector('.contract-term') || optionBlock.querySelector('.option-term-input');
            var solutionEl = optionBlock.querySelector('.solution-id-input');
            var locations = Array.from(optionBlock.querySelectorAll('.location-block')).map(function(block) {
                return {
                    name: block.querySelector('.loc-name-input') ? block.querySelector('.loc-name-input').value : '',
                    items: readPricingItemsFromLocationBlock(block),
                    promotions: readLocationPromotions(block)
                };
            });
            return {
                term: termEl ? termEl.value : '',
                solutionId: solutionEl ? solutionEl.value : '',
                locations: locations
            };
        }
        function createLocationPromotionRow(promo) {
            var p = promo || {};
            var desc = (p.description != null) ? String(p.description).replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '';
            var amount = (p.amount != null) ? String(p.amount) : '';
            return '<div class="location-promo-row flex items-center gap-2">' +
                '<input type="text" class="promo-description w-full border border-slate-200 p-2 rounded text-sm outline-none focus:border-orange-500" placeholder="Promotion description" value="' + desc + '">' +
                '<input type="number" class="promo-amount w-36 border border-slate-200 p-2 rounded text-sm text-right outline-none focus:border-orange-500" step="0.01" placeholder="Amount" value="' + amount + '">' +
                '<button type="button" class="remove-promo-btn text-slate-300 hover:text-red-500 font-bold px-2">X</button>' +
                '</div>';
        }
        function appendLocationPromotionRow(locationBlock, promo) {
            var container = locationBlock.querySelector('.location-promotions-container');
            if (!container) return;
            container.insertAdjacentHTML('beforeend', createLocationPromotionRow(promo));
            var row = container.lastElementChild;
            var removeBtn = row && row.querySelector('.remove-promo-btn');
            if (removeBtn) removeBtn.addEventListener('click', function() { row.remove(); if (!_suppressDirty) setDirty(true); });
        }
        function readLocationPromotions(locationBlock) {
            return Array.from(locationBlock.querySelectorAll('.location-promo-row')).map(function(row) {
                return {
                    description: row.querySelector('.promo-description') ? row.querySelector('.promo-description').value : '',
                    amount: row.querySelector('.promo-amount') ? row.querySelector('.promo-amount').value : ''
                };
            }).filter(function(p) { return (p.description && p.description.trim()) || (p.amount && String(p.amount).trim()); });
        }
        function setLocationPromotionsFromData(locationBlock, promotions) {
            var container = locationBlock.querySelector('.location-promotions-container');
            if (!container) return;
            container.innerHTML = '';
            if (Array.isArray(promotions) && promotions.length) promotions.forEach(function(p) { appendLocationPromotionRow(locationBlock, p || {}); });
        }
        function calculateOptionTotal(optionBlock) {
            var useDecimals = pricingUsesDecimalPoints();
            var optTotal = 0;
            optionBlock.querySelectorAll('.line-items-body tr.pricing-row').forEach(function(r) {
                var p = parseFloat(r.querySelector('.price-input').value) || 0;
                var q = parseInt(r.querySelector('.qty-input').value, 10) || 0;
                var lineRaw = computeLineTotalRaw(p, q);
                optTotal += useDecimals ? lineRaw : Math.ceil(lineRaw);
            });
            var el = optionBlock.querySelector('.option-grand-total');
            if (el) el.textContent = formatPricingMoney(optTotal, useDecimals);
        }
        function updateMath(row, locBlock, optionBlock) {
            var useDecimals = pricingUsesDecimalPoints();
            if (row) {
                var price = parseFloat(row.querySelector('.price-input').value) || 0;
                var qty = parseInt(row.querySelector('.qty-input').value, 10) || 0;
                row.querySelector('.row-total').textContent = formatLineTotalDisplay(price, qty);
            }
            var locTotal = 0;
            locBlock.querySelectorAll('.line-items-body tr.pricing-row').forEach(function(r) {
                var p = parseFloat(r.querySelector('.price-input').value) || 0;
                var q = parseInt(r.querySelector('.qty-input').value, 10) || 0;
                var lineRaw = computeLineTotalRaw(p, q);
                locTotal += useDecimals ? lineRaw : Math.ceil(lineRaw);
            });
            locBlock.querySelector('.location-total').textContent = formatPricingMoney(locTotal, useDecimals);
            calculateOptionTotal(optionBlock);
            if (!_suppressDirty) setDirty(true);
        }
        function addRow(locBlock, optionBlock, data) {
            var tbody = locBlock.querySelector('.line-items-body');
            var prod = (data && data.prod != null) ? escapeTextareaContent(data.prod) : '';
            var price = (data && data.price != null) ? String(data.price) : '';
            var qty = (data && data.qty != null) ? String(data.qty) : '1';
            var nrcEnabled = !!(data && data.nrcEnabled);
            var nrcDescription = (data && data.nrcDescription != null) ? String(data.nrcDescription).replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '';
            var nrcAmount = (data && data.nrcAmount != null) ? String(data.nrcAmount) : '';
            var html =
                '<tr class="pricing-row border-b border-slate-100 group">' +
                    '<td class="p-2 align-middle text-center w-10">' +
                        '<div class="flex flex-col items-center gap-0.5">' +
                            '<button type="button" class="product-reorder-btn product-move-up-btn inline-flex items-center justify-center w-7 h-6 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 text-xs" title="Move product up" aria-label="Move product up">▲</button>' +
                            '<button type="button" class="product-reorder-btn product-move-down-btn inline-flex items-center justify-center w-7 h-6 rounded text-slate-400 hover:text-blue-500 hover:bg-blue-50 text-xs" title="Move product down" aria-label="Move product down">▼</button>' +
                        '</div>' +
                    '</td>' +
                    '<td class="p-2 align-middle"><div class="relative">' +
                        '<textarea class="w-full border border-slate-200 p-2 rounded text-sm outline-none focus:border-orange-500 prod-name" rows="2" autocomplete="off">' + prod + '</textarea>' +
                        '<ul class="prod-suggestion-dropdown fixed bg-white border border-slate-200 rounded shadow-xl text-sm text-slate-700 py-1 z-[9999] hidden list-none max-h-56 overflow-y-auto overflow-x-hidden" role="listbox"></ul>' +
                    '</div></td>' +
                    '<td class="p-2 align-middle"><input type="number" class="w-full border border-slate-200 p-2 rounded text-sm outline-none focus:border-orange-500 price-input" step="0.01" value="' + price + '"></td>' +
                    '<td class="p-2 align-middle"><input type="number" class="w-full border border-slate-200 p-2 rounded text-sm text-center outline-none focus:border-orange-500 qty-input" min="1" value="' + qty + '"></td>' +
                    '<td class="p-2 text-right font-semibold text-slate-700 row-total align-middle">$0.00</td>' +
                    '<td class="p-2 align-middle text-center w-14">' +
                        '<input type="checkbox" class="row-nrc-toggle w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer align-middle" ' + (nrcEnabled ? 'checked' : '') + ' title="Non-recurring charge (NRC)">' +
                    '</td>' +
                    '<td class="p-2 align-middle text-center w-12">' +
                        '<button type="button" class="remove-row-btn inline-flex items-center justify-center min-w-[2rem] min-h-[2rem] rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 font-bold text-base leading-none transition" title="Remove product line">✕</button>' +
                    '</td>' +
                '</tr>' +
                '<tr class="row-nrc-subline ' + (nrcEnabled ? '' : 'hidden') + ' bg-slate-50 border-b border-slate-100">' +
                    '<td colspan="7" class="px-2 pb-3">' +
                        '<div class="rounded border border-slate-200 bg-white px-3 py-2 flex items-center gap-3">' +
                            '<input type="text" class="row-nrc-description w-full border border-slate-200 p-1.5 rounded text-sm outline-none focus:border-orange-500" placeholder="NRC description" value="' + nrcDescription + '">' +
                            '<input type="number" class="row-nrc-amount w-40 border border-slate-200 p-1.5 rounded text-sm text-right outline-none focus:border-orange-500" step="0.01" placeholder="NRC amount" value="' + nrcAmount + '">' +
                        '</div>' +
                    '</td>' +
                '</tr>';
            tbody.insertAdjacentHTML('beforeend', html);
            var nrcRow = tbody.lastElementChild;
            var row = nrcRow.previousElementSibling;
            var prodInput = row.querySelector('.prod-name');
            var suggestionDropdown = row.querySelector('.prod-suggestion-dropdown');
            var nrcToggle = row.querySelector('.row-nrc-toggle');

            function applySuggestion(optEl) {
                var opt = optEl || suggestionDropdown.querySelector('[data-suggestion]');
                if (opt) {
                    prodInput.value = opt.getAttribute('data-suggestion');
                    suggestionDropdown.classList.add('hidden');
                }
            }

            function positionSuggestionDropdown() {
                var rect = prodInput.getBoundingClientRect();
                suggestionDropdown.style.top = (rect.bottom + 2) + 'px';
                suggestionDropdown.style.left = rect.left + 'px';
                suggestionDropdown.style.width = rect.width + 'px';
            }

            prodInput.addEventListener('input', function() {
                var val = this.value.trim();
                if (!val) { suggestionDropdown.classList.add('hidden'); suggestionDropdown.innerHTML = ''; return; }
                var bandwidthSuggestion = getBandwidthSuggestion(this.value);
                var productMatches = getProductSuggestions(this.value);
                var bandwidthPlusProduct = getBandwidthPlusProductSuggestions(this.value);
                var items = [];
                if (bandwidthSuggestion && bandwidthSuggestion !== val) items.push(bandwidthSuggestion);
                bandwidthPlusProduct.forEach(function(s) {
                    if (s !== val && items.indexOf(s) === -1) items.push(s);
                });
                productMatches.forEach(function(name) {
                    if (name !== val && items.indexOf(name) === -1) items.push(name);
                });
                if (items.length === 0) {
                    suggestionDropdown.classList.add('hidden');
                    suggestionDropdown.innerHTML = '';
                } else {
                    suggestionDropdown.innerHTML = items.map(function(s) {
                        return '<li class="px-3 py-1.5 hover:bg-blue-50 cursor-pointer rounded" data-suggestion="' + s.replace(/"/g, '&quot;') + '" role="option">' + s + '</li>';
                    }).join('');
                    positionSuggestionDropdown();
                    suggestionDropdown.classList.remove('hidden');
                }
                if (!_suppressDirty) setDirty(true);
            });

            prodInput.addEventListener('keydown', function(e) {
                if (suggestionDropdown.classList.contains('hidden')) return;
                if (e.key === 'Tab') applySuggestion();
            });

            prodInput.addEventListener('blur', function() {
                setTimeout(function() { suggestionDropdown.classList.add('hidden'); }, 150);
            });

            window.addEventListener('resize', function() { suggestionDropdown.classList.add('hidden'); }, { passive: true });
            var mainScrollContainer = document.getElementById('scroll-container');
            if (mainScrollContainer) {
                mainScrollContainer.addEventListener('scroll', function() { suggestionDropdown.classList.add('hidden'); }, { passive: true });
            }

            suggestionDropdown.addEventListener('mousedown', function(e) {
                e.preventDefault();
                var opt = e.target.closest('[data-suggestion]');
                if (opt) applySuggestion(opt);
                prodInput.focus();
            });

            row.querySelector('.price-input').addEventListener('input', function() { updateMath(row, locBlock, optionBlock); });
            row.querySelector('.qty-input').addEventListener('input', function() { updateMath(row, locBlock, optionBlock); });
            row.querySelector('.remove-row-btn').addEventListener('click', function() {
                if (tbody.querySelectorAll('tr.pricing-row').length > 1) {
                    nrcRow.remove();
                    row.remove();
                    updateProductReorderButtons(tbody);
                    updateMath(null, locBlock, optionBlock);
                }
            });
            row.querySelector('.product-move-up-btn').addEventListener('click', function() { moveProductRow(row, 'up'); });
            row.querySelector('.product-move-down-btn').addEventListener('click', function() { moveProductRow(row, 'down'); });

            var syncNrc = function() {
                nrcRow.classList.toggle('hidden', !nrcToggle.checked);
                if (!_suppressDirty) setDirty(true);
            };
            nrcToggle.addEventListener('change', syncNrc);
            syncNrc();
            updateProductReorderButtons(tbody);
            updateMath(row, locBlock, optionBlock);
        }

        function clearLocationDragHighlights(container) {
            if (!container) return;
            container.querySelectorAll('.location-block').forEach(function(b) {
                b.classList.remove('ring-2', 'ring-blue-400', 'ring-inset');
            });
        }

        function getLocationDragInsertBeforeElement(container, y) {
            var draggableElements = Array.from(container.querySelectorAll('.location-block:not(.drag-location-ghost)'));
            var closest = { offset: Number.NEGATIVE_INFINITY, element: null };
            draggableElements.forEach(function(child) {
                var box = child.getBoundingClientRect();
                var offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    closest = { offset: offset, element: child };
                }
            });
            return closest.element;
        }

        function performLocationReorder(container, optionBlock, clientY, srcId) {
            if (!container || !srcId) return;
            var src = document.getElementById(srcId);
            if (!src || src.parentElement !== container) return;

            var insertBefore = getLocationDragInsertBeforeElement(container, clientY);
            if (insertBefore === src) return;
            if (insertBefore === src.nextElementSibling) return;

            if (insertBefore == null) container.appendChild(src);
            else container.insertBefore(src, insertBefore);

            clearLocationDragHighlights(container);
            calculateOptionTotal(optionBlock);
            if (!_suppressDirty) setDirty(true);
        }

        function wireLocationsContainerDragDrop(container, optionBlock) {
            if (!container || container.dataset.locationDropWired === '1') return;
            container.dataset.locationDropWired = '1';

            container.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            container.addEventListener('drop', function(e) {
                e.preventDefault();
                performLocationReorder(container, optionBlock, e.clientY, e.dataTransfer.getData('text/plain'));
            });
        }

        function wireLocationDragDrop(locBlock, container, optionBlock) {
            var handle = locBlock.querySelector('.location-drag-handle');
            if (!handle || handle.dataset.locationDragWired === '1') return;
            handle.dataset.locationDragWired = '1';

            locBlock.setAttribute('draggable', 'false');
            handle.setAttribute('draggable', 'true');

            handle.addEventListener('mousedown', function(e) {
                e.stopPropagation();
            });

            handle.addEventListener('dragstart', function(e) {
                locBlock.classList.add('drag-location-ghost');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', locBlock.id);
                try {
                    if (e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(locBlock, 24, 24);
                } catch (err) { /* ignore */ }
            });

            handle.addEventListener('dragend', function() {
                locBlock.classList.remove('drag-location-ghost');
                clearLocationDragHighlights(container);
            });

            locBlock.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                locBlock.classList.add('ring-2', 'ring-blue-400', 'ring-inset');
            });

            locBlock.addEventListener('dragleave', function(e) {
                if (!locBlock.contains(e.relatedTarget)) {
                    locBlock.classList.remove('ring-2', 'ring-blue-400', 'ring-inset');
                }
            });

            locBlock.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                performLocationReorder(container, optionBlock, e.clientY, e.dataTransfer.getData('text/plain'));
            });
        }

        function addLocationBlock(container, optionBlock, locName, items, promotions) {
            wireLocationsContainerDragDrop(container, optionBlock);
            locationCount++;
            var locId = 'location-' + locationCount;
            var nameEsc = (locName || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            var html = '<div class="location-block border border-slate-200 rounded-lg p-5 bg-white shadow-sm relative" id="' + locId + '">' +
                '<button type="button" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full w-8 h-8 font-bold text-sm remove-location-btn">✕</button>' +
                '<div class="mb-5 pr-10 flex items-center gap-2">' +
                '<div class="location-drag-handle cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-500 select-none rounded p-1 hover:bg-slate-100 shrink-0 leading-none" title="Drag to reorder locations" aria-hidden="true">⋮⋮</div>' +
                '<input type="text" class="w-full min-w-0 border-b-2 border-slate-200 p-2 text-lg font-bold text-slate-800 outline-none focus:border-orange-500 loc-name-input" placeholder="Location Name or Address (e.g., 123 Main St)" value="' + nameEsc + '"></div>' +
                '<div class="location-pricing-table-wrap mb-4">' +
                '<table class="w-full text-left border-collapse">' +
                '<thead><tr class="bg-slate-100 text-slate-600 text-xs uppercase">' +
                '<th class="p-2 w-10 text-center"><span class="sr-only">Reorder</span></th>' +
                '<th class="p-2">PRODUCT</th><th class="p-2 w-28">LIST PRICE</th><th class="p-2 w-20">QTY</th><th class="p-2 w-28 text-right">TOTAL</th>' +
                '<th class="p-2 w-14 text-center text-xs font-semibold tracking-wide normal-case" title="Non-recurring charge">NRC</th>' +
                '<th class="p-2 w-12 text-center"><span class="sr-only">Remove</span></th></tr></thead>' +
                '<tbody class="line-items-body"></tbody></table></div>' +
                '<div class="location-promotions-panel mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">' +
                '<div class="flex justify-between items-center mb-2 gap-2">' +
                '<span class="text-xs font-bold uppercase tracking-wider text-slate-500">Promotions</span>' +
                '<button type="button" class="text-blue-500 text-sm font-semibold hover:text-blue-600 shrink-0 add-promo-btn">+ Add Promotion</button></div>' +
                '<div class="location-promotions-container space-y-2"></div></div>' +
                '<div class="flex justify-between items-center mt-2 border-t border-slate-100 pt-4 gap-4">' +
                '<button type="button" class="text-blue-500 text-sm font-semibold hover:text-blue-600 add-row-btn">+ Add Product Line</button>' +
                '<div class="location-subtotal-row hidden font-bold text-slate-600 text-sm tracking-wide whitespace-nowrap">Location subtotal: <span class="location-total text-slate-900 ml-2 text-lg">$0.00</span></div></div></div>';
            container.insertAdjacentHTML('beforeend', html);
            var block = document.getElementById(locId);
            syncLocationSubtotalVisibility();

            var mergedPromotions = migrateLegacyRowPromosIntoLocationPromotions(items, promotions);

            if (items && items.length > 0) {
                items.forEach(function(it) { addRow(block, optionBlock, stripLegacyRowPromoFields(it)); });
            } else {
                addRow(block, optionBlock, null);
            }
            setLocationPromotionsFromData(block, mergedPromotions);

            block.querySelector('.add-promo-btn').addEventListener('click', function() { appendLocationPromotionRow(block); if (!_suppressDirty) setDirty(true); });
            block.querySelector('.add-row-btn').addEventListener('click', function() { addRow(block, optionBlock, null); });
            block.querySelector('.remove-location-btn').addEventListener('click', function() {
                if (container.children.length > 1) {
                    block.remove();
                    calculateOptionTotal(optionBlock);
                    if (!_suppressDirty) setDirty(true);
                } else {
                    showToast('Each option must have at least one location.', 'error');
                }
            });
            wireLocationDragDrop(block, container, optionBlock);
        }

        function addPricingOption(optionData) {
            if (!optionsContainer) return;
            var isAdditionalOption = optionsContainer.querySelectorAll('.pricing-option-block').length > 0;
            if (optionData == null) {
                var existingOpts = optionsContainer.querySelectorAll('.pricing-option-block');
                if (existingOpts.length > 0) {
                    optionData = cloneOptionDataFromBlock(existingOpts[existingOpts.length - 1]);
                }
            } else if (typeof optionData === 'object') {
                if ((optionData.term == null || String(optionData.term) === '') && optionData.contractTerm != null) {
                    optionData.term = optionData.contractTerm;
                }
                if ((optionData.solutionId == null || String(optionData.solutionId) === '') && optionData.salesforceQuoteId != null) {
                    optionData.solutionId = optionData.salesforceQuoteId;
                }
            }
            optionCount++;
            var optionId = 'pricing-option-' + optionCount;
            var termVal = '';
            if (optionData && optionData.term != null) termVal = String(optionData.term).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            var solutionVal = '';
            if (optionData && optionData.solutionId != null) {
                solutionVal = String(optionData.solutionId).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            }
            var csvWrapHtml = isAdditionalOption ? (
                '<div class="option-csv-import-wrap w-full lg:w-auto lg:shrink-0 lg:max-w-[240px]">' +
                '<span class="block text-sm font-semibold text-slate-700 lg:invisible lg:h-0 lg:overflow-hidden lg:mb-0 mb-1">Salesforce</span>' +
                '<button type="button" class="option-salesforce-csv-btn flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900">' +
                '<svg class="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>' +
                'Import CSV into this option</button>' +
                '<span class="option-csv-filename mt-1 block truncate text-[10px] text-slate-500" title=""></span></div>'
            ) : '';
            var optionHtml =
                '<div class="pricing-option-block bg-slate-50 border border-slate-200 rounded-xl p-6 relative mb-6" id="' + optionId + '">' +
                '<div class="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">' +
                '<h4 class="text-xl font-bold text-slate-700 option-title">Option ' + optionCount + '</h4>' +
                '<div class="flex items-center gap-6">' +
                '<button type="button" class="bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm hover:bg-slate-900 transition add-location-btn">+ Add Location</button>' +
                '<button type="button" class="text-slate-400 hover:text-red-500 font-bold text-2xl remove-option-btn hidden transition leading-none" title="Remove Option">✕</button></div></div>' +
                '<div class="pricing-option-controls-row mb-6">' +
                '<div class="pricing-option-term-wrap">' +
                '<label class="block text-sm font-semibold text-slate-700">Contract Term</label>' +
                '<input type="text" class="contract-term option-term-input w-full border border-slate-300 p-2 rounded-lg mt-1 bg-white focus:outline-none focus:border-orange-500 transition" placeholder="e.g. 36" value="' + termVal + '">' +
                '</div>' +
                '<div class="pricing-solution-id-wrap">' +
                '<label class="block text-sm font-semibold text-slate-700">Solution ID <span class="font-normal text-slate-400">(optional)</span></label>' +
                '<input type="text" class="solution-id-input w-full border border-slate-300 p-2 rounded-lg mt-1 bg-white focus:outline-none focus:border-orange-500 transition" placeholder="e.g. Q-40776" maxlength="32" value="' + solutionVal + '">' +
                '</div>' + csvWrapHtml +
                '</div>' +
                '<div class="locations-container space-y-8"></div>' +
                '<div class="mt-6 border-t border-slate-300 pt-6 flex justify-between items-center bg-white p-6 rounded-lg shadow-sm">' +
                '<span class="text-xl font-bold text-slate-800 uppercase option-total-label">Option Total Monthly Cost:</span>' +
                '<span class="option-grand-total text-3xl font-extrabold text-blue-600">$0.00</span></div></div>';

            optionsContainer.insertAdjacentHTML('beforeend', optionHtml);
            var block = document.getElementById(optionId);
            var locContainer = block.querySelector('.locations-container');

            if (optionData && optionData.locations && optionData.locations.length > 0) {
                optionData.locations.forEach(function(loc) {
                    addLocationBlock(locContainer, block, loc.name, loc.items, loc.promotions);
                });
            } else {
                addLocationBlock(locContainer, block);
            }

            block.querySelector('.add-location-btn').addEventListener('click', function() { addLocationBlock(locContainer, block); });
            block.querySelector('.remove-option-btn').addEventListener('click', function() {
                var checkboxGroup = block.querySelector('.pricing-option-checkboxes-wrap');
                if (checkboxGroup) {
                    var subCb = checkboxGroup.querySelector('#pricing-enable-location-subtotals');
                    if (subCb) pricingSubtotalCheckboxPreserveChecked = subCb.checked;
                    var amyCb = checkboxGroup.querySelector('#pricing-enable-decimal-points-amy');
                    if (amyCb) pricingAmyDecimalsPreserveChecked = amyCb.checked;
                }
                if (optionsContainer.querySelectorAll('.pricing-option-block').length <= 1) {
                    showToast('Keep at least one pricing option.', 'error');
                    return;
                }
                block.remove();
                updateOptionTitles();
                ensurePricingSubtotalCheckboxPlacement();
                if (!_suppressDirty) setDirty(true);
            });

            updateOptionTitles();
            ensurePricingSubtotalCheckboxPlacement();
        }

        var addPricingOptBtn = document.getElementById('add-pricing-option-btn');
        if (optionsContainer && addPricingOptBtn) {
            addPricingOptBtn.addEventListener('click', function() { addPricingOption(null); });
            addPricingOption(null);
        } else if (!optionsContainer) {
            console.warn('[Proposals] #pricing-options-container not found; pricing UI disabled.');
        }

        var csvInputEl = document.getElementById('salesforce-csv-input');
        var csvInputOptionEl = document.getElementById('salesforce-csv-input-option');

        function getFirstPricingOptionBlock() {
            return document.querySelector('#pricing-options-container .pricing-option-block') || document.querySelector('.pricing-option-block');
        }

        var csvTriggerEl = document.getElementById('salesforce-csv-trigger');
        if (csvTriggerEl && csvInputEl) {
            csvTriggerEl.addEventListener('click', function() {
                csvInputEl.click();
            });
            csvInputEl.addEventListener('change', function(e) {
                var f = e.target.files && e.target.files[0];
                var firstOpt = getFirstPricingOptionBlock();
                if (f) handleSalesforceCsvFile(f, firstOpt, document.getElementById('salesforce-csv-label'));
                e.target.value = '';
            });
            ['dragenter', 'dragover'].forEach(function(ev) {
                csvTriggerEl.addEventListener(ev, function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    csvTriggerEl.classList.add('border-blue-400', 'bg-blue-50');
                });
            });
            csvTriggerEl.addEventListener('dragleave', function(e) {
                e.preventDefault();
                e.stopPropagation();
                csvTriggerEl.classList.remove('border-blue-400', 'bg-blue-50');
            });
            csvTriggerEl.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                csvTriggerEl.classList.remove('border-blue-400', 'bg-blue-50');
                var f = e.dataTransfer.files && e.dataTransfer.files[0];
                var dropFirstOpt = getFirstPricingOptionBlock();
                if (f) handleSalesforceCsvFile(f, dropFirstOpt, document.getElementById('salesforce-csv-label'));
            });
        }

        if (csvInputOptionEl) {
            csvInputOptionEl.addEventListener('change', function(e) {
                var f = e.target.files && e.target.files[0];
                var target = csvImportTargetOptionBlock;
                var fnEl = target ? target.querySelector('.option-csv-filename') : null;
                if (f && target) handleSalesforceCsvFile(f, target, fnEl);
                csvImportTargetOptionBlock = null;
                e.target.value = '';
            });
        }

        (function setupSalesforceExportHelpModal() {
            var modal = document.getElementById('salesforce-export-help-modal');
            var openBtn = document.getElementById('salesforce-export-help-open');
            var closeBtns = [
                document.getElementById('salesforce-export-help-close'),
                document.getElementById('salesforce-export-help-close-footer')
            ].filter(Boolean);
            if (!modal || !openBtn) return;

            var prevHtmlOverflow = '';
            var prevBodyOverflow = '';

            function openModal() {
                modal.classList.remove('hidden');
                modal.setAttribute('aria-hidden', 'false');
                prevHtmlOverflow = document.documentElement.style.overflow;
                prevBodyOverflow = document.body.style.overflow;
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
            }

            function closeModal() {
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
                document.documentElement.style.overflow = prevHtmlOverflow;
                document.body.style.overflow = prevBodyOverflow;
            }

            openBtn.addEventListener('click', openModal);
            closeBtns.forEach(function(btn) { btn.addEventListener('click', closeModal); });

            modal.addEventListener('click', function(e) {
                if (e.target === modal) closeModal();
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
            });
        })();

        syncLocationSubtotalVisibility();

        function updateImpactNet() {
            var cur = parseFloat(document.getElementById('impact-current-cost').value) || 0;
            var prop = parseFloat(document.getElementById('impact-proposed-cost').value) || 0;
            var net = prop - cur;
            var el = document.getElementById('impact-net');
            if (el) el.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(net);
        }
        if (document.getElementById('impact-current-cost')) document.getElementById('impact-current-cost').addEventListener('input', updateImpactNet);
        if (document.getElementById('impact-proposed-cost')) document.getElementById('impact-proposed-cost').addEventListener('input', updateImpactNet);

        // --- Save / Load Project ---
        function buildProjectData() {
            var pricingOptions = Array.from(document.querySelectorAll('.pricing-option-block')).map(function(optBlock) {
                var termEl = optBlock.querySelector('.contract-term') || optBlock.querySelector('.option-term-input');
                var termVal = termEl ? termEl.value : '';
                var solutionEl = optBlock.querySelector('.solution-id-input');
                var solutionVal = solutionEl ? solutionEl.value.trim() : '';
                return {
                    term: termVal,
                    contractTerm: termVal,
                    solutionId: solutionVal,
                    salesforceQuoteId: solutionVal,
                    locations: Array.from(optBlock.querySelectorAll('.location-block')).map(function(block) {
                        return {
                            name: block.querySelector('.loc-name-input') ? block.querySelector('.loc-name-input').value : '',
                            promotions: readLocationPromotions(block),
                            items: readPricingItemsFromLocationBlock(block)
                        };
                    })
                };
            });
            const projectData = {
                globalRfp: document.getElementById('global-rfp').value,
                globalBiz: document.getElementById('global-biz').value,
                globalRep: document.getElementById('global-rep').value,
                globalDate: document.getElementById('global-date') ? document.getElementById('global-date').value : '',
                globalStart: document.getElementById('global-start').value,
                globalEnd: document.getElementById('global-end').value,
                coverText: document.getElementById('cover-body').value,
                customTextTitle: document.getElementById('custom-text-title-input') ? document.getElementById('custom-text-title-input').value : '',
                customPdfSectionName: document.getElementById('custom-pdf-section-name') ? document.getElementById('custom-pdf-section-name').value : '',
                customText: document.getElementById('custom-text-body') ? document.getElementById('custom-text-body').value : '',
                enableLocationSubtotals: !!(document.getElementById('pricing-enable-location-subtotals') && document.getElementById('pricing-enable-location-subtotals').checked),
                enableDecimalPointsAmy: !!(document.getElementById('pricing-enable-decimal-points-amy') && document.getElementById('pricing-enable-decimal-points-amy').checked),
                enableQuoteExpiration: !!(document.getElementById('pricing-enable-quote-expiration') && document.getElementById('pricing-enable-quote-expiration').checked),
                quoteExpirationDays: document.getElementById('pricing-quote-expiration-days') ? document.getElementById('pricing-quote-expiration-days').value : '',
                enableTaxesFeesExclusion: !!(document.getElementById('pricing-enable-taxes-fees-exclusion') && document.getElementById('pricing-enable-taxes-fees-exclusion').checked),
                pricingOptions: pricingOptions,
                references: Array.from(document.querySelectorAll('.ref-block')).map(b => ({
                    name: b.querySelector('.ref-name').value,
                    org: b.querySelector('.ref-org').value,
                    addr: b.querySelector('.ref-addr').value,
                    phone: b.querySelector('.ref-phone').value,
                    email: b.querySelector('.ref-email').value
                })),
                discoveryScratchpad: document.getElementById('discovery-scratchpad').value,
                customPages: (function() {
                    var o = {};
                    document.querySelectorAll('#module-list li[data-filename="CUSTOM_TEXT"]').forEach(function(li) {
                        var idx = li.getAttribute('data-custom-index') || '0';
                        var titleEl = document.getElementById('custom-text-title-input' + (idx === '0' ? '' : '-' + idx));
                        var bodyEl = document.getElementById('custom-text-body' + (idx === '0' ? '' : '-' + idx));
                        o[idx] = { title: (titleEl && titleEl.value) ? titleEl.value : '', body: (bodyEl && bodyEl.value) ? bodyEl.value : '' };
                    });
                    return o;
                })(),
                customPdfs: (function() {
                    var o = {};
                    document.querySelectorAll('#module-list li[data-filename="CUSTOM_PDF"]').forEach(function(li) {
                        var idx = li.getAttribute('data-custom-index') || '0';
                        var nameEl = document.getElementById('custom-pdf-section-name' + (idx === '0' ? '' : '-' + idx));
                        var fileEl = document.getElementById('custom-pdf-upload' + (idx === '0' ? '' : '-' + idx));
                        o[idx] = { sectionName: (nameEl && nameEl.value) ? nameEl.value : '', fileName: (fileEl && fileEl.files && fileEl.files[0]) ? fileEl.files[0].name : '' };
                    });
                    return o;
                })(),
                readiness: {
                    rfpBiz: getReadinessControl('check-rfp-biz') ? getReadinessControl('check-rfp-biz').checked : false,
                    cover: getReadinessControl('check-cover') ? getReadinessControl('check-cover').checked : false,
                    pricing: getReadinessControl('check-pricing') ? getReadinessControl('check-pricing').checked : false,
                    ready: getReadinessControl('check-ready') ? getReadinessControl('check-ready').checked : false
                },
                impactCurrent: document.getElementById('impact-current').value,
                impactProposed: document.getElementById('impact-proposed').value,
                impactCurrentCost: document.getElementById('impact-current-cost').value,
                impactProposedCost: document.getElementById('impact-proposed-cost').value,
                modules: []
            };
            document.querySelectorAll('#module-list li').forEach(function(li) {
                var pdfId = li.getAttribute('data-filename');
                var cb = li.querySelector('input.slide-toggle');
                var customIndex = li.getAttribute('data-custom-index');
                projectData.modules.push({
                    filename: pdfId,
                    customIndex: (pdfId === 'CUSTOM_TEXT' || pdfId === 'CUSTOM_PDF') ? (customIndex || '0') : undefined,
                    checked: cb ? cb.checked : false
                });
            });
            return projectData;
        }

        function downloadSpecFile(projectData) {
            setDirty(false);
            const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (projectData.globalBiz || 'GPC_Proposal').replace(/\s+/g, '_') + '.spec';
            a.click();
            URL.revokeObjectURL(a.href);
        }

        var proposalSaveTomSelect = null;

        function destroyProposalSaveTomSelect() {
            if (proposalSaveTomSelect) {
                try { proposalSaveTomSelect.destroy(); } catch (e) {}
                proposalSaveTomSelect = null;
            }
        }

        function openSaveModal() {
            if (typeof window.showModal !== 'function') {
                var projectData = buildProjectData();
                downloadSpecFile(projectData);
                showToast('Proposal saved locally.', 'success');
                return;
            }
            destroyProposalSaveTomSelect();
            var defaultName = (loadedProposalName || (document.getElementById('global-biz') && document.getElementById('global-biz').value) || 'Proposal').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var bodyHtml = '';
            bodyHtml += '<label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Account</label>' +
                '<select id="proposal-save-account" class="w-full mb-4" placeholder="— Select account —">' +
                '<option value="">— Select account —</option></select>';
            if (loadedProposalId) {
                bodyHtml += '<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">Overwrite the existing proposal or save as a new one (choose account for new copy above).</p>';
            }
            bodyHtml += '<label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Proposal name (optional)</label>' +
                '<input type="text" id="proposal-save-name" class="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" placeholder="e.g. Q1 2026 proposal" value="' + defaultName + '">';
            var actionsHtml = '<button type="button" id="proposal-save-cancel-btn" class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium">Cancel</button>' +
                '<button type="button" id="proposal-save-local-btn" class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium">Save local copy</button>';
            if (loadedProposalId) {
                actionsHtml += '<button type="button" id="proposal-save-overwrite-btn" class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium">Overwrite</button>' +
                    '<button type="button" id="proposal-save-as-new-btn" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save as new</button>';
            } else {
                actionsHtml += '<button type="button" id="proposal-save-account-btn" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">Save to account</button>';
            }
            window.showModal('Save Proposal', bodyHtml, null, true, actionsHtml);
            var selectEl = document.getElementById('proposal-save-account');
            if (selectEl && window.proposalsSupabase && window.getState) {
                var uid = window.getState().effectiveUserId;
                if (uid) {
                    window.proposalsSupabase.from('accounts').select('id, name').eq('user_id', uid).order('name').then(function(r) {
                        if (r.data && r.data.length && selectEl) {
                            r.data.forEach(function(acc) {
                                var opt = document.createElement('option');
                                opt.value = String(acc.id);
                                opt.textContent = acc.name || String(acc.id);
                                selectEl.appendChild(opt);
                            });
                            if (loadedProposalAccountId) selectEl.value = loadedProposalAccountId;
                        }
                        initProposalSaveTomSelect();
                        if (loadedProposalAccountId && proposalSaveTomSelect) proposalSaveTomSelect.setValue(loadedProposalAccountId);
                    });
                } else {
                    initProposalSaveTomSelect();
                }
            } else {
                initProposalSaveTomSelect();
            }
            function initProposalSaveTomSelect() {
                var sel = document.getElementById('proposal-save-account');
                if (!sel || typeof window.TomSelect === 'undefined') return;
                try {
                    proposalSaveTomSelect = new window.TomSelect(sel, {
                        create: false,
                        maxItems: 1,
                        placeholder: '— Select account —',
                        render: {
                            dropdown: function() {
                                var d = document.createElement('div');
                                d.className = 'ts-dropdown';
                                return d;
                            }
                        }
                    });
                } catch (e) { proposalSaveTomSelect = null; }
            }
            setTimeout(function() {
                var cancelBtn = document.getElementById('proposal-save-cancel-btn');
                var localBtn = document.getElementById('proposal-save-local-btn');
                var accountBtn = document.getElementById('proposal-save-account-btn');
                var overwriteBtn = document.getElementById('proposal-save-overwrite-btn');
                var saveAsNewBtn = document.getElementById('proposal-save-as-new-btn');
                if (cancelBtn && window.hideModal) {
                    cancelBtn.addEventListener('click', function() {
                        destroyProposalSaveTomSelect();
                        window.hideModal();
                    });
                }
                if (localBtn) {
                    localBtn.addEventListener('click', function() {
                        destroyProposalSaveTomSelect();
                        var projectData = buildProjectData();
                        downloadSpecFile(projectData);
                        if (window.hideModal) window.hideModal();
                        showToast('Proposal saved locally.', 'success');
                    });
                }
                function getSaveName() {
                    var nameEl = document.getElementById('proposal-save-name');
                    return (nameEl && nameEl.value && nameEl.value.trim()) ? nameEl.value.trim() : 'Proposal';
                }
                function getSaveAccountId() {
                    return proposalSaveTomSelect ? (proposalSaveTomSelect.getValue() || '') : (document.getElementById('proposal-save-account') && document.getElementById('proposal-save-account').value);
                }
                if (overwriteBtn) {
                    overwriteBtn.addEventListener('click', function() {
                        var name = getSaveName();
                        if (!window.proposalsSupabase) {
                            showToast('Unable to save. Please try saving a local copy.', 'error');
                            return;
                        }
                        var projectData = buildProjectData();
                        window.proposalsSupabase.from('proposal_specs').update({ name: name, spec: projectData }).eq('id', loadedProposalId).then(function(r) {
                            destroyProposalSaveTomSelect();
                            if (r.error) {
                                showToast('Error saving: ' + (r.error.message || 'Unknown error'), 'error');
                                return;
                            }
                            if (window.hideModal) window.hideModal();
                            setDirty(false);
                            loadedProposalName = name;
                            showToast('Proposal updated.', 'success');
                        });
                    });
                }
                if (saveAsNewBtn) {
                    saveAsNewBtn.addEventListener('click', function() {
                        var accountId = getSaveAccountId();
                        var name = getSaveName();
                        if (!accountId) {
                            showToast('Please select an account for the new proposal.', 'error');
                            return;
                        }
                        if (!window.proposalsSupabase) {
                            showToast('Unable to save. Please try saving a local copy.', 'error');
                            return;
                        }
                        var projectData = buildProjectData();
                        window.proposalsSupabase.from('proposal_specs').insert({
                            account_id: accountId,
                            name: name,
                            spec: projectData,
                            created_by: window.getState().currentUser ? window.getState().currentUser.id : null
                        }).select('id').then(function(r) {
                            destroyProposalSaveTomSelect();
                            if (r.error) {
                                showToast('Error saving: ' + (r.error.message || 'Unknown error'), 'error');
                                return;
                            }
                            if (window.hideModal) window.hideModal();
                            setDirty(false);
                            if (r.data && r.data[0] && r.data[0].id) {
                                loadedProposalId = r.data[0].id;
                                loadedProposalName = name;
                                loadedProposalAccountId = String(accountId);
                            }
                            showToast('Saved as new proposal.', 'success');
                        });
                    });
                }
                if (accountBtn) {
                    accountBtn.addEventListener('click', function() {
                        var accountId = getSaveAccountId();
                        var name = getSaveName();
                        if (!accountId) {
                            showToast('Please select an account.', 'error');
                            return;
                        }
                        if (!window.proposalsSupabase) {
                            showToast('Unable to save to account. Please try saving a local copy.', 'error');
                            return;
                        }
                        var projectData = buildProjectData();
                        window.proposalsSupabase.from('proposal_specs').insert({
                            account_id: accountId,
                            name: name,
                            spec: projectData,
                            created_by: window.getState().currentUser ? window.getState().currentUser.id : null
                        }).then(function(r) {
                            destroyProposalSaveTomSelect();
                            if (r.error) {
                                showToast('Error saving: ' + (r.error.message || 'Unknown error'), 'error');
                                return;
                            }
                            if (window.hideModal) window.hideModal();
                            setDirty(false);
                            showToast('Proposal saved to account.', 'success');
                        });
                    });
                }
            }, 50);
        }

        function saveProject() {
            var projectData = buildProjectData();
            downloadSpecFile(projectData);
            showToast('Proposal saved locally.', 'success');
        }

        function normalizeLegacyQuillText(s) {
            if (s == null || typeof s !== 'string') return '';
            var t = s.trim();
            if (t === '' || t === '<p><br></p>' || t === '<p></p>' || /^<p>\s*<\/p>$/i.test(t)) return '';
            if (/<[a-z][\s\S]*>/i.test(t)) return t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
            return t;
        }

        function applySpecToForm(data) {
            if (!data) return;
            if (data.globalRfp != null) document.getElementById('global-rfp').value = data.globalRfp;
            if (data.globalBiz != null) document.getElementById('global-biz').value = data.globalBiz;
            if (data.globalRep != null) document.getElementById('global-rep').value = data.globalRep;
            if (data.globalStart != null) document.getElementById('global-start').value = data.globalStart;
            if (data.globalEnd != null) document.getElementById('global-end').value = data.globalEnd;
            if (data.coverText != null) document.getElementById('cover-body').value = normalizeLegacyQuillText(data.coverText);
            var customPages = data.customPages || (data.customTextTitle != null ? { '0': { title: data.customTextTitle, body: (data.customText != null ? data.customText : '') } } : {});
            var customPdfs = data.customPdfs || (data.customPdfSectionName != null ? { '0': { sectionName: data.customPdfSectionName, fileName: '' } } : {});
            var customPageIndices = Object.keys(customPages).map(Number).sort(function(a,b){ return a - b; });
            var customPdfIndices = Object.keys(customPdfs).map(Number).sort(function(a,b){ return a - b; });
            for (var k = 1; k < customPageIndices.length; k++) {
                var nextIdx = customPageIndices[k];
                var lis = document.querySelectorAll('#module-list li[data-filename="CUSTOM_TEXT"]');
                var last = lis[lis.length - 1];
                var newLi = document.createElement('li');
                newLi.className = 'flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm cursor-grab group border-l-4 border-l-blue-400';
                newLi.setAttribute('data-filename', 'CUSTOM_TEXT');
                newLi.setAttribute('data-custom-index', String(nextIdx));
                newLi.innerHTML = '<svg class="w-5 h-5 handle text-slate-400 group-hover:text-blue-500 transition cursor-grab mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"></path></svg><input type="checkbox" class="mr-3 w-4 h-4 text-blue-500 slide-toggle" data-pdf-id="CUSTOM_TEXT"><span class="flex-1 font-medium text-sm text-slate-700 custom-page-label">Custom Page ' + (nextIdx + 1) + '</span><div class="flex items-center gap-1 flex-shrink-0"><button type="button" class="add-custom-page-btn text-slate-400 hover:text-blue-500 p-1 rounded" title="Add another Custom Page">+</button><button type="button" class="remove-custom-page-btn text-slate-400 hover:text-red-500 p-1 rounded" title="Remove">−</button></div>';
                last.insertAdjacentElement('afterend', newLi);
                var container = document.getElementById('custom-pages-container');
                var section = document.createElement('div');
                section.id = 'custom-text-section-' + nextIdx;
                section.className = 'custom-text-section hidden bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 transition-all duration-300';
                section.setAttribute('data-custom-index', String(nextIdx));
                section.innerHTML = '<div class="flex items-center mb-4 border-b border-slate-100 pb-2 gap-2"><svg class="w-6 h-6 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg><h3 class="text-2xl font-bold text-slate-800 custom-text-section-title">Custom Page ' + (nextIdx + 1) + '</h3></div><input type="text" id="custom-text-title-input-' + nextIdx + '" class="custom-text-title-input w-full border border-slate-300 p-2 rounded-lg mb-3 bg-slate-50 outline-none focus:border-orange-500 font-semibold text-slate-700" placeholder="Document Title (Leave blank for no header)"><div class="flex gap-6 flex-nowrap items-start"><div class="flex-1 min-w-[500px]"><textarea id="custom-text-body-' + nextIdx + '" class="custom-text-body w-full h-64 p-3 border border-slate-300 rounded-lg bg-white resize-y font-sans text-base focus:outline-none focus:border-orange-500" placeholder="Start typing custom content..." style="white-space: pre-wrap;"></textarea><p class="warning-customText hidden text-red-600 text-sm font-bold mt-2">⚠️ Warning: Text exceeds PDF page height and may be cut off. Please shorten.</p></div><div class="w-[280px] flex-shrink-0 rounded-xl bg-slate-50 border border-slate-200 p-4 text-slate-600 flex flex-col gap-4"><div><h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Click to add</h3><p class="text-xs text-slate-400 mb-2">Inserts at cursor in the custom page.</p><div class="custom-page-snippets space-y-2 overflow-auto min-h-0"></div></div></div></div>';
                container.appendChild(section);
                var snipContainer = section.querySelector('.custom-page-snippets');
                if (snipContainer && typeof GPC_CUSTOM_PAGE_SNIPPETS !== 'undefined') {
                    GPC_CUSTOM_PAGE_SNIPPETS.forEach(function(s) {
                        var btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-orange-500 hover:bg-orange-50/80 text-slate-700 text-[11px] leading-tight transition shadow-sm';
                        btn.textContent = s.label;
                        btn.title = s.text.slice(0, 80) + (s.text.length > 80 ? '…' : '');
                        btn.addEventListener('click', function() { insertIntoCustomTextBody(s.text); });
                        snipContainer.appendChild(btn);
                    });
                }
            }
            for (var kk = 1; kk < customPdfIndices.length; kk++) {
                var nextIdx = customPdfIndices[kk];
                var lis = document.querySelectorAll('#module-list li[data-filename="CUSTOM_PDF"]');
                var last = lis[lis.length - 1];
                var newLi = document.createElement('li');
                newLi.className = 'flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm cursor-grab group border-l-4 border-l-blue-400';
                newLi.setAttribute('data-filename', 'CUSTOM_PDF');
                newLi.setAttribute('data-custom-index', String(nextIdx));
                newLi.innerHTML = '<svg class="w-5 h-5 handle text-slate-400 group-hover:text-blue-500 transition cursor-grab mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"></path></svg><input type="checkbox" class="mr-3 w-4 h-4 text-blue-500 slide-toggle" data-pdf-id="CUSTOM_PDF"><span class="flex-1 font-medium text-sm text-slate-700 custom-pdf-label">Upload Custom PDF ' + (nextIdx + 1) + '</span><div class="flex items-center gap-1 flex-shrink-0"><button type="button" class="add-custom-pdf-btn text-slate-400 hover:text-blue-500 p-1 rounded" title="Add another Custom PDF">+</button><button type="button" class="remove-custom-pdf-btn text-slate-400 hover:text-red-500 p-1 rounded" title="Remove">−</button></div>';
                last.insertAdjacentElement('afterend', newLi);
                var container = document.getElementById('custom-pdfs-container');
                var section = document.createElement('div');
                section.id = 'custom-pdf-section-' + nextIdx;
                section.className = 'custom-pdf-section hidden bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 transition-all duration-300';
                section.setAttribute('data-custom-index', String(nextIdx));
                section.innerHTML = '<div class="flex items-center mb-4 border-b border-slate-100 pb-2 gap-2"><svg class="w-6 h-6 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg><h3 class="text-2xl font-bold text-slate-800 custom-pdf-section-title">Upload Custom PDF ' + (nextIdx + 1) + '</h3></div><div class="mb-4"><label class="block text-sm font-semibold text-slate-700 mb-1">Section name for Table of Contents</label><input type="text" id="custom-pdf-section-name-' + nextIdx + '" class="custom-pdf-section-name w-full border border-slate-300 p-2 rounded-lg bg-slate-50 focus:bg-white outline-none focus:border-orange-500 font-medium text-slate-700" maxlength="80" placeholder="e.g. Executive Summary"></div><input type="file" id="custom-pdf-upload-' + nextIdx + '" class="custom-pdf-upload hidden" accept="application/pdf"><div class="custom-pdf-dropzone border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-orange-50 hover:border-orange-400 transition cursor-pointer group" onclick="this.closest(\'.custom-pdf-section\').querySelector(\'.custom-pdf-upload\').click()"><svg class="mx-auto h-12 w-12 text-slate-400 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg><span class="custom-pdf-filename mt-2 block text-slate-600 font-medium group-hover:text-orange-600">Drag and drop Custom PDF here, or click to browse</span></div></div>';
                container.appendChild(section);
            }
            if (typeof updateCustomPageRowLabels === 'function') updateCustomPageRowLabels();
            if (typeof updateCustomPdfRowLabels === 'function') updateCustomPdfRowLabels();
            Object.keys(customPages).forEach(function(idx) {
                var titleEl = document.getElementById('custom-text-title-input' + (idx === '0' ? '' : '-' + idx));
                var bodyEl = document.getElementById('custom-text-body' + (idx === '0' ? '' : '-' + idx));
                var page = customPages[idx];
                if (titleEl && page && page.title != null) titleEl.value = page.title;
                if (bodyEl && page && page.body != null) bodyEl.value = normalizeLegacyQuillText(page.body);
            });
            Object.keys(customPdfs).forEach(function(idx) {
                var nameEl = document.getElementById('custom-pdf-section-name' + (idx === '0' ? '' : '-' + idx));
                var pdf = customPdfs[idx];
                if (nameEl && pdf && pdf.sectionName != null) nameEl.value = pdf.sectionName;
            });
            if (data.customTextTitle != null && !data.customPages) document.getElementById('custom-text-title-input').value = data.customTextTitle;
            if (data.customText != null && !data.customPages) document.getElementById('custom-text-body').value = normalizeLegacyQuillText(data.customText);
            if (data.customPdfSectionName != null && !data.customPdfs && document.getElementById('custom-pdf-section-name')) document.getElementById('custom-pdf-section-name').value = data.customPdfSectionName;
            var gdEl = document.getElementById('global-date');
            if (gdEl) {
                if (data.globalDate != null && String(data.globalDate).trim() !== '') gdEl.value = data.globalDate;
                else gdEl.value = '';
            }
            if (optionsContainer) {
                var poArrRaw = Array.isArray(data.pricingOptions) ? data.pricingOptions : null;
                var validPricingOptions = poArrRaw ? poArrRaw.filter(function(po) {
                    return po != null && typeof po === 'object' && !Array.isArray(po);
                }) : [];
                if (validPricingOptions.length > 0) {
                    optionsContainer.innerHTML = '';
                    optionCount = 0;
                    validPricingOptions.forEach(function(po) {
                        var locs = po.locations;
                        var term = (po.term != null && String(po.term) !== '') ? po.term : (po.contractTerm != null ? po.contractTerm : '');
                        var sid = '';
                        if (po.solutionId != null && String(po.solutionId).trim() !== '') sid = po.solutionId;
                        else if (po.salesforceQuoteId != null && String(po.salesforceQuoteId).trim() !== '') sid = po.salesforceQuoteId;
                        addPricingOption({ term: term, solutionId: sid, locations: Array.isArray(locs) ? locs : [] });
                    });
                } else {
                    optionsContainer.innerHTML = '';
                    optionCount = 0;
                    var legacyLocs = Array.isArray(data.locations) ? data.locations : [];
                    var hasLegacy = legacyLocs.length || (data.contractTerm != null && String(data.contractTerm).trim() !== '');
                    if (hasLegacy) {
                        addPricingOption({
                            term: data.contractTerm || '',
                            locations: legacyLocs.length ? legacyLocs.map(function(loc) { return Object.assign({}, loc, { promotions: Array.isArray(loc.promotions) ? loc.promotions : [] }); }) : []
                        });
                    } else {
                        addPricingOption(null);
                    }
                }
                var locSubCb = document.getElementById('pricing-enable-location-subtotals');
                if (locSubCb) locSubCb.checked = data.enableLocationSubtotals === true;
                var amyDecCb = document.getElementById('pricing-enable-decimal-points-amy');
                if (amyDecCb) amyDecCb.checked = data.enableDecimalPointsAmy === true;
                var quoteExpCb = document.getElementById('pricing-enable-quote-expiration');
                if (quoteExpCb) quoteExpCb.checked = data.enableQuoteExpiration === true;
                var quoteExpDays = document.getElementById('pricing-quote-expiration-days');
                if (quoteExpDays && data.quoteExpirationDays != null) quoteExpDays.value = data.quoteExpirationDays;
                var taxesFeesCb = document.getElementById('pricing-enable-taxes-fees-exclusion');
                if (taxesFeesCb) taxesFeesCb.checked = data.enableTaxesFeesExclusion === true;
                syncQuoteExpirationDaysVisibility();
                syncLocationSubtotalVisibility();
                refreshAllPricingMath();
            }
            if (data.references && data.references.length) {
                const refBlocks = document.querySelectorAll('.ref-block');
                data.references.forEach((ref, i) => {
                    if (refBlocks[i]) {
                        refBlocks[i].querySelector('.ref-name').value = ref.name || '';
                        refBlocks[i].querySelector('.ref-org').value = ref.org || '';
                        refBlocks[i].querySelector('.ref-addr').value = ref.addr || '';
                        refBlocks[i].querySelector('.ref-phone').value = ref.phone || '';
                        refBlocks[i].querySelector('.ref-email').value = ref.email || '';
                    }
                });
            }
            if (data.discoveryScratchpad != null) document.getElementById('discovery-scratchpad').value = data.discoveryScratchpad;
            if (data.readiness) {
                var r = data.readiness;
                if (getReadinessControl('check-rfp-biz')) getReadinessControl('check-rfp-biz').checked = !!r.rfpBiz;
                if (getReadinessControl('check-cover')) getReadinessControl('check-cover').checked = !!r.cover;
                if (getReadinessControl('check-pricing')) getReadinessControl('check-pricing').checked = !!r.pricing;
                if (getReadinessControl('check-ready')) getReadinessControl('check-ready').checked = !!r.ready;
            }
            if (data.impactCurrent != null) document.getElementById('impact-current').value = data.impactCurrent;
            if (data.impactProposed != null) document.getElementById('impact-proposed').value = data.impactProposed;
            if (data.impactCurrentCost != null) document.getElementById('impact-current-cost').value = data.impactCurrentCost;
            if (data.impactProposedCost != null) document.getElementById('impact-proposed-cost').value = data.impactProposedCost;
            if (typeof updateImpactNet === 'function') updateImpactNet();
            if (data.modules && data.modules.length) {
                data.modules.forEach(function(m) {
                    var li = null;
                    if (m.filename === 'CUSTOM_TEXT' || m.filename === 'CUSTOM_PDF') {
                        li = document.querySelector('#module-list li[data-filename="' + m.filename + '"][data-custom-index="' + (m.customIndex || '0') + '"]');
                    } else {
                        li = document.querySelector('#module-list li[data-filename="' + m.filename + '"]');
                    }
                    var cb = li ? li.querySelector('input.slide-toggle') : null;
                    if (cb) cb.checked = !!m.checked;
                });
                document.getElementById('toggle-cover-letter').dispatchEvent(new Event('change'));
                if (typeof syncCustomSectionsVisibility === 'function') syncCustomSectionsVisibility();
                if (document.getElementById('toggle-impact-roi')) document.getElementById('toggle-impact-roi').dispatchEvent(new Event('change'));
                document.getElementById('toggle-references').dispatchEvent(new Event('change'));
                document.getElementById('toggle-pricing').dispatchEvent(new Event('change'));
                document.getElementById('toggle-usac').dispatchEvent(new Event('change'));
            }
        }

        function loadProject(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            _suppressDirty = true;
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    loadedProposalId = null;
                    loadedProposalName = null;
                    loadedProposalAccountId = null;
                    applySpecToForm(data);
                    showToast('Project loaded.', 'success');
                } catch (err) {
                    console.error(err);
                    showToast('Error loading project file.', 'error');
                }
                _suppressDirty = false;
                setDirty(false);
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        document.getElementById('save-project-btn').addEventListener('click', openSaveModal);
        document.getElementById('load-project-input').addEventListener('change', loadProject);

        var loadedFromUrlThisSession = false;
        function tryLoadProposalFromUrl() {
            if (loadedFromUrlThisSession) return;
            var params = new URLSearchParams(window.location.search);
            var loadId = params.get('load');
            if (!loadId) return;
            if (!window.proposalsSupabase) return;
            window.proposalsSupabase.from('proposal_specs').select('id, name, spec, account_id').eq('id', loadId).single().then(function(r) {
                if (r.error || !r.data) {
                    if (r.error) showToast('Could not load proposal: ' + (r.error.message || 'Not found'), 'error');
                    return;
                }
                loadedFromUrlThisSession = true;
                var row = r.data;
                _suppressDirty = true;
                loadedProposalId = row.id;
                loadedProposalName = row.name || null;
                loadedProposalAccountId = row.account_id != null ? String(row.account_id) : null;
                applySpecToForm(row.spec);
                _suppressDirty = false;
                setDirty(false);
                showToast('Proposal loaded.', 'success');
            });
        }
        window.tryLoadProposalFromUrl = tryLoadProposalFromUrl;
        setTimeout(tryLoadProposalFromUrl, 1200);

        var pickerPanel = document.getElementById('proposals-picker-panel');
        var pickerToggle = document.getElementById('proposals-picker-toggle');
        if (pickerPanel && pickerToggle) {
            var iconMin = document.getElementById('proposals-picker-icon-minimize');
            var iconExp = document.getElementById('proposals-picker-icon-expand');
            pickerToggle.addEventListener('click', function() {
                pickerPanel.classList.toggle('proposals-picker-collapsed');
                if (iconMin) iconMin.classList.toggle('hidden', pickerPanel.classList.contains('proposals-picker-collapsed'));
                if (iconExp) iconExp.classList.toggle('hidden', !pickerPanel.classList.contains('proposals-picker-collapsed'));
            });
        }

        function sendForProofing() {
            var brackets = findBracketedPlaceholders();
            if (brackets.length) {
                alert('Please replace the following placeholder text before sending:\n\n' + brackets.join('\n'));
                return;
            }
            var projectData = buildProjectData();
            var blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (projectData.globalBiz || 'GPC_Proposal').replace(/\s+/g, '_') + '.spec';
            a.click();
            URL.revokeObjectURL(a.href);
            var subject = 'Proposal Proofing Request - ' + (projectData.globalBiz || 'Account');
            var body = 'Hi Marketing,\n\nPlease review the attached proposal spec and provide feedback when convenient.\n\nProposal engine: https://enterprise-proposals.vercel.app\n\nThanks.';
            var mailto = 'mailto:stinkham@gpcom.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
            window.location.href = mailto;
            var reminder = document.getElementById('send-for-proofing-reminder');
            if (reminder) { reminder.classList.remove('hidden'); setTimeout(function() { reminder.classList.add('hidden'); }, 6000); }
            showToast('Spec saved. Remember to attach the .spec file to your email.');
        }
        var sendProofBtn = document.getElementById('send-for-proofing-btn');
        if (sendProofBtn) sendProofBtn.addEventListener('click', sendForProofing);

        // --- Stock PDF Preview Logic ---
        function previewStockPdf(filename, title) {
            document.getElementById('pdf-preview-title').innerText = title;
            // Added scrollbar=0 to the engine parameters
            document.getElementById('pdf-preview-iframe').src = `Proposal_Assets/${filename}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`;
            document.getElementById('pdf-preview-modal').classList.remove('hidden');
        }

        function closePdfModal() {
            document.getElementById('pdf-preview-modal').classList.add('hidden');
            document.getElementById('pdf-preview-iframe').src = "";
            const dlBtn = document.getElementById('modal-download-btn');
            if (dlBtn) dlBtn.classList.add('hidden');
        }

        // --- Two-stage PDF: Compile = hidden first run, Generate = show preview (same flow as JenniB/Tenworks) ---
        let pdfGenerateState = 'initial';

        function setGenerateButtonState(state) {
            pdfGenerateState = state;
            const btn = document.getElementById('generate-btn');
            if (!btn) return;
            btn.setAttribute('data-state', state);
            btn.classList.remove('animate-pulse', 'btn-primary', 'btn-secondary');
            if (state === 'initial') {
                btn.innerHTML = '<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16l4-4 4 4m0-8H8"></path></svg><span>Compile Proposal</span>';
                btn.classList.add('btn-primary');
                btn.disabled = false;
            } else if (state === 'compiling') {
                btn.innerHTML = '<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="9" stroke-width="2"></circle></svg><span>Compiling…</span>';
                btn.classList.add('btn-secondary', 'animate-pulse');
                btn.disabled = true;
            } else {
                btn.innerHTML = '<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v9m0 0l-3-3m3 3l3-3M5 19h14"></path></svg><span>Generate PDF</span>';
                btn.classList.add('btn-primary');
                btn.disabled = false;
            }
        }

        function promptPdfFileName(defaultBase) {
            var suggestion = (defaultBase || '').trim();
            if (!suggestion) suggestion = 'GPC_Proposal';
            suggestion = suggestion.replace(/\s+/g, '_').replace(/[<>:"/\\|?*]+/g, '');
            if (!suggestion) suggestion = 'GPC_Proposal';
            var raw = window.prompt('Enter a file name for your PDF (without extension). This is required before downloading:', suggestion);
            if (raw === null) return null;
            var cleaned = String(raw).trim();
            if (!cleaned) {
                showToast('Please enter a file name to continue.', 'error');
                return null;
            }
            cleaned = cleaned.replace(/\.pdf$/i, '');
            cleaned = cleaned.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/^\.+$/, '').trim();
            if (!cleaned) {
                showToast('That file name is not valid. Use letters, numbers, dashes, or underscores.', 'error');
                return null;
            }
            return cleaned + '.pdf';
        }

        function getPayload() {
            var brackets = findBracketedPlaceholders();
            if (brackets.length) {
                alert('Please replace the following placeholder text before generating:\n\n' + brackets.join('\n'));
                return null;
            }
            const activeSlides = [];
            document.querySelectorAll('#module-list li').forEach(li => {
                if (!li.querySelector('.slide-toggle').checked) return;
                const fn = li.getAttribute('data-filename');
                const idx = li.getAttribute('data-custom-index');
                if (fn === 'CUSTOM_TEXT' || fn === 'CUSTOM_PDF') activeSlides.push(fn + (idx != null ? ':' + idx : ':0'));
                else activeSlides.push(fn);
            });
            const customPages = {};
            document.querySelectorAll('#module-list li[data-filename="CUSTOM_TEXT"]').forEach(li => {
                const idx = li.getAttribute('data-custom-index') || '0';
                const titleEl = document.getElementById('custom-text-title-input' + (idx === '0' ? '' : '-' + idx));
                const bodyEl = document.getElementById('custom-text-body' + (idx === '0' ? '' : '-' + idx));
                customPages[idx] = { title: (titleEl && titleEl.value) ? titleEl.value.trim() : '', body: (bodyEl && bodyEl.value) ? bodyEl.value : '' };
            });
            const customPdfs = {};
            document.querySelectorAll('#module-list li[data-filename="CUSTOM_PDF"]').forEach(li => {
                const idx = li.getAttribute('data-custom-index') || '0';
                const nameEl = document.getElementById('custom-pdf-section-name' + (idx === '0' ? '' : '-' + idx));
                const fileEl = document.getElementById('custom-pdf-upload' + (idx === '0' ? '' : '-' + idx));
                const file = fileEl && fileEl.files[0];
                customPdfs[idx] = { sectionName: (nameEl && nameEl.value) ? nameEl.value.trim() : '', file: file };
            });
            if (activeSlides.includes('TOC')) {
                for (let i = 0; i < activeSlides.length; i++) {
                    const s = activeSlides[i];
                    if (s.startsWith('CUSTOM_TEXT:')) {
                        const idx = s.split(':')[1];
                        if (!(customPages[idx] && customPages[idx].title)) { alert("Please enter a Document Title for every Custom Page (required for Table of Contents)."); return null; }
                    }
                    if (s.startsWith('CUSTOM_PDF:')) {
                        const idx = s.split(':')[1];
                        if (!(customPdfs[idx] && customPdfs[idx].sectionName)) { alert("Please enter a Section name for every Custom PDF (required for Table of Contents)."); return null; }
                    }
                }
            }
            for (let i = 0; i < activeSlides.length; i++) {
                const s = activeSlides[i];
                if (s.startsWith('CUSTOM_PDF:')) {
                    const idx = s.split(':')[1];
                    if (!(customPdfs[idx] && customPdfs[idx].file)) { alert("Please select a file for every Upload Custom PDF."); return null; }
                }
            }
            const usacFile = document.getElementById('usac-upload').files[0];
            if (activeSlides.includes('USAC_RFP') && !usacFile) { alert("Please select a file for the USAC RFP Upload."); return null; }
            return {
                globals: { biz: document.getElementById('global-biz').value },
                slides: activeSlides,
                customPages: customPages,
                customPdfs: customPdfs,
                usacFile: usacFile
            };
        }

        async function compileAssets(payload) {
            setGenerateButtonState('compiling');
            try {
                await generatePDFDocument(payload, false);
            } catch (err) {
                console.error('Compile failed:', err);
                setGenerateButtonState('initial');
                showToast('Compile failed. Check console.', 'error');
            }
        }

        document.getElementById('generate-btn').addEventListener('click', async () => {
            const payload = getPayload();
            if (!payload) return;
            if (pdfGenerateState === 'initial') {
                await compileAssets(payload);
            } else if (pdfGenerateState === 'ready') {
                try {
                    await generatePDFDocument(payload, true);
                } catch (error) {
                    console.error(error);
                    showToast('Error generating PDF. Check console.', 'error');
                }
            }
        });

    async function generatePDFDocument(payload, showPreview) {
    if (showPreview && pdfGenerateState !== 'ready') return;
    const overlay = document.getElementById('loading-overlay');
    if (overlay && showPreview) overlay.classList.remove('hidden');
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    try {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const finalDoc = await PDFDocument.create();
    
    // Load Fonts
    const font = await finalDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await finalDoc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_WIDTH = 612; const PAGE_HEIGHT = 792; 

    let letterheadPdf;
    try {
        const letterheadBytes = await fetch(`Proposal_Assets/GPC_Blank_Letterhead.pdf`).then(res => res.arrayBuffer());
        letterheadPdf = await PDFDocument.load(letterheadBytes);
    } catch (e) {
        console.warn("Letterhead not found. Falling back to blank page.");
    }

    async function getBasePage() {
        if (letterheadPdf) {
            const [copiedPage] = await finalDoc.copyPages(letterheadPdf, [0]);
            finalDoc.addPage(copiedPage);
            return copiedPage;
        } else {
            return finalDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]); 
        }
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const str = String(s);
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function captureInteriorPageGPC(headerTitle, contentHtml, options) {
        options = options || {};
        const fontWeight = options.fontWeight != null ? options.fontWeight : '';
        const extraPaddingTop = options.extraPaddingTop != null ? options.extraPaddingTop : 0;
        const fontFamily = options.fontFamily != null ? options.fontFamily : '';
        const fontSize = options.fontSize != null ? options.fontSize : '';
        const wrapper = document.getElementById('gpc-interior-render-wrapper');
        wrapper.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'gpc-pdf-font';
        card.style.cssText = 'width: 8.5in; height: 11in; position: relative; box-sizing: border-box; background: url("' + GPC_INTERIOR_BG + '") no-repeat 0 0; background-size: 100% 100%;';
        const titleText = document.createElement('div');
        titleText.style.cssText = 'position: absolute; left: 72px; top: 0.5in; color: white; font-size: 32px; font-weight: bold; white-space: nowrap;';
        titleText.textContent = (headerTitle && headerTitle.trim()) ? headerTitle : '\u00A0';
        card.appendChild(titleText);
        const contentArea = document.createElement('div');
        const contentTop = 128;
        const baseFontSize = fontSize || '11pt';
        contentArea.style.cssText = 'position: absolute; left: 72px; right: 72px; top: ' + contentTop + 'px; bottom: 72px; overflow: hidden; font-size: ' + baseFontSize + '; line-height: 1.4;' + (extraPaddingTop ? ' padding-top: ' + extraPaddingTop + 'px;' : '') + (fontFamily ? ' font-family: ' + fontFamily + ';' : '');
        contentArea.innerHTML = fontWeight ? ('<div style="font-weight: ' + fontWeight + ';">' + contentHtml + '</div>') : contentHtml;
        card.appendChild(contentArea);
        wrapper.appendChild(card);
        await new Promise(r => requestAnimationFrame(r));
        const result = await snapdom(card, { scale: 2, backgroundColor: 'white' });
        const canvas = await result.toCanvas();
        return canvas;
    }

    async function paginateCustomContent(headerTitle, bodyHtml, options) {
        options = options || {};
        var temp = document.createElement('div');
        temp.innerHTML = bodyHtml;
        var paragraphs = Array.from(temp.children);
        if (paragraphs.length === 0) {
            var canvas = await captureInteriorPageGPC(headerTitle, bodyHtml, options);
            return [canvas];
        }

        var baseFontSize = (options.fontSize) || '11pt';
        var fontFamily = options.fontFamily || '';

        function measureFit(html, extraPad) {
            var wrapper = document.getElementById('gpc-interior-render-wrapper');
            wrapper.innerHTML = '';
            var card = document.createElement('div');
            card.className = 'gpc-pdf-font';
            card.style.cssText = 'width: 8.5in; height: 11in; position: relative; box-sizing: border-box;';
            var contentArea = document.createElement('div');
            contentArea.style.cssText = 'position: absolute; left: 72px; right: 72px; top: 128px; bottom: 72px; overflow: visible; font-size: ' + baseFontSize + '; line-height: 1.4;' + (extraPad ? ' padding-top: ' + extraPad + 'px;' : '') + (fontFamily ? ' font-family: ' + fontFamily + ';' : '');
            contentArea.innerHTML = html;
            card.appendChild(contentArea);
            wrapper.appendChild(card);
            return contentArea.scrollHeight <= contentArea.clientHeight;
        }

        var canvases = [];
        var remaining = paragraphs.map(function(p) { return p.outerHTML; });
        var isFirstPage = true;

        while (remaining.length > 0) {
            var extraPad = options.extraPaddingTop || 0;
            var count = 0;

            for (var i = 1; i <= remaining.length; i++) {
                var testHtml = remaining.slice(0, i).join('');
                if (!measureFit(testHtml, extraPad)) break;
                count = i;
            }
            if (count === 0) count = 1;

            var pageHtml = remaining.slice(0, count).join('');
            var pageOpts = {};
            for (var k in options) { if (options.hasOwnProperty(k)) pageOpts[k] = options[k]; }

            var pageTitle = isFirstPage ? headerTitle : '';
            var canvas = await captureInteriorPageGPC(pageTitle, pageHtml, pageOpts);
            canvases.push(canvas);

            remaining = remaining.slice(count);
            isFirstPage = false;
        }

        return canvases;
    }

    async function buildTitlePageHybrid() {
    const rfpText = (document.getElementById('global-rfp').value || '').substring(0, 33);
    const bizText = (document.getElementById('global-biz').value || '').substring(0, 33);
    const repText = (document.getElementById('global-rep').value || '').substring(0, 33);
    
    // Check for custom date, default to today if empty
    const customDate = document.getElementById('global-date').value.trim();
    const displayDate = customDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const wrapper = document.getElementById('gpc-title-render-wrapper');
        wrapper.innerHTML = '';
        const card = document.createElement('div');
        card.style.cssText = 'width: 8.5in; height: 11in; position: relative; box-sizing: border-box; background: url("' + GPC_TITLE_BG + '") no-repeat 0 0; background-size: 100% 100%;';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: absolute; right: 72px; left: calc(58% - 0.7in); bottom: calc(45px + 0.25in); color: white; font-family: Helvetica, Arial, sans-serif;';
        overlay.innerHTML = '<div style="font-size: 31px; font-weight: bold; margin-bottom: 6px;">' + escapeHtml(bizText) + '</div><div style="font-size: 22px; font-weight: bold; margin-bottom: 6px;">' + escapeHtml(rfpText) + '</div><div style="font-size: 14px; margin-bottom: 5px;">Presented by: ' + escapeHtml(repText) + '</div><div style="font-size: 12px;">' + escapeHtml(displayDate) + '</div>';
        card.appendChild(overlay);
        wrapper.appendChild(card);
        await new Promise(r => requestAnimationFrame(r));
        const result = await snapdom(card, { scale: 2, backgroundColor: 'white' });
        const canvas = await result.toCanvas();
        return canvas;
    }

// Centralized Image Stamping & Header Injection
    async function stampImagePage(base64Image, headerText) {
        const page = await getBasePage();
        
        // 1. Stamp the HTML image FIRST
        if (base64Image) {
            const pngImage = await finalDoc.embedPng(base64Image);
            const imgDims = pngImage.scaleToFit(PAGE_WIDTH - 100, PAGE_HEIGHT - 170); 
            page.drawImage(pngImage, { 
                x: 50, 
                y: PAGE_HEIGHT - imgDims.height - 150, 
                width: imgDims.width, 
                height: imgDims.height 
            });
        }

        // 2. Inject the White Header Text MOVED UP into the colored bar
        if (headerText && headerText.trim() !== '') {
            page.drawText(headerText, { 
                x: 44,      
                y: 730,
                size: 32,   // interior page header title
                font: boldFont, 
                color: rgb(1, 1, 1) // Pure White
            });
        }
    }

    async function appendUploadedPdf(fileObj) {
        const bytes = await fileObj.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const pages = await finalDoc.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => finalDoc.addPage(p));
    }

    async function buildReferencesZone() {
        const renderBody = document.getElementById('render-references-body');
        renderBody.innerHTML = '';
        const refs = Array.from(document.querySelectorAll('.ref-block')).map(b => ({
            name: b.querySelector('.ref-name').value, org: b.querySelector('.ref-org').value,
            addr: b.querySelector('.ref-addr').value, phone: b.querySelector('.ref-phone').value, email: b.querySelector('.ref-email').value
        })).filter(r => r.name || r.org);
        refs.forEach(ref => {
            renderBody.insertAdjacentHTML('beforeend', `<div class="mb-6 border-b-4 border-[#DE5A24] pb-6" style="line-height: 1.2;"><div class="text-2xl font-bold text-black" style="line-height: 1.4;">${ref.name}</div><div class="text-xl font-bold text-black" style="line-height: 1.4;">${ref.org}</div><div class="text-xl text-black mb-4" style="line-height: 1.4;">${ref.addr}</div><div class="text-xl text-black" style="line-height: 1.4;">${ref.phone} &nbsp;|&nbsp; ${ref.email}</div></div>`);
        });
        await new Promise(r => requestAnimationFrame(r));
    }

    async function addPageFromCanvas(canvas) {
        const pngImage = await finalDoc.embedPng(canvas.toDataURL('image/png'));
        const page = finalDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        page.drawImage(pngImage, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    }

    for (const slideFile of payload.slides) {
        if (slideFile === '01_Title_Page.pdf') {
            const canvas = await buildTitlePageHybrid();
            await addPageFromCanvas(canvas);
            continue;
        }
        if (slideFile === 'CUSTOM_COVER') {
            const bodyHtml = textToHtml(document.getElementById('cover-body').value);
            const canvases = await paginateCustomContent('', bodyHtml, { extraPaddingTop: 46 });
            for (const cv of canvases) { await addPageFromCanvas(cv); }
            continue;
        }
        if (slideFile === 'TOC') {
            const tocEntries = payload.slides.filter(f => f !== 'TOC' && f !== '01_Title_Page.pdf').map((filename, idx) => {
                let label;
                if (filename.startsWith('CUSTOM_TEXT:')) {
                    const i = filename.split(':')[1];
                    label = (payload.customPages && payload.customPages[i] && payload.customPages[i].title) ? payload.customPages[i].title : 'Custom Page';
                } else if (filename.startsWith('CUSTOM_PDF:')) {
                    const i = filename.split(':')[1];
                    label = (payload.customPdfs && payload.customPdfs[i] && payload.customPdfs[i].sectionName) ? payload.customPdfs[i].sectionName : 'Upload Custom PDF';
                } else {
                    const li = document.querySelector(`#module-list li[data-filename="${filename}"]`);
                    label = (li && li.getAttribute('data-toc-label')) ? li.getAttribute('data-toc-label') : (li && li.querySelector('span.flex-1')) ? (li.querySelector('span.flex-1').textContent || '').trim() : filename;
                }
                return { num: idx + 1, label: label || filename };
            });
            const tocBodyHtml = tocEntries.length ? tocEntries.map(e => '<p style="margin-bottom: 0.6rem;">' + e.num + '. ' + escapeHtml(e.label) + '</p>').join('') : '<p style="color:#64748b;">No sections in this proposal.</p>';
            const canvas = await captureInteriorPageGPC('Table of Contents', tocBodyHtml, { extraPaddingTop: 46 });
            await addPageFromCanvas(canvas);
            continue;
        }
        if (slideFile.startsWith('CUSTOM_TEXT:')) {
            const idx = slideFile.split(':')[1];
            const page = payload.customPages && payload.customPages[idx];
            const customTitle = (page && page.title) ? page.title : '';
            const bodyHtml = textToHtml((page && page.body) ? page.body : '');
            const canvases = await paginateCustomContent(customTitle, bodyHtml, { extraPaddingTop: 46 });
            for (const cv of canvases) { await addPageFromCanvas(cv); }
            continue;
        }
        else if (slideFile === 'CUSTOM_IMPACT') {
            var cur = document.getElementById('impact-current').value || '';
            var prop = document.getElementById('impact-proposed').value || '';
            var curCost = document.getElementById('impact-current-cost').value || '';
            var propCost = document.getElementById('impact-proposed-cost').value || '';
            var curNum = parseFloat(curCost);
            var propNum = parseFloat(propCost);
            var curDollar = (curCost !== '' && curCost != null && !isNaN(curNum)) ? ('$' + Math.round(curNum).toLocaleString()) : '—';
            var propDollar = (propCost !== '' && propCost != null && !isNaN(propNum)) ? ('$' + Math.round(propNum).toLocaleString()) : '—';
            var diff = (isNaN(curNum) ? 0 : curNum) - (isNaN(propNum) ? 0 : propNum);
            var impactLabel = diff >= 0 ? 'SAVINGS' : 'NET IMPACT';
            var impactAmount = '$' + Math.abs(Math.round(diff)).toLocaleString() + '/MO';
            var impactAccent = diff >= 0 ? '#15803d' : '#1d4ed8';
            var toHtmlLines = function(s) {
                return escapeHtml((s || '').trim() || '—').replace(/\n/g, '<br>');
            };
            var impactHtml =
                '<div style="margin: 0 auto; width: 640px;">' +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">' +
                        '<div style="border:1px solid #d1d5db;border-radius:12px;background:#f8fafc;padding:18px;">' +
                            '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px;">Current State</div>' +
                            '<div style="font-size:13px;line-height:1.6;color:#0f172a;font-weight:500;">' + toHtmlLines(cur) + '</div>' +
                        '</div>' +
                        '<div style="border:1px solid #d1d5db;border-left:4px solid #DE5A24;border-radius:12px;background:#f8fafc;padding:18px;">' +
                            '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:12px;">Proposed Solution</div>' +
                            '<div style="font-size:13px;line-height:1.6;color:#0f172a;font-weight:500;">' + toHtmlLines(prop) + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="display:grid;grid-template-columns:1fr auto 1fr auto;align-items:center;gap:20px;background:#12243D;color:#fff;border-radius:12px;padding:18px 20px;border:1px solid #334155;">' +
                        '<div style="text-align:center;"><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;">Current Spend</div><div style="font-size:20px;font-weight:700;">' + escapeHtml(curDollar) + '</div></div>' +
                        '<div style="font-size:20px;opacity:.55;">→</div>' +
                        '<div style="text-align:center;"><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;">Proposed GPC Spend</div><div style="font-size:20px;font-weight:700;">' + escapeHtml(propDollar) + '</div></div>' +
                        '<div style="text-align:center;background:#fff;color:' + impactAccent + ';padding:10px 16px;border-radius:10px;border:2px solid ' + impactAccent + ';min-width: 180px;">' +
                            '<div style="font-size:10px;font-weight:800;letter-spacing:.08em;margin-bottom:3px;text-transform:uppercase;">' + escapeHtml(impactLabel) + '</div>' +
                            '<div style="font-size:20px;font-weight:800;line-height:1.1;white-space:nowrap;">' + escapeHtml(impactAmount) + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            const canvas = await captureInteriorPageGPC('Impact & ROI', impactHtml, { extraPaddingTop: 37 });
            await addPageFromCanvas(canvas);
        }
        else if (slideFile === 'CUSTOM_REFERENCES') {
            const refs = Array.from(document.querySelectorAll('.ref-block')).map(b => ({
                name: b.querySelector('.ref-name').value, org: b.querySelector('.ref-org').value,
                addr: b.querySelector('.ref-addr').value, phone: b.querySelector('.ref-phone').value, email: b.querySelector('.ref-email').value
            })).filter(r => r.name || r.org);
            let refsHtml = '';
            refs.forEach(ref => {
                refsHtml += '<div style="margin-bottom: 1.75rem; padding-bottom: 1.25rem; border-bottom: 1px solid #DE5A24;"><div style="font-size: 1.5rem; font-weight: bold; color: #0f172a;">' + escapeHtml(ref.name) + '</div><div style="font-size: 1.3rem; font-weight: bold; color: #1e293b;">' + escapeHtml(ref.org) + '</div><div style="font-size: 1.1rem; color: #334155; margin-bottom: 0.75rem;">' + escapeHtml(ref.addr) + '</div><div style="font-size: 1.1rem; color: #334155;">' + escapeHtml(ref.phone) + ' &nbsp;|&nbsp; ' + escapeHtml(ref.email) + '</div></div>';
            });
            const refsWrapped = '<div style="max-width: ' + REFERENCES_CONTENT_MAX_WIDTH_PX + 'px; margin: 0 auto;">' + (refsHtml || '<p style="color:#64748b;">No references added.</p>') + '</div>';
            const canvas = await captureInteriorPageGPC('References', refsWrapped, { extraPaddingTop: 52 });
            await addPageFromCanvas(canvas);
        }
        else if (slideFile === 'CUSTOM_PRICING') {
            const optionBlocks = Array.from(document.querySelectorAll('.pricing-option-block'));
            const borderClr = '#d1d5db';
            const useAmyDecimalsPdf = pricingUsesDecimalPoints();
            const locHeaderOrange = '<div style="display: flex; background-color: #DE5A24; color: white; font-weight: bold; text-transform: uppercase; border: 1px solid ' + borderClr + '; border-bottom: none;"><div style="width: 380px; padding: 12px 16px; border-right: 1px solid ' + borderClr + ';">PRODUCT</div><div style="width: 140px; padding: 12px 5px; text-align: center; border-right: 1px solid ' + borderClr + ';">LIST PRICE</div><div style="width: 90px; padding: 12px 5px; text-align: center; border-right: 1px solid ' + borderClr + ';">QTY</div><div style="width: 140px; padding: 12px 16px; text-align: center;">TOTAL</div></div>';
            
            const rowToHtml = (item, bg) => {
                var priceVal = formatLineListPriceDisplay(item.price);
                var qtyNum = parseInt(item.qty, 10) || 0;
                var totalVal = formatLineTotalDisplay(item.price, qtyNum);

                var nrcHtml = '';
                if (item.nrcEnabled) {
                    var nrcAmountVal = parseFloat(item.nrcAmount);
                    var nrcAmountText = '';
                    if (!isNaN(nrcAmountVal)) {
                        nrcAmountText = formatPricingMoney(Math.abs(nrcAmountVal), useAmyDecimalsPdf);
                    }
                    var nrcDesc = (item.nrcDescription || '').trim();
                    var nrcLabel = nrcDesc ? ('NRC: ' + escapeHtml(nrcDesc)) : 'NRC';
                    nrcHtml = '<div style="font-size: 11px; color: #475569; margin-top: 6px;">' + nrcLabel + (nrcAmountText ? (' <strong style="font-size: 11px; color: #334155; margin-left: 8px;">' + escapeHtml(nrcAmountText) + '</strong>') : '') + '</div>';
                }

                return '<div style="display: flex; background-color: ' + bg + '; border: 1px solid ' + borderClr + '; border-top: none;"><div style="width: 380px; padding: 12px 16px; border-right: 1px solid ' + borderClr + ';">' + formatProdTextForPdf(item.prod) + nrcHtml + '</div><div style="width: 140px; padding: 12px 5px; border-right: 1px solid ' + borderClr + '; text-align: center;">' + escapeHtml(priceVal) + '</div><div style="width: 90px; padding: 12px 5px; border-right: 1px solid ' + borderClr + '; text-align: center;">' + escapeHtml(item.qty) + '</div><div style="width: 140px; padding: 12px 16px; text-align: center;">' + escapeHtml(totalVal) + '</div></div>';
            };

            var enableLocSubtotalsPdf = !!(document.getElementById('pricing-enable-location-subtotals') && document.getElementById('pricing-enable-location-subtotals').checked);

            for (let optIdx = 0; optIdx < optionBlocks.length; optIdx++) {
                const optBlock = optionBlocks[optIdx];
                var termElPdf = optBlock.querySelector('.contract-term') || optBlock.querySelector('.option-term-input');
                const contractTerm = (termElPdf && termElPdf.value) || 'XX';
                const locationBlocks = Array.from(optBlock.querySelectorAll('.location-block'));
                
                let allRows = [];
                locationBlocks.forEach((block) => {
                    const locName = (block.querySelector('.loc-name-input') && block.querySelector('.loc-name-input').value) || 'Location';
                    const rows = Array.from(block.querySelectorAll('.line-items-body tr.pricing-row')).map(tr => {
                        const sub = getPricingLineSubrows(tr);
                        const nrcRow = sub.nrcRow;
                        const nrcToggle = tr.querySelector('.row-nrc-toggle');
                        const nrcDescription = nrcRow && nrcRow.querySelector('.row-nrc-description') ? nrcRow.querySelector('.row-nrc-description').value : '';
                        const nrcAmount = nrcRow && nrcRow.querySelector('.row-nrc-amount') ? nrcRow.querySelector('.row-nrc-amount').value : '';
                        return {
                            prod: tr.querySelector('.prod-name') ? tr.querySelector('.prod-name').value : '',
                            price: tr.querySelector('.price-input') ? tr.querySelector('.price-input').value : '',
                            qty: tr.querySelector('.qty-input') ? tr.querySelector('.qty-input').value : '1',
                            total: tr.querySelector('.row-total') ? tr.querySelector('.row-total').textContent : '$0.00',
                            nrcEnabled: !!(nrcToggle && nrcToggle.checked),
                            nrcDescription,
                            nrcAmount
                        };
                    });
                    const promotions = readLocationPromotions(block);
                    if (locationBlocks.length > 1) {
                        allRows.push({ type: 'loc', name: locName });
                    }
                    rows.forEach((item, idx) => { allRows.push({ type: 'row', item, bg: (idx % 2 === 0) ? '#E8E8E8' : '#f5f5f5' }); });
                    promotions.forEach((promo) => { allRows.push({ type: 'promo', promo }); });
                    if (enableLocSubtotalsPdf && rows.length) {
                        var monthlySum = rows.reduce(function(acc, it) {
                            var p = parseFloat(it.price) || 0;
                            var q = parseInt(it.qty, 10) || 0;
                            var lineRaw = computeLineTotalRaw(p, q);
                            return acc + (useAmyDecimalsPdf ? lineRaw : Math.ceil(lineRaw));
                        }, 0);
                        var subFormatted = formatPricingMoney(monthlySum, useAmyDecimalsPdf);
                        var subHtml = '<div style="display:flex;background:#f8fafc;color:#0f172a;border:1px solid ' + borderClr + ';border-top:none;font-weight:700;font-size:12px;"><div style="width:380px;padding:10px 16px;border-right:1px solid ' + borderClr + ';">LOCATION SUBTOTAL</div><div style="width:140px;padding:10px 5px;border-right:1px solid ' + borderClr + ';"></div><div style="width:90px;padding:10px 5px;border-right:1px solid ' + borderClr + ';"></div><div style="width:140px;padding:10px 16px;text-align:center;">' + escapeHtml(subFormatted) + '</div></div>';
                        allRows.push({ type: 'subtotal', html: subHtml });
                    }
                });

                var optTotalPdf = 0;
                locationBlocks.forEach(function(block) {
                    Array.from(block.querySelectorAll('.line-items-body tr.pricing-row')).forEach(function(tr) {
                        var p = parseFloat(tr.querySelector('.price-input') ? tr.querySelector('.price-input').value : '') || 0;
                        var q = parseInt(tr.querySelector('.qty-input') ? tr.querySelector('.qty-input').value : '1', 10) || 0;
                        var lineRaw = computeLineTotalRaw(p, q);
                        optTotalPdf += useAmyDecimalsPdf ? lineRaw : Math.ceil(lineRaw);
                    });
                });
                var grandTotalFormatted = formatPricingMoney(optTotalPdf, useAmyDecimalsPdf);
                const totalBlockHtml = '<div style="margin-top: 20px;">' + '<div style="display: flex; background-color: #12243D; color: white; font-weight: bold; font-size: 1.1rem; border: 1px solid ' + borderClr + '; border-radius: 0; box-sizing: border-box;"><div style="width: 610px; padding: 16px;">TOTAL MONTHLY COST</div><div style="width: 140px; padding: 16px; text-align: center;">' + escapeHtml(grandTotalFormatted) + '</div></div>' + '</div>';
                const termLineHtml = buildPricingTermLineHtml(contractTerm);

                let baseHeader = optionBlocks.length > 1 ? `Proposed Pricing Option ${optIdx + 1}` : 'Proposed Pricing';
                var solutionIdPdfEl = optBlock.querySelector('.solution-id-input');
                var solutionIdTrim = solutionIdPdfEl && solutionIdPdfEl.value ? String(solutionIdPdfEl.value).trim() : '';
                if (solutionIdTrim) baseHeader += ' (' + solutionIdTrim + ')';

                if (allRows.length === 0) {
                    const html = totalBlockHtml + termLineHtml;
                    const canvas = await captureInteriorPageGPC(baseHeader, html, { extraPaddingTop: 46 });
                    await addPageFromCanvas(canvas);
                } else {
                    const buildPricingBody = function(rows, includeTotals, totalBlockHtml, termLineHtml) {
                        let body = '';
                        let firstInChunk = true;
                        for (const item of rows) {
                            if (item.type === 'loc') {
                                if (!firstInChunk) body += '</div>';
                                body += '<div style="margin-top: ' + (firstInChunk ? 0 : 16) + 'px; width: 100%; max-width: 750px; box-sizing: border-box; border: 1px solid ' + borderClr + ';">';
                                if (firstInChunk) { body += locHeaderOrange; firstInChunk = false; }
                                body += item.html;
                            } else {
                                if (firstInChunk) {
                                    body += '<div style="margin-top: 0; width: 100%; max-width: 750px; box-sizing: border-box; border: 1px solid ' + borderClr + ';">' + locHeaderOrange;
                                    firstInChunk = false;
                                }
                                body += item.html;
                            }
                        }
                        if (!firstInChunk) body += '</div>';
                        if (includeTotals) body += totalBlockHtml + termLineHtml;
                        return body;
                    };

                    const measurePricingBody = function(bodyHtml) {
                        const wrapper = document.getElementById('gpc-interior-render-wrapper');
                        wrapper.innerHTML = '';
                        const card = document.createElement('div');
                        card.className = 'gpc-pdf-font';
                        card.style.cssText = 'width: 8.5in; height: 11in; position: relative; box-sizing: border-box; background: url("' + GPC_INTERIOR_BG + '") no-repeat 0 0; background-size: 100% 100%;';
                        const contentArea = document.createElement('div');
                        contentArea.style.cssText = 'position: absolute; left: 72px; right: 72px; top: 128px; bottom: 72px; overflow: visible; font-size: 11pt; line-height: 1.4; padding-top: 46px;';
                        contentArea.innerHTML = bodyHtml;
                        card.appendChild(contentArea);
                        wrapper.appendChild(card);
                        return {
                            scrollHeight: contentArea.scrollHeight,
                            clientHeight: contentArea.clientHeight
                        };
                    };

                    const bodyFits = function(rows, includeTotals, totalBlockHtml, termLineHtml) {
                        const bodyHtml = buildPricingBody(rows, includeTotals, totalBlockHtml, termLineHtml);
                        const m = measurePricingBody(bodyHtml);
                        return m.scrollHeight <= m.clientHeight;
                    };

                    const rowObjs = [];
                    for (let r = 0; r < allRows.length; r++) {
                        let rowObj;
                        if (allRows[r].type === 'loc') {
                            rowObj = { type: 'loc', html: '<div style="display: flex; background-color: #A6A6A6; color: white; font-weight: bold; padding: 8px 16px; border: 1px solid ' + borderClr + '; border-top: none;">' + escapeHtml(allRows[r].name) + '</div>' };
                        } else if (allRows[r].type === 'promo') {
                            var promoAmountVal2 = parseFloat(allRows[r].promo.amount);
                            var promoAmountText2 = (!isNaN(promoAmountVal2) && promoAmountVal2 !== 0)
                                ? '$' + promoAmountVal2.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : '';
                            var promoDesc2 = (allRows[r].promo.description || '').trim();
                            var promoHtml2 = '<div style="display:flex;background:#eef2ff;color:#1e293b;border:1px solid ' + borderClr + ';border-top:none;font-size:12px;">' +
                                '<div style="width:380px;padding:10px 16px;border-right:1px solid ' + borderClr + ';"><strong style="text-transform:uppercase;letter-spacing:.04em;font-size:10px;margin-right:8px;">Promotion</strong>' + escapeHtml((promoDesc2 || '').length ? promoDesc2 : 'Applied') + '</div>' +
                                '<div style="width:140px;padding:10px 5px;border-right:1px solid ' + borderClr + ';"></div>' +
                                '<div style="width:90px;padding:10px 5px;border-right:1px solid ' + borderClr + ';"></div>' +
                                '<div style="width:140px;padding:10px 16px;text-align:center;font-weight:700;">' + escapeHtml(promoAmountText2 || '') + '</div>' +
                                '</div>';
                            rowObj = { type: 'promo', html: promoHtml2 };
                        } else if (allRows[r].type === 'subtotal') {
                            rowObj = { type: 'row', html: allRows[r].html };
                        } else {
                            rowObj = { type: 'row', html: rowToHtml(allRows[r].item, allRows[r].bg) };
                        }
                        rowObjs.push(rowObj);
                    }

                    const locationUnits = [];
                    let unitBuf = [];
                    for (let u = 0; u < rowObjs.length; u++) {
                        const o = rowObjs[u];
                        if (o.type === 'loc' && unitBuf.length) {
                            locationUnits.push(unitBuf);
                            unitBuf = [];
                        }
                        unitBuf.push(o);
                    }
                    if (unitBuf.length) locationUnits.push(unitBuf);

                    function splitOversizedLocationUnit(unit) {
                        const parts = [];
                        let i = 0;
                        while (i < unit.length) {
                            const sub = [];
                            if (i < unit.length && unit[i].type === 'loc') {
                                sub.push(unit[i]);
                                i++;
                            }
                            while (i < unit.length && unit[i].type !== 'loc') {
                                const o = unit[i];
                                if (bodyFits(sub.concat([o]), false, totalBlockHtml, termLineHtml)) {
                                    sub.push(o);
                                    i++;
                                } else {
                                    if (sub.length === 1 && sub[0].type === 'loc') {
                                        sub.push(o);
                                        i++;
                                    }
                                    break;
                                }
                            }
                            if (!sub.length && i < unit.length) {
                                sub.push(unit[i]);
                                i++;
                            }
                            parts.push(sub);
                        }
                        return parts;
                    }

                    const chunks = [];
                    let current = [];
                    for (let ui = 0; ui < locationUnits.length; ui++) {
                        const unit = locationUnits[ui];
                        if (bodyFits(current.concat(unit), false, totalBlockHtml, termLineHtml)) {
                            current = current.concat(unit);
                            continue;
                        }
                        if (current.length) {
                            chunks.push(current);
                            current = [];
                        }
                        if (bodyFits(unit, false, totalBlockHtml, termLineHtml)) {
                            current = unit.slice();
                            continue;
                        }
                        const subparts = splitOversizedLocationUnit(unit);
                        for (let si = 0; si < subparts.length; si++) {
                            const sp = subparts[si];
                            if (current.length && !bodyFits(current.concat(sp), false, totalBlockHtml, termLineHtml)) {
                                chunks.push(current);
                                current = [];
                            }
                            current = current.concat(sp);
                        }
                    }
                    if (current.length) chunks.push(current);

                    while (chunks.length && !bodyFits(chunks[chunks.length - 1], true, totalBlockHtml, termLineHtml)) {
                        const lastChunk = chunks[chunks.length - 1];
                        if (lastChunk.length <= 1) break;
                        const spill = [];
                        while (lastChunk.length > 1 && !bodyFits(lastChunk, true, totalBlockHtml, termLineHtml)) {
                            spill.unshift(lastChunk.pop());
                        }
                        if (lastChunk.length === 1 && lastChunk[0].type === 'loc' && spill.length) {
                            lastChunk.push(spill.shift());
                        }
                        if (spill.length) chunks.push(spill);
                        else break;
                    }

                    for (let p = 0; p < chunks.length; p++) {
                        const isLast = (p === chunks.length - 1);
                        const body = buildPricingBody(chunks[p], isLast, totalBlockHtml, termLineHtml);
                        const headerTitle = p === 0 ? baseHeader : `${baseHeader} (Cont.)`;
                        const canvas = await captureInteriorPageGPC(headerTitle, body, { extraPaddingTop: 46 });
                        await addPageFromCanvas(canvas);
                    }
                }
            }
        }
        else if (slideFile.startsWith('CUSTOM_PDF:')) {
            const idx = slideFile.split(':')[1];
            const pdfEntry = payload.customPdfs && payload.customPdfs[idx];
            if (pdfEntry && pdfEntry.file) await appendUploadedPdf(pdfEntry.file);
            continue;
        }
        else if (slideFile === 'USAC_RFP') { await appendUploadedPdf(payload.usacFile); }
        else {
            try {
                const existingPdfBytes = await fetch(`Proposal_Assets/${slideFile}`).then(res => res.arrayBuffer());
                const existingPdf = await PDFDocument.load(existingPdfBytes);
                const [page] = await finalDoc.copyPages(existingPdf, [0]);

// --- DATA INJECTION FOR PROJECT PLAN ---
if (slideFile === '09_Project.pdf') {
    // Pull the text from the new sidebar inputs
    const startDate = document.getElementById('global-start').value || "";
    const endDate = document.getElementById('global-end').value || "";

    const fontSize = 12; // Tweak this if it needs to match the stock font size better

    // 1. Your exact center X and baseline Y coordinates
    const startCenterX = 207;
    const endCenterX = 406;   
    const yCoord = 537;       

    // 2. Measure the text width dynamically
    const startWidth = boldFont.widthOfTextAtSize(startDate, fontSize);
    const endWidth = boldFont.widthOfTextAtSize(endDate, fontSize);

    // 3. Calculate the true starting X coordinate (Center minus half the width)
    const actualStartX = startCenterX - (startWidth / 2);
    const actualEndX = endCenterX - (endWidth / 2);

    // 4. Draw the text perfectly centered
    page.drawText(startDate, { 
        x: actualStartX, 
        y: yCoord, 
        size: fontSize, 
        font: boldFont, 
        color: rgb(0.1, 0.1, 0.1) // Dark grey/near black
    });

    page.drawText(endDate, { 
        x: actualEndX, 
        y: yCoord, 
        size: fontSize, 
        font: boldFont, 
        color: rgb(0.1, 0.1, 0.1) 
    });
}
                finalDoc.addPage(page);
            } catch (e) { console.warn(`Could not load ${slideFile}`); }
        }
    }

    const pdfBytes = await finalDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    if (showPreview) {
        document.getElementById('pdf-preview-title').innerText = 'Generated Proposal Preview';
        document.getElementById('pdf-preview-iframe').src = url + '#toolbar=0&navpanes=0&view=FitH';
        document.getElementById('pdf-preview-modal').classList.remove('hidden');
        const downloadBtn = document.getElementById('modal-download-btn');
        if (downloadBtn) {
            downloadBtn.classList.remove('hidden');
            downloadBtn.onclick = () => {
                const defaultPdf = `${(payload.globals.biz || 'GPC').replace(/\s+/g, '_')}_Proposal`;
                const pdfFileName = promptPdfFileName(defaultPdf);
                if (!pdfFileName) return;
                const a = document.createElement('a');
                a.href = url;
                a.download = pdfFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
        }
        setGenerateButtonState('initial');
    } else {
        URL.revokeObjectURL(url);
        setGenerateButtonState('ready');
    }
    } catch (err) {
        throw err;
    } finally {
        document.documentElement.style.overflow = prevHtmlOverflow || '';
        document.body.style.overflow = prevBodyOverflow || '';
        if (overlay) overlay.classList.add('hidden');
    }
}
