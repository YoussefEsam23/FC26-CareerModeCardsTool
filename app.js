import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. Firebase Configuration 
// (Replace these values with your Firebase project config)
// ==========================================
const firebaseConfig = {

  apiKey: "AIzaSyBfXLI4Qa3aEEAQL7E4fXuhaZaM03pGHfs",

  authDomain: "careermodecardstool.firebaseapp.com",

  projectId: "careermodecardstool",

  storageBucket: "careermodecardstool.firebasestorage.app",

  messagingSenderId: "58226577235",

  appId: "1:58226577235:web:0ecaffcdffa036a7791ba6"

};


// ==========================================
// 2. ImgBB API Key 
// (Replace with your actual ImgBB key)
// ==========================================
const IMGBB_API_KEY = "15c9b9cc00be7e9fde7dfd51f6874522";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const setupScreen = document.getElementById('setup-screen');
const mainApp = document.getElementById('main-app');
const clubNameInput = document.getElementById('club-name-input');
const btnCreateClub = document.getElementById('btn-create-club');
const displayClubName = document.getElementById('display-club-name');
const btnResetClub = document.getElementById('btn-reset-club');

const container = document.getElementById('dynamic-container');
const pageTitle = document.getElementById('page-title');
const btnPlayers = document.getElementById('btn-players');
const btnAdd = document.getElementById('btn-add');

// Variable to store the current club name
let currentClub = "";

// ==========================================
// 3. Club Management Logic (Generic Tool)
// ==========================================
function checkClub() {
    const savedClub = localStorage.getItem('careerModeClub');
    if (savedClub) {
        currentClub = savedClub;
        setupScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        
        // Format club name for display (e.g., first 3 letters)
        const shortName = savedClub.substring(0, 3).toUpperCase();
        displayClubName.innerHTML = `${shortName} <span>UT 26</span>`;
        document.title = `${savedClub} | UT Manager`;
        
        // Load cards specific to this club
        loadCards();
    } else {
        setupScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
}

btnCreateClub.addEventListener('click', () => {
    const clubName = clubNameInput.value.trim();
    if (clubName) {
        localStorage.setItem('careerModeClub', clubName);
        checkClub();
    }
});

btnResetClub.addEventListener('click', () => {
    if(confirm("Are you sure? This will hide current cards and ask for a new club name.")) {
        localStorage.removeItem('careerModeClub');
        clubNameInput.value = '';
        checkClub();
    }
});

// Run on initialization
checkClub();

// ==========================================
// 4. Navigation Logic
// ==========================================
function setActiveButton(activeBtn) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
}

btnPlayers.addEventListener('click', () => {
    setActiveButton(btnPlayers);
    pageTitle.textContent = "Squad Players";
    loadCards();
});

btnAdd.addEventListener('click', () => {
    setActiveButton(btnAdd);
    pageTitle.textContent = "Add New Card";
    container.className = ""; 
    
    // Render the Add Card form dynamically
    container.innerHTML = `
        <div style="background: #1e1e1e; padding: 20px; border-radius: 8px; max-width: 500px;">
            <form id="add-card-form" style="display: flex; flex-direction: column; gap: 15px;">
                <input type="text" id="playerName" placeholder="Player Name (e.g. Alex Scott)" required style="padding: 10px; background: #121212; color: white; border: 1px solid #333; border-radius: 5px;">
                <select id="promoEvent" required style="padding: 10px; background: #121212; color: white; border: 1px solid #333; border-radius: 5px;">
                    <option value="Gold Base">Gold Base</option>
                    <option value="TOTW">Team of the Week</option>
                    <option value="RTTK">Road to the Knockouts (RTTK)</option>
                    <option value="Player Moments">Player Moments</option>
                    <option value="Scream">Scream (Halloween)</option>
                </select>
                <input type="number" id="rating" placeholder="Overall Rating" required style="padding: 10px; background: #121212; color: white; border: 1px solid #333; border-radius: 5px;">
                <input type="file" id="cardImage" accept="image/*" required style="color: white;">
                <button type="submit" id="submitBtn" style="background: #d4af37; padding: 10px; border: none; font-weight: bold; border-radius: 5px; cursor: pointer;">Upload Card</button>
            </form>
        </div>
    `;

    // Attach event listener to the newly created form
    document.getElementById('add-card-form').addEventListener('submit', handleAddCard);
});

// ==========================================
// 5. Add Card Logic (ImgBB Upload + Firestore Save)
// ==========================================
async function handleAddCard(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.textContent = "Uploading Image...";
    submitBtn.disabled = true;

    const fileInput = document.getElementById('cardImage');
    const imageFile = fileInput.files[0];

    try {
        // Step A: Upload image to ImgBB
        const formData = new FormData();
        formData.append('image', imageFile);

        const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const imgbbData = await imgbbResponse.json();
        
        if (!imgbbData.success) {
            throw new Error("Failed to upload image to ImgBB");
        }

        const imageUrl = imgbbData.data.url; // Get direct image URL

        // Step B: Save data to Firestore Database
        submitBtn.textContent = "Saving to Database...";
        await addDoc(collection(db, "cards"), {
            playerName: document.getElementById('playerName').value,
            promoEvent: document.getElementById('promoEvent').value,
            rating: Number(document.getElementById('rating').value),
            imageUrl: imageUrl,
            clubName: currentClub, // Link the card to the current club
            createdAt: new Date()
        });

        alert("Card added successfully!");
        btnPlayers.click(); // Redirect back to the squad view

    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Error adding card. Check console for details.");
        submitBtn.textContent = "Upload Card";
        submitBtn.disabled = false;
    }
}

// ==========================================
// 6. Fetch and Display Cards Logic
// ==========================================
async function loadCards() {
    container.className = "cards-grid";
    container.innerHTML = "<p>Loading cards...</p>";

    try {
        // Query cards filtered by the current club name
        const q = query(collection(db, "cards"), where("clubName", "==", currentClub));
        const querySnapshot = await getDocs(q);
        
        container.innerHTML = "";
        
        if (querySnapshot.empty) {
            container.innerHTML = "<p>No cards found for your club. Add some!</p>";
            return;
        }

        // Render each card as HTML element
        querySnapshot.forEach((docSnap) => {
            const cardData = docSnap.data();
            const cardId = docSnap.id;
            
            const cardElement = document.createElement('div');
            cardElement.className = 'card-item';
            
            // Inline styling added for the delete button (X)
            cardElement.innerHTML = `
                <button class="delete-btn" onclick="deleteCard('${cardId}')" style="position: absolute; top: 5px; right: 5px; background: #ff4c4c; color: white; border: none; cursor: pointer; padding: 2px 8px; border-radius: 4px; font-weight: bold; z-index: 10;">X</button>
                <img src="${cardData.imageUrl}" alt="${cardData.playerName}">
                <div class="card-info">
                    <h3>${cardData.playerName} <span style="color:var(--gold)">${cardData.rating}</span></h3>
                    <p>${cardData.promoEvent}</p>
                </div>
            `;
            container.appendChild(cardElement);
        });

    } catch (error) {
        console.error("Error loading cards: ", error);
        container.innerHTML = "<p>Error loading cards.</p>";
    }
}

// ==========================================
// 7. Delete Card Logic
// ==========================================
window.deleteCard = async function(cardId) {
    if (confirm("Are you sure you want to delete this card?")) {
        try {
            await deleteDoc(doc(db, "cards", cardId));
            loadCards(); // Refresh UI after deletion
        } catch (error) {
            console.error("Error deleting card: ", error);
            alert("Error deleting card.");
        }
    }
};