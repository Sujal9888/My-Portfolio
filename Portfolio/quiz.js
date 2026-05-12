// Advanced Live Quiz App - script.js
// Features: OpenTDB fetch, difficulty, timer, progress, WebAudio sounds, localStorage best score

// ----- DOM -----
const categoryScreen = document.getElementById('category-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const startBtn = document.getElementById('start-btn');
const categoryRow = document.getElementById('category-row');
const categoryToggle = document.getElementById('category-toggle');
const categoryRowWrap = document.getElementById('category-row-wrap');
const selectedCategorySpan = document.getElementById('selected-category');
const difficultyRow = document.getElementById('difficulty-row');
const questionCountInput = document.getElementById('question-count');
const timerInput = document.getElementById('timer-input');
const fetchingEl = document.getElementById('fetching');

const categoryLabel = document.getElementById('category-label');
const difficultyLabel = document.getElementById('difficulty-label');
const timerLabel = document.getElementById('timer');
const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress');
const questionEl = document.getElementById('question');
const answerButtons = document.getElementById('answer-buttons');
const nextBtn = document.getElementById('next-btn');
const quitBtn = document.getElementById('quit-btn');

const scoreEl = document.getElementById('score');
const totalQuestionsEl = document.getElementById('total-questions');
const playAgainBtn = document.getElementById('play-again-btn');
const homeBtn = document.getElementById('home-btn');

const bestScoreEl = document.getElementById('best-score');
const bestMessageEl = document.getElementById('best-message');

let selectedCategoryId = null;
let selectedCategoryName = null;
let selectedDifficulty = 'medium';
let questions = [];
let currentIndex = 0;
let score = 0;
let questionCount = 10;
let timePerQuestion = 15;
let timerInterval = null;
let timeLeft = 0;

// WebAudio context for sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// ---------- Utilities ----------
function decodeHTML(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}
function shuffle(arr) {
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function playTone(freq = 440, duration = 0.08, type = 'sine', gain = 0.05) {
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + duration);
  } catch (e) { /* ignore autoplay block errors */ }
}
function playSound(name) {
  if (name === 'correct') playTone(880, 0.10, 'sine', 0.06);
  if (name === 'wrong') {
    playTone(220, 0.10, 'sawtooth', 0.05);
    setTimeout(()=> playTone(330, 0.06, 'sawtooth', 0.04), 80);
  }
  if (name === 'click') playTone(1200, 0.04, 'triangle', 0.03);
}

// ----- Persistence (best scores) -----
function bestScoreKey(categoryId, difficulty) {
  return `quiz_best_${categoryId}_${difficulty}`;
}
function getBestScore(categoryId, difficulty) {
  const key = bestScoreKey(categoryId, difficulty);
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}
function setBestScore(categoryId, difficulty, data) {
  const key = bestScoreKey(categoryId, difficulty);
  localStorage.setItem(key, JSON.stringify(data));
}
function updateBestScoreUI() {
  if (!selectedCategoryId) {
    bestScoreEl.textContent = 'Best: —';
    document.getElementById('last-played').textContent = 'Last played: —';
    return;
  }
  const best = getBestScore(selectedCategoryId, selectedDifficulty);
  bestScoreEl.textContent = best ? `Best: ${best.score} / ${best.total}` : 'Best: —';
  document.getElementById('last-played').textContent = best && best.date ? `Last played: ${best.date}` : 'Last played: —';
}

// ----- UI / Events binding -----
categoryRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.category-btn');
  if (!btn) return;
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedCategoryId = btn.dataset.cat;
  selectedCategoryName = btn.dataset.name || btn.innerText;
  // update dropdown label if present
  if (selectedCategorySpan) selectedCategorySpan.textContent = selectedCategoryName;
  // hide the category list after a selection (dropdown behavior)
  const list = document.getElementById('category-row');
  if (list) list.classList.add('hidden');
  updateBestScoreUI();
  playSound('click');
});

// toggle dropdown
if (categoryToggle) {
  categoryToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('category-row').classList.toggle('hidden');
  });
  // close when clicking outside
  document.addEventListener('click', (e) => {
    const list = document.getElementById('category-row');
    if (!list) return;
    if (!categoryRowWrap.contains(e.target)) {
      list.classList.add('hidden');
    }
  });
  // keyboard: ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const list = document.getElementById('category-row');
      if (list) list.classList.add('hidden');
    }
  });
}

difficultyRow.addEventListener('click', (e) => {
  const btn = e.target.closest('.difficulty-btn');
  if (!btn) return;
  document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedDifficulty = btn.dataset.diff;
  updateBestScoreUI();
  playSound('click');
});

// start button
startBtn.addEventListener('click', async () => {
  if (!selectedCategoryId) {
    alert('Please select a category first.');
    return;
  }
  questionCount = parseInt(questionCountInput.value, 10) || 10;
  timePerQuestion = Math.max(5, Math.min(60, parseInt(timerInput.value, 10) || 15));
  await beginQuiz();
});

// Next / Quit / Play Again / Home
nextBtn.addEventListener('click', () => {
  playSound('click');
  currentIndex++;
  if (currentIndex < questions.length) {
    showQuestion();
  } else {
    showResult();
  }
});

quitBtn.addEventListener('click', () => {
  if (confirm('Quit this quiz and return home?')) showHome();
});

playAgainBtn.addEventListener('click', async () => {
  // same settings, refetch
  await beginQuiz();
});

homeBtn.addEventListener('click', () => {
  showHome();
});

// set default active difficulty
document.querySelectorAll('.difficulty-btn').forEach(b => {
  if (b.dataset.diff === selectedDifficulty) b.classList.add('active');
});

// ----- Flow: fetch -> show -> timer -----
async function beginQuiz() {
  // show fetching state
  fetchingEl.classList.remove('hidden');
  startBtn.disabled = true;

  try {
    // fetch from OpenTDB
    const amount = questionCount;
    const difficulty = selectedDifficulty === 'medium' ? 'medium' : selectedDifficulty;
    const url = `https://opentdb.com/api.php?amount=${amount}&category=${selectedCategoryId}&difficulty=${difficulty}&type=multiple`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.response_code !== 0 || !Array.isArray(json.results) || json.results.length === 0) {
      throw new Error('No questions returned. Try a different category/difficulty.');
    }

    // transform
    questions = json.results.map(r => {
      const q = decodeHTML(r.question);
      const correct = decodeHTML(r.correct_answer);
      const incorrect = r.incorrect_answers.map(a => decodeHTML(a));
      const answers = shuffle([
        ...incorrect.map(t => ({ text: t, correct: false })),
        { text: correct, correct: true }
      ]);
      return { question: q, answers };
    });

    // init counters
    currentIndex = 0;
    score = 0;

    // set labels
    categoryLabel.textContent = selectedCategoryName;
    difficultyLabel.textContent = selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1);

    // show quiz screen
    categoryScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    quizScreen.classList.remove('hidden');

    // show first question
    showQuestion();
  } catch (err) {
    alert('Error fetching questions: ' + (err.message || err));
    console.error(err);
  } finally {
    fetchingEl.classList.add('hidden');
    startBtn.disabled = false;
  }
}

function showQuestion() {
  // reset timer & UI state
  clearInterval(timerInterval);
  timeLeft = timePerQuestion;
  timerLabel.textContent = `⏱ ${timeLeft}s`;
  nextBtn.classList.add('hidden');
  answerButtons.innerHTML = '';

  // progress
  progressText.textContent = `${currentIndex + 1} / ${questions.length}`;
  const percent = ((currentIndex) / questions.length) * 100;
  progressBar.style.width = `${percent}%`;

  // render question
  const q = questions[currentIndex];
  questionEl.innerHTML = q.question;

  q.answers.forEach((a, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.innerHTML = `${String.fromCharCode(65 + idx)}. ${a.text}`;
    btn.addEventListener('click', () => selectAnswer(btn, a.correct));
    answerButtons.appendChild(btn);
  });

  // start timer
  startTimer();
}

function selectAnswer(button, correct) {
  // lock answers
  const all = answerButtons.querySelectorAll('.btn');
  all.forEach(b => b.disabled = true);

  clearInterval(timerInterval);

  if (correct) {
    button.classList.add('correct');
    playSound('correct');
    score++;
  } else {
    button.classList.add('wrong');
    playSound('wrong');
    // highlight correct answer
    const buttons = Array.from(all);
    const correctBtn = buttons.find(b => b.classList.contains('correct'));
    if (!correctBtn) {
      // find by text match (fallback)
      const q = questions[currentIndex];
      const correctText = q.answers.find(a => a.correct).text;
      buttons.forEach(b => {
        if (b.innerText.includes(correctText)) b.classList.add('correct');
      });
    }
  }

  nextBtn.classList.remove('hidden');
}

function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft--;
    timerLabel.textContent = `⏱ ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoExpire();
    }
  }, 1000);
}

function autoExpire() {
  // disable buttons and reveal next
  const all = answerButtons.querySelectorAll('.btn');
  all.forEach(b => b.disabled = true);
  // reveal correct
  const q = questions[currentIndex];
  const correctText = q.answers.find(a => a.correct).text;
  Array.from(all).forEach(b => {
    if (b.innerText.includes(correctText)) b.classList.add('correct');
  });
  playSound('wrong');
  nextBtn.classList.remove('hidden');
}

// ----- Results & persistence -----
function showResult() {
  clearInterval(timerInterval);
  quizScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  scoreEl.textContent = score;
  totalQuestionsEl.textContent = questions.length;

  // update progress bar to full
  progressBar.style.width = `100%`;

  // check best
  const prev = getBestScore(selectedCategoryId, selectedDifficulty);
  const now = { 
    score, 
    total: questions.length, 
    date: new Date().toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  if (!prev || (score / questions.length) > (prev.score / prev.total)) {
    setBestScore(selectedCategoryId, selectedDifficulty, now);
    bestMessageEl.textContent = `🎉 New best for ${selectedCategoryName} (${selectedDifficulty})! ${score} / ${questions.length}`;
  } else if ((score === prev.score) && (questions.length === prev.total) && prev) {
    bestMessageEl.textContent = `✅ You matched your best: ${prev.score} / ${prev.total} (on ${prev.date})`;
  } else {
    bestMessageEl.textContent = `Best: ${prev ? `${prev.score} / ${prev.total} (on ${prev.date})` : '—'}`;
  }

  updateBestScoreUI();
}

// home
function showHome() {
  quizScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  categoryScreen.classList.remove('hidden');
  playSound('click');
}

// init best UI when page loads
(function init() {
  // pick first category automatically
  const firstCat = document.querySelector('.category-btn');
  if (firstCat) {
    firstCat.classList.add('active');
    selectedCategoryId = firstCat.dataset.cat;
    selectedCategoryName = firstCat.dataset.name || firstCat.innerText;
  }
  updateBestScoreUI();
})();
