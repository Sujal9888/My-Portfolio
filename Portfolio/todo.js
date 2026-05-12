// --- Elegant Reminder Button & Modal Logic ---
let reminderTime = '';
const reminderBtn = document.getElementById('reminderBtn');
const reminderBtnText = document.getElementById('reminderBtnText');
const reminderModalBg = document.getElementById('reminderModalBg');
const reminderModal = document.getElementById('reminderModal');
const reminderTimeInput = document.getElementById('reminderTimeInput');
const reminderTimeSet = document.getElementById('reminderTimeSet');
const reminderTimeCancel = document.getElementById('reminderTimeCancel');

reminderBtn.onclick = () => {
	reminderModalBg.style.display = 'flex';
	reminderTimeInput.value = reminderTime;
	setTimeout(() => reminderTimeInput.focus(), 100);
};

// Always show the selected time or 'Add Time' on load
reminderBtnText.textContent = reminderTime ? reminderTime : 'Add Time';
reminderTimeSet.onclick = () => {
	reminderTime = reminderTimeInput.value;
	reminderBtnText.textContent = reminderTime ? reminderTime : 'Add Time';
	reminderModalBg.style.display = 'none';
};
reminderTimeCancel.onclick = () => {
	reminderModalBg.style.display = 'none';
};
reminderModalBg.onclick = e => { if (e.target === reminderModalBg) reminderModalBg.style.display = 'none'; };

