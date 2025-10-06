// UI.js - Мобильная адаптивная версия (обновленная для работы с названиями)
class BasketballUI {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentLeague = 'A';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderTeams();
        this.renderGames();
        this.renderStats();
        this.hideLoading();
    }

    setupEventListeners() {
        // Переключение лиг (радио в шапке)
        document.querySelectorAll('input[name="league"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentLeague = e.target.value;
                console.log('League changed to:', this.currentLeague);
                this.renderTeams();
                this.renderGames();
                this.renderStats();
            });
        });

        // Устанавливаем дефолт
        const checked = document.querySelector('input[name="league"]:checked');
        if (checked) this.currentLeague = checked.value;

        // Переключение типа статистики
        document.querySelectorAll('.stat-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const statType = e.target.dataset.stat;
                document.querySelectorAll('.stat-chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById('stat-type').value = statType;
                this.renderStats();
            });
        });

        // Модальные окна
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            });
        });

        // Закрытие модальных окон по клику вне контента
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Закрытие по клавише Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }

    setupGamesTabs() {
        document.querySelectorAll('.games-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                
                // Убираем активный класс у всех вкладок и контента
                document.querySelectorAll('.games-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.games-tab-content').forEach(c => c.classList.remove('active'));
                
                // Добавляем активный класс текущей вкладке и контенту
                e.target.classList.add('active');
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        });
    }

    showLoading() {
        document.getElementById('loading-indicator').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loading-indicator').classList.remove('active');
    }

    renderTeams() {
        const container = document.getElementById('teams-container');
        if (!container) {
            console.error('Teams container not found!');
            return;
        }

        console.log('Rendering teams for league:', this.currentLeague);
        
        const standings = this.dataManager.getLeagueStandings(this.currentLeague);
        console.log('Standings:', standings);
        
        if (standings.length === 0) {
            container.innerHTML = '<p class="no-teams">Команды не найдены</p>';
            return;
        }

        container.innerHTML = `
            <div class="table-container">
                <table class="standings-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Команда</th>
                            <th>И</th>
                            <th>В</th>
                            <th>П</th>
                            <th>%</th>
                            <th>Последние<br/>5 игр</th>
                            <th>Забито</th>
                            <th>Пропущено</th>
                            <th>+/-</th>
                            <th>Очки</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${standings.map((stand, index) => `
                            <tr class="clickable-row" data-team-name="${stand.teamName}">
                                <td>${index + 1}</td>
                                <td>
                                    <div class="team-row">
                                        <img src="${stand.team.logo}" alt="${stand.teamName}" class="team-logo-small" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+'">
                                        ${stand.teamName}
                                    </div>
                                </td>
                                <td>${stand.played}</td>
                                <td>${stand.wins}</td>
                                <td>${stand.losses}</td>
                                <td>${stand.wins / Math.max(stand.played, 1) * 100}</td>
                                <td>
                                    ${stand.trand.slice(-5).split('').map((char, index) => `
                                        <div class="dot ${char === '1' ? 'green' : 'red'}"></div>
                                    `).join('')}
                                </td>
                                <td>${stand.pointsFor}</td>
                                <td>${stand.pointsAgainst}</td>
                                <td>${stand.pointsFor - stand.pointsAgainst}</td>
                                <td><strong>${stand.points}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.setupTeamClickHandlers();
        console.log('Teams rendered successfully');
    }

    setupTeamClickHandlers() {
        document.querySelectorAll('[data-team-name]').forEach(element => {
            element.addEventListener('click', (e) => {
                const teamName = e.currentTarget.dataset.teamName;
                console.log('Team clicked:', teamName);
                this.showTeamModal(teamName);
            });
        });
    }

    renderGames() {
        const container = document.getElementById('games-container');
        if (!container) {
            console.error('Games container not found!');
            return;
        }

        console.log('=== RENDERING ALL GAMES ===');
        
        let games = this.dataManager.getGamesByLeague(this.currentLeague);
        console.log('Total games found:', games.length);
        
        // Фильтруем игры с невалидными датами
        games = games.filter(game => game._fullDate && !isNaN(game._fullDate.getTime()));
        console.log('Games with valid dates:', games.length);
        
        // Фильтруем игры (скрываем старые без результатов)
        games = this.dataManager.getFilteredScheduledGames(games);
        console.log('Games after time filter:', games.length);
        
        if (games.length === 0) {
            container.innerHTML = '<p class="no-games">Матчи не найдены</p>';
            return;
        }

        // Разделяем игры на результаты и расписание
        const resultsGames = games.filter(game => game._hasResult || game._isFromResults);
        const scheduleGames = games.filter(game => !game._hasResult && !game._isFromResults);

        console.log('Results games:', resultsGames.length);
        console.log('Schedule games:', scheduleGames.length);

        // Создаем HTML для вкладок
        let html = `
            <div class="games-tabs">
                <button class="games-tab active" data-tab="results">Результаты (${resultsGames.length})</button>
                <button class="games-tab" data-tab="schedule">Расписание (${scheduleGames.length})</button>
            </div>
            
            <div class="games-tab-contents">
                <div class="games-tab-content active" id="results-tab">
        `;

        // Вкладка "Результаты"
        if (resultsGames.length === 0) {
            html += '<p class="no-games">Нет завершенных матчей</p>';
        } else {
            html += `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Дата и время</th>
                                <th>Команды</th>
                                <th>Счет</th>
                                <th>Место</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${resultsGames.map(game => {
                                const hasScore = game.scoreHome !== null && game.scoreAway !== null;
                                const statusClass = "finished";
                                const statusText = "Завершен";

                                const gameDateTime = this.formatDateTime(game._fullDate);

                                return `
                                    <tr class="clickable-row" data-game-id="${game._id}">
                                        <td>${gameDateTime}</td>
                                        <td>${game.teamHome} vs ${game.teamAway}</td>
                                        <td><strong>${hasScore ? `${game.scoreHome}:${game.scoreAway}` : '-:-'}</strong></td>
                                        <td>${game.location || 'Не указано'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += `
                </div>
                <div class="games-tab-content" id="schedule-tab">
        `;

        // Вкладка "Расписание"
        if (scheduleGames.length === 0) {
            html += '<p class="no-games">Нет предстоящих матчей</p>';
        } else {
            html += `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Дата и время</th>
                                <th>Команды</th>
                                <th>Место</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${scheduleGames.map(game => {
                                const hasScore = game.scoreHome !== null && game.scoreAway !== null;
                                const statusClass = this.gameStatus(game._fullDate, hasScore);
                                const statusText = this.gameStatusStr(statusClass, hasScore);

                                const gameDateTime = this.formatDateTime(game._fullDate);

                                return `
                                    <tr class="clickable-row" data-game-id="${game._id}">
                                        <td>${gameDateTime}</td>
                                        <td>${game.teamHome} vs ${game.teamAway}</td>
                                        <td>${game.location || 'Не указано'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;

        this.setupGamesTabs();
        this.setupGameClickHandlers();
        console.log('Games rendered successfully with tabs');
    }

    setupScheduleTabs() {
        document.querySelectorAll('.schedule-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const stage = e.target.dataset.stage;
                
                // Убираем активный класс у всех вкладок и контента
                document.querySelectorAll('.schedule-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.schedule-tab-content').forEach(c => c.classList.remove('active'));
                
                // Добавляем активный класс текущей вкладке и контенту
                e.target.classList.add('active');
                document.querySelector(`.schedule-tab-content[data-stage="${stage}"]`).classList.add('active');
            });
        });
    }

    setupGameClickHandlers() {
        document.querySelectorAll('[data-game-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                const gameId = e.currentTarget.dataset.gameId;
                console.log('Game clicked:', gameId);
                this.showGameModal(gameId);
            });
        });
    }

    renderStats() {
        const container = document.getElementById('stats-container');
        if (!container) {
            console.error('Stats container not found!');
            return;
        }

        console.log('Rendering stats for league:', this.currentLeague);
        const statType = document.getElementById('stat-type').value;
        const minGames = parseInt(document.getElementById('min-games').value) || 1;
        
        const stats = this.dataManager.getPlayerStatsByLeague(this.currentLeague, statType, minGames, true);
        console.log('Player stats found:', stats.length);
        
        if (stats.length === 0) {
            container.innerHTML = '<p class="no-stats">Статистика не найдена</p>';
            return;
        }

        const statLabels = {
            'points': 'Очки',
            'rebounds': 'Подборы',
            'assists': 'Передачи',
            'steals': 'Перехваты',
            'blocks': 'Блок-шоты'
        };

        container.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Игрок</th>
                            <th>Команда</th>
                            <th>Игры</th>
                            <th>${statLabels[statType]} за игру</th>
                            <th>${statLabels[statType]} всего</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.map((player, index) => {
                            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${player.name}</td>
                                    <td>${player.teamName}</td>
                                    <td>${player.gamesPlayed}</td>
                                    <td><strong>${player[statType + 'PerGame'].toFixed(1)}</strong></td>
                                    <td><strong>${player[statType + 'Total'].toFixed(1)}</strong></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
        console.log('Stats rendered successfully');
    }

    showGameModal(gameId) {
        const game = this.dataManager.getGameById(gameId);
        if (!game) {
            console.log('Game not found:', gameId);
            return;
        }

        const modal = document.getElementById('game-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        title.textContent = `${game.teamHome} vs ${game.teamAway}`;

        let html = `
            <div class="game-details">
                <div style="text-align: center; margin-bottom: 1rem;">
                    <p><strong>Дата:</strong> ${this.formatDate(game._fullDate)}</p>
                    <p><strong>Место:</strong> ${game.location}</p>
                    <p><strong>Статус:</strong> <span class="${this.gameStatus(game._fullDate)}">
                        ${this.gameStatusStr(this.gameStatus(game._fullDate))}
                    </span></p>
                </div>

                <div class="game-score">
                    ${game.teamHome} ${game.scoreHome !== null ? game.scoreHome : '-'} 
                    : 
                    ${game.scoreAway !== null ? game.scoreAway : '-'} ${game.teamAway}
                </div>
        `;

        if (game.playerStats && Object.keys(game.playerStats).length > 0) {
            const homePlayers = Object.entries(game.playerStats)
                .filter(([playerName, stats]) => stats.teamName === game.teamHome);
            const awayPlayers = Object.entries(game.playerStats)
                .filter(([playerName, stats]) => stats.teamName === game.teamAway);

            html += `
                <div class="modal-tabs">
                    <button class="modal-tab active" data-tab="home-stats">${game.teamHome}</button>
                    <button class="modal-tab" data-tab="away-stats">${game.teamAway}</button>
                </div>

                <div class="modal-tab-content active" id="home-stats">
                    <h4>Статистика игроков ${game.teamHome}</h4>
                    <div class="table-container">
                        <table class="player-stats-table">
                            <thead>
                                <tr>
                                    <th>Игрок</th>
                                    <th>Очки</th>
                                    <th>Подборы</th>
                                    <th>Передачи</th>
                                    <th>Перехваты</th>
                                    <th>Блоки</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${homePlayers.map(([playerName, stats]) => `
                                    <tr>
                                        <td>${playerName}</td>
                                        <td>${stats.points || 0}</td>
                                        <td>${stats.rebounds || 0}</td>
                                        <td>${stats.assists || 0}</td>
                                        <td>${stats.steals || 0}</td>
                                        <td>${stats.blocks || 0}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="modal-tab-content" id="away-stats">
                    <h4>Статистика игроков ${game.teamAway}</h4>
                    <div class="table-container">
                        <table class="player-stats-table">
                            <thead>
                                <tr>
                                    <th>Игрок</th>
                                    <th>Очки</th>
                                    <th>Подборы</th>
                                    <th>Передачи</th>
                                    <th>Перехваты</th>
                                    <th>Блоки</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${awayPlayers.map(([playerName, stats]) => `
                                    <tr>
                                        <td>${playerName}</td>
                                        <td>${stats.points || 0}</td>
                                        <td>${stats.rebounds || 0}</td>
                                        <td>${stats.assists || 0}</td>
                                        <td>${stats.steals || 0}</td>
                                        <td>${stats.blocks || 0}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        html += '</div>';

        body.innerHTML = html;
        modal.style.display = 'block';

        this.setupModalTabs();
    }

    setupModalTabs() {
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;
                
                // Убираем активный класс у всех вкладок и контента
                document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
                
                // Добавляем активный класс текущей вкладке и контенту
                e.target.classList.add('active');
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    showTeamModal(teamName) {
        const team = this.dataManager.getTeamByName(teamName);
        if (!team) {
            console.error('Team not found:', teamName);
            return;
        }

        const modal = document.getElementById('team-modal');
        const title = document.getElementById('team-modal-title');
        const body = document.getElementById('team-modal-body');

        title.textContent = team.name;

        const players = this.dataManager.getPlayersByTeam(team.name);
        const games = this.dataManager.getGamesByTeam(team.name);
        const completedGames = games.filter(game => game.scoreHome !== null && game.scoreAway !== null);
        const wins = completedGames.filter(game => {
            const isHome = game.teamHome === team.name;
            return isHome ? game.scoreHome > game.scoreAway : game.scoreAway > game.scoreHome;
        }).length;
        const losses = completedGames.length - wins;

        let html = `
            <div class="team-info-header">
                <img src="${team.logo}" alt="${team.name}" class="team-info-logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+'">
                <div class="team-info-details">
                    <h2>${team.name}</h2>
                    <p><strong>Город:</strong> ${team.city}</p>
                    <p><strong>Лига:</strong> ${team.league === 'A' ? 'Лига А' : 'Лига Б'}</p>
                    <p><strong>Рекорд:</strong> ${wins}-${losses}</p>
                </div>
            </div>

            <div class="modal-tabs">
                <button class="modal-tab active" data-tab="team-tab-players">Состав</button>
                <button class="modal-tab" data-tab="team-tab-schedule">Расписание</button>
            </div>

            <div class="modal-tab-content active" id="team-tab-players">
                <div class="team-section">
                    <h4>Состав команды</h4>
                    <div class="players-list">
                        ${players.map(player => `
                            <div class="player-item">
                                <div class="player-info">
                                    <div class="player-number">${player.number}</div>
                                    <div>
                                        <div class="player-name">${player.name}</div>
                                        <div class="player-position">${player.position}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="modal-tab-content" id="team-tab-schedule">
                <div class="team-section">
                    <h4>Матчи</h4>
                    <div class="team-games-list">
                        ${games.slice(0, 5).map(game => {
                            const opponentName = this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(team.name) ? game.teamAway : game.teamHome;
                            const isHome = this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(team.name);
                            const hasScore = game.scoreHome !== null && game.scoreAway !== null;
                            const teamScore = isHome ? game.scoreHome : game.scoreAway;
                            const opponentScore = isHome ? game.scoreAway : game.scoreHome;
                            const statusClass = hasScore ? 'finished' : this.gameStatus(game._fullDate);
                            const statusText = hasScore ? 'Завершен' : this.gameStatusStr(statusClass);
                            const isWin = teamScore > opponentScore
                            const scoreClass = isWin ? 'win' : 'loss'
                            
                            return `
                                <div class="team-game-item">
                                    <div class="game-date">${this.formatDate(game._fullDate)}</div>
                                    <div class="game-versus">${isHome ? '🏠' : '✈️'} vs ${opponentName}</div>
                                    ${hasScore ? `<div class="${scoreClass}-game-score">${teamScore} : ${opponentScore}</div>` : '- : -'}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        body.innerHTML = html;
        modal.style.display = 'block';
        this.setupModalTabs();
    }

    gameStatus(gameDate, hasResult = false) {
        if (hasResult) {
            return "finished";
        }
        
        if (!gameDate || isNaN(gameDate.getTime())) {
            return "upcoming";
        }
        
        const currentDate = new Date();
        const diffMs = gameDate - currentDate;
        const ninetyMinutesMs = 90 * 60 * 1000;
        
        if (diffMs > 0 && diffMs <= ninetyMinutesMs) {
            return "soon";
        } else if (diffMs <= 0 && Math.abs(diffMs) <= ninetyMinutesMs) {
            return "live";
        } else if (diffMs < 0 && Math.abs(diffMs) > ninetyMinutesMs) {
            return "finished";
        } else {
            return "upcoming";
        }
    }

    gameStatusStr(status, hasResult = false) {
        if (hasResult) {
            return "Завершен";
        }
        
        switch(status) {
            case "soon": return "Скоро начнется";
            case "live": return "Идёт";
            case "finished": return "Завершен";
            default: return "Предстоящий";
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatDateTime(date) {
        if (!date || isNaN(date.getTime())) {
            return 'Дата не указана';
        }
        
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const dataManager = new BasketballData();
    dataManager.ready.then(() => {
        const ui = new BasketballUI(dataManager);
        window.basketballUI = ui;
        window.basketballData = dataManager;
        console.log('UI initialized successfully');
    }).catch(error => {
        console.error('Error initializing UI:', error);
    });
});