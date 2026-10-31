/**
 * NOTF Chatbot — Complaint mode methods
 * Mixed into NotfChatbot.prototype at load time.
 * Contains all complaint flow, geocoding, map picker, and GPS logic.
 *
 * Extracted from unified-chatbot.js in PR 5 of the audit plan.
 */
(function () {
    class NotfComplaintMixin {
    initializeComplaintMode() {
        this.state = 'complaint_welcome';

        // Lazy load complaint engine and boundary validator
        if (!this.complaintEngine) {
            this.complaintEngine = new ComplaintEngine();
        }
        if (!this.boundaryValidator) {
            this.boundaryValidator = new BoundaryValidator();
        }

        this.addBotMessage(`
            <div class="mode-message">
                <p>I'll help you file a complaint about a civic issue.</p>
                <p>Please describe the issue you're facing. Include as much detail as possible:</p>
                <ul>
                    <li>What is the problem?</li>
                    <li>Where is it located?</li>
                    <li>When did it start?</li>
                </ul>
                <p class="tip"><i class="fa-solid fa-lightbulb"></i> <strong>Tip:</strong> Detailed descriptions help the authorities address your complaint faster.</p>
            </div>
        `);

        this.state = 'complaint_description';
        this.enableInput();
    }
    async processComplaintMessage(message) {
        switch (this.state) {
            case 'complaint_description':
                await this.handleComplaintDescription(message);
                break;
            case 'complaint_city':
                this.handleComplaintCity(message);
                break;
            case 'complaint_city_confirm':
                // User is correcting the auto-detected city
                this.formData.city = message.trim();
                this.askForLocation();
                break;
            case 'complaint_location':
                this.handleComplaintLocation(message);
                break;
            case 'complaint_contact':
                this.handleComplaintContact(message);
                break;
            case 'complaint_name':
                this.handleComplaintName(message);
                break;
            default:
                this.addBotMessage('Sorry, I got confused. Let me restart the complaint process.');
                this.initializeComplaintMode();
        }
    }

    async handleComplaintDescription(message) {
        if (message.length < 10) {
            this.addBotMessage('Please provide more details about the issue (at least 10 characters).');
            return;
        }

        this.formData.description = message;

        // Auto-categorize using ML keywords (async)
        const category = await this.complaintEngine.categorizeComplaint(message);

        // Extract location information from description
        const locationInfo = this.extractLocationFromText(message);

        this.addBotMessage(`
            <p>Thank you for the description.</p>
            ${category ? `<p>I've categorized this as: <strong>${category.name}</strong></p>` : '<p>Let me help you categorize this issue.</p>'}
            ${locationInfo.city ? `<p>I detected city: <strong>${locationInfo.city}</strong></p>` : ''}
            ${locationInfo.location ? `<p>I detected location: <strong>${locationInfo.location}</strong></p>` : ''}
        `);

        // Store detected category
        this.formData.detectedCategory = category;

        // Store extracted location info for later use
        this.formData.extractedCity = locationInfo.city;
        this.formData.extractedLocation = locationInfo.location;

        // Ask for category confirmation/selection
        await this.askForCategory();
    }

    async askForCategory() {
        // Get top category suggestions based on description (async)
        const topMatches = await this.complaintEngine.getTopCategorySuggestions(this.formData.description, 5);

        if (topMatches.length > 0) {
            // Show top matching categories as chip suggestions
            let categoriesHTML = '<p>Select the issue category:</p>';
            categoriesHTML += '<div class="category-chips" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem;">';

            topMatches.forEach((cat, index) => {
                // First match is primary (filled), others are outlined
                const isPrimary = index === 0;
                categoriesHTML += `
                    <button class="category-chip" onclick="notfChatbot.selectCategory('${cat.id}')" style="
                        display: inline-flex;
                        align-items: center;
                        padding: 0.5rem 1rem;
                        background: ${isPrimary ? '#2F4A2C' : 'white'};
                        border: 1.5px solid #2F4A2C;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        color: ${isPrimary ? 'white' : '#2F4A2C'};
                        transition: all 0.2s ease;
                        white-space: nowrap;
                        font-weight: 500;
                    "
                    onmouseover="this.style.background='#2F4A2C'; this.style.color='white';"
                    onmouseout="this.style.background='${isPrimary ? '#2F4A2C' : 'white'}'; this.style.color='${isPrimary ? 'white' : '#2F4A2C'}';">
                        ${cat.name}
                    </button>
                `;
            });

            // Add "See all categories" button
            categoriesHTML += `
                <button class="btn-show-all" onclick="notfChatbot.showAllCategories()" style="
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: #f3f4f6;
                    border: 1.5px solid #d1d5db;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 0.875rem;
                    color: #6b7280;
                    font-weight: 500;
                    transition: all 0.2s ease;
                "
                onmouseover="this.style.background='#e5e7eb'; this.style.borderColor='#9ca3af';"
                onmouseout="this.style.background='#f3f4f6'; this.style.borderColor='#d1d5db';">
                    <i class="fa-solid fa-list"></i> See all categories
                </button>
            `;

            categoriesHTML += '</div>';
            this.addBotMessage(categoriesHTML);
        } else {
            // No matches found, show all categories
            this.showAllCategories();
        }

        this.state = 'complaint_category';
        this.disableInput();
    }

    confirmCategory(categoryId) {
        const category = this.complaintEngine.categories.find(c => c.id === categoryId);
        if (category) {
            this.formData.category_id = categoryId;
            this.addUserMessage(`✓ ${category.name}`);
            this.askForCity();
        }
    }

    showAllCategories() {
        const categories = this.complaintEngine.categories;

        // Group categories by department
        const grouped = {};
        categories.forEach(cat => {
            if (!grouped[cat.department]) {
                grouped[cat.department] = [];
            }
            grouped[cat.department].push(cat);
        });

        let categoriesHTML = '<p>Please select the category that best describes your issue:</p>';
        categoriesHTML += '<div class="category-chips-container" style="max-height: 350px; overflow-y: auto; padding: 0.5rem 0;">';

        Object.keys(grouped).sort().forEach(dept => {
            categoriesHTML += `
                <div class="department-group" style="margin-bottom: 1rem;">
                    <h4 style="font-size: 0.85rem; font-weight: 600; color: #666; margin: 0 0 0.5rem 0; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${dept}
                    </h4>
                    <div class="category-chips" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            `;

            grouped[dept].forEach(cat => {
                categoriesHTML += `
                    <button class="category-chip" onclick="notfChatbot.selectCategory('${cat.id}')" style="
                        display: inline-flex;
                        align-items: center;
                        padding: 0.5rem 1rem;
                        background: white;
                        border: 1.5px solid #2F4A2C;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 0.875rem;
                        color: #2F4A2C;
                        transition: all 0.2s ease;
                        white-space: nowrap;
                        font-weight: 500;
                    "
                    onmouseover="this.style.background='#2F4A2C'; this.style.color='white';"
                    onmouseout="this.style.background='white'; this.style.color='#2F4A2C';">
                        ${cat.name}
                    </button>
                `;
            });

            categoriesHTML += `
                    </div>
                </div>
            `;
        });

        categoriesHTML += '</div>';
        this.addBotMessage(categoriesHTML);
    }

    selectCategory(categoryId) {
        const category = this.complaintEngine.categories.find(c => c.id === categoryId);
        if (category) {
            this.formData.category_id = categoryId;
            this.addUserMessage(category.name);
            this.addBotMessage(`<p>✓ Category set to: <strong>${category.name}</strong></p>`);
            this.askForCity();
        }
    }

    extractLocationFromText(text) {
        const lowerText = text.toLowerCase();

        // City patterns - check for exact city mentions
        const cities = [
            'bengaluru', 'bangalore',
            'mumbai', 'bombay',
            'delhi', 'new delhi',
            'chennai', 'madras',
            'hyderabad',
            'pune',
            'kolkata', 'calcutta',
            'kochi', 'cochin',
            'ahmedabad',
            'jaipur',
            'gurugram', 'gurgaon',
            'bhubaneswar',
            'visakhapatnam', 'vizag', 'vishakhapatnam',
            'thane'
        ];

        // City name mapping to standardized names
        const cityMapping = {
            'bangalore': 'Bengaluru',
            'bengaluru': 'Bengaluru',
            'mumbai': 'Mumbai',
            'bombay': 'Mumbai',
            'delhi': 'Delhi',
            'new delhi': 'Delhi',
            'chennai': 'Chennai',
            'madras': 'Chennai',
            'hyderabad': 'Hyderabad',
            'pune': 'Pune',
            'kolkata': 'Kolkata',
            'calcutta': 'Kolkata',
            'kochi': 'Kochi',
            'cochin': 'Kochi',
            'ahmedabad': 'Ahmedabad',
            'jaipur': 'Jaipur',
            'gurugram': 'Gurugram',
            'gurgaon': 'Gurugram',
            'bhubaneswar': 'Bhubaneswar',
            'visakhapatnam': 'Visakhapatnam',
            'vizag': 'Visakhapatnam',
            'vishakhapatnam': 'Visakhapatnam',
            'thane': 'Thane'
        };

        let detectedCity = null;

        // Check for city mentions
        for (const city of cities) {
            const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
            if (cityRegex.test(lowerText)) {
                detectedCity = cityMapping[city];
                break;
            }
        }

        // Extract location patterns (street names, area names, landmarks)
        let detectedLocation = null;

        // Pattern 1: "on [location]" or "at [location]"
        const onAtPattern = /(?:on|at|near|in)\s+([A-Z][a-zA-Z\s]+(?:Road|Street|Avenue|Lane|Circle|Cross|Main|Layout|Nagar|Block|Sector|Ward|Area|Park|Garden|Market|Colony))/gi;
        const onAtMatch = text.match(onAtPattern);
        if (onAtMatch && onAtMatch.length > 0) {
            // Extract just the location part (remove "on", "at", etc.)
            detectedLocation = onAtMatch[0].replace(/^(?:on|at|near|in)\s+/i, '').trim();
        }

        // Pattern 2: Look for capitalized multi-word locations (e.g., "MG Road", "Indiranagar")
        if (!detectedLocation) {
            const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
            const matches = text.match(capitalizedPattern);
            if (matches && matches.length > 0) {
                // Filter out common words and city names
                const filteredMatches = matches.filter(m =>
                    !['The', 'I', 'A', 'An', 'There', 'This', 'That'].includes(m) &&
                    !cities.includes(m.toLowerCase())
                );
                if (filteredMatches.length > 0) {
                    detectedLocation = filteredMatches.slice(0, 2).join(', '); // Take first 2 matches
                }
            }
        }

        // Pattern 3: Common area/landmark patterns
        const landmarkPattern = /(?:near|behind|opposite|beside|next to)\s+([A-Z][a-zA-Z\s]+)/gi;
        const landmarkMatch = text.match(landmarkPattern);
        if (landmarkMatch && landmarkMatch.length > 0 && !detectedLocation) {
            detectedLocation = landmarkMatch[0].replace(/^(?:near|behind|opposite|beside|next to)\s+/i, '').trim();
        }

        return {
            city: detectedCity,
            location: detectedLocation
        };
    }

    askForCity() {
        // If we already detected a city, auto-select it
        if (this.formData.extractedCity) {
            this.addBotMessage(`
                <p>Using detected city: <strong>${this.formData.extractedCity}</strong></p>
                <p class="city-hint">💡 Not correct? Type a different city name</p>
            `);

            this.formData.city = this.formData.extractedCity;
            this.state = 'complaint_city_confirm';
            this.enableInput();

            // Auto-proceed to location after a delay, or wait for user correction
            setTimeout(() => {
                if (this.state === 'complaint_city_confirm') {
                    this.askForLocation();
                }
            }, 2000); // Give user 2 seconds to type correction

            return;
        }

        // No city detected, ask for it
        this.addBotMessage(`
            <div class="city-selection">
                <p><strong>Which city is this complaint for?</strong></p>
                <p>Select your city or type it:</p>
                <div class="city-buttons">
                    <button class="city-btn" onclick="notfChatbot.selectCity('Bengaluru')">Bengaluru</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Mumbai')">Mumbai</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Delhi')">Delhi</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Chennai')">Chennai</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Hyderabad')">Hyderabad</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Pune')">Pune</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Kolkata')">Kolkata</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Kochi')">Kochi</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Ahmedabad')">Ahmedabad</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Jaipur')">Jaipur</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Gurugram')">Gurugram</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Bhubaneswar')">Bhubaneswar</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Visakhapatnam')">Visakhapatnam</button>
                    <button class="city-btn" onclick="notfChatbot.selectCity('Thane')">Thane</button>
                </div>
                <p class="city-hint">💡 Or type your city name</p>
            </div>
        `);

        this.state = 'complaint_city';
        this.enableInput();
    }

    selectCity(city) {
        // Called when user clicks a city button
        this.formData.city = city;
        this.addUserMessage(city);
        this.askForLocation();
    }

    handleComplaintCity(message) {
        // User typed a city name
        const city = message.trim();

        if (city.length < 3) {
            this.addBotMessage('Please provide a valid city name.');
            return;
        }

        this.formData.city = city;
        this.askForLocation();
    }

    askForLocation() {
        // If we already detected a location, pre-fill it
        if (this.formData.extractedLocation) {
            this.addBotMessage(`
                <p>I detected the location: <strong>${this.formData.extractedLocation}</strong></p>
                <p>Is this correct? Press Enter to confirm, or type the correct location in <strong>${this.formData.city}</strong>.</p>
                <p class="city-hint">💡 You can also click "Use Map" or "Use My Location"</p>
                <div class="location-options">
                    <button class="btn-location-map" onclick="notfChatbot.showMapModal()"><i class="fa-solid fa-location-dot"></i> Use Map</button>
                    <button class="btn-location-gps" onclick="notfChatbot.useGPS()">🧭 Use My Location</button>
                    <button class="btn-confirm-detected" onclick="notfChatbot.confirmDetectedLocation()">✓ Confirm "${this.formData.extractedLocation}"</button>
                </div>
            `);

            this.state = 'complaint_location';
            this.enableInput();

            return;
        }

        // No location detected, ask for it
        this.addBotMessage(`
            <p>Great! Now, please provide the location in <strong>${this.formData.city}</strong> where this issue is occurring.</p>
            <p>You can:</p>
            <ul>
                <li>Type the street/area name (e.g., "MG Road, Indiranagar")</li>
                <li>Click "Use Map" to select on a map</li>
                <li>Click "Use My Location" for GPS</li>
            </ul>
            <div class="location-options">
                <button class="btn-location-map" onclick="notfChatbot.showMapModal()"><i class="fa-solid fa-location-dot"></i> Use Map</button>
                <button class="btn-location-gps" onclick="notfChatbot.useGPS()">🧭 Use My Location</button>
            </div>
        `);

        this.state = 'complaint_location';
        this.enableInput();
    }

    confirmDetectedLocation() {
        // User clicked "Confirm" button for detected location
        this.addUserMessage(`✓ ${this.formData.extractedLocation}`);
        this.handleComplaintLocation(this.formData.extractedLocation);
    }

    async handleComplaintLocation(message) {
        this.disableInput();
        this.addBotMessage('<i class="fa-solid fa-hourglass-half"></i> Verifying your location...');

        try {
            // Geocode the address with city context
            const geocoded = await this.geocodeAddress(message, this.formData.city);

            if (!geocoded.success) {
                this.addBotMessage(`
                    <p><i class="fa-solid fa-circle-xmark"></i> ${geocoded.message}</p>
                    <p>Please try again with a more specific address in ${this.formData.city} (include area, landmark).</p>
                `);
                this.enableInput();
                return;
            }

            // Validate against boundaries
            const validation = await this.boundaryValidator.validateLocation(
                geocoded.lat,
                geocoded.lng,
                geocoded.city
            );

            if (!validation.valid) {
                this.showBoundaryValidationError(validation);
                this.enableInput();
                return;
            }

            // Location is valid!
            this.formData.address = message;
            this.formData.latitude = geocoded.lat;
            this.formData.longitude = geocoded.lng;
            this.formData.corporation_id = validation.corporation_code;
            this.formData.locationTag = validation;

            this.addBotMessage(`
                <div class="location-verified">
                    <p><i class="fa-solid fa-circle-check"></i> <strong>Location Verified!</strong></p>
                    <p><i class="fa-solid fa-location-dot"></i> ${message}</p>
                    <p><i class="fa-solid fa-building"></i> ${validation.corporation_name}</p>
                    ${validation.ward ? `<p>🗺️ Ward: ${validation.ward}</p>` : ''}
                    <p class="success-message">Your complaint will be routed to ${validation.corporation_name}</p>
                </div>
            `);

            this.askForContact();

        } catch (error) {
            console.error('Location validation error:', error);
            this.addBotMessage(`
                <p><i class="fa-solid fa-circle-xmark"></i> Unable to verify location. Please try again.</p>
                <p>You can also use the map picker or GPS option above.</p>
            `);
            this.enableInput();
        }
    }

    showBoundaryValidationError(validation) {
        this.addBotMessage(`
            <div class="boundary-error">
                <p>⚠️ <strong>Location Validation Error</strong></p>
                <p>${validation.message}</p>
                ${validation.nearest_city ? `
                    <p>Nearest supported city: <strong>${validation.nearest_city.name}</strong> (${validation.nearest_city.distance}km away)</p>
                ` : ''}
                <div class="recovery-options">
                    <p>What would you like to do?</p>
                    <button onclick="notfChatbot.retryLocation()">Try Different Address</button>
                    <button onclick="notfChatbot.showMapModal()">Use Map Picker</button>
                    <button onclick="notfChatbot.viewCoverageMap()">View Coverage Areas</button>
                </div>
            </div>
        `);
    }

    askForContact() {
        this.addBotMessage(`
            <p>Please provide your contact information (phone number or email).</p>
            <p>This helps the authorities reach you for updates.</p>
            <p class="tip">💡 You can provide either phone or email (or both)</p>
        `);

        this.state = 'complaint_contact';
        this.enableInput();
    }

    handleComplaintContact(message) {
        const phoneRegex = /^[6-9]\d{9}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        const hasPhone = phoneRegex.test(message.replace(/\s+/g, ''));
        const hasEmail = emailRegex.test(message);

        if (!hasPhone && !hasEmail) {
            this.addBotMessage(`
                <p>Please provide a valid phone number (10 digits starting with 6-9) or email address.</p>
                <p>Example phone: 9876543210</p>
                <p>Example email: name@example.com</p>
            `);
            return;
        }

        if (hasPhone) {
            this.formData.citizen_phone = message.replace(/\s+/g, '');
        }
        if (hasEmail) {
            this.formData.citizen_email = message;
        }

        this.addBotMessage(`
            <p>Thank you! Would you like to provide your name?</p>
            <p class="tip">💡 You can skip this if you prefer to remain anonymous. Just type "skip".</p>
        `);

        this.state = 'complaint_name';
    }

    handleComplaintName(message) {
        if (message.toLowerCase() !== 'skip') {
            this.formData.citizen_name = message;
        }

        this.askForPhoto();
    }

    askForPhoto() {
        this.addBotMessage(`
            <p>Would you like to add a photo to your complaint?</p>
            <p class="tip">💡 Photos help authorities better understand the issue</p>
            <p class="tip">📸 Max size: 2MB | Formats: JPG, PNG, HEIC, HEIF</p>
            <div class="photo-upload-container">
                <input type="file" id="complaint-photo-input" accept="image/jpeg,image/jpg,image/png,image/heic,image/heif" style="display: none;" onchange="notfChatbot.handlePhotoSelect(event)">
                <button class="btn-secondary" onclick="document.getElementById('complaint-photo-input').click()">
                    <i class="fa-solid fa-camera"></i> Choose Photo
                </button>
                <button class="btn-secondary" onclick="notfChatbot.skipPhoto()">
                    Skip
                </button>
            </div>
        `);

        this.state = 'complaint_photo';
        this.disableInput();
    }

    handlePhotoSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate photo
        const validation = this.complaintEngine.validatePhoto(file);

        if (!validation.valid) {
            this.addBotMessage(`
                <p class="error">✗ ${validation.error}</p>
                <p>Please try again with a different photo.</p>
            `);
            // Reset file input
            event.target.value = '';
            return;
        }

        // Sanitize filename - replace spaces with hyphens for Supabase storage
        const sanitizedName = file.name.replace(/\s+/g, '-');
        const sanitizedFile = new File([file], sanitizedName, { type: file.type });

        // Store file for upload
        this.formData.photo = sanitizedFile;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            this.addBotMessage(`
                <p style="display: flex; align-items: center; gap: 0.5rem; color: #059669;">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>Photo uploaded successfully!</span>
                </p>
                <div class="photo-preview">
                    <img src="${e.target.result}" alt="Complaint photo" style="max-width: 300px; max-height: 300px; border-radius: 8px; margin-top: 0.5rem;">
                    <p class="file-info">${sanitizedFile.name} (${(sanitizedFile.size / 1024).toFixed(1)} KB)</p>
                </div>
                <button class="btn-secondary" onclick="notfChatbot.removePhoto()">
                    <i class="fa-solid fa-trash"></i> Remove Photo
                </button>
            `);
            this.showComplaintReview();
        };
        reader.readAsDataURL(file);
    }

    removePhoto() {
        this.formData.photo = null;
        this.addBotMessage('<p>Photo removed. You can upload a different photo or continue without one.</p>');
        this.askForPhoto();
    }

    skipPhoto() {
        this.formData.photo = null;
        this.addBotMessage('<p>No problem! Continuing without a photo.</p>');
        this.showComplaintReview();
    }

    showComplaintReview() {
        // Generate photo preview HTML if photo exists
        let photoPreviewHTML = '';
        if (this.formData.photo) {
            const photoURL = URL.createObjectURL(this.formData.photo);
            photoPreviewHTML = `
                <div style="margin-top: 1rem;">
                    <strong>Photo:</strong>
                    <div class="photo-preview" style="margin-top: 0.5rem;">
                        <img src="${photoURL}" alt="Complaint photo" style="max-width: 250px; max-height: 250px; border-radius: 8px;">
                        <p class="file-info" style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">
                            ${this.formData.photo.name} (${(this.formData.photo.size / 1024).toFixed(1)} KB)
                        </p>
                    </div>
                </div>
            `;
        }

        this.addBotMessage(`
            <div class="complaint-review">
                <h4>📋 Complaint Summary</h4>
                <div class="review-details">
                    <p><strong>Issue:</strong> ${this.formData.description}</p>
                    <p><strong>Location:</strong> ${this.formData.address}</p>
                    <p><strong>Corporation:</strong> ${this.formData.locationTag.corporation_name}</p>
                    ${this.formData.locationTag.ward ? `<p><strong>Ward:</strong> ${this.formData.locationTag.ward}</p>` : ''}
                    <p><strong>Contact:</strong> ${this.formData.citizen_phone || this.formData.citizen_email}</p>
                    ${this.formData.citizen_name ? `<p><strong>Name:</strong> ${this.formData.citizen_name}</p>` : '<p><em>Anonymous</em></p>'}
                    ${photoPreviewHTML}
                </div>
                <div class="review-actions">
                    <button class="btn-submit-complaint" onclick="notfChatbot.submitComplaint()">Submit Complaint</button>
                    <button class="btn-edit" onclick="notfChatbot.editComplaint()">Edit</button>
                </div>
            </div>
        `);

        this.state = 'complaint_review';
        this.disableInput();
    }

    async submitComplaint() {
        this.addBotMessage('<i class="fa-solid fa-hourglass-half"></i> Submitting your complaint...');

        try {
            // Initialize API client if not already done
            if (!this.apiClient) {
                this.apiClient = new NotfCmsApi();
            }

            // Debug: Log formData
            console.log('[Chatbot] formData before submission:', {
                description: this.formData.description,
                category_id: this.formData.category_id,
                citizen_phone: this.formData.citizen_phone,
                citizen_email: this.formData.citizen_email,
                citizen_name: this.formData.citizen_name,
                address: this.formData.address,
                latitude: this.formData.latitude,
                longitude: this.formData.longitude
            });

            // Prepare complaint data using ComplaintEngine
            const complaintData = this.complaintEngine.prepareComplaintData({
                description: this.formData.description,
                category_id: this.formData.category_id,

                // Location data (with auto-tagging from boundary validation)
                address: this.formData.address,
                latitude: this.formData.latitude,
                longitude: this.formData.longitude,
                city: this.formData.locationTag?.city || this.formData.city,
                corporation_code: this.formData.locationTag?.corporation_code,
                corporation_id: this.formData.locationTag?.corporation_id,
                ward: this.formData.locationTag?.ward,
                wardNumber: this.formData.locationTag?.wardNumber,

                // Contact
                phone: this.formData.citizen_phone,
                email: this.formData.citizen_email,
                name: this.formData.citizen_name,

                // Photo
                photo: this.formData.photo,

                // Metadata
                metadata: {
                    auto_tagged: this.formData.locationTag?.metadata?.auto_tagged || false,
                    boundary_match: this.formData.locationTag?.metadata?.boundary_match || false,
                    session_id: this.sessionId
                }
            });

            // Validate before submission
            const validation = this.complaintEngine.validateComplaintData(complaintData);

            if (!validation.valid) {
                throw new Error('Validation failed: ' + validation.errors.join(', '));
            }

            // Submit to notf-cms API
            const result = await this.apiClient.submitComplaint(complaintData);

            if (result.success) {
                this.showComplaintSuccess(result);
            } else {
                throw new Error(result.message || result.error || 'Submission failed');
            }

        } catch (error) {
            console.error('Complaint submission error:', error);
            this.addBotMessage(`
                <div class="error-message">
                    <p><i class="fa-solid fa-circle-xmark"></i> Failed to submit complaint: ${error.message}</p>
                    <p>Please try again or contact support.</p>
                    <button onclick="notfChatbot.submitComplaint()">Retry</button>
                </div>
            `);
        }
    }

    showComplaintSuccess(result) {
        const trackingUrl = result.tracking_url || `https://notf-cms.vercel.app/track/${result.complaint_number}`;

        this.addBotMessage(`
            <div class="complaint-success">
                <h4><i class="fa-solid fa-circle-check"></i> Complaint Filed Successfully!</h4>
                <div class="ticket-info">
                    <p class="ticket-number">Ticket Number: <strong>${result.complaint_number}</strong></p>
                    <p><i class="fa-solid fa-building"></i> Corporation: ${this.formData.locationTag?.corporation_name || this.formData.locationTag?.city + ' Municipal Corporation'}</p>
                    ${this.formData.locationTag?.ward ? `<p><i class="fa-solid fa-map-pin"></i> Ward: ${this.formData.locationTag.ward}</p>` : ''}
                    <p><i class="fa-solid fa-circle"></i> Status: <span class="status-badge new">New</span></p>
                </div>
                <p class="next-steps">You will receive updates on your complaint via ${this.formData.citizen_phone ? 'phone' : 'email'}.</p>
                <p class="tracking-info">
                    <i class="fa-solid fa-link"></i> Track your complaint:
                    <a href="${trackingUrl}" target="_blank">${result.complaint_number}</a>
                </p>
                <div class="success-actions">
                    <button onclick="notfChatbot.fileAnotherComplaint()">File Another Complaint</button>
                    <button onclick="notfChatbot.closeChatbot()">Close</button>
                </div>
            </div>
        `);

        this.state = 'complaint_submitted';

        // Clear form data
        this.formData = {};
        this.saveSession();
    }
    async geocodeAddress(address, city = null) {
        try {
            // Combine address with city for better geocoding
            const fullAddress = city ? `${address}, ${city}, India` : address;

            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullAddress)}&format=json&limit=1&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'NOTF-Chatbot/1.0 (https://notf-one.vercel.app; chatbot@notf.in)'
                    }
                }
            );

            if (!response.ok) {
                console.error('Geocoding API error:', response.status, response.statusText);
                return {
                    success: false,
                    message: 'Geocoding service is temporarily unavailable. Please try again in a moment.'
                };
            }

            const results = await response.json();

            if (results.length === 0) {
                return {
                    success: false,
                    message: 'Could not find this address. Please try adding more details (area, landmark, city).'
                };
            }

            // Extract city from display name or address components
            const detectedCity = this.extractCityFromAddress(results[0].display_name, results[0].address);

            return {
                success: true,
                lat: parseFloat(results[0].lat),
                lng: parseFloat(results[0].lon),
                display_name: results[0].display_name,
                city: city || detectedCity  // Use provided city or detected city
            };
        } catch (error) {
            console.error('Geocoding error:', error);
            return {
                success: false,
                message: 'Unable to verify address. Please check your internet connection and try again.'
            };
        }
    }

    extractCityFromAddress(displayName, addressComponents) {
        const knownCities = ['Bengaluru', 'Mumbai', 'Chennai', 'Ahmedabad', 'Hyderabad',
                             'Kolkata', 'Pune', 'Kochi', 'Jaipur', 'Gurugram', 'Thane',
                             'Bhubaneswar', 'Visakhapatnam'];

        // First try address components if available
        if (addressComponents) {
            // Try city, town, municipality fields
            const cityField = addressComponents.city || addressComponents.town ||
                             addressComponents.municipality || addressComponents.state_district;

            if (cityField) {
                for (const city of knownCities) {
                    if (cityField.toLowerCase().includes(city.toLowerCase()) ||
                        city.toLowerCase().includes(cityField.toLowerCase())) {
                        return city;
                    }
                }
            }
        }

        // Fallback to parsing display name
        const parts = displayName.split(',').map(p => p.trim());
        for (const part of parts) {
            for (const city of knownCities) {
                if (part.toLowerCase().includes(city.toLowerCase())) {
                    return city;
                }
            }
        }

        return null;
    }
    fileAnotherComplaint() {
        this.formData = {};
        this.initializeComplaintMode();
    }

    retryLocation() {
        this.state = 'complaint_location';
        this.addBotMessage('Please provide the location again.');
        this.enableInput();
    }

    openMapPicker() {
        this.addBotMessage(`
            <div class="map-picker-instructions">
                <p><i class="fa-solid fa-info-circle"></i> <strong>Map Picker:</strong></p>
                <ol>
                    <li>Click "Open Map" below</li>
                    <li>Click on the map where the issue is located</li>
                    <li>Click "Use This Location" to confirm</li>
                </ol>
                <button class="btn-open-map" onclick="notfChatbot.showMapModal()"><i class="fa-solid fa-map"></i> Open Map</button>
            </div>
        `);
    }

    getCityCoordinates(city) {
        const cityCoords = {
            'Bengaluru': [12.9716, 77.5946],
            'Mumbai': [19.0760, 72.8777],
            'Delhi': [28.6139, 77.2090],
            'Chennai': [13.0827, 80.2707],
            'Hyderabad': [17.3850, 78.4867],
            'Pune': [18.5204, 73.8567],
            'Kolkata': [22.5726, 88.3639],
            'Kochi': [9.9312, 76.2673],
            'Ahmedabad': [23.0225, 72.5714],
            'Jaipur': [26.9124, 75.7873],
            'Gurugram': [28.4595, 77.0266],
            'Bhubaneswar': [20.2961, 85.8245],
            'Visakhapatnam': [17.6868, 83.2185],
            'Thane': [19.2183, 72.9781]
        };

        return cityCoords[city] || [20.5937, 78.9629]; // Default to center of India
    }

    showMapModal() {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'map-picker-modal';
        modal.className = 'map-modal';

        const selectedCity = this.formData.city || 'Bengaluru';

        modal.innerHTML = `
            <div class="map-modal-content">
                <div class="map-modal-header">
                    <h3><i class="fa-solid fa-map-marker-alt"></i> Select Location in ${selectedCity}</h3>
                    <button class="map-modal-close" onclick="notfChatbot.closeMapModal()">&times;</button>
                </div>
                <div class="map-instructions" style="padding: 0.75rem 1rem; background: #f0f9ff; border-bottom: 1px solid #e0f2fe; font-size: 0.9rem;">
                    <p style="margin: 0; color: #0369a1;"><i class="fa-solid fa-info-circle"></i> <strong>How to use:</strong> Click on the map where the issue is located, then click "Use This Location"</p>
                </div>
                <div id="map-picker" style="height: 400px; width: 100%;"></div>
                <div class="map-modal-footer">
                    <p id="selected-coords">Click on the map to select a location</p>
                    <button class="btn-confirm-location" onclick="notfChatbot.confirmMapLocation()" disabled>Use This Location</button>
                    <button class="btn-cancel" onclick="notfChatbot.closeMapModal()">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Initialize Leaflet map with city-specific center
        setTimeout(() => {
            const cityCoords = this.getCityCoordinates(selectedCity);
            const map = L.map('map-picker').setView(cityCoords, 12);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(map);

            let marker;
            this.selectedLocation = null;

            map.on('click', (e) => {
                const { lat, lng } = e.latlng;

                // Remove old marker
                if (marker) {
                    map.removeLayer(marker);
                }

                // Add new marker
                marker = L.marker([lat, lng]).addTo(map);

                // Store location
                this.selectedLocation = { lat, lng };

                // Update UI
                document.getElementById('selected-coords').textContent =
                    `Selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                document.querySelector('.btn-confirm-location').disabled = false;
            });

            this.mapPickerInstance = map;
        }, 100);
    }

    closeMapModal() {
        const modal = document.getElementById('map-picker-modal');
        if (modal) {
            modal.remove();
        }
        if (this.mapPickerInstance) {
            this.mapPickerInstance.remove();
            this.mapPickerInstance = null;
        }
    }

    async confirmMapLocation() {
        if (!this.selectedLocation) {
            return;
        }

        this.closeMapModal();

        const { lat, lng } = this.selectedLocation;

        this.addBotMessage('<i class="fa-solid fa-hourglass-half"></i> Verifying your location...');
        this.disableInput();

        try {
            // Reverse geocode to get address
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
                {
                    headers: {
                        'User-Agent': 'NOTF-Chatbot/1.0 (https://notf-one.vercel.app; chatbot@notf.in)'
                    }
                }
            );
            const result = await response.json();

            const address = result.display_name || `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            const city = this.extractCityFromAddress(result.display_name, result.address);

            // Validate against boundaries
            const validation = await this.boundaryValidator.validateLocation(lat, lng, city);

            if (!validation.valid) {
                this.showBoundaryValidationError(validation);
                this.enableInput();
                return;
            }

            // Location is valid!
            this.formData.address = address;
            this.formData.latitude = lat;
            this.formData.longitude = lng;
            this.formData.corporation_id = validation.corporation_code;
            this.formData.locationTag = validation;

            this.addBotMessage(`
                <div class="location-verified">
                    <p><i class="fa-solid fa-circle-check"></i> <strong>Location Verified!</strong></p>
                    <p><i class="fa-solid fa-location-dot"></i> ${address}</p>
                    <p><i class="fa-solid fa-building"></i> ${validation.corporation_name}</p>
                    ${validation.ward ? `<p>🗺️ Ward: ${validation.ward}</p>` : ''}
                    <p class="success-message">Your complaint will be routed to ${validation.corporation_name}</p>
                </div>
            `);

            this.askForContact();

        } catch (error) {
            console.error('Map location error:', error);
            this.addBotMessage('Unable to verify location. Please try typing the address instead.');
            this.enableInput();
        }
    }

    useGPS() {
        if (!navigator.geolocation) {
            this.addBotMessage('GPS is not available on your device. Please type your address instead.');
            return;
        }

        this.addBotMessage('<i class="fa-solid fa-location-dot"></i> Getting your location...');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // Reverse geocode to get address
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
                        {
                            headers: {
                                'User-Agent': 'NOTF-Chatbot/1.0 (https://notf-one.vercel.app; chatbot@notf.in)'
                            }
                        }
                    );
                    const result = await response.json();

                    const city = this.formData.city || this.extractCityFromAddress(result.display_name, result.address);

                    // Validate location
                    const validation = await this.boundaryValidator.validateLocation(lat, lng, city);

                    if (!validation.valid) {
                        this.showBoundaryValidationError(validation);
                        return;
                    }

                    // Location is valid!
                    this.formData.address = result.display_name;
                    this.formData.latitude = lat;
                    this.formData.longitude = lng;
                    this.formData.corporation_id = validation.corporation_code;
                    this.formData.locationTag = validation;

                    this.addBotMessage(`
                        <div class="location-verified">
                            <p><i class="fa-solid fa-circle-check"></i> <strong>Location Detected!</strong></p>
                            <p><i class="fa-solid fa-location-dot"></i> ${result.display_name}</p>
                            <p><i class="fa-solid fa-building"></i> ${validation.corporation_name}</p>
                        </div>
                    `);

                    this.askForContact();

                } catch (error) {
                    this.addBotMessage('Failed to get address from GPS. Please type your address instead.');
                }
            },
            (error) => {
                this.addBotMessage('Unable to access GPS. Please type your address instead.');
            }
        );
    }

    viewCoverageMap() {
        // Show supported cities and their boundaries
        this.addBotMessage(`
            <div class="coverage-map">
                <h4>🗺️ Our Service Areas</h4>
                <p>We currently support complaints from these cities:</p>
                <ul class="city-list">
                    <li>Bengaluru (5 corporations)</li>
                    <li>Mumbai</li>
                    <li>Chennai</li>
                    <li>Ahmedabad</li>
                    <li>Hyderabad</li>
                    <li>Kolkata</li>
                    <li>Pune</li>
                    <li>Jaipur</li>
                    <li>Gurugram</li>
                    <li>Thane</li>
                    <li>Bhubaneswar</li>
                    <li>Visakhapatnam</li>
                </ul>
                <p>Please ensure your location is within one of these cities.</p>
            </div>
        `);
    }

    editComplaint() {
        this.addBotMessage('Which part would you like to edit?');
        this.addBotMessage(`
            <div class="edit-options">
                <button onclick="notfChatbot.editDescription()">Edit Description</button>
                <button onclick="notfChatbot.editLocation()">Edit Location</button>
                <button onclick="notfChatbot.editContact()">Edit Contact</button>
            </div>
        `);
    }

    editDescription() {
        this.state = 'complaint_description';
        this.addBotMessage('Please provide the updated description:');
        this.enableInput();
    }

    editLocation() {
        this.state = 'complaint_location';
        this.addBotMessage('Please provide the updated location:');
        this.enableInput();
    }

    editContact() {
        this.state = 'complaint_contact';
        this.addBotMessage('Please provide your updated contact information:');
        this.enableInput();
    }
    }
    window.NotfComplaintMixin = NotfComplaintMixin;
})();

