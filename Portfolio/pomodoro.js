// --- Configuration ---
const TIME_CONFIG = {
    pomodoro: 25 * 60,   // 25 minutes
    shortBreak: 5 * 60,  // 5 minutes
    longBreak: 15 * 60   // 15 minutes
};
const LONG_BREAK_FREQUENCY = 4; // Long break after 4 Pomodoros

// --- DOM Elements ---
const timeDisplay = document.getElementById('time-display');
const statusMessage = document.getElementById('status-message');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
const sessionButtons = document.querySelectorAll('.session-selector button');
const alarmSound = document.getElementById('alarm-sound');
const pomodoroCountDisplay = document.getElementById('pomodoro-count');
const longBreakCounterDisplay = document.getElementById('long-break-counter');
const timerContainer = document.querySelector('.timer-container'); // Used for color change

// Map session keys to button IDs and back for robust wiring
const SESSION_ID_MAP = {
    pomodoro: 'pomodoro-btn',
    shortBreak: 'short-break-btn',
    longBreak: 'long-break-btn'
};
const ID_TO_SESSION = {
    'pomodoro-btn': 'pomodoro',
    'short-break-btn': 'shortBreak',
    'long-break-btn': 'longBreak'
};

// --- State Variables ---
let currentSession = 'pomodoro';
let timeLeft = TIME_CONFIG.pomodoro;
let isPaused = true;
let intervalId = null;
let pomodoroCount = 0; // Total Pomodoros completed today
let cyclesUntilLongBreak = LONG_BREAK_FREQUENCY;

// --- Helper Functions ---

/** Converts seconds to MM:SS format */
function formatTime(seconds) {
    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
    const remainingSeconds = String(seconds % 60).padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
}

/** Updates the display with the current time and session color */
function updateDisplay() {
    timeDisplay.textContent = formatTime(timeLeft);
    
    // Change color based on session type
    const isBreak = currentSession !== 'pomodoro';
    timeDisplay.classList.toggle('break-color', isBreak);
    
    // Update progress tracker
    pomodoroCountDisplay.textContent = pomodoroCount;
    longBreakCounterDisplay.textContent = cyclesUntilLongBreak;
}

/** Decrements the timer every second */
function countdown() {
    if (isPaused) return;

    if (timeLeft > 0) {
        timeLeft--;
        updateDisplay();
    } else {
        // Timer reached zero
        clearInterval(intervalId);
        intervalId = null;
        isPaused = true;
        startPauseBtn.textContent = 'START';
        startPauseBtn.classList.add('start');
        startPauseBtn.classList.remove('pause');

        playAlarm();
        handleSessionEnd();
    }
}

/** Plays the notification sound */
function playAlarm() {
    // Try HTMLAudioElement first
    try {
        if (alarmSound) {
            alarmSound.currentTime = 0;
            const p = alarmSound.play();
            if (p && typeof p.then === 'function') {
                p.catch(() => fallbackBeep());
            }
        } else {
            fallbackBeep();
        }
    } catch (_) {
        fallbackBeep();
    }

    // Optional: Use native browser notification
    if (Notification.permission === "granted") {
        new Notification("Pomodoro Complete!", {
            body: `Time for a ${currentSession === 'pomodoro' ? 'break' : 'new Pomodoro'}!`
        });
    }
}

/** Fallback beep using Web Audio API */
function fallbackBeep(durationMs = 800, frequency = 880, volume = 0.2) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        setTimeout(() => { oscillator.stop(); ctx.close(); }, durationMs);
    } catch (_) {
        // As a last resort, do nothing
    }
}

/** Handles state transitions when a session ends */
function handleSessionEnd() {
    if (currentSession === 'pomodoro') {
        pomodoroCount++;
        cyclesUntilLongBreak--;
        
        if (cyclesUntilLongBreak <= 0) {
            switchSession('longBreak');
            cyclesUntilLongBreak = LONG_BREAK_FREQUENCY; // Reset cycle
        } else {
            switchSession('shortBreak');
        }
        statusMessage.textContent = "Take a well-deserved break!";

    } else {
        // Break session ended, switch to Pomodoro
        switchSession('pomodoro');
        statusMessage.textContent = "Time to focus!";
    }
    
    // Auto-start the next session (a professional feature)
    startPauseTimer();
}

/** Switches the current session type */
function switchSession(sessionType) {
    currentSession = sessionType;
    timeLeft = TIME_CONFIG[sessionType];

    // Update active button styling
    sessionButtons.forEach(btn => btn.classList.remove('active'));
    const activeBtnId = SESSION_ID_MAP[sessionType];
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) activeBtn.classList.add('active');

    // Reset controls and display
    resetTimer();
    updateDisplay();

    // Update status message for clarity
    if (sessionType === 'pomodoro') {
        statusMessage.textContent = 'Time to focus!';
    } else {
        statusMessage.textContent = 'Take a well-deserved break!';
    }
}

/** Resets the timer to the start time of the current session */
function resetTimer() {
    clearInterval(intervalId);
    intervalId = null;
    isPaused = true;
    timeLeft = TIME_CONFIG[currentSession];
    
    startPauseBtn.textContent = 'START';
    startPauseBtn.classList.add('start');
    startPauseBtn.classList.remove('pause');
    
    updateDisplay();
}

/** Toggles the Start/Pause state */
function startPauseTimer() {
    if (isPaused) {
        // START/RESUME
        isPaused = false;
        startPauseBtn.textContent = 'PAUSE';
        startPauseBtn.classList.remove('start');
        startPauseBtn.classList.add('pause');
        intervalId = setInterval(countdown, 1000);
    } else {
        // PAUSE
        isPaused = true;
        startPauseBtn.textContent = 'RESUME';
        startPauseBtn.classList.remove('pause');
        startPauseBtn.classList.add('start');
        clearInterval(intervalId);
        intervalId = null;
    }
}

// --- Event Listeners ---

// Session Switching
sessionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const sessionType = ID_TO_SESSION[btn.id];
        if (sessionType && sessionType !== currentSession) {
            switchSession(sessionType);
        }
    });
});

// Control Buttons
startPauseBtn.addEventListener('click', startPauseTimer);
resetBtn.addEventListener('click', resetTimer);

// Request Notification Permission on load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize display
    updateDisplay();
    
    // Request permission for desktop notifications
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
});