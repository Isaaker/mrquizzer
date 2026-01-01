document.addEventListener('DOMContentLoaded', () => {

    // --- VARIABLES ---
    const modal = document.getElementById('tos-modal');
    const mainApp = document.getElementById('main-app');
    const sourceText = document.getElementById('source-text');
    const fileInput = document.getElementById('file-input');
    const jsonInput = document.getElementById('json-input');
    const jsonStatus = document.getElementById('json-status');
    const btnStart = document.getElementById('btn-start');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    // --- 1. MODAL LOGIC ---
    const btnAccept = document.getElementById('btn-accept');
    if (btnAccept) {
        btnAccept.addEventListener('click', () => {
            if (!modal) return;
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
                if (mainApp) mainApp.classList.remove('hidden');
                loadCachedSettings();
            }, 300);
        });
    }

    const btnDecline = document.getElementById('btn-decline');
    if (btnDecline) {
        btnDecline.addEventListener('click', () => {
            alert('You must accept the TOS to use MrQuizzer.');
            window.location.href = 'index.html';
        });
    }

    // --- 2. FILE & URL HANDLERS ---
    
    // --- PDF Handler ---
    document.getElementById('btn-attach-file').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Please select a PDF file.');
            fileInput.value = '';
            return;
        }

        // Check if PDF.js is loaded
        if (typeof pdfjsLib === 'undefined') {
            alert('Error: PDF.js library is not loaded. Please check your HTML include.');
            return;
        }

        showLoading(true, 'Reading PDF...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }

            sourceText.value = fullText;
            saveCache();
            alert('PDF loaded successfully.');
        } catch (error) {
            console.error(error);
            alert('Error reading the PDF.');
        } finally {
            showLoading(false);
            fileInput.value = '';
        }
    });

    // --- Attach Link Handler (UPDATED & FIXED) ---
    document.getElementById('btn-attach-link').addEventListener('click', async () => {
        let url = prompt("Enter the URL (Web):");
        if (!url) return;

        // Ensure protocol exists
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        showLoading(true, 'Fetching URL content...');

        try {
            // Use AllOrigins Proxy to bypass CORS
            const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
            
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('Proxy returned HTTP ' + res.status);
            
            const data = await res.json();
            
            if (!data.contents) {
                throw new Error('No content returned from proxy (Website might strictly block bots).');
            }

            // HTML Parsing using DOMParser
            const rawHtml = data.contents;
            const parser = new DOMParser();
            const doc = parser.parseFromString(rawHtml, 'text/html');

            // Remove clutter (scripts, styles, navs, footers, etc)
            const elementsToRemove = doc.querySelectorAll('script, style, noscript, iframe, svg, nav, footer, header, form, button, aside');
            elementsToRemove.forEach(el => el.remove());

            // Extract text
            let textOnly = doc.body.textContent || "";
            
            // Normalize whitespace (replace multiple spaces/newlines with single space)
            textOnly = textOnly.replace(/\s+/g, ' ').trim();

            if (textOnly.length < 50) {
                throw new Error('Could not extract enough readable text from this URL.');
            }

            // Truncate if too long (200k chars limit)
            const maxChars = 200000;
            const finalText = textOnly.length > maxChars ? textOnly.slice(0, maxChars) + '\n\n[Truncated]' : textOnly;

            sourceText.value = `Content extracted from: ${url}\n\n` + finalText;
            saveCache();
            alert('Link processed successfully.');

        } catch (err) {
            console.error('Link fetch error:', err);
            alert('Error fetching link: ' + err.message);
        } finally {
            showLoading(false);
        }
    });

    // --- 3. SETTINGS & PROMPT GENERATOR ---
    if (sourceText) {
        sourceText.addEventListener('input', saveCache);
    }
    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', saveCache);
    });

    // Helper to gather settings
    function getSettings() {
        return {
            language: document.getElementById('set-language')?.value || 'en',
            difficulty: document.getElementById('set-difficulty')?.value || 'medium',
            number_of_questions: parseInt(document.getElementById('set-questions')?.value || '10', 10),
            question_types: getCheckedTypes(),
            include_explanations: !!document.getElementById('set-explanations')?.checked,
            tricky_questions: document.getElementById('set-tricky')?.value === 'Yes',
            attach_additional_documents: document.getElementById('set-attach-docs')?.value === 'Yes',
            allow_ai_own_content: document.getElementById('set-allow-own')?.value === 'Yes',
            mcq_options: 4,
            allow_multiple_correct: false,
            restrict_to_text: true
        };
    }

    function generateFinalPrompt(text, settings) {
        return `
Here’s the prompt translated to English and kept clear/direct for an AI that must output ONLY a JSON with questions and correct answers.

Prompt:
"You are an automatic question generator based on a source text. Input: a JSON object with two fields: 'text' (string) containing the source text, and 'settings' (object).

INPUT DATA:
{
  "text": ${JSON.stringify(text)},
  "settings": ${JSON.stringify(settings)}
}

Generation rules:
Generate exactly 'number_of_questions' questions. If the text lacks sufficient explicit facts, create inference questions consistent with the specified 'difficulty'.
For each question produce an object with these fields:
id: integer (1..N)
type: one of 'mcq','true_false','short_answer','fill_blank'
question: string (phrased in the specified language)
options: array of strings (only for 'mcq' or 'true_false'; for 'true_false' use ['True','False'] or ['Verdadero','Falso'] based on language)
correct_answers: array of indices (integers, 0-based, pointing to 'options') for 'mcq'/'true_false'; for 'short_answer' and 'fill_blank' provide an array of one or more correct answer strings
explanation: string (only if include_explanations=true; brief, 1–2 sentences)

Final JSON structure to return:
{
"metadata": {
"language": "...",
"difficulty": "...",
"number_of_questions": N,
"generated_at": "YYYY-MM-DDTHH:MM:SSZ"
},
"questions": [ ... array of question objects ... ]
}

Output requirements:
The AI must OUTPUT ONLY the JSON (no extra text, no explanations).
Use valid double quotes and strict JSON format."
`;
    }

    window.copyPrompt = () => {
        const text = sourceText.value.trim();
        if (!text) {
            alert('Please enter text in step 1 first.');
            return;
        }

        const settings = getSettings();
        const finalPrompt = generateFinalPrompt(text, settings);

        navigator.clipboard.writeText(finalPrompt).then(() => {
            alert(`Prompt copied! Paste it in your AI chat.`);
        }).catch(err => {
            console.error('Clipboard error:', err);
            alert('Could not copy to clipboard.');
        });
    };

    window.openPrompt = (selected_ai) => {
        const text = sourceText.value.trim();
        if (!text) {
            alert('Please enter text in step 1 first.');
            return;
        }

        const settings = getSettings();
        const finalPrompt = generateFinalPrompt(text, settings);

        let url = null;
        if (selected_ai === 'chatgpt') {
            url = 'https://chatgpt.com/?q=' + encodeURIComponent(finalPrompt);
        } else if (selected_ai === 'perplexity') {
            url = 'https://www.perplexity.ai/?q=' + encodeURIComponent(finalPrompt);
        } else {
            alert('Unknown AI, use Copy button instead.');
            return;
        }

        window.open(url, '_blank');
    };

    function getCheckedTypes() {
        const checked = [];
        document.querySelectorAll('.checkbox-group input:checked').forEach(cb => checked.push(cb.value));
        return checked.length > 0 ? checked : ['mcq'];
    }

    // --- 4. JSON VALIDATION ---
    jsonInput.addEventListener('input', () => {
        const val = jsonInput.value.trim();
        if (!val) {
            setStatus('Waiting for JSON...', '');
            btnStart.disabled = true;
            btnStart.classList.add('disabled');
            return;
        }

        try {
            let cleanVal = val;
            // Attempt to find JSON object if user pasted extra text
            const jsonMatch = val.match(/\{[\s\S]*\}/);
            if (jsonMatch) cleanVal = jsonMatch[0];

            const parsed = JSON.parse(cleanVal);

            if (parsed && parsed.questions && Array.isArray(parsed.questions)) {
                setStatus(`✅ Valid JSON. ${parsed.questions.length} questions detected.`, 'status-success');
                btnStart.disabled = false;
                btnStart.classList.remove('disabled');
                sessionStorage.setItem('mrquizzer_data', JSON.stringify(parsed));
            } else {
                throw new Error('Missing "questions" array.');
            }
        } catch (e) {
            setStatus('❌ Invalid JSON: ' + e.message, 'status-error');
            btnStart.disabled = true;
            btnStart.classList.add('disabled');
        }
    });

    function setStatus(msg, className) {
        if (!jsonStatus) return;
        jsonStatus.textContent = msg;
        jsonStatus.className = 'status-msg ' + (className || '');
    }

    // --- 5. START QUIZ ---
    btnStart.addEventListener('click', () => {
        window.location.href = 'play.html';
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        if (confirm('Clear everything and start over?')) {
            localStorage.removeItem('mrquizzer_cache');
            sessionStorage.removeItem('mrquizzer_data');
            location.reload();
        }
    });

    // --- UTILITIES ---
    function showLoading(show, text) {
        if (!loadingOverlay || !loadingText) return;
        if (show) {
            loadingText.textContent = text || '';
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }

    function saveCache() {
        const data = {
            text: sourceText?.value || '',
        };
        // Also save settings state if needed, but text is most important
        localStorage.setItem('mrquizzer_cache', JSON.stringify(data));
    }

    function loadCachedSettings() {
        const cached = localStorage.getItem('mrquizzer_cache');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                if (data.text && sourceText) sourceText.value = data.text;
            } catch (e) {
                console.warn('Cache parse error', e);
            }
        }
    }

    window.onbeforeunload = function() {
        // Prevent accidental closing if there is content
        if ((sourceText && sourceText.value.length > 50) || (jsonInput && jsonInput.value.length > 50)) {
            // Modern browsers ignore the return string but show a generic warning
            return "You have unsaved changes.";
        }
    };
});