document.addEventListener('DOMContentLoaded', () => {
    
    // --- API Configuration ---
    const API_BASE = 'https://opentdb.com/api.php';
    const API_AMOUNT = 10; // Number of questions to fetch per category change
    
    // 1. Category Mapping for Open Trivia DB
    const CATEGORY_MAP = {
        'general': 9,        // General Knowledge
        'programming': 18,   // Computer Science (closest match)
        'science': 17,       // Science & Nature
        'geography': 22,     // Geography
        'history': 23,       // History
        'art': 25,           // Art (closest match)
        'entertainment': 11, // Entertainment: Film (Closest single category)
        'mythology': 20,     // Mythology
        'sports': 21,        // Sports
        'animals': 27,       // Animals
        'anime': 31          // Japanese Anime & Manga
    };
    // -------------------------

    // 2. Data Structure
    let flashcards = []; 
    let filtered = [];   

    // 3. DOM Element Selectors
    const cardElement = document.getElementById('flashcard');
    const cardFront = document.getElementById('card-front');
    const cardBack = document.getElementById('card-back');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const nextBtn = document.getElementById('next-btn');
    const currentIndexSpan = document.getElementById('current-card-index');
    const totalCardsSpan = document.getElementById('total-cards');
    const categorySelect = document.getElementById('category-select');

    // 4. State Variables
    let currentCardIndex = -1; 
    let currentCategory = 'all';

    // 5. Core Functions

    /** Loads content for the card at the given index and resets the flip state. */
    function loadCard(index) {
        const total = filtered.length;
        if (index >= 0 && index < total) {
            currentCardIndex = index;
            
            cardElement.classList.remove('flipped');
            
            setTimeout(() => {
                const card = filtered[currentCardIndex];
                // Use innerHTML to handle HTML entities (&quot;, &#039; etc.) from the API
                cardFront.innerHTML = card.front; 
                cardBack.innerHTML = card.back;
                
                currentIndexSpan.textContent = currentCardIndex + 1;
                showAnswerBtn.disabled = false;
                showAnswerBtn.textContent = 'Show Answer';
            }, 300);
        } else if (index >= total && total > 0) {
            currentCardIndex = total;
            currentIndexSpan.textContent = total;
            cardFront.textContent = "🥳 Deck Complete! Click 'Next' to restart.";
            cardBack.textContent = "Review Session Finished! Fetch a new category!";
            showAnswerBtn.disabled = true;
        } else {
            currentIndexSpan.textContent = 0;
            showAnswerBtn.disabled = true;
        }
    }

    /** Toggles the 'flipped' class on the card element. */
    function toggleFlip() {
        if (currentCardIndex >= 0 && currentCardIndex < filtered.length) {
            cardElement.classList.toggle('flipped');
            showAnswerBtn.textContent = cardElement.classList.contains('flipped') ? 'Hide Answer' : 'Show Answer';
        }
    }

    /** Loads the next card or restarts the deck. */
    function nextCard() {
        const total = filtered.length;
        if (currentCardIndex < total - 1) {
            loadCard(currentCardIndex + 1);
        } else if (total > 0) {
            currentCardIndex = -1;
            loadCard(0);
        }
    }

    // 6. Category Handling

    function applyCategory(cat) {
        currentCategory = (!cat ? 'all' : cat);
        filtered = [];
        resetDeckHint();
        fetchCategory(currentCategory);
    }

    function resetDeckHint(){
        currentCardIndex = -1;
        totalCardsSpan.textContent = filtered.length;
        cardElement.classList.remove('flipped');
        cardFront.textContent = filtered.length ? "Click 'Next' to start." : `No cards found for '${currentCategory}'`;
        cardBack.textContent = '';
        currentIndexSpan.textContent = 0;
        showAnswerBtn.disabled = true;
    }

    /** Fetches questions from the external API based on the selected category. */
    async function fetchCategory(cat){
        const categoryId = CATEGORY_MAP[cat];
        
        let url = `${API_BASE}?amount=${API_AMOUNT}`;

        if (categoryId) {
            url += `&category=${categoryId}`;
        }
        
        // Request multiple choice questions for Q&A format
        url += `&difficulty=medium&type=multiple`; 

        try{
            const res = await fetch(url);
            
            if(!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            
            const data = await res.json();
            
            if (data.response_code !== 0) {
                let errorMsg = 'Failed to fetch cards. API limit or error.';
                if (data.response_code === 1) errorMsg = 'Not enough questions in this category/difficulty.';
                throw new Error(errorMsg);
            }
            
            // Map the OTDB results (question and correct_answer) to the flashcard structure
            const mapped = data.results.map(item => ({
                front: item.question, 
                back: item.correct_answer,
                category: item.category.toLowerCase()
            }));

            if(currentCategory === cat){
                flashcards = mapped;
                filtered = mapped;
                resetDeckHint();
                if (filtered.length > 0) {
                    loadCard(0); 
                }
            }
        }catch(e){
            console.error("API Fetch Error:", e);
            if(currentCategory === cat){
                cardElement.classList.remove('flipped');
                cardFront.textContent = 'Network Error! 🛑';
                cardBack.textContent = e.message || 'Could not fetch questions from API.';
                totalCardsSpan.textContent = 0;
            }
        }
    }

    // 7. Event Listeners
    showAnswerBtn.addEventListener('click', toggleFlip);
    nextBtn.addEventListener('click', nextCard);

    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            applyCategory(e.target.value);
        });
    }

    cardElement.addEventListener('click', toggleFlip);
    
    // 8. Initial Load
    applyCategory(categorySelect ? categorySelect.value : 'all');
    loadCard(-1); 
});