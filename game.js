let settings = { lang: 'es-de', type: 'choice', lives: 'survival' };

let currentWordIndex;
let correctOptionIndex;
let targetAnswer = "";
let score = 0;
let combo = 1;
let mistakes = new Set();
let livesLeft = 5;
let timeLeft = 100;
let timerInterval;
let isWaiting = false;

// Button Group Logic
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const group = e.target.dataset.group;
        document.querySelectorAll(`.mode-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        settings[group] = e.target.dataset.val;
    });
});

function playSound(id) {
    const snd = document.getElementById(id);
    if (snd) { snd.currentTime = 0; snd.play().catch(e => {}); }
}

function startGame(restart = false) {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    score = 0;
    combo = 1;
    mistakes.clear();
    livesLeft = 5;
    isWaiting = false;

    document.getElementById('options-grid').classList.add('hidden');
    document.getElementById('typing-container').classList.add('hidden');
    
    if (settings.type === 'choice') {
        document.getElementById('options-grid').classList.remove('hidden');
    } else {
        document.getElementById('typing-container').classList.remove('hidden');
    }

    if (settings.lives === 'survival') {
        document.getElementById('lives').classList.remove('hidden');
    } else {
        document.getElementById('lives').classList.add('hidden');
    }

    updateStats();
    nextQuestion();
}

function nextQuestion() {
    clearInterval(timerInterval);
    isWaiting = false;
    document.getElementById('typing-answer-reveal').classList.add('hidden');

    const randIndex = Math.floor(Math.random() * vocabData.length);
    const wordObj = vocabData[randIndex];
    
    let askLang, ansLang;
    if (settings.lang === 'es-de') { askLang = 'es'; ansLang = 'de'; }
    else if (settings.lang === 'de-es') { askLang = 'de'; ansLang = 'es'; }
    else { 
        if (Math.random() > 0.5) { askLang = 'es'; ansLang = 'de'; }
        else { askLang = 'de'; ansLang = 'es'; }
    }

    document.getElementById('word-display').textContent = wordObj[askLang];
    targetAnswer = wordObj[ansLang];
    currentWordIndex = randIndex;

    if (settings.type === 'choice') {
        setupChoiceOptions(wordObj, ansLang);
    } else {
        setupTyping();
    }
    
    startTimer();
}

function setupChoiceOptions(wordObj, ansLang) {
    let options = new Set();
    options.add(wordObj[ansLang]);
    
    while(options.size < 4) {
        let randomWrongObj = vocabData[Math.floor(Math.random() * vocabData.length)];
        options.add(randomWrongObj[ansLang]);
    }
    
    let optionsArray = Array.from(options).sort(() => Math.random() - 0.5);

    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach((btn, idx) => {
        btn.textContent = optionsArray[idx];
        btn.classList.remove('correct', 'wrong');
        btn.disabled = false;
        if (optionsArray[idx] === wordObj[ansLang]) correctOptionIndex = idx;
    });
}

function setupTyping() {
    const input = document.getElementById('typing-input');
    input.value = '';
    input.disabled = false;
    input.focus();
}

// Typing Enter Event
document.getElementById('typing-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !isWaiting) {
        checkAnswerTyping(this.value);
    }
});

function normalizeText(text) {
    let lower = text.toLowerCase().trim();
    let variations = [lower];
    
    // Remove brackets (e.g. "(hier)", "(an)") and clean multiple spaces
    let noBrackets = lower.replace(/\(.*?\)/g, ' ').replace(/\.\.\./g, ' ').replace(/\s+/g, ' ').trim();
    if(noBrackets) variations.push(noBrackets);
    
    // Allow individual terms separated by comma or slash
    let tokens = noBrackets.split(/[,/]/).map(t => t.trim()).filter(t => t.length > 0);
    variations = variations.concat(tokens);
    
    return variations;
}

function checkAnswerTyping(userInput) {
    isWaiting = true;
    clearInterval(timerInterval);
    document.getElementById('typing-input').disabled = true;

    const userText = userInput.toLowerCase().trim();
    const targetVariations = normalizeText(targetAnswer);
    
    let isCorrect = false;
    if (userText !== '' && targetVariations.includes(userText)) {
        isCorrect = true;
    }

    if (isCorrect) {
        handleCorrect();
    } else {
        document.getElementById('typing-answer-reveal').textContent = `Antwort: ${targetAnswer}`;
        document.getElementById('typing-answer-reveal').classList.remove('hidden');
        handleWrong(-1, true);
    }
}

function checkAnswerChoice(idx) {
    if(isWaiting) return;
    isWaiting = true;
    clearInterval(timerInterval);
    
    if (idx === correctOptionIndex) {
        document.querySelectorAll('.option-btn')[idx].classList.add('correct');
        handleCorrect();
    } else {
        handleWrong(idx, false);
    }
}

function handleCorrect() {
    playSound('snd-correct');
    document.body.classList.add('flash-green');
    setTimeout(() => document.body.classList.remove('flash-green'), 300);
    
    score += 10 * combo;
    combo++;
    updateStats();
    
    let delay = settings.type === 'typing' ? 500 : 200; 
    setTimeout(nextQuestion, delay); 
}

function handleWrong(clickedIdx = -1, isTyping = false) {
    playSound('snd-wrong');
    document.body.classList.add('flash-red', 'shake');
    setTimeout(() => document.body.classList.remove('flash-red', 'shake'), 300);

    mistakes.add(currentWordIndex);
    combo = 1;
    livesLeft--;
    updateStats();

    if (!isTyping) {
        const buttons = document.querySelectorAll('.option-btn');
        buttons[correctOptionIndex].classList.add('correct');
        if (clickedIdx >= 0) buttons[clickedIdx].classList.add('wrong');
        buttons.forEach(btn => btn.disabled = true);
    }

    saveMistakeToLocal(vocabData[currentWordIndex]);

    if (settings.lives === 'survival' && livesLeft <= 0) {
        setTimeout(endGame, 2000);
    } else {
        setTimeout(nextQuestion, 2000);
    }
}

function startTimer() {
    timeLeft = 100;
    document.getElementById('timer-bar').style.width = '100%';
    
    let timePerQuestion = settings.type === 'typing' ? 15000 : 5000;
    let currentTimerSpeed = timePerQuestion - (combo * (settings.type === 'typing' ? 150 : 100));
    let minTime = settings.type === 'typing' ? 8000 : 5000;
    if(currentTimerSpeed < minTime) currentTimerSpeed = minTime; 

    let updateInterval = 20; 
    let decrementAmount = 100 / (currentTimerSpeed / updateInterval);

    timerInterval = setInterval(() => {
        timeLeft -= decrementAmount;
        document.getElementById('timer-bar').style.width = `${timeLeft}%`;
        
        if(timeLeft < 30) document.getElementById('timer-bar').style.backgroundColor = 'var(--wrong-color)';
        else document.getElementById('timer-bar').style.backgroundColor = 'var(--primary-color)';

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (settings.type === 'choice') handleWrong(-1, false);
            else {
                document.getElementById('typing-answer-reveal').textContent = `Antwort: ${targetAnswer}`;
                document.getElementById('typing-answer-reveal').classList.remove('hidden');
                document.getElementById('typing-input').disabled = true;
                handleWrong(-1, true);
            }
        }
    }, updateInterval);
}

function updateStats() {
    document.getElementById('score').textContent = score;
    document.getElementById('combo-multiplier').textContent = combo;
    document.getElementById('lives-count').textContent = livesLeft;
    
    if(combo > 5) document.getElementById('combo').style.color = '#ff9800';
    if(combo > 10) document.getElementById('combo').style.color = '#f44336';
    if(combo <= 5) document.getElementById('combo').style.color = '#ffeb3b';
}

function endGame() {
    clearInterval(timerInterval);
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('end-screen').classList.remove('hidden');
    document.getElementById('final-score').textContent = score;

    const list = document.getElementById('mistakes-list');
    list.innerHTML = '';
    if (mistakes.size === 0) {
        list.innerHTML = `<p>Perfekt! Keine falschen Wörter.</p>`;
    } else {
        mistakes.forEach(idx => {
            const item = document.createElement('div');
            item.className = 'mistake-item';
            item.innerHTML = `<span class="es">${vocabData[idx].es}</span> = <span class="de">${vocabData[idx].de}</span>`;
            list.appendChild(item);
        });
    }
}

function saveMistakeToLocal(wordObj) {
    let saved = JSON.parse(localStorage.getItem('vocabMistakes') || '[]');
    const exists = saved.find(w => w.es === wordObj.es && w.de === wordObj.de);
    if (!exists) {
        saved.push(wordObj);
        localStorage.setItem('vocabMistakes', JSON.stringify(saved));
    }
}

function showSavedMistakes() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('saved-mistakes-screen').classList.remove('hidden');
    
    const list = document.getElementById('local-saved-list');
    let saved = JSON.parse(localStorage.getItem('vocabMistakes') || '[]');
    
    list.innerHTML = '';
    if (saved.length === 0) {
        list.innerHTML = `<p>Keine gespeicherten Fehler. Hervorragend!</p>`;
    } else {
        saved.forEach(wordObj => {
            const item = document.createElement('div');
            item.className = 'mistake-item';
            item.innerHTML = `<span class="es">${wordObj.es}</span> = <span class="de">${wordObj.de}</span>`;
            list.appendChild(item);
        });
    }
}

function hideSavedMistakes() {
    document.getElementById('saved-mistakes-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
}

function clearLocalMistakes() {
    if(confirm("Möchten Sie wirklich den gesamten Fehlerverlauf löschen?")) {
        localStorage.removeItem('vocabMistakes');
        showSavedMistakes(); 
    }
}

function generateTxtContent(listData) {
    let txt = "=== Fehlerliste (Spanisch - Deutsch) ===\n\n";
    listData.forEach(w => {
        txt += `${w.es} = ${w.de}\n`;
    });
    return txt;
}

function downloadFile(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function downloadMistakes() {
    if (mistakes.size === 0) return alert("Keine falschen Wörter vorhanden!");
    let listData = Array.from(mistakes).map(idx => vocabData[idx]);
    downloadFile(`Fehlerliste_${new Date().getTime()}.txt`, generateTxtContent(listData));
}

function downloadLocalMistakes() {
    let saved = JSON.parse(localStorage.getItem('vocabMistakes') || '[]');
    if (saved.length === 0) return alert("Keine gespeicherten Fehler vorhanden!");
    downloadFile(`Fehlerliste_Gesamt_${new Date().getTime()}.txt`, generateTxtContent(saved));
}
