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
        originalStepValues: {}
    };

    // --- DOM Element Selectors ---
    const logoutBtn = document.getElementById("logout-btn");
    const sequenceList = document.getElementById("sequence-list");
    const addSequenceBtn = document.getElementById("add-sequence-btn");
    const importMarketingSequenceBtn = document.getElementById("import-marketing-sequence-btn");
    const importSequenceBtn = document.getElementById("import-sequence-btn");
    const sequenceCsvInput = document.getElementById("sequence-csv-input");
    const deleteSequenceBtn = document.getElementById("delete-sequence-btn");
    const sequenceStepsTableBody = document.querySelector("#sequence-steps-table-body");
    const addStepBtn = document.getElementById("add-step-btn");
    const themeNameSpan = document.getElementById("theme-name");
    const sequenceNameInput = document.getElementById("sequence-name-input");
    const sequenceDescriptionTextarea = document.getElementById("sequence-description-textarea");
    const sequenceIdInput = document.getElementById("sequence-id");
    const editSequenceDetailsBtn = document.getElementById("edit-sequence-details-btn");
    const saveSequenceDetailsBtn = document.getElementById("save-sequence-details-btn");
    const cancelEditSequenceBtn = document.getElementById("cancel-edit-sequence-btn");
    const sequenceDetailsPanel = document.getElementById("sequence-details-panel");

  
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
                <td>${step.type || ''}</td>
                <td>${step.subject || ''}</td>
                <td>${step.message || ''}</td>
                <td>${step.delay_days || 0}</td>
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

        // CHANGED: Also hide the "Add Step" button for marketing imports
        editSequenceDetailsBtn.classList.toggle('hidden', isMarketingImport);
        addStepBtn.classList.toggle('hidden', isMarketingImport);
        
        deleteSequenceBtn.classList.remove('hidden');
        saveSequenceDetailsBtn.classList.add('hidden');
        cancelEditSequenceBtn.classList.add('hidden');

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

        if (editSequenceDetailsBtn) editSequenceDetailsBtn.classList.add('hidden');
        if (saveSequenceDetailsBtn) saveSequenceDetailsBtn.classList.add('hidden');
        if (cancelEditSequenceBtn) cancelEditSequenceBtn.classList.add('hidden');
        if (deleteSequenceBtn) deleteSequenceBtn.classList.add('hidden');
        if (addStepBtn) addStepBtn.classList.add('hidden');

        document.querySelectorAll("#sequence-list .selected").forEach(item => item.classList.remove("selected"));
        state.editingStepId = null;
        state.originalStepValues = {};
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
        if (editSequenceDetailsBtn) editSequenceDetailsBtn.addEventListener("click", handleEditSequenceDetails);
        if (saveSequenceDetailsBtn) saveSequenceDetailsBtn.addEventListener("click", handleSaveSequenceDetails);
        if (cancelEditSequenceBtn) cancelEditSequenceBtn.addEventListener("click", handleCancelEditSequenceDetails);
        if (addStepBtn) addStepBtn.addEventListener("click", handleAddStep);
        if (sequenceList) sequenceList.addEventListener("click", handleSequenceListClick);
        if (sequenceStepsTableBody) sequenceStepsTableBody.addEventListener("click", handleSequenceStepActions);
    }
    
    function handleSequenceListClick(e) {
        const item = e.target.closest(".list-item");
        if (item) {
            const sequenceId = Number(item.dataset.id);
            if (state.isEditingSequenceDetails || state.editingStepId) {
                showModal("Unsaved Changes", "You have unsaved changes. Do you want to discard them?", () => {
                    state.isEditingSequenceDetails = false;
                    state.editingStepId = null;
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
        if (state.isEditingSequenceDetails || state.editingStepId) {
            showModal("Unsaved Changes", "You have unsaved changes. Do you want to discard them and add a new sequence?", () => {
                state.isEditingSequenceDetails = false;
                state.editingStepId = null;
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
        if (state.isEditingSequenceDetails || state.editingStepId) { showModal("Error", "Please save or cancel any active edits before deleting.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
        showModal("Confirm Deletion", "Are you sure? This will delete the sequence and all its steps.", async () => {
            await supabase.from("sequence_steps").delete().eq("sequence_id", state.selectedSequenceId);
            await supabase.from("sequences").delete().eq("id", state.selectedSequenceId);
            clearSequenceDetailsPanel(true);
            await loadAllData();
            hideModal();
        }, true, `<button id="modal-confirm-btn" class="btn-danger">Delete</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`);
    }

    function handleEditSequenceDetails() {
        if (state.editingStepId) { showModal("Error", "Please save or cancel the current step edit first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
        state.isEditingSequenceDetails = true;
        sequenceNameInput.disabled = false;
        sequenceDescriptionTextarea.disabled = false;
        editSequenceDetailsBtn.classList.add('hidden');
        saveSequenceDetailsBtn.classList.remove('hidden');
        cancelEditSequenceBtn.classList.remove('hidden');
        deleteSequenceBtn.classList.add('hidden');
        addStepBtn.classList.add('hidden');
        sequenceNameInput.focus();
    }

    async function handleSaveSequenceDetails() {
        const updatedName = sequenceNameInput.value.trim();
        const updatedDescription = sequenceDescriptionTextarea.value.trim();
        if (!updatedName) { showModal("Error", "Sequence name cannot be empty.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }

        if (updatedName !== state.originalSequenceName || updatedDescription !== state.originalSequenceDescription) {
            await supabase.from("sequences").update({ name: updatedName, description: updatedDescription }).eq("id", state.selectedSequenceId);
            showModal("Success", "Sequence details saved successfully!", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        } else {
            showModal("Info", "No changes to save.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        }
        
        state.isEditingSequenceDetails = false;
        sequenceNameInput.disabled = true;
        sequenceDescriptionTextarea.disabled = true;
        editSequenceDetailsBtn.classList.remove('hidden');
        saveSequenceDetailsBtn.classList.add('hidden');
        cancelEditSequenceBtn.classList.add('hidden');
        deleteSequenceBtn.classList.remove('hidden');
        addStepBtn.classList.remove('hidden');
        await loadAllData();
    }

    function handleCancelEditSequenceDetails() {
        sequenceNameInput.value = state.originalSequenceName;
        sequenceDescriptionTextarea.value = state.originalSequenceDescription;
        state.isEditingSequenceDetails = false;
        sequenceNameInput.disabled = true;
        sequenceDescriptionTextarea.disabled = true;
        editSequenceDetailsBtn.classList.remove('hidden');
        saveSequenceDetailsBtn.classList.add('hidden');
        cancelEditSequenceBtn.classList.add('hidden');
        deleteSequenceBtn.classList.remove('hidden');
        addStepBtn.classList.remove('hidden');
    }
    
    function handleAddStep() {
        if (!state.selectedSequenceId) return showModal("Error", "Please select a sequence.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`);
        if (state.isEditingSequenceDetails || state.editingStepId) { showModal("Error", "Please save or cancel any active edits first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
        const steps = state.sequence_steps.filter(s => s.sequence_id === state.selectedSequenceId);
        const nextNum = steps.length > 0 ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
        
        // HTML for suggested type buttons
        const suggestedTypesHtml = `
            <div style="margin-top: 10px; display: flex; gap: 5px; flex-wrap: wrap;">
                <button type="button" class="btn-sm btn-secondary suggested-type-btn" data-type="email">Email</button>
                <button type="button" class="btn-sm btn-secondary suggested-type-btn" data-type="call">Call</button>
                <button type="button" class="btn-sm btn-secondary suggested-type-btn" data-type="linkedin">LinkedIn</button>
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
                // Normalize the input type by trimming whitespace and converting to lowercase
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
        }, true, `<button id="modal-confirm-btn" class="btn-primary">Add Step</button><button id="modal-cancel-btn" class="btn-secondary">Cancel</button>`, () => {
            // Callback for when the modal is opened
            const stepTypeInput = document.getElementById("modal-step-type");
            document.querySelectorAll(".suggested-type-btn").forEach(button => {
                button.addEventListener("click", () => {
                    stepTypeInput.value = button.dataset.type;
                });
            });
        });
    }

    async function handleSequenceStepActions(e) {
        const target = e.target.closest("button");
        if (!target) return;
        const row = target.closest("tr[data-id]");
        if (!row) return;

        const stepId = Number(row.dataset.id);

        if (state.isEditingSequenceDetails) { showModal("Error", "Please save or cancel sequence details edits first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
        
        if (target.classList.contains("edit-step-btn")) {
            if (state.editingStepId) { showModal("Error", "Please save or cancel the current step edit first.", null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); return; }
            state.editingStepId = stepId;
            renderSequenceSteps();
        } else if (target.classList.contains("save-step-btn")) {
            const updatedStep = {
                // Normalize the input type by trimming whitespace and converting to lowercase
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
            const existingSteps = state.sequence_steps.filter(s => s.sequence_id === state.selectedSequenceId);
            let nextAvailableStepNumber = existingSteps.length > 0 ? Math.max(...existingSteps.map(s => s.step_number)) + 1 : 1;

            const newRecords = rows.slice(1).map((row) => {
                const c = parseCsvRow(row);
                if (c.length < 5) return null;
                const currentStepNumber = nextAvailableStepNumber++;
                const delayDays = parseInt(c[4], 10);
                if (isNaN(delayDays)) return null;

                return {
                    sequence_id: state.selectedSequenceId,
                    step_number: currentStepNumber,
                    // Normalize the imported type as well
                    type: c[1] ? c[1].trim().toLowerCase() : "",
                    subject: c[2] || "",
                    message: c[3] || "",
                    delay_days: delayDays,
                    user_id: state.currentUser.id
                };
            }).filter(record => record !== null);
            
            if (newRecords.length > 0) {
                const { error } = await supabase.from("sequence_steps").insert(newRecords);
                if (error) { showModal("Error", "Error importing steps: " + error.message, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); }
                else { showModal("Success", `${newRecords.length} steps imported.`, null, false, `<button id="modal-ok-btn" class="btn-primary">OK</button>`); await loadAllData(); }
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
                // Normalize imported marketing sequence steps too
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
