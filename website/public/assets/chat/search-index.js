/**
 * Search for the chatbot's "Find communities": a small keyword index over
 * communities and providers, ranked by BM25 (how often a word appears in a
 * record, weighed by how rare it is across all records).
 *
 * - Everyday words and core words in the site's other languages map to the
 *   English words the data uses (CONCEPTS): "footpath" finds mobility work,
 *   "कचरा" finds waste work.
 * - Plurals and small typos are forgiven ("Malleswaram" finds Malleshwaram).
 * - "Need funding" looks at what records offer; "we offer space" at what they ask.
 * - Weak matches are dropped instead of padding the list.
 *
 * No models or downloads: it indexes ~100 records in a few milliseconds.
 */

const SEARCH_STOP_WORDS = new Set((
    'a an the and or of for to in on at by with from about into is are was be been our my me we us i ' +
    'you your who what which where how can could would should will please find search show looking look ' +
    'want wants need needs help get any some all near nearby around people person group groups ' +
    'community communities organisation organisations organization organizations provider providers ' +
    'working work works there here this that these those do does start started'
).split(' '));

// Words that mark a resource someone can give or need. In a "need" question
// these only match what records offer; in an "offer" question, what they ask for.
const RESOURCE_CONCEPTS = new Set(['funding', 'volunteers', 'space', 'expertise']);
const NEED_WORDS = /\b(need|needs|want|wants|looking for|require|seeking|get)\b|चाहिए|ಬೇಕು|தேவை|కావాలి|જોઈએ|দরকার|വേണം|ଦରକାର|چاہیے/i;
const OFFER_WORDS = /\b(offer|offering|can give|donate|provide|providing)\b/i;

// Each concept lists English words (as in the data) and words people type in
// the site's other languages. Indic words are stems, matched as prefixes, so
// inflected forms (पेड़ों, மரங்கள்) still match; two-letter stems match whole words.
const CONCEPTS = {
    waste: ['waste', 'garbage', 'trash', 'rubbish', 'litter', 'compost', 'segregation', 'recycle', 'recycling', 'swm',
        'कचर', 'कूड़', 'ಕಸ', 'ತ್ಯಾಜ್ಯ', 'குப்பை', 'கழிவு', 'చెత్త', 'వ్యర్థ', 'કચર', 'আবর্জনা', 'ময়লা', 'বর্জ্য',
        'മാലിന്യ', 'ଆବର୍ଜନା', 'ଅଳିଆ', 'کچر', 'کوڑ'],
    water: ['water', 'rainwater', 'groundwater', 'borewell', 'stormwater', 'drain', 'flood', 'rwh',
        'पानी', 'जल', 'ನೀರು', 'தண்ணீர்', 'நீர்', 'నీరు', 'నీళ్ళ', 'પાણી', 'জল', 'পানি', 'വെള്ള', 'ജല', 'ପାଣି', 'ଜଳ', 'پانی'],
    lake: ['lake', 'tank', 'wetland', 'pond', 'river',
        'झील', 'तालाब', 'नदी', 'ಕೆರೆ', 'ನದಿ', 'ஏரி', 'குளம்', 'ஆறு', 'చెరువ', 'సరస్స', 'నది', 'તળાવ', 'નદી',
        'পুকুর', 'ঝিল', 'নদী', 'തടാക', 'കുളം', 'പുഴ', 'ପୋଖରୀ', 'ହ୍ରଦ', 'ନଦୀ', 'جھیل', 'تالاب', 'دریا'],
    trees: ['tree', 'plant', 'plantation', 'sapling', 'green', 'greenery', 'garden', 'park', 'forest', 'nursery',
        'biodiversity', 'nature',
        'पेड़', 'पेड', 'वृक्ष', 'पौध', 'हरियाल', 'बगीच', 'झाड', 'ಮರ', 'ಮರಗಳ', 'ಗಿಡ', 'ಹಸಿರು', 'ಉದ್ಯಾನ', 'மரம்', 'மரங்',
        'செடி', 'பசுமை', 'பூங்கா', 'చెట్ట', 'చెట్ల', 'మొక్క', 'పచ్చదన', 'વૃક્ષ', 'ઝાડ', 'છોડ', 'গাছ', 'বৃক্ষ', 'সবুজ',
        'বাগান', 'മരം', 'മരങ്ങ', 'ചെടി', 'പച്ചപ്പ', 'ଗଛ', 'ବୃକ୍ଷ', 'ଉଦ୍ୟାନ', 'درخت', 'پود', 'ہریال', 'باغ'],
    mobility: ['mobility', 'walk', 'walking', 'walkability', 'footpath', 'pavement', 'sidewalk', 'pedestrian', 'cycle',
        'cycling', 'bicycle', 'traffic', 'transport', 'bus', 'metro', 'commute', 'road', 'street',
        'पैदल', 'फुटपाथ', 'सड़क', 'यातायात', 'ट्रैफिक', 'साइकिल', 'ರಸ್ತೆ', 'ಪಾದಚಾರಿ', 'ಸಂಚಾರ', 'ಫುಟ್ಪಾತ್',
        'நடைபாதை', 'சாலை', 'போக்குவரத்து', 'రోడ్డ', 'ఫుట్పాత్', 'నడక', 'ట్రాఫిక్', 'રસ્ત', 'ફૂટપાથ', 'ટ્રાફિક',
        'রাস্তা', 'ফুটপাথ', 'যানজট', 'റോഡ', 'നടപ്പാത', 'ഗതാഗത', 'ରାସ୍ତା', 'ଫୁଟପାଥ', 'سڑک', 'فٹ', 'ٹریفک', 'پیدل'],
    children: ['child', 'children', 'kid', 'school', 'student', 'youth', 'education', 'teach', 'learn',
        'बच्च', 'स्कूल', 'शिक्ष', 'मुल', 'शाळ', 'ಮಕ್ಕಳ', 'ಶಾಲೆ', 'ಶಿಕ್ಷಣ', 'குழந்தை', 'பள்ளி', 'கல்வி', 'పిల్లల',
        'పాఠశాల', 'విద్య', 'બાળક', 'શાળા', 'શિક્ષણ', 'শিশু', 'স্কুল', 'শিক্ষা', 'കുട്ടിക', 'സ്കൂൾ', 'വിദ്യാഭ്യാസ',
        'ପିଲା', 'ବିଦ୍ୟାଳୟ', 'ଶିକ୍ଷା', 'بچے', 'بچوں', 'اسکول', 'تعلیم'],
    air: ['air', 'pollution', 'aqi', 'smog', 'dust', 'emission',
        'हवा', 'वायु', 'प्रदूषण', 'ಗಾಳಿ', 'ವಾಯು', 'ಮಾಲಿನ್ಯ', 'காற்று', 'மாசு', 'గాలి', 'కాలుష్య', 'હવા', 'પ્રદૂષણ',
        'বায়ু', 'দূষণ', 'വായു', 'മലിനീകരണ', 'ବାୟୁ', 'ପ୍ରଦୂଷଣ', 'ہوا', 'آلودگی'],
    energy: ['energy', 'solar', 'electricity', 'power', 'renewable', 'climate',
        'ऊर्जा', 'सौर', 'बिजली', 'ಶಕ್ತಿ', 'ಸೌರ', 'ವಿದ್ಯುತ್', 'ஆற்றல்', 'சூரிய', 'மின்', 'శక్తి', 'సౌర', 'విద్యుత్',
        'ઊર્જા', 'સૌર', 'વીજળી', 'শক্তি', 'সৌর', 'বিদ্যুৎ', 'ഊർജ', 'സൗര', 'വൈദ്യുതി', 'ଶକ୍ତି', 'ସୌର', 'ବିଦ୍ୟୁତ',
        'توانائی', 'شمسی', 'بجلی'],
    health: ['health', 'toilet', 'sanitation', 'hygiene', 'menstrual', 'menstruation', 'clinic',
        'स्वास्थ्य', 'शौचालय', 'स्वच्छता', 'ಆರೋಗ್ಯ', 'ಶೌಚಾಲಯ', 'சுகாதார', 'கழிப்பறை', 'ఆరోగ్య', 'మరుగుదొడ్డ',
        'આરોગ્ય', 'શૌચાલય', 'স্বাস্থ্য', 'শৌচাগার', 'ആരോഗ്യ', 'ശൗചാലയ', 'ସ୍ୱାସ୍ଥ୍ୟ', 'ଶୌଚାଳୟ', 'صحت'],
    livelihoods: ['livelihood', 'women', 'woman', 'job', 'income', 'vendor', 'shg', 'skill', 'inclusion',
        'महिला', 'आजीविका', 'रोजगार', 'ಮಹಿಳೆ', 'ಜೀವನೋಪಾಯ', 'பெண்', 'வாழ்வாதார', 'మహిళ', 'జీవనోపాధి', 'મહિલા',
        'આજીવિકા', 'মহিলা', 'নারী', 'জীবিকা', 'സ്ത്രീ', 'ഉപജീവന', 'ମହିଳା', 'ଜୀବିକା', 'خواتین', 'روزگار'],
    heritage: ['heritage', 'history', 'historic', 'temple', 'culture',
        'विरासत', 'धरोहर', 'ಪರಂಪರೆ', 'பாரம்பரிய', 'వారసత్వ', 'વારસ', 'ঐতিহ্য', 'പൈതൃക', 'ଐତିହ୍ୟ', 'ورثہ'],
    governance: ['governance', 'policy', 'ward', 'municipal', 'civic', 'government', 'advocacy',
        'शासन', 'नीति', 'वार्ड', 'ನೀತಿ', 'ವಾರ್ಡ್', 'ஆட்சி', 'வார்டு', 'పాలన', 'వార్డ', 'શાસન', 'વોર્ડ', 'শাসন',
        'ওয়ার্ড', 'ഭരണ', 'വാർഡ', 'ଶାସନ', 'ୱାର୍ଡ', 'حکومت', 'وارڈ'],
    funding: ['funding', 'fund', 'grant', 'money', 'donation', 'donor', 'csr', 'finance', 'financial',
        'पैस', 'धन', 'अनुदान', 'फंड', 'ಹಣ', 'ಅನುದಾನ', 'நிதி', 'பணம்', 'నిధుల', 'డబ్బ', 'ભંડોળ', 'પૈસ', 'তহবিল',
        'টাকা', 'ফান্ড', 'ധനസഹായ', 'ഫണ്ട', 'ପାଣ୍ଠି', 'ଟଙ୍କା', 'فنڈ', 'پیس'],
    volunteers: ['volunteer', 'volunteering',
        'स्वयंसेवक', 'ಸ್ವಯಂಸೇವಕ', 'தன்னார்வ', 'స్వచ్ఛంద', 'వాలంటీర్', 'સ્વયંસેવક', 'স্বেচ্ছাসেবক', 'സന്നദ്ധ',
        'ସ୍ୱେଚ୍ଛାସେବୀ', 'رضاکار'],
    space: ['space', 'venue', 'hall', 'room',
        'जगह', 'स्थान', 'हॉल', 'ಸ್ಥಳ', 'இடம்', 'స్థలం', 'જગ્યા', 'জায়গা', 'സ്ഥലം', 'ସ୍ଥାନ', 'جگہ'],
    expertise: ['expertise', 'expert', 'mentor', 'training', 'guidance', 'consulting', 'technical',
        'विशेषज्ञ', 'प्रशिक्षण', 'ತಜ್ಞ', 'நிபுணர்', 'నిపుణ', 'નિષ્ણાત', 'বিশেষজ্ঞ', 'വിദഗ്ധ', 'ବିଶେଷଜ୍ଞ', 'ماہر'],
};

const isLatin = (word) => /^[a-z0-9]+$/.test(word);

/** Fold English plurals and -ing/-ed endings so "schools", "planting" match "school", "plant". */
function stemWord(word) {
    if (!isLatin(word) || word.length <= 3) return word;
    let w = word;
    if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
    else if (w.endsWith('sses')) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) w = w.slice(0, -1);
    if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith('ed') && w.length > 5) w = w.slice(0, -2);
    return w;
}

/** Words of a text, lower-cased and stemmed, without filler words. Keeps Indic letters and marks. */
function tokenize(text) {
    return String(text ?? '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/[​-‍]/g, '')
        .split(/[^\p{L}\p{M}\p{N}]+/u)
        .filter((w) => w && !SEARCH_STOP_WORDS.has(w))
        .map(stemWord);
}

// Concept lookups: English words by stem, other-language words as prefixes.
const CONCEPT_STEMS = new Map();
const CONCEPT_PREFIXES = [];
const CONCEPT_TERMS = {};
for (const [concept, words] of Object.entries(CONCEPTS)) {
    CONCEPT_TERMS[concept] = [...new Set(words.filter(isLatin).map(stemWord))];
    for (const word of words) {
        if (isLatin(word)) CONCEPT_STEMS.set(stemWord(word), concept);
        else CONCEPT_PREFIXES.push([word.normalize('NFC').replace(/[​-‍]/g, ''), concept]);
    }
}

function conceptOf(term) {
    if (isLatin(term)) return CONCEPT_STEMS.get(term) || null;
    // Two-letter stems (धन, ಮರ) match only whole words, so धन्यवाद is not "money".
    return CONCEPT_PREFIXES.find(([prefix]) => prefix.length > 2 ? term.startsWith(prefix) : term === prefix)?.[1] || null;
}

/** Edit distance, giving up once it passes `max`. */
function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        if (Math.min(...row) > max) return max + 1;
        prev = row;
    }
    return prev[b.length];
}

// Where a word appears, and how much that counts.
const SEARCH_FIELDS = [
    { weight: 3, get: (r) => [r.name] },
    { weight: 2, get: (r) => [r.domains, r.themes, r.theme, r.focus_areas] },
    { weight: 1.5, get: (r) => [r.neighborhood, r.neighborhoods, r.location] },
    { weight: 1.5, side: 'offers', get: (r) => [r.offers, r.infrastructure_offers] },
    { weight: 1.5, side: 'asks', get: (r) => [r.asks] },
    { weight: 1, get: (r) => [r.description] },
    { weight: 0.5, get: (r) => [r.metadata?.searchable_content] },
];

/** Index records once; search them many times. */
function buildSearchIndex(resources) {
    const docs = resources.map((resource) => {
        const doc = { resource, tf: new Map(), offers: new Map(), asks: new Map(), length: 0 };
        for (const field of SEARCH_FIELDS) {
            for (const term of tokenize(field.get(resource).flat().filter(Boolean).join(' '))) {
                doc.tf.set(term, (doc.tf.get(term) || 0) + field.weight);
                if (field.side) doc[field.side].set(term, (doc[field.side].get(term) || 0) + field.weight);
                doc.length += field.weight;
            }
        }
        return doc;
    });
    const df = new Map();
    for (const doc of docs) for (const term of doc.tf.keys()) df.set(term, (df.get(term) || 0) + 1);
    const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(docs.length, 1) || 1;
    return { docs, df, avgLength, vocabulary: [...df.keys()] };
}

// The terms a query word stands for: itself and near-spellings (`direct`), and
// the other words of its concept (`related`).
function expandTerm(index, term) {
    const direct = new Map([[term, 1]]);
    if (isLatin(term) && term.length >= 5 && !index.df.has(term)) {
        const max = term.length >= 8 ? 2 : 1;
        for (const t of index.vocabulary) {
            if (t !== term && editDistance(term, t, max) <= max) direct.set(t, 0.8);
        }
    }
    const concept = conceptOf(term);
    const related = new Map((concept ? CONCEPT_TERMS[concept] : [])
        .filter((t) => !direct.has(t)).map((t) => [t, 0.5]));
    return { direct, related, concept };
}

/**
 * Records matching `query`, best first, as [{resource, score}]. `keep(resource)`
 * limits which records may be returned. Records scoring under a third of the
 * best are dropped.
 */
function searchIndex(index, query, keep = () => true) {
    const words = tokenize(query);
    if (!words.length) return [];
    const side = NEED_WORDS.test(query) ? 'offers' : OFFER_WORDS.test(query) ? 'asks' : null;
    const expanded = words.map((word) => expandTerm(index, word));
    const k1 = 1.2;
    const b = 0.75;
    const n = index.docs.length;

    const bestOf = (terms, tf, doc) => {
        let best = 0;
        for (const [term, weight] of terms) {
            const f = tf.get(term);
            if (!f) continue;
            const df = index.df.get(term);
            const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
            best = Math.max(best, weight * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * doc.length / index.avgLength)));
        }
        return best;
    };

    const scored = [];
    for (const doc of index.docs) {
        if (!keep(doc.resource)) continue;
        let score = 0;
        // Related words count once per concept, so "tree planting" does not
        // credit a "biodiversity" record twice.
        const relatedByConcept = new Map();
        for (const { direct, related, concept } of expanded) {
            // A resource word in a "need" question counts only where it is offered.
            const tf = side && RESOURCE_CONCEPTS.has(concept) ? doc[side] : doc.tf;
            score += bestOf(direct, tf, doc);
            if (concept) relatedByConcept.set(concept, Math.max(relatedByConcept.get(concept) || 0, bestOf(related, tf, doc)));
        }
        for (const credit of relatedByConcept.values()) score += credit;
        if (score > 0) scored.push({ resource: doc.resource, score });
    }
    scored.sort((p, q) => q.score - p.score);
    const cutoff = (scored[0]?.score || 0) / 3;
    return scored.filter((r) => r.score >= cutoff);
}
