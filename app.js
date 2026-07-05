// ============================================================
// かずであそぼう！ — 10のまとまりで たしざんが すきになるアプリ
// 学習方針:
//  - すべての数を「10のフレーム（5×2のマス）」で見せる（subitizing / make-10）
//  - やることは いつも1つだけ 画面に案内する（迷わない）
//  - 青いドットをタップして 自分の指で「10のまとまり」をつくる
//  - 10ができたら「かぞえるモード」: 満タンの枠は「10」、
//    のこりを タップすると 11,12,13… と10から数え足せる（count-on）
//  - ぜんぶ数えると「10」と「6」のカードが合体して「16」になるアニメで
//    「数えた結果」と「数字」がつながる
//  - まちがえても次に飛ばさない。ヒントを見て同じ問題に再挑戦
//  - 調子がいいと すこしずつ難しくなる／星でなかまがふえる
// ============================================================

const TOTAL_QUESTIONS = 5;
const STORAGE_KEY = 'kazu_progress_v3';
const FRIEND_COST = 5;

const FRIENDS = ['🐰', '🐶', '🐱', '🐼', '🦊', '🐨', '🐯', '🦁', '🐸', '🐧',
    '🦉', '🐢', '🦄', '🐬', '🦖', '🐙', '🦋', '🐿️', '🦩', '🐳',
    '🐹', '🦜', '🐞', '🐠', '🦕'];

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// --- ステージ定義（gen は むずかしさ d = 1〜3 を受け取る） ---
const STAGES = [
    {
        id: 's1', emoji: '🐣', label: 'ちいさい たしざん', sub: '＋1 ＋2',
        gen(d) {
            const a = rand(1, d === 1 ? 5 : 8);
            return { a, b: rand(1, d >= 3 ? 3 : 2) };
        }
    },
    {
        id: 's2', emoji: '🍎', label: '10までの たしざん', sub: 'こたえが 10まで',
        gen(d) {
            const cap = d === 1 ? 6 : d === 2 ? 8 : 10;
            const a = rand(1, cap - 1);
            return { a, b: rand(1, cap - a) };
        }
    },
    {
        id: 's3', emoji: '✨', label: '10を つくろう', sub: 'あと いくつで 10？', make10: true,
        gen(d) {
            const easy = [1, 2, 5, 8, 9];
            const a = d === 1 ? easy[rand(0, easy.length - 1)] : rand(1, 9);
            return { a, b: 10 - a };
        }
    },
    {
        id: 's4', emoji: '🌈', label: '10を こえろ！', sub: '8＋5 みたいなの',
        gen(d) {
            const a = d === 1 ? 9 : rand(d === 2 ? 7 : 5, 9);
            return { a, b: rand(11 - a, 9) };
        }
    },
    {
        id: 's5', emoji: '🚀', label: '20まで チャレンジ', sub: '13＋7 みたいなの',
        gen(d) {
            if (d === 1) { const a = rand(11, 13); return { a, b: rand(2, 4) }; }
            const a = rand(11, d === 2 ? 15 : 17);
            return { a, b: rand(d === 3 ? 3 : 2, Math.min(9, 20 - a)) };
        }
    }
];

let gameState = {
    stage: null,
    questionIndex: 0,
    stars: 0,
    streak: 0,
    a: 0, b: 0,
    moved: 0,
    answer: null,
    firstTry: true,
    countMode: false,   // かぞえるモード中か
    counted: 0,         // いま何まで数えたか
    results: []
};

// --- DOM ---
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
    stageList: document.getElementById('stage-list'),
    totalStars: document.getElementById('total-stars'),
    friendsRow: document.getElementById('friends-row'),

    progressTrack: document.getElementById('progress-track'),
    starText: document.getElementById('star-text'),
    visualsLeft: document.getElementById('visuals-left'),
    visualsRight: document.getElementById('visuals-right'),
    numLeft: document.getElementById('num-left'),
    numRight: document.getElementById('num-right'),
    numAnswer: document.getElementById('num-answer'),
    choicesContainer: document.getElementById('choices-container'),
    hintBanner: document.getElementById('hint-banner'),
    mergeArea: document.getElementById('merge-area'),

    reactionMascot: document.getElementById('reaction-mascot'),
    mascotSpeech: document.getElementById('mascot-speech'),

    resultTitle: document.getElementById('result-title'),
    resultStars: document.getElementById('result-stars'),
    resultMessage: document.getElementById('result-message'),
    friendUnlock: document.getElementById('friend-unlock')
};

// --- 進捗の保存 ---
function loadProgress() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) { return {}; }
}

function saveProgressData(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) { }
}

function finishRound(stageId, stars) {
    const p = loadProgress();
    const prev = p[stageId] || { best: 0, plays: 0, diff: 1 };
    let diff = prev.diff || 1;
    let leveledUp = false;
    if (stars === TOTAL_QUESTIONS && diff < 3) { diff++; leveledUp = true; }
    else if (stars <= 2 && diff > 1) { diff--; }
    p[stageId] = { best: Math.max(prev.best, stars), plays: prev.plays + 1, diff };
    const before = Math.floor((p.lifetime || 0) / FRIEND_COST);
    p.lifetime = (p.lifetime || 0) + stars;
    const after = Math.floor(p.lifetime / FRIEND_COST);
    saveProgressData(p);
    const newFriends = FRIENDS.slice(
        clamp(before, 0, FRIENDS.length),
        clamp(after, 0, FRIENDS.length)
    );
    return { leveledUp, newFriends };
}

function lifetimeStars() {
    return loadProgress().lifetime || 0;
}

function unlockedFriends() {
    return FRIENDS.slice(0, clamp(Math.floor(lifetimeStars() / FRIEND_COST), 0, FRIENDS.length));
}

function stageDiff(stageId) {
    const p = loadProgress();
    return (p[stageId] && p[stageId].diff) || 1;
}

// --- 音声（Web Audio 効果音 + 読み上げ）---
let audioCtx;
let speechUnlocked = false;

function setupAudioContext() {
    document.body.addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // iOS Safari 対策: 最初のタップで無音の発話をして読み上げを有効化する
        if (!speechUnlocked && 'speechSynthesis' in window) {
            try {
                const u = new SpeechSynthesisUtterance(' ');
                u.volume = 0;
                window.speechSynthesis.speak(u);
                speechUnlocked = true;
            } catch (e) { }
        }
    }, { once: true });
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (type === 'correct') {
        playTone(880, now, 0.1, 'sine', 0.4);
        playTone(1320, now + 0.1, 0.2, 'sine', 0.4);
    } else if (type === 'wrong') {
        playTone(300, now, 0.25, 'triangle', 0.3);
    } else if (type === 'clear') {
        playTone(523.25, now, 0.12, 'square', 0.3);
        playTone(659.25, now + 0.15, 0.12, 'square', 0.3);
        playTone(783.99, now + 0.3, 0.35, 'square', 0.3);
        playTone(1046.5, now + 0.5, 0.5, 'square', 0.3);
    } else if (type === 'tap') {
        playTone(700, now, 0.07, 'sine', 0.2);
        playTone(1050, now + 0.06, 0.08, 'sine', 0.15);
    } else if (type === 'count') {
        playTone(520 + gameState.counted * 30, now, 0.09, 'sine', 0.25);
    } else if (type === 'ten') {
        playTone(659.25, now, 0.1, 'sine', 0.35);
        playTone(880, now + 0.1, 0.1, 'sine', 0.35);
        playTone(1174.7, now + 0.2, 0.25, 'sine', 0.35);
    } else if (type === 'merge') {
        playTone(523.25, now, 0.1, 'sine', 0.3);
        playTone(783.99, now + 0.12, 0.1, 'sine', 0.3);
        playTone(1046.5, now + 0.24, 0.3, 'sine', 0.35);
    }
}

function playTone(freq, time, duration, type, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    osc.start(time);
    osc.stop(time + duration);
}

function speak(text) {
    try {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ja-JP';
        u.rate = 0.9;
        u.pitch = 1.2;
        window.speechSynthesis.speak(u);
    } catch (e) { }
}

// --- 画面遷移 ---
function switchScreen(name) {
    Object.values(screens).forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    screens[name].classList.remove('hidden');
    setTimeout(() => screens[name].classList.add('active'), 50);
    if (name === 'title') renderTitleBadges();
    if (name === 'stageSelect') renderStageList();
}

function renderTitleBadges() {
    UI.totalStars.textContent = lifetimeStars();
    const friends = unlockedFriends();
    UI.friendsRow.innerHTML = '';
    friends.forEach((f, i) => {
        const span = document.createElement('span');
        span.className = 'friend';
        span.textContent = f;
        span.style.animationDelay = `${i * 0.05}s`;
        UI.friendsRow.appendChild(span);
    });
    if (friends.length < FRIENDS.length) {
        const next = document.createElement('span');
        next.className = 'friend locked';
        const remain = FRIEND_COST - (lifetimeStars() % FRIEND_COST);
        next.innerHTML = `？<small>あと⭐${remain}</small>`;
        UI.friendsRow.appendChild(next);
    }
}

// --- ステージ選択画面 ---
function renderStageList() {
    const progress = loadProgress();
    UI.stageList.innerHTML = '';
    STAGES.forEach((stage, i) => {
        const rec = progress[stage.id] || {};
        const best = rec.best || 0;
        const diff = rec.diff || 1;
        const btn = document.createElement('button');
        btn.className = 'btn btn-stage';
        btn.style.animationDelay = `${i * 0.06}s`;
        btn.innerHTML = `
            <span class="stage-emoji">${stage.emoji}</span>
            <span class="stage-text">
                <span class="stage-label">${stage.label}</span>
                <span class="stage-sub">${stage.sub}${diff > 1 ? ' ・レベル' + diff : ''}</span>
            </span>
            <span class="stage-stars">${'⭐'.repeat(best)}${'☆'.repeat(TOTAL_QUESTIONS - best)}</span>`;
        btn.addEventListener('click', () => startStage(stage));
        UI.stageList.appendChild(btn);
    });
}

// --- ゲーム進行 ---
function startStage(stage) {
    gameState = {
        stage,
        questionIndex: 0,
        stars: 0,
        streak: 0,
        a: 0, b: 0, moved: 0, answer: null,
        firstTry: true,
        countMode: false,
        counted: 0,
        results: []
    };
    UI.starText.textContent = '0';
    renderProgressDots();
    switchScreen('play');
    nextQuestion();
}

function renderProgressDots() {
    UI.progressTrack.innerHTML = '';
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
        const dot = document.createElement('span');
        dot.className = 'progress-dot';
        if (i < gameState.results.length) {
            dot.classList.add('done');
            dot.textContent = gameState.results[i] ? '⭐' : '💮';
        }
        UI.progressTrack.appendChild(dot);
    }
}

function setGuide(html, spokenText) {
    UI.hintBanner.classList.remove('hidden');
    UI.hintBanner.innerHTML = html;
    if (spokenText) speak(spokenText);
}

function nextQuestion() {
    if (gameState.questionIndex >= TOTAL_QUESTIONS) {
        showResult();
        return;
    }

    const stage = gameState.stage;
    const d = clamp(stageDiff(stage.id) + (gameState.streak >= 3 ? 1 : 0), 1, 3);
    const { a, b } = stage.gen(d);
    gameState.a = a;
    gameState.b = b;
    gameState.moved = 0;
    gameState.firstTry = true;
    gameState.countMode = false;
    gameState.counted = 0;
    gameState.answer = stage.make10 ? b : a + b;

    if (stage.make10) {
        UI.numLeft.textContent = a;
        UI.numRight.textContent = '？';
        UI.numRight.classList.add('answer-slot');
        UI.numAnswer.textContent = '10';
        UI.numAnswer.classList.remove('answer-slot');
    } else {
        UI.numLeft.textContent = a;
        UI.numRight.textContent = b;
        UI.numRight.classList.remove('answer-slot');
        UI.numAnswer.textContent = '？';
        UI.numAnswer.classList.add('answer-slot');
    }

    UI.reactionMascot.classList.add('hidden');
    UI.mergeArea.classList.add('hidden');
    UI.mergeArea.innerHTML = '';
    UI.choicesContainer.innerHTML = '';

    generateChoices(gameState.answer).forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-choice';
        btn.textContent = choice;
        btn.onclick = () => handleAnswer(choice, btn);
        UI.choicesContainer.appendChild(btn);
    });

    // やることを いつも1つだけ 案内する
    if (stage.make10) {
        renderProblemVisuals();
        setGuide(`${a} と あといくつで 10 かな？`, `${a} と あといくつで 10 かな？`);
    } else if (needsMakeTen()) {
        renderProblemVisuals();
        setGuide(`🔵 あおい ドットを タップして <b>10</b> を つくろう！`,
            `${a} たす ${b}！ あおい どっとを たっぷして 10 を つくろう！`);
    } else {
        enterCountMode(false);
        setGuide(`👆 ドットを タッチして かぞえてみよう！`,
            `${a} たす ${b}！ どっとを たっちして かぞえてみよう！`);
    }

    const area = document.getElementById('problem-area');
    area.classList.remove('zoom-in');
    void area.offsetWidth;
    area.classList.add('zoom-in');
}

// --- 問題エリアの描画 ---
function movableGap() {
    const rem = gameState.a % 10;
    return rem === 0 ? 0 : 10 - rem;
}

// 10づくりが必要な問題か（青ドットの移動フェーズがあるか）
function needsMakeTen() {
    const { a, b, stage } = gameState;
    return !stage.make10 && movableGap() > 0 && movableGap() <= b;
}

function renderProblemVisuals(opts = {}) {
    const { a, b, moved, stage } = gameState;
    if (stage.make10) {
        renderNumber(UI.visualsLeft, a, 'coral', { highlightEmpty: opts.highlightEmpty });
        UI.visualsRight.innerHTML = '<div class="mystery-box bounce-in">？</div>';
        return;
    }
    const canMoveMore = moved < Math.min(movableGap(), b);
    renderNumber(UI.visualsLeft, a, 'coral', {
        movedIn: moved,
        onDotTap: null,
        onMovedTap: (!gameState.countMode && moved > 0) ? moveDotBack : null,
        countMode: gameState.countMode
    });
    renderNumber(UI.visualsRight, b - moved, 'sky', {
        onDotTap: (!gameState.countMode && canMoveMore) ? moveDotToLeft : null,
        countMode: gameState.countMode
    });
}

function moveDotToLeft() {
    gameState.moved++;
    playSound('tap');
    const total = gameState.a + gameState.moved;
    if (total % 10 === 0) {
        // 10のまとまり完成 → かぞえるモードへ
        playSound('ten');
        enterCountMode(true);
    } else {
        renderProblemVisuals();
    }
}

function moveDotBack() {
    if (gameState.moved <= 0 || gameState.countMode) return;
    gameState.moved--;
    playSound('tap');
    renderProblemVisuals();
}

// --- かぞえるモード ---
// 満タンの枠は「10」と表示済みにして、のこりのドットを
// タップすると 11,12,13… と10から数え足す（count-on from ten）
function enterCountMode(celebrate) {
    gameState.countMode = true;
    const { a, b, moved } = gameState;
    const leftTotal = a + moved;
    const fullFrames = Math.floor(leftTotal / 10) + Math.floor((b - moved) / 10);
    gameState.counted = fullFrames * 10;
    renderProblemVisuals();

    const sum = a + b;
    if (celebrate) {
        const ones = sum % 10;
        setGuide(
            `✨ 10が できた！ こんどは のこりを タッチして <b>じゅういち、じゅうに…</b> と かぞえてみよう！`,
            'じゅうが できた！ のこりを たっちして、じゅういち、じゅうに、と かぞえてみよう！');
    }

    // のこりが0（ちょうど10や20）なら すぐ合体アニメ
    if (gameState.counted >= sum && sum > 0) {
        setTimeout(() => finishCounting(), 800);
    }
}

function countDot(dotEl) {
    if (!gameState.countMode) return;
    if (dotEl.classList.contains('counted')) return;
    gameState.counted++;
    playSound('count');
    dotEl.classList.add('counted');
    const badge = document.createElement('span');
    badge.className = 'count-badge';
    badge.textContent = gameState.counted;
    dotEl.parentElement.appendChild(badge);
    speak(String(gameState.counted));

    const sum = gameState.a + gameState.b;
    if (gameState.counted >= sum) {
        setTimeout(() => finishCounting(), 500);
    }
}

// 数え終わり → 「10」と「6」が合体して「16」になるアニメ
function finishCounting() {
    const sum = gameState.a + gameState.b;
    const tens = Math.floor(sum / 10);
    const ones = sum % 10;

    if (sum <= 10) {
        setGuide(`ぜんぶで <b>${sum}</b>！ したの ボタンから <b>${sum}</b> を さがしてね！`,
            `ぜんぶで ${sum}！ ${sum} の ぼたんを おしてね！`);
        return;
    }

    UI.hintBanner.classList.add('hidden');
    const area = UI.mergeArea;
    area.classList.remove('hidden');
    area.innerHTML = '';

    // カードを並べる: [10] (＋[10]) ＋ [6]
    const parts = [];
    for (let t = 0; t < tens; t++) parts.push(10);
    if (ones > 0) parts.push(ones);

    parts.forEach((val, i) => {
        if (i > 0) {
            const plus = document.createElement('span');
            plus.className = 'merge-plus';
            plus.textContent = '＋';
            area.appendChild(plus);
        }
        const card = document.createElement('span');
        card.className = 'merge-card' + (val === 10 ? ' tens' : ' ones');
        card.textContent = val;
        card.style.animationDelay = `${i * 0.15}s`;
        area.appendChild(card);
    });

    playSound('merge');
    const onesText = ones > 0 ? ` と ${ones}` : '';
    speak(`10${tens > 1 ? ' と 10' : ''}${onesText} で…`);

    // 合体！
    setTimeout(() => {
        area.classList.add('merging');
        setTimeout(() => {
            area.innerHTML = `<span class="merge-card result">${sum}</span>`;
            area.classList.remove('merging');
            playSound('ten');
            speak(`${sum}！ ${sum} の ぼたんを おしてね！`);
            setGuide(`したの ボタンから <b>${sum}</b> を さがしてね！`, null);
        }, 700);
    }, 1300);
}

// --- 10のフレーム描画 ---
function renderNumber(container, n, colorClass, opts = {}) {
    container.innerHTML = '';
    const movedIn = opts.movedIn || 0;
    const total = n + movedIn;
    if (total === 0) return; // かぞえるモードで空になった側は何も描かない
    const frameCount = Math.max(1, Math.ceil(total / 10));
    for (let f = 0; f < frameCount; f++) {
        const frame = document.createElement('div');
        frame.className = 'ten-frame';
        const start = f * 10;
        const filledInFrame = Math.min(10, Math.max(0, total - start));
        const isFullFrame = filledInFrame === 10;
        for (let i = 0; i < 10; i++) {
            const idx = start + i;
            const cell = document.createElement('span');
            cell.className = 'tf-cell';
            if (idx < total) {
                const dot = document.createElement('span');
                const isMoved = idx >= n;
                dot.className = `tf-dot ${isMoved ? 'moved' : colorClass}`;
                dot.style.animation = isMoved
                    ? `dotJump 0.4s ease both`
                    : `dotIn 0.35s ease ${(idx * 0.04)}s both`;
                if (opts.countMode && !isFullFrame) {
                    // かぞえるモード: 満タンでない枠のドットをタップで数える
                    dot.classList.add('countable');
                    dot.addEventListener('click', () => countDot(dot));
                } else if (!opts.countMode && !isMoved && opts.onDotTap) {
                    dot.classList.add('tappable');
                    dot.addEventListener('click', opts.onDotTap);
                } else if (!opts.countMode && isMoved && opts.onMovedTap) {
                    dot.classList.add('tappable');
                    dot.addEventListener('click', opts.onMovedTap);
                }
                cell.appendChild(dot);
            } else if (opts.highlightEmpty) {
                cell.classList.add('tf-empty-glow');
            }
            frame.appendChild(cell);
        }
        if (isFullFrame) {
            const badge = document.createElement('span');
            badge.className = 'tf-badge';
            badge.textContent = '10';
            frame.appendChild(badge);
            if (opts.countMode) {
                // かぞえるモード: 満タンの枠は「10」と数え済みで表示
                frame.classList.add('frame-counted');
                const label = document.createElement('span');
                label.className = 'frame-total';
                label.textContent = '10';
                frame.appendChild(label);
            }
        }
        container.appendChild(frame);
    }
}

function generateChoices(correctAnswer) {
    const choices = new Set([correctAnswer]);
    while (choices.size < 3) {
        const wrong = correctAnswer + (Math.floor(Math.random() * 5) - 2);
        if (wrong > 0 && wrong <= 20 && wrong !== correctAnswer) choices.add(wrong);
    }
    return Array.from(choices).sort(() => Math.random() - 0.5);
}

// --- 解答処理: まちがえても同じ問題に再挑戦できる ---
const PRAISE = ['せいかい！', 'すごい！', 'やったね！', 'そのちょうし！', 'てんさい！'];
const ENCOURAGE = ['おしい！ もういっかい！', 'だいじょうぶ！ もういっかい！', 'いっしょに かんがえよう！'];

function handleAnswer(selected, buttonElement) {
    const allButtons = UI.choicesContainer.querySelectorAll('button');

    if (selected === gameState.answer) {
        allButtons.forEach(btn => btn.disabled = true);
        playSound('correct');
        buttonElement.classList.add('correct');

        if (gameState.stage.make10) {
            UI.numRight.textContent = selected;
        } else {
            UI.numAnswer.textContent = selected;
        }

        const gotStar = gameState.firstTry;
        if (gotStar) {
            gameState.stars++;
            gameState.streak++;
            UI.starText.textContent = gameState.stars;
        } else {
            gameState.streak = 0;
        }
        gameState.results.push(gotStar);
        renderProgressDots();

        const praise = PRAISE[rand(0, PRAISE.length - 1)];
        showMascotReaction(praise, true);
        speak(praise);

        const rect = buttonElement.getBoundingClientRect();
        confetti({
            particleCount: 40,
            spread: 70,
            origin: {
                x: (rect.left + rect.width / 2) / window.innerWidth,
                y: (rect.top + rect.height / 2) / window.innerHeight
            },
            colors: ['#1dd1a1', '#feca57', '#ff6b6b', '#48dbfb']
        });

        setTimeout(() => {
            gameState.questionIndex++;
            nextQuestion();
        }, 1600);

    } else {
        playSound('wrong');
        buttonElement.classList.add('wrong');
        buttonElement.disabled = true;
        gameState.firstTry = false;
        gameState.streak = 0;

        const msg = ENCOURAGE[rand(0, ENCOURAGE.length - 1)];
        showMascotReaction(msg, false);
        showHint();

        setTimeout(() => {
            buttonElement.classList.remove('wrong');
            UI.reactionMascot.classList.add('hidden');
        }, 1500);
    }
}

// --- まちがえたときのヒント ---
function showHint() {
    const { a, b, stage } = gameState;

    if (stage.make10) {
        renderProblemVisuals({ highlightEmpty: true });
        setGuide(`ひかっている マスを かぞえてみよう！`, 'ひかっている ますを かぞえてみよう');
        return;
    }

    if (!gameState.countMode && needsMakeTen()) {
        // まだ10を作っていない → 自動で10を作って かぞえるモードへ
        gameState.moved = Math.min(movableGap(), b);
        playSound('ten');
        enterCountMode(true);
        return;
    }

    // かぞえるモード中のまちがい → 数えることをうながす
    setGuide(`👆 ドットを ぜんぶ タッチして かぞえてみよう！`,
        'どっとを ぜんぶ たっちして かぞえてみよう！');
}

function showMascotReaction(text, isHappy) {
    UI.mascotSpeech.textContent = text;
    UI.reactionMascot.classList.remove('hidden', 'correct-toast', 'wrong-toast');
    void UI.reactionMascot.offsetWidth;
    UI.reactionMascot.classList.add(isHappy ? 'correct-toast' : 'wrong-toast');
}

// --- 結果画面 ---
function showResult() {
    playSound('clear');
    const { leveledUp, newFriends } = finishRound(gameState.stage.id, gameState.stars);
    switchScreen('result');

    const stars = gameState.stars;
    UI.resultStars.innerHTML = '';
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
        const s = document.createElement('span');
        s.className = 'result-star' + (i < stars ? ' lit' : '');
        s.textContent = i < stars ? '⭐' : '☆';
        s.style.animationDelay = `${0.3 + i * 0.15}s`;
        UI.resultStars.appendChild(s);
    }

    let speech;
    if (stars === TOTAL_QUESTIONS) {
        UI.resultTitle.textContent = 'パーフェクト！';
        UI.resultMessage.innerHTML = 'ぜんぶ いちばつで せいかい！<br>てんさいだね！'
            + (leveledUp ? '<br><span class="level-up">つぎは もうすこし むずかしいよ🔥</span>' : '');
        speech = 'ぱーふぇくと！てんさいだね！';
    } else if (stars >= 3) {
        UI.resultTitle.textContent = 'すごい！';
        UI.resultMessage.textContent = 'とっても よくできました！';
        speech = 'すごい！よくできました！';
    } else {
        UI.resultTitle.textContent = 'クリア！';
        UI.resultMessage.textContent = 'さいごまで がんばったね！';
        speech = 'さいごまで がんばったね！';
    }

    if (newFriends.length > 0) {
        UI.friendUnlock.classList.remove('hidden');
        UI.friendUnlock.innerHTML =
            `<span class="unlock-emoji">${newFriends.join('')}</span> あたらしい なかまが きたよ！`;
        speech += ' あたらしい なかまが きたよ！';
    } else {
        UI.friendUnlock.classList.add('hidden');
    }
    speak(speech);

    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ff6b6b', '#48dbfb', '#feca57', '#1dd1a1'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ff6b6b', '#48dbfb', '#feca57', '#1dd1a1'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

// --- 初期化 ---
function init() {
    UI.btnStart.addEventListener('click', () => switchScreen('stageSelect'));
    UI.btnBackTitle.addEventListener('click', () => switchScreen('title'));
    UI.btnQuit.addEventListener('click', () => {
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
        switchScreen('stageSelect');
    });
    UI.btnRetry.addEventListener('click', () => startStage(gameState.stage));
    UI.btnToStageSelect.addEventListener('click', () => switchScreen('stageSelect'));
    setupAudioContext();
    renderTitleBadges();
}

init();
