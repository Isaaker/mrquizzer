document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificación de datos
    const rawData = sessionStorage.getItem('mrquizzer_data');
    if (!rawData) {
        window.location.href = 'settings.html';
        return;
    }

    let quizData;
    try {
        quizData = JSON.parse(rawData);
    } catch (e) {
        console.error("Error parsing JSON:", e);
        return;
    }

    const questions = quizData.questions || [];
    let currentIndex = 0;
    let score = 0;
    let isAnswered = false;

    // 2. Referencias fijas al DOM
    const questionArea = document.getElementById('question-area');
    const explanationArea = document.getElementById('explanation-area');
    const btnNext = document.getElementById('btn-next');
    const progressBar = document.getElementById('progress-bar');
    const resultsScreen = document.getElementById('results-screen');
    const quizSetup = document.getElementById('quiz-setup');

    // --- FUNCIONES DE LÓGICA ---

    function showQuestion(index) {
        isAnswered = false;
        btnNext.style.display = 'none';
        explanationArea.style.display = 'none';
        
        const q = questions[index];
        const questionText = q.question || q.enunciado || q.text || "Sin título";
        
        // Actualizar progreso
        progressBar.style.width = `${(index / questions.length) * 100}%`;

        // Generar HTML
        let html = `
            <p class="badge">Pregunta ${index + 1} de ${questions.length}</p>
            <h2 style="margin: 20px 0;">${questionText}</h2>
            <div id="options-container" class="options-list">
        `;

        if ((q.type === 'mcq' || q.type === 'true_false') && q.options) {
            q.options.forEach((opt, i) => {
                html += `<button class="option-btn j-choice" data-idx="${i}">${opt}</button>`;
            });
        } else {
            html += `
                <input type="text" id="j-input-text" class="input-select" style="width:100%; margin-bottom:10px;" placeholder="Escribe aquí...">
                <button id="j-submit-text" class="btn-start" style="width:100%;">Enviar Respuesta</button>
            `;
        }

        html += `
            <button id="j-skip" class="btn-small" style="width:100%; margin-top:20px; border:1px dashed #ccc; background:none;">
                ⏩ Saltar pregunta
            </button>
        </div>`;

        questionArea.innerHTML = html;

        // --- ASIGNACIÓN DE EVENTOS MANUAL (Post-render) ---
        // Esto garantiza que los botones reaccionen
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
            if (correctAnswers.includes(i)) {
                btn.style.backgroundColor = "#d4edda";
                btn.style.borderColor = "#28a745";
            } else if (i === selectedIndex) {
                btn.style.backgroundColor = "#f8d7da";
                btn.style.borderColor = "#dc3545";
            }
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
            questionArea.insertAdjacentHTML('beforeend', `<p style="color:red; margin-top:10px;">Correcta: ${q.correct_answers[0]}</p>`);
        }
        finishStep(q);
    }

    function handleSkip() {
        if (isAnswered) return;
        isAnswered = true;
        questionArea.insertAdjacentHTML('beforeend', `<p style="color:#666; margin-top:10px;">Pregunta saltada.</p>`);
        finishStep(questions[currentIndex]);
    }

    function finishStep(q) {
        // Ocultar botones de acción
        const skip = document.getElementById('j-skip');
        if (skip) skip.style.display = 'none';
        const submit = document.getElementById('j-submit-text');
        if (submit) submit.style.display = 'none';

        if (q.explanation) {
            explanationArea.textContent = q.explanation;
            explanationArea.style.display = 'block';
        }
        btnNext.style.display = 'block';
        if (currentIndex === questions.length - 1) btnNext.textContent = "Finalizar Quiz";
    }

    // Navegación
    btnNext.addEventListener('click', () => {
        currentIndex++;
        if (currentIndex < questions.length) {
            showQuestion(currentIndex);
        } else {
            showResults();
        }
    });

    function showResults() {
        quizSetup.style.display = 'none';
        resultsScreen.classList.remove('hidden');
        const finalPercent = Math.round((score / questions.length) * 100);
        document.getElementById('score-display').textContent = `${finalPercent}%`;
        document.getElementById('result-text').textContent = `Puntuación: ${score} de ${questions.length}`;
    }

    // Iniciar
    showQuestion(currentIndex);
});