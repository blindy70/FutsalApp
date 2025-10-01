const App = {
    DB: {
        getPlayers: () => {
            return JSON.parse(localStorage.getItem('futsal_players')) || [];
        },
        savePlayers: (players) => {
            localStorage.setItem('futsal_players', JSON.stringify(players));
        }
    },
    matchTime: 0,
    matchTimerInterval: null,
    playerTimers: {},
    draggedPlayerId: null,
    currentHalf: 1,
    halfTimes: {
        1: 0,
        2: 0
    },
    matchPlayers: [],
    currentMatchStarters: [],
    currentMatchSubstitutes: [],

    init: () => {
        App.renderHomePage();
    },

    renderHomePage: () => {
        const appContainer = document.getElementById('app');
        const html = `
            <h2>Gestor de Tiempo de Juego</h2>
            <div class="actions">
                <button class="btn" id="goToTeamManagementBtn">Mi Equipo</button>
                <button class="btn" id="goToNewMatchBtn">Nuevo Partido</button>
            </div>
        `;
        appContainer.innerHTML = html;

        document.getElementById('goToTeamManagementBtn').addEventListener('click', App.renderTeamManagementPage);
        document.getElementById('goToNewMatchBtn').addEventListener('click', App.renderNewMatchPage);
    },

    renderTeamManagementPage: () => {
        const appContainer = document.getElementById('app');
        const players = App.DB.getPlayers();

        const html = `
            <h2>Mi Equipo</h2>
            <div class="form-group">
                <label for="playerName">Nombre del Jugador</label>
                <input type="text" id="playerName" placeholder="Ej: Juan Pérez">
            </div>
            <div class="form-group">
                <label for="playerDorsal">Dorsal</label>
                <input type="number" id="playerDorsal" placeholder="Ej: 10">
            </div>
            <div class="actions">
                <button class="btn btn-success" id="addPlayerBtn">Añadir Jugador</button>
            </div>
            <ul class="player-list" id="playerList">
                ${players.map(player => `
                    <li class="player-item" data-id="${player.id}">
                        <span>${player.dorsal} - ${player.name}</span>
                        <button class="btn btn-danger deletePlayerBtn">Eliminar</button>
                    </li>
                `).join('')}
            </ul>
            <div class="actions">
                <button class="btn" id="backToHomeBtn">Volver al Inicio</button>
                <button class="btn" id="goToNewMatchBtn">Ir a Nuevo Partido</button>
            </div>
        `;

        appContainer.innerHTML = html;

        document.getElementById('addPlayerBtn').addEventListener('click', App.addPlayer);
        document.querySelectorAll('.deletePlayerBtn').forEach(btn => {
            btn.addEventListener('click', App.deletePlayer);
        });
        document.getElementById('goToNewMatchBtn').addEventListener('click', App.renderNewMatchPage);
        document.getElementById('backToHomeBtn').addEventListener('click', App.renderHomePage);
    },

    addPlayer: () => {
        const nameInput = document.getElementById('playerName');
        const dorsalInput = document.getElementById('playerDorsal');
        const name = nameInput.value.trim();
        const dorsal = parseInt(dorsalInput.value);

        if (name && dorsal) {
            const players = App.DB.getPlayers();
            const newPlayer = {
                id: Date.now(),
                name: name,
                dorsal: dorsal
            };
            players.push(newPlayer);
            App.DB.savePlayers(players);
            App.renderTeamManagementPage();
        } else {
            alert('Por favor, introduce un nombre y un dorsal válidos.');
        }
    },

    deletePlayer: (e) => {
        const playerId = parseInt(e.target.closest('.player-item').dataset.id);
        let players = App.DB.getPlayers();
        players = players.filter(p => p.id !== playerId);
        App.DB.savePlayers(players);
        App.renderTeamManagementPage();
    },

    renderNewMatchPage: () => {
        const appContainer = document.getElementById('app');
        const players = App.DB.getPlayers();

        if (players.length < 5) {
            alert('Debes tener al menos 5 jugadores en tu equipo para empezar un partido.');
            return;
        }

        const html = `
            <h2>Nuevo Partido</h2>
            <h3>Selecciona los jugadores para el partido (5 titulares, hasta 12 en total)</h3>
            <ul class="player-list" id="playerSelectionList">
                ${players.map(player => `
                    <li class="player-item" data-id="${player.id}">
                        <span>${player.dorsal} - ${player.name}</span>
                        <input type="checkbox" class="player-checkbox">
                    </li>
                `).join('')}
            </ul>
            <div class="actions">
                <button class="btn btn-success" id="startMatchBtn">Empezar Partido</button>
                <button class="btn btn-secondary" id="backToHomeBtn">Volver al Inicio</button>
            </div>
        `;

        appContainer.innerHTML = html;

        document.getElementById('startMatchBtn').addEventListener('click', App.startMatch);
        document.getElementById('backToHomeBtn').addEventListener('click', App.renderHomePage);
    },

    startMatch: () => {
        const selectedCheckboxes = document.querySelectorAll('.player-checkbox:checked');
        const selectedPlayers = Array.from(selectedCheckboxes).map(cb => {
            const playerId = parseInt(cb.closest('.player-item').dataset.id);
            return App.DB.getPlayers().find(p => p.id === playerId);
        });

        if (selectedPlayers.length < 5 || selectedPlayers.length > 12) {
            alert('Debes seleccionar entre 5 y 12 jugadores para el partido.');
            return;
        }
        
        App.matchPlayers = selectedPlayers;
        App.currentMatchStarters = selectedPlayers.slice(0, 5);
        App.currentMatchSubstitutes = selectedPlayers.slice(5);

        selectedPlayers.forEach(player => {
            App.playerTimers[player.id] = {
                totalTime: 0,
                currentRotationTime: 0,
                halfTimes: { 1: 0, 2: 0 },
                interval: null,
                ejected: false
            };
        });

        App.renderMatchPage(App.currentMatchStarters, App.currentMatchSubstitutes);
    },

    renderMatchPage: (starters, substitutes) => {
        const appContainer = document.getElementById('app');
        const html = `
            <h2>Partido en Juego</h2>
            <div class="match-timer">
                <h3>Tiempo de Partido - <span id="currentHalfDisplay">${App.currentHalf}ª Parte</span></h3>
                <div id="matchTimer">${App.formatTime(App.matchTime)}</div>
                <div class="actions">
                    <button class="btn btn-success" id="startPauseMatchBtn">Iniciar</button>
                    <button class="btn btn-secondary" id="switchHalfBtn">Cambiar de Parte</button>
                    <button class="btn btn-danger" id="endMatchBtn">Finalizar Partido</button>
                </div>
            </div>
            <div class="player-containers">
                <div class="on-court-container">
                    <h3>En la Cancha</h3>
                    <ul class="player-list" id="onCourtList">
                        ${starters.map(player => `
                            <li class="player-item" data-id="${player.id}" draggable="true">
                                <span>${player.dorsal} - ${player.name}</span>
                                <small><span id="player-rotation-time-${player.id}">${App.formatTime(App.playerTimers[player.id].currentRotationTime)}</span></small>
                                <small><span id="player-half-time-${player.id}">${App.formatTime(App.currentHalf === 1 ? App.playerTimers[player.id].halfTimes[App.currentHalf] : App.playerTimers[player.id].totalTime)}</span></small>
                                <button class="btn btn-danger ejectPlayerBtn">X</button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <div class="substitutes-container">
                    <h3>Banquillo</h3>
                    <ul class="player-list" id="substituteList">
                        ${substitutes.map(player => `
                            <li class="player-item" data-id="${player.id}" draggable="true">
                                <span>${player.dorsal} - ${player.name}</span>
                                <small><span id="player-rotation-time-${player.id}">${App.formatTime(App.playerTimers[player.id].currentRotationTime)}</span></small>
                                <small><span id="player-half-time-${player.id}">${App.formatTime(App.currentHalf === 1 ? App.playerTimers[player.id].halfTimes[App.currentHalf] : App.playerTimers[player.id].totalTime)}</span></small>
                                <button class="btn btn-danger ejectPlayerBtn">X</button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;

        appContainer.innerHTML = html;

        document.getElementById('startPauseMatchBtn').addEventListener('click', App.toggleMatchTimer);
        document.getElementById('switchHalfBtn').addEventListener('click', App.switchHalf);
        document.getElementById('endMatchBtn').addEventListener('click', App.endMatch);
        
        document.querySelectorAll('.player-list').forEach(list => {
            list.addEventListener('dragover', App.handleDragOver);
            list.addEventListener('drop', App.handleDrop);
        });

        document.querySelectorAll('.player-item').forEach(item => {
            item.addEventListener('dragstart', App.handleDragStart);
            item.addEventListener('dragend', App.handleDragEnd);
        });

        document.querySelectorAll('.ejectPlayerBtn').forEach(btn => {
            btn.addEventListener('click', App.ejectPlayer);
        });
    },

    handleDragStart: (e) => {
        App.draggedPlayerId = e.target.dataset.id;
        e.dataTransfer.setData('text/plain', App.draggedPlayerId);
        e.target.classList.add('dragging');
    },

    handleDragOver: (e) => {
        e.preventDefault();
    },

    handleDrop: (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        const draggedPlayerItem = document.querySelector(`[data-id="${draggedId}"]`);
        const sourceList = draggedPlayerItem.parentNode;
        const targetList = e.target.closest('.player-list');

        if (!targetList || sourceList.id === targetList.id) {
            return;
        }

        const targetPlayerItem = e.target.closest('.player-item');

        if (targetPlayerItem) {
            const sourcePlayer = draggedPlayerItem;
            const targetPlayer = targetPlayerItem;
            
            const sourceParent = sourcePlayer.parentNode;
            const targetParent = targetPlayer.parentNode;
            
            const sourceNextSibling = sourcePlayer.nextSibling;
            const targetNextSibling = targetPlayer.nextSibling;

            sourceParent.insertBefore(targetPlayer, sourceNextSibling);
            targetParent.insertBefore(sourcePlayer, targetNextSibling);

        } else {
            if (targetList.id === 'onCourtList' && targetList.children.length >= 5) {
                alert('Ya hay 5 jugadores en la cancha. Realiza una sustitución.');
                return;
            }
            targetList.appendChild(draggedPlayerItem);
        }
        
        App.updateAllPlayersState();
    },

    handleDragEnd: (e) => {
        e.target.classList.remove('dragging');
    },
    
    updateAllPlayersState: () => {
        const onCourtList = document.getElementById('onCourtList');
        const substituteList = document.getElementById('substituteList');
        const isMatchRunning = document.getElementById('startPauseMatchBtn').textContent === 'Pausar';

        App.currentMatchStarters = [];
        App.currentMatchSubstitutes = [];

        onCourtList.querySelectorAll('.player-item').forEach(item => {
            const playerId = parseInt(item.dataset.id);
            const player = App.matchPlayers.find(p => p.id === playerId);
            App.currentMatchStarters.push(player);
            App.updatePlayerUI(item, true);
            if (isMatchRunning) {
                App.startSinglePlayerTimer(playerId);
            }
        });

        substituteList.querySelectorAll('.player-item').forEach(item => {
            const playerId = parseInt(item.dataset.id);
            const player = App.matchPlayers.find(p => p.id === playerId);
            App.currentMatchSubstitutes.push(player);
            App.updatePlayerUI(item, false);
            App.pauseSinglePlayerTimer(playerId);
            App.playerTimers[playerId].currentRotationTime = 0;
            const rotationTimeEl = document.getElementById(`player-rotation-time-${playerId}`);
            if(rotationTimeEl) rotationTimeEl.textContent = App.formatTime(0);
        });
    },

    updatePlayerUI: (playerItem, isOnCourt) => {
        let ejectBtn = playerItem.querySelector('.ejectPlayerBtn');
        if (!ejectBtn) {
            ejectBtn = document.createElement('button');
            ejectBtn.classList.add('btn', 'btn-danger', 'ejectPlayerBtn');
            ejectBtn.textContent = 'X';
            ejectBtn.addEventListener('click', App.ejectPlayer);
            playerItem.appendChild(ejectBtn);
        }
    },

    ejectPlayer: (e) => {
        const playerItem = e.currentTarget.closest('.player-item');
        const playerId = parseInt(playerItem.dataset.id);

        if (confirm('¿Estás seguro de que quieres expulsar a este jugador del partido?')) {
            if (App.playerTimers[playerId]) {
                App.pauseSinglePlayerTimer(playerId);
                App.playerTimers[playerId].ejected = true;
            }

            App.currentMatchStarters = App.currentMatchStarters.filter(p => p.id !== playerId);
            App.currentMatchSubstitutes = App.currentMatchSubstitutes.filter(p => p.id !== playerId);

            playerItem.remove();
        }
    },

    startSinglePlayerTimer: (playerId) => {
        if (App.playerTimers[playerId] && !App.playerTimers[playerId].interval) {
            App.playerTimers[playerId].interval = setInterval(() => {
                const timerData = App.playerTimers[playerId];
                timerData.currentRotationTime++;
                timerData.totalTime++;
                timerData.halfTimes[App.currentHalf]++;
                
                const rotationTimeEl = document.getElementById(`player-rotation-time-${playerId}`);
                if (rotationTimeEl) {
                    rotationTimeEl.textContent = App.formatTime(timerData.currentRotationTime);
                }
                const halfTimeEl = document.getElementById(`player-half-time-${playerId}`);
                if (halfTimeEl) {
                    halfTimeEl.textContent = App.formatTime(App.currentHalf === 1 ? timerData.halfTimes[App.currentHalf] : timerData.totalTime);
                }
            }, 1000);
        }
    },

    pauseSinglePlayerTimer: (playerId) => {
        if (App.playerTimers[playerId] && App.playerTimers[playerId].interval) {
            clearInterval(App.playerTimers[playerId].interval);
            App.playerTimers[playerId].interval = null;
        }
    },

    toggleMatchTimer: () => {
        const button = document.getElementById('startPauseMatchBtn');
        const isMatchPaused = button.textContent !== 'Pausar';

        if (isMatchPaused) {
            button.textContent = 'Pausar';
            button.classList.remove('btn-success');
            button.classList.add('btn-danger');
            App.matchTimerInterval = setInterval(App.updateMatchTimer, 1000);
            App.startAllPlayerTimers();
        } else {
            button.textContent = 'Reanudar';
            button.classList.remove('btn-danger');
            button.classList.add('btn-success');
            clearInterval(App.matchTimerInterval);
            App.pauseAllPlayerTimers();
        }
    },

    updateMatchTimer: () => {
        App.matchTime++;
        document.getElementById('matchTimer').textContent = App.formatTime(App.matchTime);
    },

    startAllPlayerTimers: () => {
        document.querySelectorAll('#onCourtList .player-item').forEach(item => {
            const playerId = parseInt(item.dataset.id);
            App.startSinglePlayerTimer(playerId);
        });
    },

    pauseAllPlayerTimers: () => {
        for (const playerId in App.playerTimers) {
            App.pauseSinglePlayerTimer(playerId);
        }
    },

    switchHalf: () => {
        if (App.currentHalf === 1) {
            if (!confirm('¿Estás seguro de que quieres cambiar a la segunda parte? Esto reiniciará el cronómetro.')) {
                return;
            }
            App.halfTimes[1] = App.matchTime;
            
            if (App.matchTimerInterval) {
                clearInterval(App.matchTimerInterval);
                App.matchTimerInterval = null;
            }
            App.pauseAllPlayerTimers();
            const button = document.getElementById('startPauseMatchBtn');
            button.textContent = 'Iniciar';
            button.classList.remove('btn-danger');
            button.classList.add('btn-success');

            const playersWithTime = App.matchPlayers.map(player => {
                const playerStats = App.playerTimers[player.id] || { totalTime: 0, halfTimes: {1: 0, 2: 0} };
                const ejectedStatus = playerStats.ejected ? ' (Expulsado)' : '';
                return {
                    ...player,
                    totalTime: playerStats.totalTime,
                    half1Time: playerStats.halfTimes[1],
                    ejectedStatus: ejectedStatus
                };
            });

            App.renderHalfSummaryPage(playersWithTime);
            
        } else {
            alert('El partido ya está en la segunda parte.');
        }
    },

    renderHalfSummaryPage: (playersWithTime) => {
        const appContainer = document.getElementById('app');
        playersWithTime.sort((a, b) => b.half1Time - a.half1Time);

        const html = `
            <h2>Resumen de la 1ª Parte</h2>
            <h3>Tiempo Total de la 1ª Parte: ${App.formatTime(App.halfTimes[1])}</h3>
            <ul class="player-list">
                ${playersWithTime.map(player => `
                    <li class="player-item">
                        <span>${player.dorsal} - ${player.name}${player.ejectedStatus}</span>
                        <small>Tiempo en 1ª Parte: ${App.formatTime(player.half1Time)}</small>
                    </li>
                `).join('')}
            </ul>
            <div class="actions">
                <button class="btn" id="continueMatchBtn">Continuar Partido</button>
            </div>
        `;

        appContainer.innerHTML = html;
        document.getElementById('continueMatchBtn').addEventListener('click', () => {
            App.currentHalf = 2;
            App.matchTime = 0;
            
            App.currentMatchStarters.forEach(player => {
                if (App.playerTimers[player.id]) {
                    App.playerTimers[player.id].currentRotationTime = 0;
                }
            });
            
            App.renderMatchPage(App.currentMatchStarters, App.currentMatchSubstitutes);
            document.getElementById('currentHalfDisplay').textContent = '2ª Parte';
        });
    },

    endMatch: () => {
        if (!confirm('¿Estás seguro de que quieres finalizar el partido?')) {
            return;
        }

        if (App.matchTimerInterval) {
            clearInterval(App.matchTimerInterval);
            App.matchTimerInterval = null;
        }
        App.pauseAllPlayerTimers();

        App.halfTimes[App.currentHalf] = App.matchTime;

        const appContainer = document.getElementById('app');
        const playersWithTime = App.matchPlayers.map(player => {
            const playerStats = App.playerTimers[player.id] || { totalTime: 0, halfTimes: {1: 0, 2: 0} };
            const ejectedStatus = playerStats.ejected ? ' (Expulsado)' : '';
            return {
                ...player,
                totalTime: playerStats.totalTime,
                half1Time: playerStats.halfTimes[1],
                half2Time: playerStats.halfTimes[2],
                ejectedStatus: ejectedStatus
            };
        });

        const html = `
            <h2>Partido Finalizado</h2>
            <h3>Resumen de Tiempo de Juego</h3>
            <p>Tiempo Total 1ª Parte: ${App.formatTime(App.halfTimes[1])}</p>
            <p>Tiempo Total 2ª Parte: ${App.formatTime(App.halfTimes[2])}</p>
            <ul class="player-list">
                ${playersWithTime.map(player => `
                    <li class="player-item">
                        <span>${player.dorsal} - ${player.name}${player.ejectedStatus}</span>
                        <small>Total Partido: ${App.formatTime(player.totalTime)}</small>
                        <small>1ª Parte: ${App.formatTime(player.half1Time)}</small>
                        <small>2ª Parte: ${App.formatTime(player.half2Time)}</small>
                    </li>
                `).join('')}
            </ul>
            <div class="actions">
                <button class="btn" id="backToHomeBtn">Volver al Inicio</button>
            </div>
        `;

        appContainer.innerHTML = html;
        document.getElementById('backToHomeBtn').addEventListener('click', App.renderHomePage);
    },

    formatTime: (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
};

document.addEventListener('DOMContentLoaded', App.init);