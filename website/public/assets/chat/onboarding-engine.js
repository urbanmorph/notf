/**
 * NOTF Onboarding Engine
 * Conversational flow for joining the NOTF network
 * Steps: type -> name -> city -> themes -> description -> contact -> submit
 */

class OnboardingEngine {
    constructor() {
        this.steps = ['type', 'name', 'city', 'neighborhood', 'themes', 'description', 'offersAsks', 'email', 'phone', 'contactPerson', 'confirm'];
        this.currentStep = 0;
        this.data = {};
        this.supabase = null;
        this._waitingForOtherCity = false;
    }

    async init(supabaseClient) {
        this.supabase = supabaseClient;
    }

    getWelcomeMessage() {
        return {
            text: "I can help you join the NOTF network! Are you a...",
            buttons: [
                { label: "Community / Neighbourhood Group", value: "community" },
                { label: "Solution Provider / Expert", value: "organization" }
            ]
        };
    }

    async handleInput(input) {
        const currentStepName = this.steps[this.currentStep];

        switch (currentStepName) {
            case 'type':
                this.data.type = input;
                this.currentStep++;
                return {
                    text: "What's your community/organisation called?",
                    inputType: "text"
                };

            case 'name':
                this.data.name = input;
                this.currentStep++;
                // Show top 4 cities as quick buttons, plus "Other city" for the rest
                const topCities = ['Bengaluru', 'Mumbai', 'Dehradun', 'Chennai'];
                const cityButtons = topCities.map(c => ({ label: c, value: c }));
                cityButtons.push({ label: "Other city", value: "_other" });
                return {
                    text: "Where are you based?",
                    buttons: cityButtons
                };

            case 'city':
                if (input === '_other') {
                    this._waitingForOtherCity = true;
                    return {
                        text: "Which city are you in?",
                        inputType: "text",
                        stayOnStep: true
                    };
                }
                if (this._waitingForOtherCity) {
                    this._waitingForOtherCity = false;
                }
                this.data.city = input;
                this.currentStep++;
                // Neighbourhood is only asked for communities — skip for
                // solution providers and go straight to themes.
                if (this.data.type !== 'community') {
                    this.currentStep++; // skip 'neighborhood'
                    return {
                        text: "What topics does your organisation focus on? (pick all that apply)",
                        checkboxes: THEME_CATEGORIES.map(t => ({ label: t, value: t }))
                    };
                }
                return {
                    text: `Which neighbourhood or area in ${input}?`,
                    inputType: "text"
                };

            case 'neighborhood':
                this.data.neighborhood = input;
                this.currentStep++;
                return {
                    text: "What topics does your community focus on? (pick all that apply)",
                    checkboxes: THEME_CATEGORIES.map(t => ({ label: t, value: t }))
                };

            case 'themes':
                const selectedThemes = Array.isArray(input) ? input : [input];
                if (selectedThemes.length === 0) {
                    return {
                        text: "Please select at least one focus area.",
                        stayOnStep: true
                    };
                }
                this.data.themes = selectedThemes;
                this.currentStep++;
                return {
                    text: "In one line, describe what your community does:",
                    inputType: "text"
                };

            case 'description':
                this.data.description = input;
                this.currentStep++;
                return {
                    text: "What can you offer to the network, and what do you need? (optional — type \"skip\" to continue)",
                    inputType: "text"
                };

            case 'offersAsks':
                if (input.toLowerCase() !== 'skip' && input.trim()) {
                    // Simple heuristic: split on "need" / "ask" / "looking for"
                    // to separate offers from asks, else store everything as offers.
                    const lower = input.toLowerCase();
                    const needIdx = lower.search(/\b(need|ask|looking for|require)\b/);
                    if (needIdx > 0) {
                        this.data.offers = input.substring(0, needIdx).trim();
                        this.data.asks = input.substring(needIdx).trim();
                    } else {
                        this.data.offers = input.trim();
                    }
                }
                this.currentStep++;
                return {
                    text: "Almost done! What's your email address?",
                    inputType: "email"
                };

            case 'email':
                // Basic email validation
                if (!isValidEmail(input)) {
                    return {
                        text: "Please provide a valid email address (e.g. name@example.com).",
                        inputType: "email",
                        stayOnStep: true
                    };
                }
                this.data.email = input;
                this.currentStep++;
                return {
                    text: "Phone number? (optional — type \"skip\" to continue)",
                    inputType: "text"
                };

            case 'phone':
                if (input.toLowerCase() !== 'skip' && input.trim()) {
                    this.data.phone = input.trim();
                }
                this.currentStep++;
                return {
                    text: "And who should we reach out to? (contact person's name)",
                    inputType: "text"
                };

            case 'contactPerson':
                const cp = (input || '').trim();
                if (cp.length < 2) {
                    return {
                        text: "Please share a name we can address you by (at least 2 characters).",
                        inputType: "text",
                        stayOnStep: true
                    };
                }
                this.data.contactPerson = cp;
                this.currentStep++;
                return await this.submit();

            case 'confirm':
                return {
                    text: "Your application has already been submitted!",
                    done: true
                };

            default:
                return {
                    text: "Something went wrong. Please try again.",
                    done: true
                };
        }
    }

    async submit() {
        const refNum = generateRefNumber();

        const record = buildJoinRecord({
            type: this.data.type,
            name: this.data.name,
            city: this.data.city,
            neighborhood: this.data.neighborhood || null,
            description: this.data.description,
            themes: this.data.themes,
            contactPerson: this.data.contactPerson,
            email: this.data.email,
            phone: this.data.phone || null,
            offers: this.data.offers || null,
            asks: this.data.asks || null,
            source: 'chatbot'
        });

        try {
            // Recover the client if it wasn't ready when onboarding started.
            if (!this.supabase && typeof dataLoader !== 'undefined' && dataLoader.getSupabaseClient) {
                this.supabase = dataLoader.getSupabaseClient();
            }
            // Never report success without an actual insert (previously a missing
            // client silently skipped the insert but still confirmed "submitted").
            if (!this.supabase) {
                throw new Error('No connection to the server.');
            }

            // Insert with collision-safe slug retry (file_path is UNIQUE).
            const { error } = await insertJoinRecord(this.supabase, record);
            if (error) throw error;

            return {
                text: `Your application for "${this.data.name}" has been submitted!\n\nReference: ${refNum}\nWe'll review it within 3 working days.`,
                buttons: [
                    { label: "Browse communities near you", value: "_link:/communities/" },
                    { label: "Explore project catalogue", value: "_link:/catalog/" }
                ],
                done: true
            };
        } catch (err) {
            console.error('Onboarding submission error:', err);
            return {
                text: "Something went wrong submitting your application. Please try again or use the join form at /join/.",
                done: true
            };
        }
    }

    reset() {
        this.currentStep = 0;
        this.data = {};
        this._waitingForOtherCity = false;
    }
}
