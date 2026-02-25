        const renderZones = document.getElementById('render-zones');
        const ASSETS_BASE = new URL('Proposal_Assets/', window.location.href).href;
        const GPC_TITLE_BG = ASSETS_BASE + '01_Title_Page.svg';
        const GPC_INTERIOR_BG = ASSETS_BASE + 'GPC_Blank_Letterhead.svg';
        const REFERENCES_CONTENT_MAX_WIDTH_PX = 450;

        function showToast(message, type) {
            type = type === 'error' ? 'error' : 'success';
            var container = document.getElementById('toast-container');
            if (!container) return;
            var el = document.createElement('div');
            el.className = 'toast px-4 py-3 text-sm font-medium shadow-lg ' + (type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white');
            el.textContent = message;
            container.appendChild(el);
            setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
        }

        var isDirty = false, _suppressDirty = false;
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
            if (isDirty) { e.preventDefault(); e.returnValue = ''; }
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
        function textToHtml(s) {
            if (s == null || String(s).trim() === '') return '';
            var escaped = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            var pars = escaped.split(/\n\n+/);
            return pars.map(function(p) { return '<p style="margin: 0 0 0.75em 0;">' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
        }
        function checkCustomTextHeight() {
            var ta = document.getElementById('custom-text-body');
            var warn = document.getElementById('warning-customText');
            if (!ta || !warn) return;
            if (ta.scrollHeight > 600) warn.classList.remove('hidden'); else warn.classList.add('hidden');
        }
        document.getElementById('custom-text-body').addEventListener('input', checkCustomTextHeight);

        const GPC_COVER_SNIPPETS = [
            { label: 'Exceptional customer service', text: 'What sets our company apart is our exceptional customer service. From the first customer contact through design, turn-up, testing and maintenance, you will work with a local team that\'s committed to developing custom solutions to help you achieve your business goals.' },
            { label: 'Scalable fiber-driven technology', text: 'From small storefronts to large enterprises, our fully scalable, fiber-driven technology services will accelerate the success of your business.' },
            { label: 'Why Us: local team & custom solutions', text: 'Exceptional customer service experience. Nebraska- & Indiana-based teams. Custom solutions. High-performing network, high-performing people. 24/7 tech support.' },
            { label: '24/7 Network Operations Center', text: 'We take great pride in our high-performing fiber network. We monitor around the clock to ensure uptime for our customers. Local network monitoring in Blair, Nebraska. Highly skilled technicians. Rapid response to outages and alarms.' },
            { label: 'High-performing network, Midwest', text: 'We take pride in being one of the largest privately owned internet service providers for businesses in the Midwest. We build our networks with redundancy and scalability to meet the needs of your business today, while also being able to grow with your business.' },
            { label: 'Network differentiators', text: '99% buried fiber. Unique routes. MEF-certified. Reliability — 99.99% availability on the core. 20,000+ mile fiber-optic network. Secure fiber-ringed network designed with redundancy, scalability and flexibility. Local presence — technicians strategically located across Nebraska and Southeast Indiana.' },
            { label: 'Business Internet', text: 'Reliable, high-performance dedicated business internet from 10 Mbps to 400 Gbps.' },
            { label: 'Managed Ethernet', text: 'Scalable, secure transport across multiple locations, delivering cost savings and efficiency.' }
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
            var ta = document.getElementById('custom-text-body');
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

        // --- UI Visibility Toggles based on Slide Selection ---
        function toggleSection(checkboxId, sectionId) {
            document.getElementById(checkboxId).addEventListener('change', function(e) {
                document.getElementById(sectionId).style.display = e.target.checked ? 'block' : 'none';
            });
        }
        toggleSection('toggle-cover-letter', 'cover-letter-section');
        toggleSection('toggle-custom-text', 'custom-text-section');
        toggleSection('toggle-impact-roi', 'impact-roi-section');
        toggleSection('toggle-custom-pdf', 'custom-pdf-section');
        toggleSection('toggle-references', 'references-section');
        toggleSection('toggle-pricing', 'pricing-section');
        toggleSection('toggle-usac', 'usac-upload-section');

        new Sortable(document.getElementById('module-list'), { animation: 150, handle: '.handle', ghostClass: 'bg-slate-100', onEnd: function() { if (!_suppressDirty) setDirty(true); } });

        // --- File Upload Handlers ---
        document.getElementById('usac-upload').addEventListener('change', e => {
            document.getElementById('usac-filename').textContent = e.target.files[0] ? e.target.files[0].name : "Drag and drop USAC RFP PDF here";
        });
        document.getElementById('custom-pdf-upload').addEventListener('change', e => {
            document.getElementById('custom-pdf-filename').textContent = e.target.files[0] ? e.target.files[0].name : "Drag and drop Custom PDF here";
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

        // --- Dynamic Pricing UI ---
        const locationsContainer = document.getElementById('locations-container');
        let locationCount = 0;
        addLocationBlock();
        document.getElementById('add-location-btn').addEventListener('click', () => addLocationBlock());

        function addLocationBlock(locName = '', items = null) {
            locationCount++;
            const locId = `location-${locationCount}`;
            const html = `
                <div class="location-block border border-slate-200 rounded-lg p-5 bg-white relative" id="${locId}">
                    <button class="absolute top-3 right-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full w-8 h-8 font-bold text-sm remove-location-btn">X</button>
                    <div class="mb-5 pr-10"><input type="text" class="w-full border-b-2 border-slate-200 p-2 text-lg font-bold text-slate-800 outline-none focus:border-orange-500 loc-name-input" placeholder="Location Name or Address (e.g., 123 Main St)" value="${(locName || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></div>
                    <table class="w-full text-left border-collapse mb-4 min-w-[600px]">
                        <thead><tr class="bg-slate-100 text-slate-600 text-xs uppercase"><th class="p-3">PRODUCT</th><th class="p-3 w-32">LIST PRICE</th><th class="p-3 w-24">QTY</th><th class="p-3 w-32 text-right">TOTAL</th><th class="p-3 w-12"></th></tr></thead>
                        <tbody class="line-items-body"></tbody>
                    </table>
                    <div class="flex justify-between items-center mt-2 border-t border-slate-100 pt-4">
                        <button class="text-orange-500 text-sm font-semibold hover:text-orange-600 add-row-btn">+ Add Product Line</button>
                        <div class="font-bold text-slate-600 text-sm tracking-wide">Location Total: <span class="location-total text-slate-900 ml-2 text-lg">$0.00</span></div>
                    </div>
                </div>`;
            locationsContainer.insertAdjacentHTML('beforeend', html);
            const block = document.getElementById(locId);
            if (items && items.length > 0) {
                items.forEach(item => addRow(block, item));
            } else {
                addRow(block);
            }
            block.querySelector('.add-row-btn').addEventListener('click', () => addRow(block));
            block.querySelector('.remove-location-btn').addEventListener('click', () => {
                if (locationsContainer.children.length > 1) { block.remove(); calculateGrandTotal(); }
            });
        }

        function addRow(block, data) {
            const tbody = block.querySelector('.line-items-body');
            const prod = (data && data.prod != null) ? String(data.prod).replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '';
            const price = (data && data.price != null) ? String(data.price) : '';
            const qty = (data && data.qty != null) ? String(data.qty) : '1';
            const html = `
                <tr class="border-b border-slate-100 group">
                    <td class="p-2"><input type="text" class="w-full border border-slate-200 p-2 rounded text-sm outline-none focus:border-orange-500 prod-name" value="${prod}"></td>
                    <td class="p-2"><input type="number" class="w-full border border-slate-200 p-2 rounded text-sm outline-none focus:border-orange-500 price-input" step="0.01" value="${price}"></td>
                    <td class="p-2"><input type="number" class="w-full border border-slate-200 p-2 rounded text-sm text-center outline-none focus:border-orange-500 qty-input" min="1" value="${qty}"></td>
                    <td class="p-2 text-right font-semibold text-slate-700 row-total">$0.00</td>
                    <td class="p-2 text-center"><button class="text-slate-300 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 remove-row-btn">X</button></td>
                </tr>`;
            tbody.insertAdjacentHTML('beforeend', html);
            const row = tbody.lastElementChild;
            row.querySelector('.price-input').addEventListener('input', () => updateMath(row, block));
            row.querySelector('.qty-input').addEventListener('input', () => updateMath(row, block));
            row.querySelector('.remove-row-btn').addEventListener('click', () => { if (tbody.children.length > 1) { row.remove(); updateMath(null, block); } });
            updateMath(row, block);
        }

        function updateMath(row, block) {
            if(row) {
                const price = parseFloat(row.querySelector('.price-input').value) || 0;
                const qty = parseInt(row.querySelector('.qty-input').value) || 0;
                row.querySelector('.row-total').textContent = `$${(price * qty).toFixed(2)}`;
            }
            let locTotal = 0;
            block.querySelectorAll('.line-items-body tr').forEach(r => {
                const p = parseFloat(r.querySelector('.price-input').value) || 0;
                const q = parseInt(r.querySelector('.qty-input').value) || 0;
                locTotal += (p * q);
            });
            block.querySelector('.location-total').textContent = `$${locTotal.toFixed(2)}`;
            calculateGrandTotal();
        }

        function calculateGrandTotal() {
            let gt = 0;
            document.querySelectorAll('.location-total').forEach(l => gt += parseFloat(l.textContent.replace('$', '')) || 0);
            document.getElementById('grand-total').textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(gt);
        }

        function updateImpactNet() {
            var cur = parseFloat(document.getElementById('impact-current-cost').value) || 0;
            var prop = parseFloat(document.getElementById('impact-proposed-cost').value) || 0;
            var net = prop - cur;
            var el = document.getElementById('impact-net');
            if (el) el.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(net);
        }
        if (document.getElementById('impact-current-cost')) document.getElementById('impact-current-cost').addEventListener('input', updateImpactNet);
        if (document.getElementById('impact-proposed-cost')) document.getElementById('impact-proposed-cost').addEventListener('input', updateImpactNet);

        document.getElementById('contract-term').addEventListener('input', () => {});

        // --- Save / Load Project ---
        function saveProject() {
            const projectData = {
                globalRfp: document.getElementById('global-rfp').value,
                globalBiz: document.getElementById('global-biz').value,
                globalRep: document.getElementById('global-rep').value,
                globalStart: document.getElementById('global-start').value,
                globalEnd: document.getElementById('global-end').value,
                coverTitle: document.getElementById('cover-title-input').value,
                coverText: document.getElementById('cover-body').value,
                customTextTitle: document.getElementById('custom-text-title-input').value,
                customText: document.getElementById('custom-text-body').value,
                contractTerm: document.getElementById('contract-term').value,
                references: Array.from(document.querySelectorAll('.ref-block')).map(b => ({
                    name: b.querySelector('.ref-name').value,
                    org: b.querySelector('.ref-org').value,
                    addr: b.querySelector('.ref-addr').value,
                    phone: b.querySelector('.ref-phone').value,
                    email: b.querySelector('.ref-email').value
                })),
                locations: Array.from(document.querySelectorAll('#locations-container > div')).map(block => ({
                    name: block.querySelector('.loc-name-input').value,
                    items: Array.from(block.querySelectorAll('.line-items-body tr')).map(tr => ({
                        prod: tr.querySelector('.prod-name').value,
                        price: tr.querySelector('.price-input').value,
                        qty: tr.querySelector('.qty-input').value
                    }))
                })),
                discoveryScratchpad: document.getElementById('discovery-scratchpad').value,
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
            setDirty(false);
            document.querySelectorAll('#module-list li').forEach(li => {
                const cb = li.querySelector('input.slide-toggle');
                projectData.modules.push({
                    filename: li.getAttribute('data-filename'),
                    checked: cb ? cb.checked : false
                });
            });
            const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (projectData.globalBiz || 'GPC_Proposal').replace(/\s+/g, '_') + '.spec';
            a.click();
            URL.revokeObjectURL(a.href);
        }

        function normalizeLegacyQuillText(s) {
            if (s == null || typeof s !== 'string') return '';
            var t = s.trim();
            if (t === '' || t === '<p><br></p>' || t === '<p></p>' || /^<p>\s*<\/p>$/i.test(t)) return '';
            if (/<[a-z][\s\S]*>/i.test(t)) return t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
            return t;
        }

        function loadProject(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            _suppressDirty = true;
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.globalRfp != null) document.getElementById('global-rfp').value = data.globalRfp;
                    if (data.globalBiz != null) document.getElementById('global-biz').value = data.globalBiz;
                    if (data.globalRep != null) document.getElementById('global-rep').value = data.globalRep;
                    if (data.globalStart != null) document.getElementById('global-start').value = data.globalStart;
                    if (data.globalEnd != null) document.getElementById('global-end').value = data.globalEnd;
                    if (data.coverTitle != null) document.getElementById('cover-title-input').value = data.coverTitle;
                    if (data.coverText != null) document.getElementById('cover-body').value = normalizeLegacyQuillText(data.coverText);
                    if (data.customTextTitle != null) document.getElementById('custom-text-title-input').value = data.customTextTitle;
                    if (data.customText != null) document.getElementById('custom-text-body').value = normalizeLegacyQuillText(data.customText);
                    if (data.contractTerm != null) document.getElementById('contract-term').value = data.contractTerm;
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
                    if (data.locations) {
                        locationsContainer.innerHTML = '';
                        locationCount = 0;
                        if (data.locations.length) {
                            data.locations.forEach(loc => addLocationBlock(loc.name || '', loc.items || []));
                        } else {
                            addLocationBlock();
                        }
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
                        data.modules.forEach(m => {
                            const li = document.querySelector(`#module-list li[data-filename="${m.filename}"]`);
                            if (li) {
                                const cb = li.querySelector('input.slide-toggle');
                                if (cb) cb.checked = !!m.checked;
                            }
                        });
                        document.getElementById('toggle-cover-letter').dispatchEvent(new Event('change'));
                        document.getElementById('toggle-custom-text').dispatchEvent(new Event('change'));
                        if (document.getElementById('toggle-impact-roi')) document.getElementById('toggle-impact-roi').dispatchEvent(new Event('change'));
                        document.getElementById('toggle-references').dispatchEvent(new Event('change'));
                        document.getElementById('toggle-pricing').dispatchEvent(new Event('change'));
                        document.getElementById('toggle-custom-pdf').dispatchEvent(new Event('change'));
                        document.getElementById('toggle-usac').dispatchEvent(new Event('change'));
                    }
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

        document.getElementById('save-project-btn').addEventListener('click', saveProject);
        document.getElementById('load-project-input').addEventListener('change', loadProject);

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

        function getPayload() {
            const activeSlides = [];
            document.querySelectorAll('#module-list li').forEach(li => {
                if (li.querySelector('.slide-toggle').checked) activeSlides.push(li.getAttribute('data-filename'));
            });
            const customPdfFile = document.getElementById('custom-pdf-upload').files[0];
            if (activeSlides.includes('CUSTOM_PDF') && !customPdfFile) { alert("Please select a file for the Custom PDF Upload."); return null; }
            const usacFile = document.getElementById('usac-upload').files[0];
            if (activeSlides.includes('USAC_RFP') && !usacFile) { alert("Please select a file for the USAC RFP Upload."); return null; }
            return {
                globals: { biz: document.getElementById('global-biz').value },
                slides: activeSlides,
                customPdfFile: customPdfFile,
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
        titleText.style.cssText = 'position: absolute; left: 72px; top: 0.5in; color: white; font-size: 32px; font-weight: bold;';
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

    async function buildTitlePageHybrid() {
        const rfpText = (document.getElementById('global-rfp').value || '').substring(0, 33);
        const bizText = (document.getElementById('global-biz').value || '').substring(0, 33);
        const repText = (document.getElementById('global-rep').value || '').substring(0, 33);
        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const wrapper = document.getElementById('gpc-title-render-wrapper');
        wrapper.innerHTML = '';
        const card = document.createElement('div');
        card.style.cssText = 'width: 8.5in; height: 11in; position: relative; box-sizing: border-box; background: url("' + GPC_TITLE_BG + '") no-repeat 0 0; background-size: 100% 100%;';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: absolute; right: 72px; left: calc(58% - 0.7in); bottom: calc(45px + 0.25in); color: white; font-family: Helvetica, Arial, sans-serif;';
        overlay.innerHTML = '<div style="font-size: 31px; font-weight: bold; margin-bottom: 6px;">' + escapeHtml(bizText) + '</div><div style="font-size: 22px; font-weight: bold; margin-bottom: 6px;">' + escapeHtml(rfpText) + '</div><div style="font-size: 14px; margin-bottom: 5px;">Presented by: ' + escapeHtml(repText) + '</div><div style="font-size: 12px;">' + escapeHtml(today) + '</div>';
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

    async function buildPricingZone() {
        const flexBody = document.getElementById('flex-table-body');
        flexBody.innerHTML = '';
        const locations = Array.from(document.querySelectorAll('#locations-container > div')).map(block => ({
            name: block.querySelector('.loc-name-input').value,
            items: Array.from(block.querySelectorAll('.line-items-body tr')).map(tr => ({
                prod: tr.querySelector('.prod-name').value,
                price: tr.querySelector('.price-input').value,
                qty: tr.querySelector('.qty-input').value,
                total: tr.querySelector('.row-total').innerText
            }))
        }));
        locations.forEach(loc => {
            if (locations.length > 1) {
                flexBody.insertAdjacentHTML('beforeend', `<div style="display: flex; background-color: #A6A6A6; color: white; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #A6A6A6;"><div style="width: 100%; padding: 8px 16px;">${loc.name || 'LOCATION NAME'}</div></div>`);
            }
            loc.items.forEach((item, index) => {
                const bgColor = locations.length === 1 ? ((index % 2 === 0) ? "#E8E8E8" : "#ffffff") : ((index % 2 === 0) ? "#ffffff" : "#E8E8E8");
                flexBody.insertAdjacentHTML('beforeend', `<div style="display: flex; background-color: ${bgColor}; border-bottom: 1px solid #DE5A24;"><div style="width: 380px; padding: 14px 16px; border-right: 1px solid #DE5A24; display: flex; align-items: center;">${item.prod}</div><div style="width: 140px; padding: 14px 5px; border-right: 1px solid #DE5A24; text-align: center; display: flex; align-items: center; justify-content: center;">$${item.price}</div><div style="width: 90px; padding: 14px 5px; border-right: 1px solid #DE5A24; text-align: center; display: flex; align-items: center; justify-content: center;">${item.qty}</div><div style="width: 140px; padding: 14px 16px; text-align: center; display: flex; align-items: center; justify-content: center;">${item.total}</div></div>`);
            });
        });
        document.getElementById('render-grand-total-flex').innerText = document.getElementById('grand-total').innerText;
        document.getElementById('render-term-text-flex').innerText = `Pricing based off ${document.getElementById('contract-term').value || 'XX'}-month term`;
        await new Promise(r => requestAnimationFrame(r));
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
            const displayTitle = document.getElementById('cover-title-input').value || '';
            const bodyHtml = textToHtml(document.getElementById('cover-body').value);
            const canvas = await captureInteriorPageGPC(displayTitle, bodyHtml, { extraPaddingTop: 46 });
            await addPageFromCanvas(canvas);
            continue;
        }
        if (slideFile === 'CUSTOM_TEXT') {
            const customTitle = document.getElementById('custom-text-title-input').value || '';
            const bodyHtml = textToHtml(document.getElementById('custom-text-body').value);
            const canvas = await captureInteriorPageGPC(customTitle, bodyHtml, { extraPaddingTop: 46 });
            await addPageFromCanvas(canvas);
            continue;
        }
        else if (slideFile === 'CUSTOM_IMPACT') {
            var cur = document.getElementById('impact-current').value || '';
            var prop = document.getElementById('impact-proposed').value || '';
            var curCost = document.getElementById('impact-current-cost').value || '';
            var propCost = document.getElementById('impact-proposed-cost').value || '';
            var netEl = document.getElementById('impact-net');
            var netTextRaw = netEl ? netEl.textContent : '$0';
            var netText = (typeof netTextRaw === 'string' && netTextRaw.match(/^\$[\d,]+\.\d{2}$/)) ? netTextRaw.replace(/\.\d{2}$/, '') : netTextRaw;
            var tableStyle = 'border-collapse: collapse; border: 1px solid #d1d5db; border-radius: 0;';
            var thStyle = 'background-color: #0f172a; color: white; font-weight: bold; text-align: left; padding: 12px 16px; border: 1px solid #d1d5db;';
            var tdStyle = 'padding: 12px 16px; border: 1px solid #d1d5db; background-color: #f8fafc; color: #0f172a;';
            var tdAlt = 'padding: 12px 16px; border: 1px solid #d1d5db; background-color: #f1f5f9; color: #0f172a;';
            var roiHeaderOrange = 'padding: 12px 16px; border: 1px solid #d1d5db; background-color: #DE5A24; color: white; font-weight: bold; text-align: center;';
            var impactValueCell = 'padding: 12px 16px; border: 1px solid #d1d5db; background-color: #f8fafc; color: #0f172a; font-weight: 900; text-align: center;';
            var curNum = parseFloat(curCost);
            var propNum = parseFloat(propCost);
            var curDollar = (curCost !== '' && curCost != null && !isNaN(curNum)) ? ('$' + Math.round(curNum).toLocaleString()) : '—';
            var propDollar = (propCost !== '' && propCost != null && !isNaN(propNum)) ? ('$' + Math.round(propNum).toLocaleString()) : '—';
            var wrapperStyle = 'margin: 0 auto; width: 600px;';
            var topTable = '<table style="' + tableStyle + '; width: 100%;"><thead><tr><th colspan="2" style="' + thStyle + '">Impact & ROI</th></tr></thead><tbody>' +
                '<tr><td style="' + tdStyle + '"><strong>Current State</strong></td><td style="' + tdStyle + '">' + escapeHtml(cur || '—') + '</td></tr>' +
                '<tr><td style="' + tdAlt + '"><strong>Proposed Solution</strong></td><td style="' + tdAlt + '">' + escapeHtml(prop || '—') + '</td></tr></tbody></table>';
            var pricingRow = '<table style="' + tableStyle + '; width: 100%; margin-top: 16px;"><tbody><tr>' +
                '<td style="' + roiHeaderOrange + '">Current Spend</td><td style="' + roiHeaderOrange + '">Proposed GPC Spend</td><td style="' + roiHeaderOrange + '">Net Impact</td></tr><tr>' +
                '<td style="' + tdStyle + '; text-align: center; font-weight: 600;">' + escapeHtml(curDollar) + '</td>' +
                '<td style="' + tdAlt + '; text-align: center; font-weight: 600;">' + escapeHtml(propDollar) + '</td>' +
                '<td style="' + impactValueCell + '">' + escapeHtml(netText) + '</td></tr></tbody></table>';
            var impactHtml = '<div style="' + wrapperStyle + '">' + topTable + pricingRow + '</div>';
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
            const locationBlocks = Array.from(document.querySelectorAll('.location-block'));
            const grandTotalText = document.getElementById('grand-total').innerText;
            const contractTerm = document.getElementById('contract-term').value || 'XX';
            const MAX_ROWS_PER_PAGE = 14;
            const borderClr = '#d1d5db';
            const locHeaderOrange = '<div style="display: flex; background-color: #DE5A24; color: white; font-weight: bold; text-transform: uppercase; border: 1px solid ' + borderClr + '; border-bottom: none;"><div style="width: 380px; padding: 12px 16px; border-right: 1px solid ' + borderClr + ';">PRODUCT</div><div style="width: 140px; padding: 12px 5px; text-align: center; border-right: 1px solid ' + borderClr + ';">LIST PRICE</div><div style="width: 90px; padding: 12px 5px; text-align: center; border-right: 1px solid ' + borderClr + ';">QTY</div><div style="width: 140px; padding: 12px 16px; text-align: center;">TOTAL</div></div>';
            const rowToHtml = (item, bg) => {
                var priceVal = '$0';
                if (item.price !== '' && !isNaN(parseFloat(item.price))) priceVal = '$' + Math.round(parseFloat(item.price)).toLocaleString();
                var totalVal = (item.total && item.total.replace) ? item.total.replace(/\.\d{2}$/, '') : item.total || '$0';
                if (totalVal.match(/^\$[\d,]+\.\d{2}$/)) totalVal = totalVal.replace(/\.\d{2}$/, '');
                return '<div style="display: flex; background-color: ' + bg + '; border: 1px solid ' + borderClr + '; border-top: none;"><div style="width: 380px; padding: 12px 16px; border-right: 1px solid ' + borderClr + ';">' + escapeHtml(item.prod) + '</div><div style="width: 140px; padding: 12px 5px; border-right: 1px solid ' + borderClr + '; text-align: center;">' + priceVal + '</div><div style="width: 90px; padding: 12px 5px; border-right: 1px solid ' + borderClr + '; text-align: center;">' + escapeHtml(item.qty) + '</div><div style="width: 140px; padding: 12px 16px; text-align: center;">' + escapeHtml(totalVal) + '</div></div>';
            };
            let allRows = [];
            locationBlocks.forEach((block, i) => {
                const locName = (block.querySelector('.loc-name-input') && block.querySelector('.loc-name-input').value) || 'Location';
                const rows = Array.from(block.querySelectorAll('.line-items-body tr')).map(tr => ({
                    prod: tr.querySelector('.prod-name') ? tr.querySelector('.prod-name').value : '',
                    price: tr.querySelector('.price-input') ? tr.querySelector('.price-input').value : '',
                    qty: tr.querySelector('.qty-input') ? tr.querySelector('.qty-input').value : '1',
                    total: tr.querySelector('.row-total') ? tr.querySelector('.row-total').textContent : '$0.00'
                }));
                if (locationBlocks.length > 1) {
                    allRows.push({ type: 'loc', name: locName });
                }
                rows.forEach((item, idx) => { allRows.push({ type: 'row', item, bg: (idx % 2 === 0) ? '#E8E8E8' : '#f5f5f5' }); });
            });
            var grandTotalNoDecimals = grandTotalText.replace(/\.(\d{2})$/, '') || grandTotalText;
            const totalBlockHtml = '<div style="margin-top: 20px;">' + '<div style="display: flex; background-color: #12243D; color: white; font-weight: bold; font-size: 1.1rem; border: 1px solid ' + borderClr + '; border-radius: 0; box-sizing: border-box;"><div style="width: 610px; padding: 16px;">TOTAL MONTHLY COST</div><div style="width: 140px; padding: 16px; text-align: center;">' + escapeHtml(grandTotalNoDecimals) + '</div></div>' + '</div>';
            const termLineHtml = '<p style="text-align: center; font-size: 11px; color: #475569; margin-top: 1rem;">Pricing based off ' + escapeHtml(contractTerm) + '-month term</p>';
            if (allRows.length === 0) {
                const html = totalBlockHtml + termLineHtml;
                const canvas = await captureInteriorPageGPC('Proposed Pricing', html, { extraPaddingTop: 46 });
                await addPageFromCanvas(canvas);
            } else {
                const MAX_ROWS_LAST_PAGE = 12;
                const chunks = [];
                let current = [];
                let rowCount = 0;
                for (let r = 0; r < allRows.length; r++) {
                    const isLast = (r === allRows.length - 1);
                    if (isLast && rowCount >= MAX_ROWS_LAST_PAGE) {
                        chunks.push(current);
                        current = [];
                        rowCount = 0;
                    }
                    if (allRows[r].type === 'loc') {
                        if (rowCount > 0 && rowCount + 1 >= MAX_ROWS_PER_PAGE) {
                            chunks.push(current);
                            current = [];
                            rowCount = 0;
                        }
                        current.push({ type: 'loc', html: '<div style="display: flex; background-color: #A6A6A6; color: white; font-weight: bold; padding: 8px 16px; border: 1px solid ' + borderClr + '; border-top: none;">' + escapeHtml(allRows[r].name) + '</div>' });
                        rowCount++;
                    } else {
                        current.push({ type: 'row', html: rowToHtml(allRows[r].item, allRows[r].bg) });
                        rowCount++;
                    }
                    if (rowCount >= MAX_ROWS_PER_PAGE && !isLast) {
                        chunks.push(current);
                        current = [];
                        rowCount = 0;
                    }
                }
                if (current.length) chunks.push(current);
                for (let p = 0; p < chunks.length; p++) {
                    const isLast = (p === chunks.length - 1);
                    let body = '';
                    let firstInChunk = true;
                    for (const item of chunks[p]) {
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
                    body += '</div>';
                    if (isLast) body += totalBlockHtml + termLineHtml;
                    const headerTitle = p === 0 ? 'Proposed Pricing' : 'Proposed Pricing (Cont.)';
                    const canvas = await captureInteriorPageGPC(headerTitle, body, { extraPaddingTop: 46 });
                    await addPageFromCanvas(canvas);
                }
            }
        }
        else if (slideFile === 'CUSTOM_PDF') { await appendUploadedPdf(payload.customPdfFile); }
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
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(payload.globals.biz || 'GPC').replace(/ /g, '_')}_Proposal.pdf`;
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

        // --- Dirty Data Check before leaving page ---
        window.addEventListener('beforeunload', function (e) {
            const hasData = document.getElementById('global-rfp').value || 
                            document.getElementById('global-biz').value ||
                            (document.getElementById('cover-body') && document.getElementById('cover-body').value || '').trim().length > 0;
            if (hasData) {
                e.preventDefault();
                e.returnValue = ''; // Triggers the native browser warning
            }
        });
