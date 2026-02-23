// --- Game Configuration & State ---
const CONFIG = {
    totalQuestions: 5,
    visualIcon: "🍎",
    mascot: "🐶", // A friendly dog mascot for gameplay
    sounds: {
        correct: null, // We will synthesize simple sounds to avoid asset loading issues for the MVP
        wrong: null,
        clear: null
    }
};

let gameState = {
    currentStage: null, // e.g., 1 for "+1", 2 for "+2"
    questionCount: 0,
    stars: 0,
    currentAnswer: null
};

// --- DOM Elements ---
const screens = {
    title: document.getElementById('screen-title'),
    stageSelect: document.getElementById('screen-stage-select'),
    play: document.getElementById('screen-play'),
    result: document.getElementById('screen-result')
};

const UI = {
    btnStart: document.getElementById('btn-start'),
    btnBackTitle: document.getElementById('btn-back-title'),
    btnQuit: document.getElementById('btn-quit'),
    btnRetry: document.getElementById('btn-retry-stage'),
    btnToStageSelect: document.getElementById('btn-to-stage-select'),
    stageButtons: document.querySelectorAll('.btn-stage'),

    // Play area
    progressFill: document.getElementById('progress-fill'),
    starText: document.getElementById('star-text'),
    visualsLeft: document.getElementById('visuals-left'),
    visualsRight: document.getElementById('visuals-right'),
    numLeft: document.getElementById('num-left'),
    numRight: document.getElementById('num-right'),
    numAnswer: document.getElementById('num-answer'),
    choicesContainer: document.getElementById('choices-container'),

    // Mascot elements
    reactionMascot: document.getElementById('reaction-mascot'),
    mascotSpeech: document.getElementById('mascot-speech'),

    // Result elements
    resultMessage: document.querySelector('.result-message')
};

// --- Initialization ---
function init() {
    setupEventListeners();
    setupAudioContext();
}

function setupEventListeners() {
    UI.btnStart.addEventListener('click', () => switchScreen('stageSelect'));
    UI.btnBackTitle.addEventListener('click', () => switchScreen('title'));

    UI.stageButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stage = parseInt(e.target.dataset.stage);
            startStage(stage);
        });
    });

    UI.btnQuit.addEventListener('click', () => switchScreen('stageSelect'));

    UI.btnRetry.addEventListener('click', () => {
        startStage(gameState.currentStage);
    });

    UI.btnToStageSelect.addEventListener('click', () => switchScreen('stageSelect'));
}

// --- Audio Synthesis (Web Audio API for simple MVP sounds) ---
let audioCtx;
function setupAudioContext() {
    // Need user interaction to start AudioContext usually, so we init on first button click
    document.body.addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, { once: true });
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'correct') {
        // Cheerful Ding (High pitch, fast decay)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'wrong') {
        // Low Boop
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'clear') {
        // Fanfare-like sequence
        playTone(523.25, now, 0.1); // C5
        playTone(659.25, now + 0.15, 0.1); // E5
        playTone(783.99, now + 0.3, 0.4); // G5
    }
}

function playTone(freq, time, duration) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    osc.start(time);
    osc.stop(time + duration);
}


// --- Screen Management ---
function switchScreen(screenName) {
    // Hide all
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });
    // Show target
    screens[screenName].classList.remove('hidden');
    // Small delay to allow display:block to apply before opacity transition
    setTimeout(() => {
        screens[screenName].classList.add('active');
    }, 50);
}

// --- Game Logic ---
function startStage(stageNumber) {
    gameState = {
        currentStage: stageNumber,
        questionCount: 0,
        stars: 0,
        currentAnswer: null
    };

    UI.starText.textContent = "0";
    updateProgress();
    switchScreen('play');
    nextQuestion();
}

function nextQuestion() {
    if (gameState.questionCount >= CONFIG.totalQuestions) {
        showResult();
        return;
    }

    // Reset UI
    UI.numAnswer.textContent = "？";
    UI.reactionMascot.classList.add('hidden');
    UI.choicesContainer.innerHTML = '';

    // Generate Problem
    // Target constraint: Left number + Right number (Stage)
    // For MVP, left number is random between 1 and 9
    const leftNum = Math.floor(Math.random() * 9) + 1;
    const rightNum = gameState.currentStage;
    gameState.currentAnswer = leftNum + rightNum;

    // Update Equation Text
    UI.numLeft.textContent = leftNum;
    UI.numRight.textContent = rightNum;

    // Update Visuals (Apples)
    renderVisuals(UI.visualsLeft, leftNum);
    renderVisuals(UI.visualsRight, rightNum);

    // Generate Choices (4 options)
    const choices = generateChoices(gameState.currentAnswer);

    // Render Choices
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-choice';
        btn.textContent = choice;
        btn.onclick = () => handleAnswer(choice, btn);
        UI.choicesContainer.appendChild(btn);
    });

    // Animate new question
    const playArea = document.querySelector('.problem-area');
    playArea.classList.remove('zoom-in');
    void playArea.offsetWidth; // trigger reflow
    playArea.classList.add('zoom-in');
}

function renderVisuals(container, count) {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const span = document.createElement('span');
        span.textContent = CONFIG.visualIcon;
        // Stagger animation slightly for cuteness
        span.style.animation = `bounceIn 0.5s ease ${(i * 0.05)}s both`;
        container.appendChild(span);
    }
}

function generateChoices(correctAnswer) {
    const choices = new Set([correctAnswer]);
    while (choices.size < 4) {
        // Generate a plausible wrong answer (within +/- 3 of the real answer, never negative/zero)
        let wrong = correctAnswer + (Math.floor(Math.random() * 7) - 3);
        if (wrong > 0 && wrong !== correctAnswer) {
            choices.add(wrong);
        }
    }
    // Convert to array and shuffle
    return Array.from(choices).sort(() => Math.random() - 0.5);
}

function handleAnswer(selectedAnswer, buttonElement) {
    // Disable all buttons to prevent multiple clicks
    const allButtons = UI.choicesContainer.querySelectorAll('button');
    allButtons.forEach(btn => btn.disabled = true);

    UI.numAnswer.textContent = selectedAnswer;

    if (selectedAnswer === gameState.currentAnswer) {
        // Correct
        playSound('correct');
        buttonElement.classList.add('correct');
        gameState.stars++;
        UI.starText.textContent = gameState.stars;

        // Show reaction
        showMascotReaction("せいかい！", true);

        // Minor confetti from button
        const rect = buttonElement.getBoundingClientRect();
        confetti({
            particleCount: 30,
            spread: 60,
            origin: {
                x: (rect.left + rect.width / 2) / window.innerWidth,
                y: (rect.top + rect.height / 2) / window.innerHeight
            },
            colors: ['#1dd1a1', '#feca57', '#ff6b6b']
        });

        setTimeout(() => {
            gameState.questionCount++;
            updateProgress();
            nextQuestion();
        }, 1500);

    } else {
        // Wrong
        playSound('wrong');
        buttonElement.classList.add('wrong');

        showMascotReaction("おしい！", false);

        setTimeout(() => {
            buttonElement.classList.remove('wrong');
            UI.numAnswer.textContent = "？";
            UI.reactionMascot.classList.add('hidden');
            // Re-enable buttons
            allButtons.forEach(btn => btn.disabled = false);

            gameState.questionCount++;
            updateProgress();
            nextQuestion();
        }, 1200);
    }
}

function showMascotReaction(text, isHappy) {
    UI.mascotSpeech.textContent = text;
    UI.reactionMascot.classList.remove('hidden');

    // Reset animation
    const mascotIcon = UI.reactionMascot.querySelector('.mascot');
    mascotIcon.classList.remove('jump', 'shake');
    void mascotIcon.offsetWidth;

    if (isHappy) {
        mascotIcon.classList.add('jump');
    } else {
        mascotIcon.style.animation = 'shake 0.5s ease';
    }
}

function updateProgress() {
    const percent = (gameState.questionCount / CONFIG.totalQuestions) * 100;
    UI.progressFill.style.width = `${percent}%`;
}

function showResult() {
    playSound('clear');
    switchScreen('result');

    if (gameState.stars === CONFIG.totalQuestions) {
        UI.resultMessage.innerHTML = "パーフェクト！<br>てんさいだね！";
    } else {
        UI.resultMessage.textContent = "よくがんばりました！";
    }

    // Grand Confetti
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#ff6b6b', '#48dbfb', '#feca57', '#1dd1a1']
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#ff6b6b', '#48dbfb', '#feca57', '#1dd1a1']
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

// Start application
init();
