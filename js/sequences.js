// js/sequences.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, formatDate, parseCsvRow, themes, setupModalListeners, showModal, hideModal, updateActiveNavLink, setupUserMenuAndAuth, addDays, loadSVGs } from './shared_constants.js';

document.addEventListener("DOMContentLoaded", async () => {
    console.log("sequences.js script started parsing.");
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        currentUser: null,
        sequences: [],
        sequence_steps: [],
        selectedSequenceId: null,
        contacts: [],
        contact_sequences: [],
        isEditingSequenceDetails: false,
        originalSequenceName: '',
        originalSequenceDescription: '',
        editingStepId: null,
        originalStepValues: {},
        aiGeneratedSteps: []
    };

    // --- DOM Element Selectors ---
    const logoutBtn = document.getElementById("logout-btn");
    const sequenceList = document.getElementById("sequence-list");
    const addSequenceBtn = document.getElementById("add-sequence-btn");
    const importMarketingSequenceBtn = document.getElementById("import-marketing-sequence-btn");
    const importSequenceBtn = document.getElementById("bulk-import-sequence-steps-btn"); // Corrected ID for bulk import
    const sequenceCsvInput = document.getElementById("sequence-steps-csv-input"); // Corrected ID for CSV input
    const deleteSequenceBtn = document.getElementById("delete-sequence-btn");
    const sequenceStepsTableBody = document.querySelector("#sequence-steps-table-body");
    const addStepBtn = document.getElementById("add-step-btn");
    const themeNameSpan = document.getElementById("theme-name");
    const sequenceNameInput = document.getElementById("sequence-name");
    const sequenceDescriptionTextarea = document.getElementById("sequence-description");
    const sequenceIdInput = document.getElementById("sequence-id");
    const sequenceDetailsPanel = document.getElementById("sequence-details");

    // AI Generation Section Selectors
    const aiNumStepsInput = document.getElementById("ai-num-steps");
    const aiStepTypeEmailCheckbox = document.getElementById("ai-step-type-email");
    const aiStepTypeLinkedinCheckbox = document.getElementById("ai-step-type-linkedin");
    const aiStepTypeCallCheckbox = document.getElementById("ai-step-type-call");
    const aiStepTypeTaskCheckbox = document.getElementById("ai-step-type-task");
    // NEW: Other checkbox and input
    const aiStepTypeOtherCheckbox = document.getElementById("ai-step-type-other");
    const aiStepTypeOtherInput = document.getElementById("ai-step-type-other-input");

    const aiPersonaPromptTextarea = document.getElementById("ai-persona-prompt");
    const aiGenerateSequenceBtn = document.getElementById("ai-generate-sequence-btn");
    const aiGeneratedSequencePreview = document.getElementById("ai-generated-sequence-preview");
    const aiGeneratedSequenceForm = document.getElementById("ai-generated-sequence-form");
    const saveAiSequenceBtn = document.getElementById("save-ai-sequence-btn");
    const cancelAiSequenceBtn = document.getElementById("cancel-ai-sequence-btn");
   
    // --- Data Fetching ---
    async function loadAllData() {
        if (!state.currentUser) return;
        const userSpecificTables = ["sequences", "contacts", "contact_sequences", "sequence_steps"];
        const promises = userSpecificTables.map((table) =>
            supabase.from(table).select("*").eq("user_id", state.currentUser.id)
        );
       
        try {
            const results = await Promise.allSettled(promises);
            results.forEach((result, index) => {
                const tableName = userSpecificTables[index];
                if (result.status === "fulfilled" && !result.value.error) {
                    state[tableName] = result.value.data || [];
                } else {
                    console.error(`Error fetching ${tableName}:`, result.status === 'fulfilled' ? result.value.error?.message : result.reason);
                }
            });
        } catch (error) {
            console.error("Critical error in loadAllData:", error);
        } finally {
            renderSequenceList();
            if (state.selectedSequenceId) {
                renderSequenceDetails(state.selectedSequenceId);
            } else {
                clearSequenceDetailsPanel(false);
            }
        }
    }

    // --- Render Functions ---
    const renderSequenceList = () => {
        if (!sequenceList) return;
        sequenceList.innerHTML = "";
        state.sequences
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
            .forEach((seq) => {
                const item = document.createElement("div");
                item.className = "list-item";
                item.dataset.id = seq.id;
   
                const isMarketingSource = seq.source === 'Marketing';
                const indicatorHtml = isMarketingSource ? '<span class="marketing-indicator" title="Imported from Marketing"></span>' : '';
               
                item.innerHTML = `
                    <div class="sequence-list-item-content">
                        ${indicatorHtml}
                        <span>${seq.name}</span>
                    </div>
                `;
   
                if (seq.id === state.selectedSequenceId) {
                    item.classList.add("selected");
                }
                sequenceList.appendChild(item);
            });
    };

    const renderSequenceSteps = () => {
        if (!sequenceStepsTableBody) return;
        sequenceStepsTableBody.innerHTML = "";
        if (!state.selectedSequenceId) return;

        const steps = state.sequence_steps
            .filter(s => s.sequence_id === state.selectedSequenceId)
            .sort((a, b) => a.step_number - b.step_number);

        steps.forEach((step, index) => {
            const row = sequenceStepsTableBody.insertRow();
            row.dataset.id = step.id;
            const isEditingThisStep = state.editingStepId === step.id;
            const isFirstStep = index === 0;
            const isLastStep = index === steps.length - 1;
            const sequence = state.sequences.find(s => s.id === state.selectedSequenceId);
            const isMarketingImport = sequence?.source === 'Marketing';

            // For Marketing imports, actions are completely hidden.
            const actionsHtml = isMarketingImport ? '<td>Read-Only</td>' : `
                <td>
                    <div class="actions-cell-content" style="grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));">
                        ${isEditingThisStep ?
                            `
                            <button class="btn btn-sm btn-success save-step-btn" data-id="${step.id}">Save</button>
                            <button class="btn btn-sm btn-secondary cancel-step-btn" data-id="${step.id}">Cancel</button>
                            ` :
                            `
                            <button class="btn btn-sm btn-secondary move-up-btn ${isFirstStep ? 'hidden' : ''}" data-id="${step.id}" title="Move Up"><i class="fas fa-arrow-up"></i></button>
                            <button class="btn btn-sm btn-primary edit-step-btn" data-id="${step.id}" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn btn-sm btn-secondary move-down-btn ${isLastStep ? 'hidden' : ''}" data-id="${step.id}" title="Move Down"><i class="fas fa-arrow-down"></i></button>
                            <button class="btn btn-sm btn-danger delete-step-btn" data-id="${step.id}" title="Delete"><i class="fas fa-trash-can"></i></button>
                            `
                        }
                    </div>
                </td>`;

            row.innerHTML = `
                <td>${step.step_number}</td>
                <td>${isEditingThisStep ? `<input type="text" class="edit-step-type" value="${step.type || ''}">` : (step.type || '')}</td>
                <td>${isEditingThisStep ? `<input type="number" class="edit-step-delay" value="${step.delay_days || 0}">` : (step.delay_days || 0)}</td>
                <td>${isEditingThisStep ? `<input type="text" class="edit-step-subject" value="${step.subject || ''}">` : (step.subject || '')}</td>
                <td>${isEditingThisStep ? `<textarea class="edit-step-message">${step.message || ''}</textarea>` : (step.message || '')}</td>
                ${actionsHtml}
            `;
        });
    };
   
    const renderSequenceDetails = (sequenceId) => {
        const sequence = state.sequences.find(s => s.id === sequenceId);
        state.selectedSequenceId = sequenceId;

        if (!sequenceDetailsPanel) return;
        sequenceDetailsPanel.classList.remove('hidden');

        if (!sequence) {
            clearSequenceDetailsPanel(false);
            return;
        }

        sequenceIdInput.value = sequence.id;
        sequenceNameInput.value = sequence.name || "";
        sequenceDescriptionTextarea.value = sequence.description || "";
        state.originalSequenceName = sequence.name || "";
        state.originalSequenceDescription = sequence.description || "";
       
        const isMarketingImport = sequence.source === 'Marketing';
        sequenceNameInput.disabled = isMarketingImport;
        sequenceDescriptionTextarea.disabled = isMarketingImport;

        deleteSequenceBtn.classList.remove('hidden');
        addStepBtn.classList.toggle('hidden', isMarketingImport);
        
        state.editingStepId = null;
        renderSequenceSteps();
    };

    const clearSequenceDetailsPanel = (hidePanel = true) => {
        state.selectedSequenceId = null;
        if (sequenceIdInput) sequenceIdInput.value = "";
        if (sequenceNameInput) sequenceNameInput.value = "";
        if (sequenceDescriptionTextarea) sequenceDescriptionTextarea.value = "";
        if (sequenceStepsTableBody) sequenceStepsTableBody.innerHTML = "";

        if (hidePanel && sequenceDetailsPanel) {
            sequenceDetailsPanel.classList.add('hidden');
        } else if (sequenceDetailsPanel) {
            sequenceDetailsPanel.classList.remove('hidden');
            if (sequenceNameInput) {
                sequenceNameInput.value = "No Sequence Selected";
                sequenceNameInput.disabled = true;
            }
            if (sequenceDescriptionTextarea) {
                sequenceDescriptionTextarea.value = "Select a sequence from the left or create a new one.";
                sequenceDescriptionTextarea.disabled = true;
            }
        }

        if (deleteSequenceBtn) deleteSequenceBtn.classList.add('hidden');
        if (addStepBtn) addStepBtn.classList.add('hidden');

        document.querySelectorAll("#sequence-list .selected").forEach(item => item.classList.remove("selected"));
        state.editingStepId = null;
        state.originalStepValues = {};
        state.aiGeneratedSteps = [];
        aiGeneratedSequencePreview.classList.add('hidden');
    };

    function setupPageEventListeners() {
        setupModalListeners();
        updateActiveNavLink();
        if (logoutBtn) logoutBtn.addEventListener("click", async () => { await supabase.auth.signOut(); window.location.href = "index.html"; });
        if (addSequenceBtn) addSequenceBtn.addEventListener("click", handleNewSequenceClick);
        if (importMarketingSequenceBtn) importMarketingSequenceBtn.addEventListener('click', showMarketingSequencesForImport);
        if (importSequenceBtn) importSequenceBtn.addEventListener("click", () => {
            if (!state.selectedSequenceId) return showModal("Error", "Please select a sequence to import steps into.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            if (state.isEditingSequenceDetails || state.editingStepId) { showModal("Error", "Please save or cancel any active edits before importing steps.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
            sequenceCsvInput.click();
        });
        if(sequenceCsvInput) sequenceCsvInput.addEventListener("change", handleCsvImport);
        if (deleteSequenceBtn) deleteSequenceBtn.addEventListener("click", handleDeleteSequence);
        if (addStepBtn) addStepBtn.addEventListener("click", handleAddStep);
        if (sequenceList) sequenceList.addEventListener("click", handleSequenceListClick);
        if (sequenceStepsTableBody) sequenceStepsTableBody.addEventListener("click", handleSequenceStepActions);

        document.body.addEventListener("click", (e) => {
            const target = e.target;
            if (target.classList.contains("suggested-type-btn")) {
                const stepTypeInput = document.getElementById("modal-step-type");
                if (stepTypeInput) {
                    stepTypeInput.value = target.dataset.type;
                    stepTypeInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        });

        // NEW: Event listener for 'Other' checkbox to enable/disable its input
        if (aiStepTypeOtherCheckbox && aiStepTypeOtherInput) {
            aiStepTypeOtherCheckbox.addEventListener('change', () => {
                aiStepTypeOtherInput.disabled = !aiStepTypeOtherCheckbox.checked;
                if (!aiStepTypeOtherCheckbox.checked) {
                    aiStepTypeOtherInput.value = ''; // Clear input if unchecked
                }
            });
        }

        // AI Sequence Generation Event Listeners
        if (aiGenerateSequenceBtn) aiGenerateSequenceBtn.addEventListener("click", handleAiGenerateSequence);
        if (saveAiSequenceBtn) saveAiSequenceBtn.addEventListener("click", handleSaveAiSequence);
        if (cancelAiSequenceBtn) cancelAiSequenceBtn.addEventListener("click", handleCancelAiSequence);
    }
   
    function handleSequenceListClick(e) {
        const item = e.target.closest(".list-item");
        if (item) {
            const sequenceId = Number(item.dataset.id);
            if (state.isEditingSequenceDetails || state.editingStepId || state.aiGeneratedSteps.length > 0) {
                showModal("Unsaved Changes", "You have unsaved changes or an active AI generation preview. Do you want to discard them?", () => {
                    state.isEditingSequenceDetails = false;
                    state.editingStepId = null;
                    state.aiGeneratedSteps = [];
                    aiGeneratedSequencePreview.classList.add('hidden');
                    renderSequenceDetails(sequenceId);
                    document.querySelectorAll("#sequence-list .selected").forEach(i => i.classList.remove("selected"));
                    item.classList.add("selected");
                    hideModal();
                }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
            } else {
                renderSequenceDetails(sequenceId);
                document.querySelectorAll("#sequence-list .selected").forEach(i => i.classList.remove("selected"));
                item.classList.add("selected");
            }
        }
    }

    function handleNewSequenceClick() {
        if (state.isEditingSequenceDetails || state.editingStepId || state.aiGeneratedSteps.length > 0) {
            showModal("Unsaved Changes", "You have unsaved changes or an active AI generation preview. Do you want to discard them and add a new sequence?", () => {
                state.isEditingSequenceDetails = false;
                state.editingStepId = null;
                state.aiGeneratedSteps = [];
                aiGeneratedSequencePreview.classList.add('hidden');
                clearSequenceDetailsPanel(false);
                hideModal();
                showNewSequenceModal();
            }, true, `<button id="modal-confirm-btn" class="btn-primary">Discard & New</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        } else {
            showNewSequenceModal();
        }
    }
   
    function showNewSequenceModal() {
        showModal("New Personal Sequence", `<label>Sequence Name</label><input type="text" id="modal-sequence-name" required>`, async () => {
            const name = document.getElementById("modal-sequence-name").value.trim();
            if (name) {
                const { data: newSeq, error } = await supabase.from("sequences").insert([{ name, source: 'Personal', user_id: state.currentUser.id }]).select().single();
                if (error) { showModal("Error", "Error adding sequence: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return false; }
                state.selectedSequenceId = newSeq.id;
                await loadAllData();
                hideModal();
                renderSequenceDetails(newSeq.id);
                return true;
            } else { showModal("Error", "Sequence name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return false; }
        });
    }

    function handleDeleteSequence() {
        if (!state.selectedSequenceId) return showModal("Error", "Please select a sequence to delete.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        if (state.isEditingSequenceDetails || state.editingStepId || state.aiGeneratedSteps.length > 0) {
            showModal("Error", "Please save or cancel any active edits or AI generation preview before deleting.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
        showModal("Confirm Deletion", "Are you sure? This will delete the sequence and all its steps.", async () => {
            await supabase.from("sequence_steps").delete().eq("sequence_id", state.selectedSequenceId);
            await supabase.from("sequences").delete().eq("id", state.selectedSequenceId);
            clearSequenceDetailsPanel(true);
            await loadAllData();
            hideModal();
        }, true, `<button id="modal-confirm-btn" class="btn-danger">Delete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }
   
    function handleAddStep() {
        if (!state.selectedSequenceId) return showModal("Error", "Please select a sequence.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        if (state.isEditingSequenceDetails || state.editingStepId || state.aiGeneratedSteps.length > 0) {
            showModal("Error", "Please save or cancel any active edits or AI generation preview first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
        const steps = state.sequence_steps.filter(s => s.sequence_id === state.selectedSequenceId);
        const nextNum = steps.length > 0 ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
       
        const suggestedTypesHtml = `
            <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-start; padding: 0 5px;">
                <button type="button" class="btn-sm btn-secondary suggested-type-btn" data-type="Email" style="flex-grow: 1; min-width: 80px;">Email</button>
                <button type="button" class="btn-sm btn-secondary suggested-type-btn" data-type="Call" style="flex-grow: 1; min-width: 80px;">Call</button>
                <button type="button" class="btn-sm btn-secondary suggested-type-btn" data-type="LinkedIn" style="flex-grow: 1; min-width: 80px;">LinkedIn</button>
                <button type="button" class="btn-sm btn-secondary suggested-type-btn" data-type="Task" style="flex-grow: 1; min-width: 80px;">Task</button>
            </div>
        `;

        showModal("Add Sequence Step", `
            <label>Step Number</label><input type="number" id="modal-step-number" value="${nextNum}" required>
            <label>Type</label><input type="text" id="modal-step-type" required placeholder="e.g., Email, Call, LinkedIn">
            ${suggestedTypesHtml}
            <label>Subject (for Email)</label><input type="text" id="modal-step-subject" placeholder="Optional">
            <label>Message (for Email/Notes)</label><textarea id="modal-step-message" placeholder="Optional"></textarea>
            <label>Delay (Days after previous step)</label><input type="number" id="modal-step-delay" value="0" required>
        `, async () => {
            const newStep = {
                sequence_id: state.selectedSequenceId,
                step_number: parseInt(document.getElementById("modal-step-number").value),
                type: document.getElementById("modal-step-type").value.trim().toLowerCase(), 
                subject: document.getElementById("modal-step-subject").value.trim(),
                message: document.getElementById("modal-step-message").value.trim(),
                delay_days: parseInt(document.getElementById("modal-step-delay").value),
                user_id: state.currentUser.id
            };
            if (!newStep.type) { showModal("Error", "Step Type is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return false; }
            await supabase.from("sequence_steps").insert([newStep]);
            await loadAllData();
            hideModal();
            return true;
        }, true, `<button id="modal-confirm-btn" class="btn-primary">Add Step</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }

    async function handleSequenceStepActions(e) {
        const target = e.target.closest("button");
        if (!target) return;
        const row = target.closest("tr[data-id]");
        if (!row) return;

        const stepId = Number(row.dataset.id);

        if (state.isEditingSequenceDetails || state.aiGeneratedSteps.length > 0) {
            showModal("Error", "Please save or cancel sequence details edits or AI generation preview first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
       
        if (target.classList.contains("edit-step-btn")) {
            if (state.editingStepId) { showModal("Error", "Please save or cancel the current step edit first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
            state.editingStepId = stepId;
            renderSequenceSteps();
        } else if (target.classList.contains("save-step-btn")) {
            const updatedStep = {
                type: row.querySelector(".edit-step-type").value.trim().toLowerCase(),
                subject: row.querySelector(".edit-step-subject").value.trim(),
                message: row.querySelector(".edit-step-message").value.trim(),
                delay_days: parseInt(row.querySelector(".edit-step-delay").value || 0, 10),
            };
            if (!updatedStep.type) { showModal("Error", "Step Type is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
            await supabase.from("sequence_steps").update(updatedStep).eq("id", stepId);
            state.editingStepId = null;
            await loadAllData();
        } else if (target.classList.contains("cancel-step-btn")) {
            state.editingStepId = null;
            renderSequenceSteps();
        } else if (target.classList.contains("delete-step-btn")) {
            if (state.editingStepId) { showModal("Error", "Please save or cancel the current step edit first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
            showModal("Confirm Delete Step", "Are you sure you want to delete this step?", async () => {
                await supabase.from("sequence_steps").delete().eq("id", stepId);
                await loadAllData();
                hideModal();
            }, true, `<button id="modal-confirm-btn" class="btn-danger">Delete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
        } else if (target.classList.contains("move-up-btn")) {
            if (state.editingStepId) { showModal("Error", "Please save or cancel any active edits first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
            await handleMoveStep(stepId, 'up');
        } else if (target.classList.contains("move-down-btn")) {
            if (state.editingStepId) { showModal("Error", "Please save or cancel any active edits first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
            await handleMoveStep(stepId, 'down');
        }
    }

    async function handleMoveStep(stepId, direction) {
        const currentStep = state.sequence_steps.find(s => s.id === stepId);
        if (!currentStep) return;

        const allStepsInSequence = state.sequence_steps
            .filter(s => s.sequence_id === state.selectedSequenceId)
            .sort((a, b) => a.step_number - b.step_number);

        const currentIndex = allStepsInSequence.findIndex(s => s.id === stepId);
        let targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= allStepsInSequence.length) return;

        const targetStep = allStepsInSequence[targetIndex];
       
        const tempStepNumber = currentStep.step_number;
        currentStep.step_number = targetStep.step_number;
        targetStep.step_number = tempStepNumber;

        await supabase.from("sequence_steps").update({ step_number: currentStep.step_number }).eq("id", currentStep.id);
        await supabase.from("sequence_steps").update({ step_number: targetStep.step_number }).eq("id", targetStep.id);
       
        await loadAllData();
    }
   
    function handleCsvImport(e) {
        if (!state.selectedSequenceId) return;
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = async function(e) {
            const rows = e.target.result.split("\n").filter((r) => r.trim() !== "");
            console.log("DEBUG: Total rows from CSV (including header):", rows.length); // DEBUG
            const existingSteps = state.sequence_steps.filter(s => s.sequence_id === state.selectedSequenceId);
            let nextAvailableStepNumber = existingSteps.length > 0 ? Math.max(...existingSteps.map(s => s.step_number)) + 1 : 1;

            const newRecords = rows.slice(1).map((row, index) => { // Added index for debugging
                const c = parseCsvRow(row);
                console.log(`DEBUG: Row ${index + 1} parsed:`, c); // DEBUG
                if (c.length < 5) {
                    console.warn(`DEBUG: Row ${index + 1} skipped: Less than 5 columns.`, c); // DEBUG
                    return null;
                }
                const currentStepNumber = nextAvailableStepNumber++;
                const delayDays = parseInt(c[4], 10);
                if (isNaN(delayDays)) {
                    console.warn(`DEBUG: Row ${index + 1} skipped: Invalid delay_days.`, c[4]); // DEBUG
                    return null;
                }

                // Log the type before conversion
                console.log(`DEBUG: Row ${index + 1} original type:`, c[1]); // DEBUG

                return {
                    sequence_id: state.selectedSequenceId,
                    step_number: currentStepNumber,
                    type: c[1] ? c[1].trim().toLowerCase() : "", 
                    subject: c[2] || "",
                    message: c[3] || "",
                    delay_days: delayDays,
                    user_id: state.currentUser.id
                };
            }).filter(record => record !== null);
           
            console.log("DEBUG: Number of records prepared for insert:", newRecords.length); // DEBUG
            
            if (newRecords.length > 0) {
                const { error } = await supabase.from("sequence_steps").insert(newRecords);
                if (error) {
                    console.error("DEBUG: Supabase insert error:", error); // DEBUG
                    showModal("Error", "Error importing steps: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                }
                else {
                    showModal("Success", `${newRecords.length} steps imported.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    await loadAllData();
                }
            } else {
                showModal("Info", "No valid records found to import.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            }
        };
        r.readAsText(f);
        e.target.value = "";
    }
   
    async function showMarketingSequencesForImport() {
        try {
            const { data: marketingSequences, error } = await supabase.from('marketing_sequences').select('id, name');
            if (error) throw error;
   
            const personalSequenceNames = new Set(state.sequences.map(s => s.name));
            const availableSequences = marketingSequences.filter(ms => !personalSequenceNames.has(ms.name));
   
            if (availableSequences.length === 0) {
                showModal("Import Marketing Sequence", "<p>All available marketing sequences have already been imported.</p>", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return;
            }
   
            const sequenceOptionsHtml = availableSequences.map(seq => `
                <div class="list-item" data-id="${seq.id}" style="cursor: pointer; margin-bottom: 5px;">
                    <input type="radio" name="marketing_sequence" value="${seq.id}" id="seq-${seq.id}" style="margin-right: 10px;">
                    <label for="seq-${seq.id}" style="flex-grow: 1; cursor: pointer;">${seq.name}</label>
                </div>
            `).join('');
   
            const modalBody = `<div class="import-modal-list">${sequenceOptionsHtml}</div>`;
            showModal("Import Marketing Sequence", modalBody, importMarketingSequence);
   
        } catch (error) {
            showModal("Error", "Error fetching marketing sequences: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }
   
    async function importMarketingSequence() {
        const selectedRadio = document.querySelector('input[name="marketing_sequence"]:checked');
        if (!selectedRadio) {
            showModal("Error", "Please select a sequence to import.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return false;
        }
   
        const marketingSeqId = Number(selectedRadio.value);
   
        const { data: originalSequence, error: seqError } = await supabase.from('marketing_sequences').select('*').eq('id', marketingSeqId).single();
        if (seqError) { showModal("Error", "Error fetching original sequence: " + seqError.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return false; }
   
        const { data: originalSteps, error: stepsError } = await supabase.from('marketing_sequence_steps').select('*').eq('marketing_sequence_id', marketingSeqId);
        if (stepsError) { showModal("Error", "Error fetching original steps: " + stepsError.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return false; }
   
        const { data: newPersonalSequence, error: insertSeqError } = await supabase.from('sequences').insert({
            name: originalSequence.name,
            description: originalSequence.description,
            source: 'Marketing',
            user_id: state.currentUser.id
        }).select().single();
   
        if (insertSeqError) {
            showModal("Error", "Failed to create new sequence. You may already have a sequence with this name. Error: " + insertSeqError.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return false;
        }
   
        if (originalSteps && originalSteps.length > 0) {
            const newSteps = originalSteps.map(step => ({
                sequence_id: newPersonalSequence.id,
                step_number: step.step_number,
                type: step.type ? step.type.trim().toLowerCase() : "",
                subject: step.subject,
                message: step.message,
                delay_days: step.delay_days,
                user_id: state.currentUser.id
            }));
            const { error: insertStepsError } = await supabase.from('sequence_steps').insert(newSteps);
            if (insertStepsError) {
                await supabase.from('sequences').delete().eq('id', newPersonalSequence.id);
                showModal("Error", "Failed to copy sequence steps. Error: " + insertStepsError.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return false;
            }
        }
   
        showModal("Success", `Sequence "${originalSequence.name}" imported successfully!`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        await loadAllData();
        state.selectedSequenceId = newPersonalSequence.id;
        renderSequenceList();
        renderSequenceDetails(newPersonalSequence.id);
   
        return true;
    }

    // NEW: AI Sequence Generation Functions
    async function handleAiGenerateSequence() {
        if (state.isEditingSequenceDetails || state.editingStepId || state.aiGeneratedSteps.length > 0) {
            showModal("Error", "Please save or cancel any active edits or AI generation preview first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        const numSteps = parseInt(aiNumStepsInput.value, 10);
        const selectedStepTypes = [];
        if (aiStepTypeEmailCheckbox.checked) selectedStepTypes.push(aiStepTypeEmailCheckbox.value);
        if (aiStepTypeLinkedinCheckbox.checked) selectedStepTypes.push(aiStepTypeLinkedinCheckbox.value);
        if (aiStepTypeCallCheckbox.checked) selectedStepTypes.push(aiStepTypeCallCheckbox.value);
        if (aiStepTypeTaskCheckbox.checked) selectedStepTypes.push(aiStepTypeTaskCheckbox.value);
        // NEW: Capture custom 'Other' type if checked and input has value
        if (aiStepTypeOtherCheckbox.checked) {
            const customType = aiStepTypeOtherInput.value.trim();
            if (customType) {
                selectedStepTypes.push(customType);
            } else {
                showModal("Error", "Please provide a name for the 'Other' step type.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return;
            }
        }

        const personaPrompt = aiPersonaPromptTextarea.value.trim();

        if (numSteps < 1) {
            showModal("Error", "Number of steps must be at least 1.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }
        if (selectedStepTypes.length === 0) {
            showModal("Error", "Please select at least one step type.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }
        if (!personaPrompt) {
            showModal("Error", "Please provide a persona and voice prompt for the AI.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        showModal("Generating Sequence", `<div class="loader"></div><p class="placeholder-text" style="text-align: center;">AI is drafting your sequence steps...</p>`, null, false, `<button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);

        try {
            const { data, error } = await supabase.functions.invoke('generate-sequence-steps', {
                body: {
                    numSteps,
                    stepTypes: selectedStepTypes,
                    personaPrompt
                }
            });

            if (error) throw error;

            state.aiGeneratedSteps = data.steps.map((step, index) => ({
                id: `ai-temp-${index}`, // Temporary ID for preview editing
                step_number: index + 1,
                type: step.type.toLowerCase(),
                subject: step.subject || '',
                message: step.message || '',
                delay_days: step.delay_days || 0,
                isEditing: false // For inline editing in preview
            }));

            renderAiGeneratedStepsPreview();
            hideModal();
            aiGeneratedSequencePreview.classList.remove('hidden');
            showModal("Success", "AI sequence generated! Review and save below.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);

        } catch (error) {
            console.error("Error generating AI sequence:", error);
            showModal("Error", `Failed to generate AI sequence: ${error.message}. Please try again.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
    }

    function renderAiGeneratedStepsPreview() {
        if (!aiGeneratedSequenceForm) return;
        aiGeneratedSequenceForm.innerHTML = ""; // Clear previous preview

        if (state.aiGeneratedSteps.length === 0) {
            aiGeneratedSequenceForm.innerHTML = "<p class='placeholder-text'>No steps generated yet.</p>";
            return;
        }

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Step #</th>
                    <th>Type</th>
                    <th>Delay (Days)</th>
                    <th>Subject / Description</th>
                    <th>Content</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="ai-generated-steps-table-body"></tbody>
        `;
        aiGeneratedSequenceForm.appendChild(table);
        const tbody = table.querySelector("#ai-generated-steps-table-body");

        state.aiGeneratedSteps.forEach((step, index) => {
            const row = tbody.insertRow();
            row.dataset.id = step.id; // Use temporary ID for preview
            const isEditingThisStep = step.isEditing;

            row.innerHTML = `
                <td>${step.step_number}</td>
                <td>${isEditingThisStep ? `<input type="text" class="edit-step-type" value="${step.type || ''}">` : (step.type || '')}</td>
                <td>${isEditingThisStep ? `<input type="number" class="edit-step-delay" value="${step.delay_days || 0}">` : (step.delay_days || 0)}</td>
                <td>${isEditingThisStep ? `<input type="text" class="edit-step-subject" value="${step.subject || ''}">` : (step.subject || '')}</td>
                <td>${isEditingThisStep ? `<textarea class="edit-step-message">${step.message || ''}</textarea>` : (step.message || '')}</td>
                <td>
                    <div class="actions-cell-content" style="grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));">
                        ${isEditingThisStep ?
                            `
                            <button class="btn btn-sm btn-success save-ai-step-btn" data-id="${step.id}">Save</button>
                            <button class="btn btn-sm btn-secondary cancel-ai-step-btn" data-id="${step.id}">Cancel</button>
                            ` :
                            `
                            <button class="btn btn-sm btn-primary edit-ai-step-btn" data-id="${step.id}" title="Edit"><i class="fas fa-pencil-alt"></i></button>
                            `
                        }
                    </div>
                </td>
            `;
        });

        // Add event listeners for inline editing within the AI preview table
        tbody.addEventListener("click", (e) => {
            const target = e.target.closest("button");
            if (!target) return;
            const row = target.closest("tr[data-id]");
            if (!row) return;
            const stepId = row.dataset.id;
            const stepIndex = state.aiGeneratedSteps.findIndex(s => s.id === stepId);
            if (stepIndex === -1) return;

            if (target.classList.contains("edit-ai-step-btn")) {
                state.aiGeneratedSteps[stepIndex].isEditing = true;
                state.aiGeneratedSteps[stepIndex].originalValues = { ...state.aiGeneratedSteps[stepIndex] };
                renderAiGeneratedStepsPreview();
            } else if (target.classList.contains("save-ai-step-btn")) {
                state.aiGeneratedSteps[stepIndex].type = row.querySelector(".edit-step-type").value.trim().toLowerCase();
                state.aiGeneratedSteps[stepIndex].delay_days = parseInt(row.querySelector(".edit-step-delay").value || 0, 10);
                state.aiGeneratedSteps[stepIndex].subject = row.querySelector(".edit-step-subject").value.trim();
                state.aiGeneratedSteps[stepIndex].message = row.querySelector(".edit-step-message").value.trim();
                
                if (!state.aiGeneratedSteps[stepIndex].type) {
                    showModal("Error", "Step Type is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                    return;
                }

                state.aiGeneratedSteps[stepIndex].isEditing = false;
                delete state.aiGeneratedSteps[stepIndex].originalValues;
                renderAiGeneratedStepsPreview();
            } else if (target.classList.contains("cancel-ai-step-btn")) {
                Object.assign(state.aiGeneratedSteps[stepIndex], state.aiGeneratedSteps[stepIndex].originalValues);
                state.aiGeneratedSteps[stepIndex].isEditing = false;
                delete state.aiGeneratedSteps[stepIndex].originalValues;
                renderAiGeneratedStepsPreview();
            }
        });
    }

    async function handleSaveAiSequence() {
        if (state.aiGeneratedSteps.some(step => step.isEditing)) {
            showModal("Error", "Please save or cancel all inline step edits before saving the sequence.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
            return;
        }

        showModal("Save AI Generated Sequence", `
            <label>New Sequence Name:</label>
            <input type="text" id="modal-new-sequence-name" required placeholder="e.g., AI Generated Outreach Sequence">
        `, async () => {
            const newSequenceName = document.getElementById("modal-new-sequence-name").value.trim();
            if (!newSequenceName) {
                showModal("Error", "Sequence name is required.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return false;
            }

            const existingSequence = state.sequences.find(s => s.name.toLowerCase() === newSequenceName.toLowerCase());
            if (existingSequence) {
                showModal("Error", "A sequence with this name already exists. Please choose a different name.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return false;
            }

            try {
                const { data: newSeqArr, error: seqError } = await supabase.from("sequences").insert([
                    { name: newSequenceName, description: "AI Generated Sequence", source: "AI", user_id: state.currentUser.id }
                ]).select();

                if (seqError) throw seqError;
                const newSequenceId = newSeqArr[0].id;

                const stepsToInsert = state.aiGeneratedSteps.map(step => ({
                    sequence_id: newSequenceId,
                    step_number: step.step_number,
                    type: step.type,
                    subject: step.subject,
                    message: step.message,
                    delay_days: step.delay_days,
                    user_id: state.currentUser.id
                }));

                if (stepsToInsert.length > 0) {
                    const { error: stepsError } = await supabase.from("sequence_steps").insert(stepsToInsert);
                    if (stepsError) throw stepsError;
                }

                state.aiGeneratedSteps = [];
                aiGeneratedSequencePreview.classList.add('hidden');
                state.selectedSequenceId = newSequenceId;
                await loadAllData();

                hideModal();
                showModal("Success", `AI-generated sequence "${newSequenceName}" saved successfully!`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return true;

            } catch (error) {
                console.error("Error saving AI generated sequence:", error);
                showModal("Error", `Failed to save AI sequence: ${error.message}.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
                return false;
            }
        }, true, `<button id="modal-confirm-btn" class="btn-primary">Save Sequence</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }

    function handleCancelAiSequence() {
        showModal("Confirm Cancel", "Are you sure you want to discard the AI generated sequence?", () => {
            state.aiGeneratedSteps = [];
            aiGeneratedSequencePreview.classList.add('hidden');
            hideModal();
        }, true, `<button id="modal-confirm-btn" class="btn-danger">Discard</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }

    // --- App Initialization ---
    async function initializePage() {
        await loadSVGs();
        updateActiveNavLink();

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.currentUser = session.user;
            await setupUserMenuAndAuth(supabase, state);
            setupPageEventListeners();
            await loadAllData();
        } else {
            window.location.href = "index.html";
        }
    }

    initializePage();
});
