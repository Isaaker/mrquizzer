document.addEventListener('DOMContentLoaded', () => {
    const rawData = sessionStorage.getItem('mrquizzer_data');
    if (!rawData) { window.location.href = 'settings.html'; return; }

    let quizData = JSON.parse(rawData);
    const questions = quizData.questions || [];
    
    // State Persistence
    let currentIndex = parseInt(localStorage.getItem('mq_current_idx')) || 0;
    let score = parseInt(localStorage.getItem('mq_score')) || 0;
    let secondsElapsed = parseInt(localStorage.getItem('mq_timer')) || 0;
    let userAnswers = JSON.parse(localStorage.getItem('mq_user_answers')) || []; 
    let isAnswered = false;
    let timerInterval;

    const questionArea = document.getElementById('question-area');
    const explanationArea = document.getElementById('explanation-area');
    const btnNext = document.getElementById('btn-next');
    const progressBar = document.getElementById('progress-bar');
    const resultsScreen = document.getElementById('results-screen');
    const quizSetup = document.getElementById('quiz-setup');
    const timerDisplay = document.getElementById('timer-display');
    const reviewContainer = document.getElementById('review-container');

    function renderMath() {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise();
        }
    }

    function saveProgress() {
        localStorage.setItem('mq_current_idx', currentIndex);
        localStorage.setItem('mq_score', score);
        localStorage.setItem('mq_timer', secondsElapsed);
        localStorage.setItem('mq_user_answers', JSON.stringify(userAnswers));
    }

    window.clearProgressAndReload = () => {
        localStorage.clear();
        location.reload();
    };

    window.resetCurrentProgress = () => {
        if(confirm("Restart current progress?")) clearProgressAndReload();
    };

    function startTimer() {
        timerInterval = setInterval(() => {
            secondsElapsed++;
            const mins = Math.floor(secondsElapsed / 60);
            const secs = secondsElapsed % 60;
            timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }

    function showQuestion(index) {
        if (index >= questions.length) { showResults(); return; }
        isAnswered = false;
        btnNext.style.display = 'none';
        explanationArea.style.display = 'none';
        
        const q = questions[index];
        progressBar.style.width = `${(index / questions.length) * 100}%`;

        let html = `
            <p class="badge">Question ${index + 1} of ${questions.length}</p>
            <h2 style="margin: 20px 0;">${q.question || q.text}</h2>
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

        html += `<button id="j-skip" class="btn-small" style="width:100%; margin-top:20px; border:1px dashed #ccc; background:none;">⏩ Skip Question</button></div>`;
        questionArea.innerHTML = html;
        
        renderMath();

        document.querySelectorAll('.j-choice').forEach(btn => {
            btn.addEventListener('click', () => handleMCQ(parseInt(btn.dataset.idx), btn));
        });

        if (document.getElementById('j-submit-text')) {
            document.getElementById('j-submit-text').addEventListener('click', handleText);
        }
        document.getElementById('j-skip').addEventListener('click', handleSkip);
    }

    function handleMCQ(selectedIndex, clickedBtn) {
        if (isAnswered) return;
        isAnswered = true;
        
        const q = questions[currentIndex];
        const correctOnes = Array.isArray(q.correct_answers) ? q.correct_answers.map(Number) : [Number(q.correct_answers)];
        const isCorrect = correctOnes.includes(Number(selectedIndex));

        // Resaltado visual inmediato
        document.querySelectorAll('.j-choice').forEach((btn, i) => {
            if (correctOnes.includes(i)) {
                btn.classList.add('correct');
            } else if (i === selectedIndex) {
                btn.classList.add('wrong');
            }
        });

        userAnswers[currentIndex] = { type: 'mcq', choice: selectedIndex, correct: isCorrect };
        if (isCorrect) score++;
        finishStep(q);
    }

    function handleText() {
        if (isAnswered) return;
        const input = document.getElementById('j-input-text');
        const val = input.value.trim();
        if (!val) return;
        
        isAnswered = true;
        const q = questions[currentIndex];
        const correctStrings = Array.isArray(q.correct_answers) 
            ? q.correct_answers.map(a => a.toString().toLowerCase()) 
            : [q.correct_answers.toString().toLowerCase()];

        const isCorrect = correctStrings.includes(val.toLowerCase());
        userAnswers[currentIndex] = { type: 'text', choice: val, correct: isCorrect };

        if (isCorrect) {
            score++;
            input.style.backgroundColor = "#d4edda";
            input.style.borderColor = "#28a745";
        } else {
            input.style.backgroundColor = "#f8d7da";
            input.style.borderColor = "#dc3545";
            questionArea.insertAdjacentHTML('beforeend', `<p style="color:#dc3545; font-weight:bold; margin-top:10px;">Correct Answer: ${q.correct_answers[0]}</p>`);
        }
        finishStep(q);
    }

    function handleSkip() {
        if (isAnswered) return;
        isAnswered = true;
        userAnswers[currentIndex] = { type: 'skip', choice: null, correct: false };
        finishStep(questions[currentIndex]);
    }

    function finishStep(q) {
        document.getElementById('j-skip').style.display = 'none';
        if (document.getElementById('j-submit-text')) document.getElementById('j-submit-text').style.display = 'none';
        
        if (q.explanation) {
            explanationArea.textContent = q.explanation;
            explanationArea.style.display = 'block';
            renderMath();
        }
        
        btnNext.style.display = 'block';
        if (currentIndex === questions.length - 1) btnNext.textContent = "See Results";
        saveProgress();
    }

    btnNext.addEventListener('click', () => {
        currentIndex++;
        saveProgress();
        showQuestion(currentIndex);
    });

    function showResults() {
        clearInterval(timerInterval);
        quizSetup.style.display = 'none';
        resultsScreen.classList.remove('hidden');
        
        const finalPercent = Math.round((score / questions.length) * 100);
        const scoreCircle = document.getElementById('score-display');
        scoreCircle.textContent = `${finalPercent}%`;
        
        // Colores del círculo de puntuación
        if (finalPercent >= 80) scoreCircle.style.color = scoreCircle.style.borderColor = "#28a745";
        else if (finalPercent >= 50) scoreCircle.style.color = scoreCircle.style.borderColor = "#ffc107";
        else scoreCircle.style.color = scoreCircle.style.borderColor = "#dc3545";

        document.getElementById('result-text').textContent = `Score: ${score} out of ${questions.length}`;
        document.getElementById('time-result').textContent = `Total Time: ${timerDisplay.textContent}`;
        
        if (finalPercent === 100) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        buildReview();
    }

    function buildReview() {
        reviewContainer.innerHTML = '';
        questions.forEach((q, i) => {
            const ans = userAnswers[i] || { type: 'skip', choice: null, correct: false };
            let userText = "Skipped", correctText = "";

            if (q.options && (q.type === 'mcq' || q.type === 'true_false')) {
                const cIndices = Array.isArray(q.correct_answers) ? q.correct_answers.map(Number) : [Number(q.correct_answers)];
                correctText = cIndices.map(idx => q.options[idx] || "N/A").join(', ');
                if (ans.type !== 'skip' && ans.choice !== null) userText = q.options[ans.choice] || "Unknown";
            } else {
                correctText = Array.isArray(q.correct_answers) ? q.correct_answers.join(' / ') : q.correct_answers;
                if (ans.type !== 'skip') userText = ans.choice;
            }

            const statusClass = ans.type === 'skip' ? 'text-skipped' : (ans.correct ? 'text-success' : 'text-danger');
            const item = document.createElement('div');
            item.className = `review-item ${ans.correct ? 'is-correct' : (ans.type === 'skip' ? '' : 'is-wrong')}`;
            item.innerHTML = `
                <span class="review-q">${i + 1}. ${q.question || q.text}</span>
                <div class="review-ans">Your Answer: <span class="${statusClass}">${userText}</span></div>
                <div class="review-ans">Correct: <span class="text-success">${correctText}</span></div>
                <button onclick="deepExplain(${i})" class="ai-btn" style="margin-top:10px; padding: 4px 8px; font-size:0.7rem;">🤖 Explain Question</button>
            `;
            reviewContainer.appendChild(item);
        });
        renderMath();
    }

    window.toggleReview = () => reviewContainer.classList.toggle('hidden');
    
    window.deepExplain = (idx) => {
        const q = questions[idx];
        let correct;
        if (q.options) {
             const indices = Array.isArray(q.correct_answers) ? q.correct_answers.map(Number) : [Number(q.correct_answers)];
             correct = indices.map(i => q.options[i]).join(', ');
        } else {
             correct = Array.isArray(q.correct_answers) ? q.correct_answers.join('/') : q.correct_answers;
        }
        const prompt = `Explain this question from my quiz:\n\nQuestion: "${q.question || q.text}"\nCorrect Answer: "${correct}"\n\nPlease provide a detailed explanation.`;
        navigator.clipboard.writeText(prompt);
        alert("Prompt copied!");
    };

    window.toggleRegenerate = () => document.getElementById('regenerate-container').classList.toggle('hidden');
    window.shareResults = (platform) => {
        const text = `I scored ${document.getElementById('score-display').textContent} on MrQuizzer! 🧠\nTry it: https://mrquizzer.piscinadeentropia.es`;
        window.open(platform === 'whatsapp' ? `https://wa.me/?text=${encodeURIComponent(text)}` : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    };
    window.copyTestLink = () => {
        const data = btoa(unescape(encodeURIComponent(sessionStorage.getItem('mrquizzer_data'))));
        navigator.clipboard.writeText(`https://mrquizzer.piscinadeentropia.es/share.html?test=${data}`);
        alert("Link copied!");
    };

    startTimer();
    showQuestion(currentIndex);
});