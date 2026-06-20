// Join Form Wizard Handler
// 3-step wizard for community and solution provider join requests

let currentStep = 1;
let selectedType = 'community';

// Initialize theme checkboxes from THEME_CATEGORIES
function initThemeCheckboxes() {
    const container = document.getElementById('themeCheckboxes');
    if (!container || typeof THEME_CATEGORIES === 'undefined') return;

    container.innerHTML = THEME_CATEGORIES.map(theme => `
        <label>
            <input type="checkbox" name="themes" value="${theme}">
            ${theme}
        </label>
    `).join('');
}

// Type selector
function selectType(type, el) {
    selectedType = type;

    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
    if (el) {
        el.classList.add('active');
    }

    // Show/hide neighbourhood field based on type
    const neighbourhoodGroup = document.getElementById('neighbourhoodGroup');
    if (type === 'community') {
        neighbourhoodGroup.style.display = 'block';
    } else {
        neighbourhoodGroup.style.display = 'none';
    }
}

// City "Other" toggle
function initCityOther() {
    const citySelect = document.getElementById('city');
    const cityOtherGroup = document.getElementById('cityOtherGroup');
    const cityOtherInput = document.getElementById('cityOther');

    if (!citySelect) return;

    citySelect.addEventListener('change', function() {
        if (this.value === 'Other') {
            cityOtherGroup.style.display = 'block';
            cityOtherInput.required = true;
        } else {
            cityOtherGroup.style.display = 'none';
            cityOtherInput.required = false;
            cityOtherInput.value = '';
        }
    });
}

// Character counter for description
function initCharCounter() {
    const desc = document.getElementById('description');
    const counter = document.getElementById('charCount');

    if (!desc || !counter) return;

    desc.addEventListener('input', function() {
        const len = this.value.length;
        counter.textContent = len;
        const wrapper = counter.closest('.char-counter');
        if (len > 140) {
            wrapper.classList.add('over-limit');
        } else {
            wrapper.classList.remove('over-limit');
        }
    });
}

// Validate a specific step
function validateStep(step) {
    clearErrors();

    if (step === 1) {
        let valid = true;

        const name = document.getElementById('name');
        if (!name.value.trim()) {
            showFieldError(name, 'Organisation name is required');
            valid = false;
        }

        const city = document.getElementById('city');
        if (!city.value) {
            showFieldError(city, 'Please select a city');
            valid = false;
        }

        if (city.value === 'Other') {
            const cityOther = document.getElementById('cityOther');
            if (!cityOther.value.trim()) {
                showFieldError(cityOther, 'Please enter your city');
                valid = false;
            }
        }

        if (selectedType === 'community') {
            const neighbourhood = document.getElementById('neighbourhood');
            if (!neighbourhood.value.trim()) {
                showFieldError(neighbourhood, 'Neighbourhood is required for communities');
                valid = false;
            }
        }

        return valid;
    }

    if (step === 2) {
        let valid = true;

        const checked = document.querySelectorAll('#themeCheckboxes input[type="checkbox"]:checked');
        if (checked.length === 0) {
            document.getElementById('themesError').style.display = 'block';
            valid = false;
        }

        const desc = document.getElementById('description');
        if (!desc.value.trim()) {
            showFieldError(desc, 'Description is required');
            valid = false;
        }

        return valid;
    }

    if (step === 3) {
        let valid = true;

        const contactPerson = document.getElementById('contactPerson');
        if (!contactPerson.value.trim()) {
            showFieldError(contactPerson, 'Contact person name is required');
            valid = false;
        }

        const email = document.getElementById('email');
        if (!email.value.trim()) {
            showFieldError(email, 'Email is required');
            valid = false;
        } else if (!isValidEmail(email.value)) {
            showFieldError(email, 'Please enter a valid email address');
            valid = false;
        }

        return valid;
    }

    return true;
}

function showFieldError(field, message) {
    field.classList.add('error');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    field.parentElement.appendChild(errorDiv);
}

function clearErrors() {
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    const themesError = document.getElementById('themesError');
    if (themesError) themesError.style.display = 'none';
    const errorMsg = document.getElementById('errorMessage');
    if (errorMsg) errorMsg.style.display = 'none';
}

// Navigate between steps
function goToStep(step) {
    // Validate current step before moving forward
    if (step > currentStep) {
        if (!validateStep(currentStep)) return;
    }

    currentStep = step;

    // Update step visibility
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
    const targetStep = document.getElementById('step' + step);
    if (targetStep) targetStep.classList.add('active');

    // Update progress indicators
    document.querySelectorAll('.wizard-step-indicator').forEach(ind => {
        const s = parseInt(ind.dataset.step);
        ind.classList.remove('active', 'completed');
        if (s === step) ind.classList.add('active');
        else if (s < step) ind.classList.add('completed');
    });

    // Update lines
    const line1 = document.getElementById('line1');
    const line2 = document.getElementById('line2');
    if (line1) line1.classList.toggle('completed', step > 1);
    if (line2) line2.classList.toggle('completed', step > 2);

    // Scroll to top of form
    document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Submit form
async function submitForm() {
    if (!validateStep(3)) return;

    const submitBtn = document.getElementById('submitBtn');
    const errorMsg = document.getElementById('errorMessage');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    try {
        const name = document.getElementById('name').value.trim();

        const citySelect = document.getElementById('city');
        const city = citySelect.value === 'Other'
            ? document.getElementById('cityOther').value.trim()
            : citySelect.value;

        const neighbourhood = document.getElementById('neighbourhood').value.trim();
        const description = document.getElementById('description').value.trim();
        const offers = document.getElementById('offers').value.trim();
        const asks = document.getElementById('asks').value.trim();
        const contactPerson = document.getElementById('contactPerson').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const website = document.getElementById('website').value.trim();

        // Collect selected themes
        const selectedThemes = Array.from(
            document.querySelectorAll('#themeCheckboxes input[type="checkbox"]:checked')
        ).map(cb => cb.value);

        const record = buildJoinRecord({
            type: selectedType,
            name: name,
            city: city,
            neighborhood: selectedType === 'community' ? neighbourhood : null,
            description: description,
            themes: selectedThemes,
            contactPerson: contactPerson,
            email: email,
            phone: phone,
            website: website,
            offers: offers,
            asks: asks,
            source: 'join_form'
        });

        // Reuse Supabase client from data-loader.js (loaded before this script)
        const supabase = (typeof dataLoader !== 'undefined' && dataLoader.getSupabaseClient)
            ? dataLoader.getSupabaseClient()
            : null;

        if (!supabase) throw new Error('Supabase client not available. Please refresh and try again.');

        // Insert with collision-safe slug retry (file_path is UNIQUE).
        const { error } = await insertJoinRecord(supabase, record);

        if (error) throw error;

        // Show confirmation
        const refNumber = generateRefNumber();
        document.getElementById('referenceNumber').textContent = refNumber;

        // Hide wizard, show confirmation
        document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
        document.getElementById('wizardProgress').style.display = 'none';
        document.getElementById('confirmationScreen').classList.add('active');

        document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
        console.error('Submission error:', error);
        errorMsg.innerHTML = `
            <strong><i class="fa-solid fa-circle-xmark" style="margin-right: 4px;"></i>Submission Failed</strong><br>
            ${error.message || 'There was an error submitting your application. Please try again or contact us directly.'}
        `;
        errorMsg.style.display = 'block';
        errorMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application';
    }
}

// Initialize city dropdown from SUPPORTED_CITIES constant
function initCityDropdown() {
    const citySelect = document.getElementById('city');
    if (!citySelect || typeof SUPPORTED_CITIES === 'undefined') return;

    const placeholder = citySelect.querySelector('option[value=""]');
    citySelect.innerHTML = '';
    if (placeholder) citySelect.appendChild(placeholder);

    SUPPORTED_CITIES.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
    });

    const otherOpt = document.createElement('option');
    otherOpt.value = 'Other';
    otherOpt.textContent = 'Other';
    citySelect.appendChild(otherOpt);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initCityDropdown();
    initThemeCheckboxes();
    initCityOther();
    initCharCounter();
});

// Make functions globally available
window.selectType = selectType;
window.goToStep = goToStep;
window.submitForm = submitForm;
