document.addEventListener('DOMContentLoaded', () => {
    // 1. Core Data
    const rawData = sessionStorage.getItem('mrquizzer_data');
    if (!rawData) {
        window.location.href = 'settings.html';
        return;
    }

    let quizData = JSON.parse(rawData);
    const questions = quizData.questions || [];
    
    // 2. State & Persistence
    // Load existing progress from cache if available
    let currentIndex = parseInt(localStorage.getItem('mq_current_idx')) || 0;
    let score = parseInt(localStorage.getItem('mq_score')) || 0;
    let secondsElapsed = parseInt(localStorage.getItem('mq_timer')) || 0;
    let isAnswered = false;
    let timerInterval;

    // 3. DOM References
    const questionArea = document.getElementById('question-area');
    const explanationArea = document.getElementById('explanation-area');
    const btnNext = document.getElementById('btn-next');
    const progressBar = document.getElementById('progress-bar');
    const resultsScreen = document.getElementById('results-screen');
    const quizSetup = document.getElementById('quiz-setup');
    const timerDisplay = document.getElementById('timer-display');

    // --- UTILITIES ---

    function saveProgress() {
        localStorage.setItem('mq_current_idx', currentIndex);
        localStorage.setItem('mq_score', score);
        localStorage.setItem('mq_timer', secondsElapsed);
    }

    window.clearProgressAndReload = () => {
        localStorage.removeItem('mq_current_idx');
        localStorage.removeItem('mq_score');
        localStorage.removeItem('mq_timer');
        location.reload();
    };

    window.resetCurrentProgress = () => {
        if(confirm("Do you want to restart your progress?")) clearProgressAndReload();
    };

    // --- TIMER LOGIC ---

    function startTimer() {
        timerInterval = setInterval(() => {
            secondsElapsed++;
            updateTimerUI();
            if (secondsElapsed % 5 === 0) saveProgress(); // Save every 5s
        }, 1000);
    }

    function updateTimerUI() {
        const mins = Math.floor(secondsElapsed / 60);
        const secs = secondsElapsed % 60;
        timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // --- GAMEPLAY ---

    function showQuestion(index) {
        if (index >= questions.length) {
            showResults();
            return;
        }

        isAnswered = false;
        btnNext.style.display = 'none';
        explanationArea.style.display = 'none';
        
        const q = questions[index];
        const questionText = q.question || q.text || "Untitled Question";
        
        progressBar.style.width = `${(index / questions.length) * 100}%`;

        let html = `
            <p class="badge">Question ${index + 1} of ${questions.length}</p>
            <h2 style="margin: 20px 0;">${questionText}</h2>
            <div id="options-container" class="options-list">
        `;

        if ((q.type === 'mcq' || q.type === 'true_false') && q.options) {
            q.options.forEach((opt, i) => {
                html += `<button class="option-btn j-choice" data-idx="${i}">${opt}</button>`;
            });
        } else {
            html += `
                <input type="text" id="j-input-text" class="input-select" style="width:100%; margin-bottom:10px;" placeholder="Type answer...">
                <button id="j-submit-text" class="btn-start" style="width:100%;">Submit</button>
            `;
        }

        html += `<button id="j-skip" class="btn-small" style="width:100%; margin-top:20px; border:1px dashed #ccc; background:none;">⏩ Skip</button></div>`;
        questionArea.innerHTML = html;

        document.querySelectorAll('.j-choice').forEach(btn => {
            btn.addEventListener('click', () => handleMCQ(parseInt(btn.dataset.idx), btn));
        });

        const btnSubmit = document.getElementById('j-submit-text');
        if (btnSubmit) btnSubmit.addEventListener('click', handleText);

        const btnSkip = document.getElementById('j-skip');
        if (btnSkip) btnSkip.addEventListener('click', handleSkip);
    }

    function handleMCQ(selectedIndex, clickedBtn) {
        if (isAnswered) return;
        isAnswered = true;
        const q = questions[currentIndex];
        const correctAnswers = Array.isArray(q.correct_answers) ? q.correct_answers : [q.correct_answers];

        document.querySelectorAll('.j-choice').forEach((btn, i) => {
            if (correctAnswers.includes(i)) btn.classList.add('correct');
            else if (i === selectedIndex) btn.classList.add('wrong');
        });

        if (correctAnswers.includes(selectedIndex)) score++;
        finishStep(q);
    }

    function handleText() {
        if (isAnswered) return;
        const input = document.getElementById('j-input-text');
        const val = input.value.trim().toLowerCase();
        if (!val) return;

        isAnswered = true;
        const q = questions[currentIndex];
        const correctOnes = Array.isArray(q.correct_answers) 
            ? q.correct_answers.map(a => a.toString().toLowerCase())
            : [q.correct_answers.toString().toLowerCase()];

        if (correctOnes.includes(val)) {
            score++;
            input.style.backgroundColor = "#d4edda";
        } else {
            input.style.backgroundColor = "#f8d7da";
            questionArea.insertAdjacentHTML('beforeend', `<p style="color:red; margin-top:10px;">Correct: ${q.correct_answers[0]}</p>`);
        }
        finishStep(q);
    }

    function handleSkip() {
        if (isAnswered) return;
        isAnswered = true;
        finishStep(questions[currentIndex]);
    }

    function finishStep(q) {
        document.getElementById('j-skip').style.display = 'none';
        const submit = document.getElementById('j-submit-text');
        if (submit) submit.style.display = 'none';

        if (q.explanation) {
            explanationArea.textContent = q.explanation;
            explanationArea.style.display = 'block';
        }
        btnNext.style.display = 'block';
        if (currentIndex === questions.length - 1) btnNext.textContent = "See Results";
        saveProgress();
    }

    btnNext.addEventListener('click', () => {
        currentIndex++;
        saveProgress();
        if (currentIndex < questions.length) {
            showQuestion(currentIndex);
        } else {
            showResults();
        }
    });

    // --- RESULTS & EFFECTS ---

    function showResults() {
        clearInterval(timerInterval);
        quizSetup.style.display = 'none';
        resultsScreen.classList.remove('hidden');
        
        const finalPercent = Math.round((score / questions.length) * 100);
        const scoreCircle = document.getElementById('score-display');
        
        scoreCircle.textContent = `${finalPercent}%`;
        document.getElementById('result-text').textContent = `Score: ${score} out of ${questions.length}`;
        document.getElementById('time-result').textContent = `Total Time: ${timerDisplay.textContent}`;

        // Dynamic Color Logic
        if (finalPercent >= 80) {
            scoreCircle.style.borderColor = "#28a745";
            scoreCircle.style.color = "#28a745";
        } else if (finalPercent >= 50) {
            scoreCircle.style.borderColor = "#ffc107";
            scoreCircle.style.color = "#856404";
        } else {
            scoreCircle.style.borderColor = "#dc3545";
            scoreCircle.style.color = "#dc3545";
        }

        // Automatic Confetti for Perfect Score (100%)
        if (finalPercent === 100) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
        
        // Clear progress since quiz is finished
        localStorage.removeItem('mq_current_idx');
        localStorage.removeItem('mq_score');
        localStorage.removeItem('mq_timer');
    }

    // --- REGENERATION & SHARING ---

    window.toggleRegenerate = () => document.getElementById('regenerate-container').classList.toggle('hidden');

    window.shareResults = (platform) => {
        const text = `I scored ${document.getElementById('score-display').textContent} on MrQuizzer! 🧠\nTry it: https://mrquizzer.piscinadeentropia.es`;
        const urls = {
            whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
        };
        window.open(urls[platform], '_blank');
    };

    window.copyToClipboard = () => {
        navigator.clipboard.writeText(`MrQuizzer Score: ${document.getElementById('score-display').textContent}`);
        alert("Score copied!");
    };

    window.copyTestLink = () => {
        const encodedData = btoa(unescape(encodeURIComponent(sessionStorage.getItem('mrquizzer_data'))));
        navigator.clipboard.writeText(`https://mrquizzer.piscinadeentropia.es/share.html?test=${encodedData}`);
        alert("Test link copied!");
    };

    window.copyRegeneratePrompt = () => {
        const oldQs = questions.map(q => q.question || q.text);
        const source = localStorage.getItem('mrquizzer_source') || "Previous text";
        const prompt = `Generate NEW questions based on: "${source}". DO NOT repeat these: ${JSON.stringify(oldQs)}. Use same JSON schema.`;
        navigator.clipboard.writeText(prompt);
        alert("Prompt copied!");
    };

    window.regeneratePrompt = (ai) => {
        window.copyRegeneratePrompt();
        const urls = { chatgpt: 'https://chat.openai.com/', perplexity: 'https://www.perplexity.ai/' };
        window.open(urls[ai], '_blank');
    };

    document.getElementById('btn-load-new')?.addEventListener('click', () => {
        const newData = JSON.parse(document.getElementById('json-input-new').value);
        if (newData.questions) {
            sessionStorage.setItem('mrquizzer_data', JSON.stringify(newData));
            clearProgressAndReload();
        }
    });

    // Start
    updateTimerUI();
    startTimer();
    showQuestion(currentIndex);
});