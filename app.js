import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBfXLI4Qa3aEEAQL7E4fXuhaZaM03pGHfs",
  authDomain: "careermodecardstool.firebaseapp.com",
  projectId: "careermodecardstool",
  storageBucket: "careermodecardstool.firebasestorage.app",
  messagingSenderId: "58226577235",
  appId: "1:58226577235:web:0ecaffcdffa036a7791ba6"
};
const IMGBB_API_KEY = "15c9b9cc00be7e9fde7dfd51f6874522";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let currentClubId = "";
let currentClubName = "";
let currentSeasonId = "";
let currentSeasonName = "";
let selectedRosterPlayer = null; 

// متغيرات البحث والفلترة
let allCards = []; 
let allPlayers = [];
let currentViewMode = 'player'; 
let currentSearchQuery = "";
let activeAppSection = "cards"; // 'cards' أو 'roster'

const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
let isLoginMode = true;

// تفعيل استماع البحث الفوري
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('main-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.toLowerCase().trim();
            if (activeAppSection === 'cards') {
                renderCards();
            } else if (activeAppSection === 'roster') {
                renderRosterScreen();
            }
        });
    }
});

document.getElementById('auth-toggle-btn').addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').textContent = isLoginMode ? "Login" : "Sign Up";
    document.getElementById('auth-submit-btn').textContent = isLoginMode ? "Login" : "Create Account";
    document.getElementById('auth-toggle-text').textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
    document.getElementById('auth-toggle-btn').textContent = isLoginMode ? "Sign Up" : "Login";
    document.getElementById('auth-error').style.display = "none";
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const pwd = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = "none";
    try {
        if (isLoginMode) await signInWithEmailAndPassword(auth, email, pwd);
        else await createUserWithEmailAndPassword(auth, email, pwd);
    } catch (err) { 
        errorEl.textContent = err.message;
        errorEl.style.display = "block";
    }
});

const handleLogout = async () => await signOut(auth);
document.getElementById('btn-logout').addEventListener('click', handleLogout);
document.getElementById('btn-logout-clubs').addEventListener('click', handleLogout);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authScreen.style.display = 'none';
        loadClubsScreen();
    } else {
        currentUser = null;
        authScreen.style.display = 'flex';
        document.getElementById('clubs-screen').style.display = 'none';
        document.getElementById('seasons-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';
    }
});

const clubsScreen = document.getElementById('clubs-screen');
const seasonsScreen = document.getElementById('seasons-screen');
const mainApp = document.getElementById('main-app');

document.getElementById('btn-back-to-clubs-setup').addEventListener('click', loadClubsScreen);
document.getElementById('btn-back-clubs').addEventListener('click', loadClubsScreen);
document.getElementById('btn-back-seasons').addEventListener('click', loadSeasonsScreen);

// ----------------------------------------------------
// Global Delete Handlers
// ----------------------------------------------------
window.deleteClub = async function(clubId) {
    try {
        await deleteDoc(doc(db, "clubs", clubId));
        await loadClubsScreen();
    } catch (err) {
        alert("Error deleting club: " + err.message);
    }
};

window.deleteSeason = async function(seasonId) {
    try {
        await deleteDoc(doc(db, "seasons", seasonId));
        await loadSeasonsScreen();
    } catch (err) {
        alert("Error deleting season: " + err.message);
    }
};

window.deletePlayer = async function(playerId) {
    try {
        await deleteDoc(doc(db, "players", playerId));
        document.getElementById('btn-roster').click();
    } catch (err) {
        alert("Error deleting player: " + err.message);
    }
};

window.deleteCard = async function(cardId) {
    try {
        await deleteDoc(doc(db, "cards", cardId));
        if (selectedRosterPlayer) {
            openPlayerCards(selectedRosterPlayer.name, selectedRosterPlayer.position);
        } else {
            document.getElementById('btn-players').click();
        }
    } catch (err) {
        alert("Error deleting card: " + err.message);
    }
};

// ----------------------------------------------------
// Custom Card Types Management (Edit & Delete)
// ----------------------------------------------------
window.openManageEventsModal = async function() {
    const eQ = query(collection(db, "user_events"), where("userId", "==", currentUser.uid));
    const eSnap = await getDocs(eQ);
    let eventsListHTML = "";
    
    if (eSnap.empty) {
        eventsListHTML = `<p style="color: var(--text-muted); text-align: center;">No custom card types found.</p>`;
    } else {
        eSnap.forEach(d => {
            const ev = d.data();
            eventsListHTML += `
                <div class="list-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 10px 14px;">
                    <span style="font-size: 0.95rem;">${ev.name}</span>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button type="button" class="edit-btn" style="position: static; opacity: 1; transform: none; height: 28px; padding: 0 12px; font-size: 0.75rem;" onclick="editEventName('${d.id}', '${ev.name}')">Edit</button>
                        <button type="button" class="circle-delete-btn" onclick="deleteCustomEvent('${d.id}', '${ev.name}')">X</button>
                    </div>
                </div>
            `;
        });
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'manage-events-modal';
    modal.innerHTML = `
        <div class="modal-box" style="max-width: 425px;">
            <h3 class="gold-text">Manage Card Types</h3>
            <div style="max-height: 250px; overflow-y: auto; margin: 10px 0; text-align: left;">
                ${eventsListHTML}
            </div>
            <button type="button" class="primary-btn" onclick="document.getElementById('manage-events-modal').remove()" style="width: 100%; margin-top: 10px;">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.deleteCustomEvent = async function(eventId, eventName) {
    if (!confirm(`Are you sure you want to delete the card type "${eventName}"?`)) return;
    try {
        await deleteDoc(doc(db, "user_events", eventId));
        document.getElementById('manage-events-modal').remove();
        openManageEventsModal();
    } catch (err) {
        alert("Error deleting card type: " + err.message);
    }
};

window.editEventName = async function(eventId, oldName) {
    const newName = prompt("Enter new name for the card type:", oldName);
    if (!newName || newName.trim() === "" || newName.trim() === oldName) return;
    
    try {
        const trimmedName = newName.trim();
        await updateDoc(doc(db, "user_events", eventId), { name: trimmedName });

        const cardsQ = query(collection(db, "cards"), where("seasonId", "==", currentSeasonId), where("promoEvent", "==", oldName));
        const cardsSnap = await getDocs(cardsQ);
        for (const cardDoc of cardsSnap.docs) {
            await updateDoc(doc(db, "cards", cardDoc.id), { promoEvent: trimmedName });
        }

        alert("Card type updated successfully!");
        document.getElementById('manage-events-modal').remove();
        openManageEventsModal();
    } catch (err) {
        alert("Error updating card type: " + err.message);
    }
};

// ----------------------------------------------------
// Clubs & Seasons Management
// ----------------------------------------------------
async function loadClubsScreen() {
    clubsScreen.style.display = 'flex';
    seasonsScreen.style.display = 'none';
    mainApp.style.display = 'none';
    const list = document.getElementById('clubs-list');
    list.innerHTML = "<p style='color: var(--text-muted);'>Loading your clubs...</p>";
    
    const q = query(collection(db, "clubs"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    list.innerHTML = "";
    
    if (snap.empty) {
        list.innerHTML = "<p style='color: var(--text-muted);'>No clubs found. Create your first club below!</p>";
        return;
    }

    snap.forEach(docSnap => {
        const c = docSnap.data();
        list.innerHTML += `
            <div class="list-item" onclick="enterClub('${docSnap.id}', '${c.name}')">
                <span>${c.name}</span>
                <div class="list-actions" onclick="event.stopPropagation();">
                    <button class="icon-btn" onclick="deleteClub('${docSnap.id}')">X</button>
                </div>
            </div>`;
    });
}

document.getElementById('create-club-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    await addDoc(collection(db, "clubs"), { name: document.getElementById('new-club-name').value, userId: currentUser.uid });
    document.getElementById('new-club-name').value = '';
    btn.disabled = false;
    loadClubsScreen();
});

window.enterClub = function(id, name) {
    currentClubId = id; currentClubName = name;
    loadSeasonsScreen();
};

async function loadSeasonsScreen() {
    clubsScreen.style.display = 'none';
    seasonsScreen.style.display = 'flex';
    mainApp.style.display = 'none';
    document.getElementById('seasons-club-title').textContent = currentClubName;
    
    const list = document.getElementById('seasons-list');
    list.innerHTML = "<p style='color: var(--text-muted);'>Loading...</p>";
    
    const q = query(collection(db, "seasons"), where("clubId", "==", currentClubId));
    const snap = await getDocs(q);
    list.innerHTML = "";
    
    if (snap.empty) {
        list.innerHTML = "<p style='color: var(--text-muted);'>No seasons found.</p>";
    }

    snap.forEach(docSnap => {
        const s = docSnap.data();
        list.innerHTML += `
            <div class="list-item" onclick="enterSeason('${docSnap.id}', '${s.name}')">
                <span>${s.name}</span>
                <div class="list-actions" onclick="event.stopPropagation();">
                    <button class="icon-btn" onclick="deleteSeason('${docSnap.id}')">X</button>
                </div>
            </div>`;
    });
}

document.getElementById('create-season-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    await addDoc(collection(db, "seasons"), { name: document.getElementById('new-season-name').value, clubId: currentClubId, userId: currentUser.uid });
    document.getElementById('new-season-name').value = '';
    btn.disabled = false;
    loadSeasonsScreen();
});

window.enterSeason = function(id, name) {
    currentSeasonId = id; currentSeasonName = name;
    seasonsScreen.style.display = 'none';
    mainApp.style.display = 'flex';
    document.getElementById('display-club-name').textContent = currentClubName;
    document.getElementById('display-season-name').textContent = currentSeasonName;
    document.getElementById('btn-players').click();
};

function setActiveButton(activeBtn) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
}

// ----------------------------------------------------
// Club Roster & Categorized Players Management
// ----------------------------------------------------
document.getElementById('btn-roster').addEventListener('click', async () => {
    selectedRosterPlayer = null;
    activeAppSection = 'roster';
    currentSearchQuery = "";
    if (document.getElementById('main-search-input')) {
        document.getElementById('main-search-input').value = "";
    }

    setActiveButton(document.getElementById('btn-roster'));
    document.getElementById('page-title').textContent = "Squad Players";
    document.getElementById('view-tabs-container').style.display = 'none';

    const searchBox = document.getElementById('search-box-container');
    if (searchBox) {
        searchBox.style.display = 'block';
        document.getElementById('main-search-input').placeholder = "Search by player name...";
    }

    const countersContainer = document.getElementById('counters-container');
    if (countersContainer) {
        countersContainer.style.display = 'flex';
        countersContainer.innerHTML = `
            <div class="app-counter-badge">
                <span class="counter-title">Total Players</span>
                <span class="counter-value" id="players-count">0</span>
            </div>
        `;
    }

    const container = document.getElementById('dynamic-container');
    container.className = "";
    container.innerHTML = "<p style='color: var(--text-muted);'>Loading your players...</p>";

    const pQuery = query(collection(db, "players"), where("seasonId", "==", currentSeasonId));
    const pSnap = await getDocs(pQuery);
    allPlayers = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderRosterScreen();
});

async function renderRosterScreen() {
    const container = document.getElementById('dynamic-container');
    container.className = "";

    if (document.getElementById('players-count')) {
        document.getElementById('players-count').textContent = allPlayers.length;
    }

    const cQuery = query(collection(db, "cards"), where("seasonId", "==", currentSeasonId));
    const cSnap = await getDocs(cQuery);
    const cardsMap = {}; 
    cSnap.forEach(d => {
        const card = d.data();
        const pName = card.playerName;
        if (!cardsMap[pName] || Number(card.rating) > Number(cardsMap[pName].rating)) {
            cardsMap[pName] = card;
        }
    });

    let filteredPlayers = allPlayers;
    if (currentSearchQuery) {
        filteredPlayers = allPlayers.filter(p => p.playerName.toLowerCase().includes(currentSearchQuery));
    }
    
    let rosterHTML = `
        <div class="setup-box" style="margin: 0; box-shadow: none; width: 100%; max-width: 650px; text-align: left; margin-bottom: 30px;">
            <h3 class="gold-text" style="margin-bottom: 15px;">Register New Player</h3>
            <form id="add-player-form" style="display: flex; gap: 10px;">
                <input type="text" id="newPlayerName" placeholder="Player Name" required style="flex:1;">
                <select id="newPlayerPosition" required style="width: 150px;">
                    <option value="" disabled selected>Position</option>
                    <option value="GK">GK</option>
                    <option value="LB">LB</option>
                    <option value="RB">RB</option>
                    <option value="CB">CB</option>
                    <option value="CDM">CDM</option>
                    <option value="CM">CM</option>
                    <option value="CAM">CAM</option>
                    <option value="LM">LM</option>
                    <option value="RM">RM</option>
                    <option value="LW">LW</option>
                    <option value="RW">RW</option>
                    <option value="ST">ST</option>
                </select>
                <button type="submit" class="primary-btn">Add Player</button>
            </form>
        </div>
    `;

    if (filteredPlayers.length === 0) {
        rosterHTML += `<p style='color: var(--text-muted);'>No players found matching your search.</p>`;
        container.innerHTML = rosterHTML;
    } else {
        const categories = {
            "GOALKEEPERS": { title: "GOALKEEPERS", positions: ["GK"], players: [] },
            "DEFENDERS": { title: "DEFENDERS", positions: ["CB", "LB", "RB"], players: [] },
            "MIDFIELDERS": { title: "MIDFIELDERS", positions: ["CM", "CDM", "CAM", "LM", "RM"], players: [] },
            "ATTACKERS": { title: "ATTACKERS", positions: ["LW", "RW", "ST"], players: [] }
        };

        filteredPlayers.forEach((p) => {
            let matched = false;
            for (const key in categories) {
                if (categories[key].positions.includes(p.position)) {
                    categories[key].players.push(p);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                categories["DEFENDERS"].players.push(p);
            }
        });

        for (const key in categories) {
            categories[key].players.sort((a, b) => a.playerName.localeCompare(b.playerName));
        }

        container.innerHTML = rosterHTML;

        for (const key in categories) {
            const cat = categories[key];
            if (cat.players.length > 0) {
                let sectionHTML = `
                    <h2 class="group-header">${cat.title}</h2>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; margin-bottom: 25px;">
                `;
                
                cat.players.forEach(p => {
                    const topCard = cardsMap[p.playerName];
                    let cardDisplayHTML = "";

                    if (topCard) {
                        cardDisplayHTML = `
                            <img src="${topCard.imageUrl}" alt="${p.playerName}" style="width: 100%; max-width: 150px; border-radius: 8px; margin-bottom: 10px; transition: var(--transition-smooth);">
                            <h4>${p.playerName} <span style="color: var(--gold);">${topCard.rating}</span></h4>
                            <p style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">${topCard.promoEvent}</p>
                        `;
                    } else {
                        cardDisplayHTML = `
                            <div style="height: 140px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.9rem;">No Cards Yet</div>
                            <h4>${p.playerName}</h4>
                            <span class="pos-badge">${p.position}</span>
                        `;
                    }

                    sectionHTML += `
                        <div class="card-item player-item-card" onclick="openPlayerCards('${p.playerName}', '${p.position}')" style="cursor: pointer;">
                            <button class="edit-btn" onclick="event.stopPropagation(); openEditPlayerModal('${p.id}', '${p.playerName}', '${p.position}')">Edit</button>
                            <button class="delete-btn" onclick="event.stopPropagation(); deletePlayer('${p.id}')">X</button>
                            ${cardDisplayHTML}
                        </div>
                    `;
                });
                
                sectionHTML += `</div>`;
                container.innerHTML += sectionHTML;
            }
        }
    }

    document.getElementById('add-player-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button'); btn.disabled = true;
        await addDoc(collection(db, "players"), {
            playerName: document.getElementById('newPlayerName').value.trim(),
            position: document.getElementById('newPlayerPosition').value,
            seasonId: currentSeasonId,
            userId: currentUser.uid,
            createdAt: new Date()
        });
        const pQuery2 = query(collection(db, "players"), where("seasonId", "==", currentSeasonId));
        const pSnap2 = await getDocs(pQuery2);
        allPlayers = pSnap2.docs.map(d => ({ id: d.id, ...d.data() }));
        renderRosterScreen();
    });
}

// Edit Player Modal
window.openEditPlayerModal = async function(playerId, curName, curPos) {
    const positions = ["GK", "LB", "RB", "CB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"];
    let posOptions = "";
    positions.forEach(pos => {
        posOptions += `<option value="${pos}" ${pos === curPos ? 'selected' : ''}>${pos}</option>`;
    });

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'edit-player-modal';
    modal.innerHTML = `
        <div class="modal-box">
            <h3 class="gold-text">Edit Player Details</h3>
            <form id="edit-player-form" style="display:flex; flex-direction:column; gap:12px; margin-top:10px; text-align:left;">
                <label>Player Name:</label>
                <input type="text" id="editPlayerName" value="${curName}" required>
                
                <label>Position:</label>
                <select id="editPlayerPos">${posOptions}</select>
                
                <div class="modal-buttons" style="display:flex; gap:10px; margin-top:10px;">
                    <button type="submit" class="primary-btn btn-save" id="savePlayerBtn" style="flex:1;">Save Changes</button>
                    <button type="button" class="danger-btn btn-cancel" onclick="document.getElementById('edit-player-modal').remove()" style="flex:1;">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('edit-player-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('savePlayerBtn');
        btn.textContent = "Saving...";
        btn.disabled = true;

        try {
            const newName = document.getElementById('editPlayerName').value.trim();
            const newPos = document.getElementById('editPlayerPos').value;

            await updateDoc(doc(db, "players", playerId), {
                playerName: newName,
                position: newPos
            });

            document.getElementById('edit-player-modal').remove();
            document.getElementById('btn-roster').click();
        } catch (err) {
            alert("Error updating player: " + err.message);
            btn.textContent = "Save Changes";
            btn.disabled = false;
        }
    });
};

// Open Player Specific Cards Page
window.openPlayerCards = async function(playerName, position) {
    selectedRosterPlayer = { name: playerName, position: position };
    document.getElementById('page-title').innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <button onclick="document.getElementById('btn-roster').click()" class="switch-btn" style="flex: none; width: auto; padding: 8px 14px;">&larr; Back to Roster</button>
                <span>${playerName} <span style="color: var(--gold); font-size: 1.2rem;">(${position})</span></span>
            </div>
            <button onclick="openAddCardForPlayer('${playerName}')" class="primary-btn" style="padding: 10px 20px; font-size: 0.9rem;">+ Add Card for ${playerName}</button>
        </div>
    `;
    document.getElementById('view-tabs-container').style.display = 'none';
    
    const searchBox = document.getElementById('search-box-container');
    if (searchBox) searchBox.style.display = 'none';

    if (document.getElementById('counters-container')) {
        document.getElementById('counters-container').style.display = 'none';
    }

    const container = document.getElementById('dynamic-container');
    container.className = "cards-grid";
    container.innerHTML = "<p style='color: var(--text-muted);'>Loading player cards...</p>";

    const q = query(collection(db, "cards"), where("seasonId", "==", currentSeasonId), where("playerName", "==", playerName));
    const snap = await getDocs(q);
    const playerCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    playerCards.sort((a, b) => Number(b.rating) - Number(a.rating));

    container.innerHTML = "";
    if (playerCards.length === 0) {
        container.innerHTML = `<p style='color: var(--text-muted); grid-column: 1/-1;'>No cards found for ${playerName} in this season. Click the button above to add one!</p>`;
        return;
    }

    playerCards.forEach(card => {
        container.innerHTML += createCardHTML(card);
    });
};

// Add Card for specific player directly
window.openAddCardForPlayer = async function(prefilledPlayerName) {
    document.getElementById('page-title').textContent = `Add Card for ${prefilledPlayerName}`;
    document.getElementById('view-tabs-container').style.display = 'none';
    
    const searchBox = document.getElementById('search-box-container');
    if (searchBox) searchBox.style.display = 'none';

    if (document.getElementById('counters-container')) {
        document.getElementById('counters-container').style.display = 'none';
    }

    const container = document.getElementById('dynamic-container');
    container.className = "";

    const eQ = query(collection(db, "user_events"), where("userId", "==", currentUser.uid));
    const eSnap = await getDocs(eQ);
    let eventOptions = `<option value="Gold Base">Gold Base</option><option value="TOTW">TOTW</option>`;
    eSnap.forEach(d => eventOptions += `<option value="${d.data().name}">${d.data().name}</option>`);
    eventOptions += `<option value="ADD_NEW">+ Add New Card Type...</option>`;

    container.innerHTML = `
        <div class="setup-box" style="margin: 0; box-shadow: none; width: 100%; max-width: 500px; text-align: left;">
            <form id="add-card-form" style="display:flex; flex-direction:column; gap:15px; margin: 0;">
                <label style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: -10px;">Assigned Player</label>
                <input type="text" id="selectedPlayerFixed" value="${prefilledPlayerName}" readonly style="background: var(--bg-dark); color: var(--gold); font-weight: bold; cursor: not-allowed;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: -6px;">
                    <label style="color: var(--text-muted); font-size: 0.9rem;">Card Type</label>
                    <button type="button" class="text-btn" onclick="openManageEventsModal()" style="color: var(--gold); font-size: 0.8rem; text-decoration: underline;">Manage Card Types</button>
                </div>
                <select id="promoEvent" onchange="if(this.value==='ADD_NEW') document.getElementById('customEventContainer').style.display='block'; else document.getElementById('customEventContainer').style.display='none';">
                    ${eventOptions}
                </select>
                
                <div id="customEventContainer" style="display:none; margin-top: -5px;">
                    <input type="text" id="customEventName" placeholder="Type new card type name...">
                </div>
                
                <label style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: -10px;">Overall Rating</label>
                <input type="number" id="rating" placeholder="e.g. 90" required>
                
                <label style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: -10px;">Card Image (PNG/JPG)</label>
                <input type="file" id="cardImage" accept="image/*" required>
                
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button type="submit" id="submitBtn" class="primary-btn" style="flex: 1;">Upload Card</button>
                    <button type="button" class="danger-btn" onclick="openPlayerCards('${prefilledPlayerName}', '${selectedRosterPlayer ? selectedRosterPlayer.position : ''}')" style="flex: 1;">Cancel</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('add-card-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn'); 
        btn.textContent = "Uploading..."; 
        btn.disabled = true;
        
        try {
            let eventName = document.getElementById('promoEvent').value;
            if (eventName === 'ADD_NEW') {
                eventName = document.getElementById('customEventName').value.trim();
                if(eventName) await addDoc(collection(db, "user_events"), { name: eventName, userId: currentUser.uid });
            }

            const formData = new FormData(); 
            formData.append('image', document.getElementById('cardImage').files[0]);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
            const imgData = await res.json();
            
            if (!imgData.success) throw new Error("Image upload failed");

            await addDoc(collection(db, "cards"), {
                playerName: prefilledPlayerName,
                promoEvent: eventName,
                rating: Number(document.getElementById('rating').value),
                imageUrl: imgData.data.url,
                seasonId: currentSeasonId,
                userId: currentUser.uid,
                createdAt: new Date()
            });

            openPlayerCards(prefilledPlayerName, selectedRosterPlayer ? selectedRosterPlayer.position : '');
        } catch(err) {
            alert("Error: " + err.message);
            btn.textContent = "Upload Card";
            btn.disabled = false;
        }
    });
};

// ----------------------------------------------------
// Cards Management & Triple View
// ----------------------------------------------------
function setActiveTab(activeId) {
    document.querySelectorAll('#view-tabs-container .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

document.getElementById('view-by-player').addEventListener('click', () => {
    currentViewMode = 'player';
    setActiveTab('view-by-player');
    document.getElementById('main-search-input').placeholder = "Search by player name...";
    renderCards();
});

document.getElementById('view-by-promo').addEventListener('click', () => {
    currentViewMode = 'promo';
    setActiveTab('view-by-promo');
    document.getElementById('main-search-input').placeholder = "Search by card type...";
    renderCards();
});

document.getElementById('view-by-rating').addEventListener('click', () => {
    currentViewMode = 'rating';
    setActiveTab('view-by-rating');
    document.getElementById('main-search-input').placeholder = "Search by player name...";
    renderCards();
});

document.getElementById('btn-players').addEventListener('click', async () => {
    selectedRosterPlayer = null;
    activeAppSection = 'cards';
    currentSearchQuery = "";
    if (document.getElementById('main-search-input')) {
        document.getElementById('main-search-input').value = "";
    }

    setActiveButton(document.getElementById('btn-players'));
    document.getElementById('page-title').textContent = "Squad Cards";
    document.getElementById('view-tabs-container').style.display = 'flex';

    const searchBox = document.getElementById('search-box-container');
    if (searchBox) {
        searchBox.style.display = 'block';
        document.getElementById('main-search-input').placeholder = currentViewMode === 'player' ? "Search by player name..." : "Search by card type...";
    }

    const countersContainer = document.getElementById('counters-container');
    if (countersContainer) {
        countersContainer.style.display = 'flex';
        countersContainer.innerHTML = `
            <div class="app-counter-badge">
                <span class="counter-title">Card Types</span>
                <span class="counter-value" id="events-count">0</span>
            </div>
            <div class="app-counter-badge">
                <span class="counter-title">Total Cards</span>
                <span class="counter-value" id="cards-count">0</span>
            </div>
        `;
    }

    const container = document.getElementById('dynamic-container');
    container.className = "cards-grid";
    container.innerHTML = "<p style='color: var(--text-muted);'>Loading...</p>";
    
    const q = query(collection(db, "cards"), where("seasonId", "==", currentSeasonId));
    const snap = await getDocs(q);
    allCards = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const totalCards = allCards.length;
    const uniqueEvents = new Set(allCards.map(c => c.promoEvent)).size;

    if (document.getElementById('cards-count')) document.getElementById('cards-count').textContent = totalCards;
    if (document.getElementById('events-count')) document.getElementById('events-count').textContent = uniqueEvents;

    renderCards();
});

function createCardHTML(card) {
    return `
        <div class="card-item">
            <button class="edit-btn" onclick="openEditModal('${card.id}', '${card.playerName}', '${card.promoEvent}', ${card.rating}, '${card.imageUrl}')">Edit</button>
            <button class="delete-btn" onclick="deleteCard('${card.id}')">X</button>
            <img src="${card.imageUrl}" alt="${card.playerName}">
            <div class="card-info">
                <h3>${card.playerName} <span>${card.rating}</span></h3>
                <p>${card.promoEvent}</p>
            </div>
        </div>
    `;
}

function renderCards() {
    const container = document.getElementById('dynamic-container');
    container.innerHTML = "";
    
    let cardsToRender = allCards;
    if (currentSearchQuery) {
        if (currentViewMode === 'player') {
            cardsToRender = allCards.filter(c => c.playerName.toLowerCase().includes(currentSearchQuery));
        } else if (currentViewMode === 'promo') {
            cardsToRender = allCards.filter(c => c.promoEvent.toLowerCase().includes(currentSearchQuery));
        } else if (currentViewMode === 'rating') {
            cardsToRender = allCards.filter(c => c.playerName.toLowerCase().includes(currentSearchQuery));
        }
    }

    if (cardsToRender.length === 0) {
        container.innerHTML = "<p style='color: var(--text-muted); grid-column: 1/-1;'>No cards found matching your search.</p>";
        return;
    }

    if (currentViewMode === 'rating') {
        const sortedCards = [...cardsToRender].sort((a, b) => Number(b.rating) - Number(a.rating));
        sortedCards.forEach(card => {
            container.innerHTML += createCardHTML(card);
        });
        return;
    }

    const groups = {};
    cardsToRender.forEach(card => {
        const key = currentViewMode === 'player' ? card.playerName : card.promoEvent;
        if (!groups[key]) groups[key] = [];
        groups[key].push(card);
    });

    for (const [groupName, cards] of Object.entries(groups)) {
        cards.sort((a, b) => Number(b.rating) - Number(a.rating));
        container.innerHTML += `<h2 class="group-header">${groupName}</h2>`;
        cards.forEach(card => {
            container.innerHTML += createCardHTML(card);
        });
    }
}

// ----------------------------------------------------
// Edit Card Modal Logic
// ----------------------------------------------------
window.openEditModal = async function(cardId, curPlayer, curPromo, curRating, curImg) {
    const pQ = query(collection(db, "players"), where("seasonId", "==", currentSeasonId));
    const pSnap = await getDocs(pQ);
    let pOptions = "";
    pSnap.forEach(d => {
        const pName = d.data().playerName;
        pOptions += `<option value="${pName}" ${pName === curPlayer ? 'selected' : ''}>${pName}</option>`;
    });

    const eQ = query(collection(db, "user_events"), where("userId", "==", currentUser.uid));
    const eSnap = await getDocs(eQ);
    let eventOptions = `
        <option value="Gold Base" ${curPromo === 'Gold Base' ? 'selected' : ''}>Gold Base</option>
        <option value="TOTW" ${curPromo === 'TOTW' ? 'selected' : ''}>TOTW</option>
    `;
    eSnap.forEach(d => {
        const eName = d.data().name;
        eventOptions += `<option value="${eName}" ${eName === curPromo ? 'selected' : ''}>${eName}</option>`;
    });
    eventOptions += `<option value="ADD_NEW">+ Add New Card Type...</option>`;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'edit-modal';
    modal.innerHTML = `
        <div class="modal-box">
            <h3 class="gold-text">Edit Card Details</h3>
            <form id="edit-card-form" style="display:flex; flex-direction:column; gap:12px; margin-top:10px; text-align:left;">
                <label>Assigned Player:</label>
                <select id="editPlayer">${pOptions}</select>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: -6px;">
                    <label style="color: var(--text-muted); font-size: 0.85rem;">Card Type</label>
                    <button type="button" class="text-btn" onclick="openManageEventsModal()" style="color: var(--gold); font-size: 0.8rem; text-decoration: underline;">Manage Card Types</button>
                </div>
                <select id="editPromo" onchange="if(this.value==='ADD_NEW') document.getElementById('editCustomEventContainer').style.display='block'; else document.getElementById('editCustomEventContainer').style.display='none';">
                    ${eventOptions}
                </select>

                <div id="editCustomEventContainer" style="display:none;">
                    <input type="text" id="editCustomEventName" placeholder="Type new card type name...">
                </div>
                
                <label>Overall Rating:</label>
                <input type="number" id="editRating" value="${curRating}" required>
                
                <label>New Image (Leave empty to keep current):</label>
                <input type="file" id="editImage" accept="image/*">
                
                <div class="modal-buttons" style="display:flex; gap:10px; margin-top:10px;">
                    <button type="submit" class="primary-btn btn-save" id="saveEditBtn" style="flex:1;">Save Changes</button>
                    <button type="button" class="danger-btn btn-cancel" onclick="document.getElementById('edit-modal').remove()" style="flex:1;">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('edit-card-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveEditBtn');
        btn.textContent = "Saving...";
        btn.disabled = true;

        try {
            let eventName = document.getElementById('editPromo').value;
            if (eventName === 'ADD_NEW') {
                eventName = document.getElementById('editCustomEventName').value.trim();
                if (!eventName) throw new Error("Please enter a name for the new card type.");
                await addDoc(collection(db, "user_events"), { name: eventName, userId: currentUser.uid });
            }

            let imageUrl = curImg;
            const fileInput = document.getElementById('editImage');
            if (fileInput.files.length > 0) {
                const formData = new FormData();
                formData.append('image', fileInput.files[0]);
                const imgRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
                const imgData = await imgRes.json();
                if (imgData.success) imageUrl = imgData.data.url;
            }

            await updateDoc(doc(db, "cards", cardId), {
                playerName: document.getElementById('editPlayer').value,
                promoEvent: eventName,
                rating: Number(document.getElementById('editRating').value),
                imageUrl: imageUrl
            });

            document.getElementById('edit-modal').remove();
            if (selectedRosterPlayer) {
                openPlayerCards(selectedRosterPlayer.name, selectedRosterPlayer.position);
            } else {
                document.getElementById('btn-players').click();
            }
        } catch (err) {
            alert("Error updating card: " + err.message);
            btn.textContent = "Save Changes";
            btn.disabled = false;
        }
    });
};

// ----------------------------------------------------
// Upload Card & Dynamic Card Types
// ----------------------------------------------------
document.getElementById('btn-add').addEventListener('click', async () => {
    selectedRosterPlayer = null;
    setActiveButton(document.getElementById('btn-add'));
    document.getElementById('page-title').textContent = "Add New Card";
    document.getElementById('view-tabs-container').style.display = 'none';
    
    const searchBox = document.getElementById('search-box-container');
    if (searchBox) searchBox.style.display = 'none';

    if (document.getElementById('counters-container')) {
        document.getElementById('counters-container').style.display = 'none';
    }

    const container = document.getElementById('dynamic-container');
    container.className = "";
    container.innerHTML = "<p style='color: var(--text-muted);'>Loading configuration...</p>";
    
    const pQ = query(collection(db, "players"), where("seasonId", "==", currentSeasonId));
    const pSnap = await getDocs(pQ);
    if (pSnap.empty) {
        container.innerHTML = `<p style='color: var(--danger);'>Please register players in the Squad Players first!</p>`;
        return;
    }
    
    let pOptions = "";
    pSnap.forEach(d => pOptions += `<option value="${d.data().playerName}">${d.data().playerName}</option>`);

    const eQ = query(collection(db, "user_events"), where("userId", "==", currentUser.uid));
    const eSnap = await getDocs(eQ);
    let eventOptions = `<option value="Gold Base">Gold Base</option><option value="TOTW">TOTW</option>`;
    eSnap.forEach(d => eventOptions += `<option value="${d.data().name}">${d.data().name}</option>`);
    eventOptions += `<option value="ADD_NEW">+ Add New Card Type...</option>`;

    container.innerHTML = `
        <div class="setup-box" style="margin: 0; box-shadow: none; width: 100%; max-width: 500px; text-align: left;">
            <form id="add-card-form" style="display:flex; flex-direction:column; gap:15px; margin: 0;">
                <label style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: -10px;">Select Player</label>
                <select id="selectedPlayer">${pOptions}</select>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: -6px;">
                    <label style="color: var(--text-muted); font-size: 0.9rem;">Card Type</label>
                    <button type="button" class="text-btn" onclick="openManageEventsModal()" style="color: var(--gold); font-size: 0.8rem; text-decoration: underline;">Manage Card Types</button>
                </div>
                <select id="promoEvent" onchange="if(this.value==='ADD_NEW') document.getElementById('customEventContainer').style.display='block'; else document.getElementById('customEventContainer').style.display='none';">
                    ${eventOptions}
                </select>
                
                <div id="customEventContainer" style="display:none; margin-top: -5px;">
                    <input type="text" id="customEventName" placeholder="Type new card type name...">
                </div>
                
                <label style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: -10px;">Overall Rating</label>
                <input type="number" id="rating" placeholder="e.g. 90" required>
                
                <label style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: -10px;">Card Image (PNG/JPG)</label>
                <input type="file" id="cardImage" accept="image/*" required>
                
                <button type="submit" id="submitBtn" class="primary-btn" style="margin-top: 10px;">Upload Card</button>
            </form>
        </div>
    `;

    document.getElementById('add-card-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn'); 
        btn.textContent = "Uploading..."; 
        btn.disabled = true;
        
        try {
            let eventName = document.getElementById('promoEvent').value;
            if (eventName === 'ADD_NEW') {
                eventName = document.getElementById('customEventName').value.trim();
                if(eventName) await addDoc(collection(db, "user_events"), { name: eventName, userId: currentUser.uid });
            }

            const formData = new FormData(); 
            formData.append('image', document.getElementById('cardImage').files[0]);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
            const imgData = await res.json();
            
            if (!imgData.success) throw new Error("Image upload failed");

            await addDoc(collection(db, "cards"), {
                playerName: document.getElementById('selectedPlayer').value,
                promoEvent: eventName,
                rating: Number(document.getElementById('rating').value),
                imageUrl: imgData.data.url,
                seasonId: currentSeasonId,
                userId: currentUser.uid,
                createdAt: new Date()
            });
            document.getElementById('btn-players').click();
        } catch(err) {
            alert("Error: " + err.message);
            btn.textContent = "Upload Card";
            btn.disabled = false;
        }
    });
});