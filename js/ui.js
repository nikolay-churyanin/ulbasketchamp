// ui.js - обновленная версия без вкладки игроков
class BasketballUI {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.setupModalCloseHandlers();
    }

    setupModalCloseHandlers() {
        // Закрытие модального окна при клике на крестик
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('team-modal');
            if (!modal || modal.style.display !== 'block') return;

            // Закрытие по крестику
            if (e.target.classList.contains('close')) {
                this.closeTeamModal();
            }
            
            // Закрытие по клику вне модального окна
            if (e.target === modal) {
                this.closeTeamModal();
            }
        });

        // Закрытие по клавише Escape
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('team-modal');
            if (modal && modal.style.display === 'block' && e.key === 'Escape') {
                this.closeTeamModal();
            }
        });
    }

    closeTeamModal() {
        const modal = document.getElementById('team-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showTeamModal(teamName, league = null) {
        // Если лига не указана, ищем команду во всех лигах
        if (!league) {
            // Проверяем все лиги
            const leagues = ['A', 'B', 'F'];
            for (const l of leagues) {
                const team = this.dataManager.getTeamByName(teamName, l);
                if (team) {
                    league = l;
                    break;
                }
            }
            
            if (!league) {
                console.error('Team not found in any league:', teamName);
                return;
            }
        }
        
        const team = this.dataManager.getTeamByName(teamName, league);
        if (!team) {
            console.error('Team not found:', teamName, 'in league:', league);
            return;
        }

        const modal = document.getElementById('team-modal');
        const title = document.getElementById('team-modal-title');
        const body = document.getElementById('team-modal-body');

        title.textContent = team.name;

        const games = this.dataManager.getGamesByTeam(team.name, league);
        const completedGames = games.filter(game => game.scoreHome !== null && game.scoreAway !== null);
        const wins = completedGames.filter(game => {
            const isHome = this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(team.name);
            return isHome ? game.scoreHome > game.scoreAway : game.scoreAway > game.scoreHome;
        }).length;
        const losses = completedGames.length - wins;

        let html = `
            <div class="team-info-header">
                <div class="team-logo-container">
                    <img src="${team.logo}" alt="${team.name}" class="team-info-logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplePSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+'">
                </div>
                <div class="team-info-details">
                    <h2>${team.name}</h2>
                    <div class="team-meta-info">
                        <div class="meta-item">
                            <span class="meta-label">Город:</span>
                            <span class="meta-value">${team.city || 'Не указан'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Лига:</span>
                            <span class="meta-value">${this.dataManager.getLeagueName(league)}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Рекорд:</span>
                            <span class="meta-value record-value">${wins}-${losses}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Сыграно:</span>
                            <span class="meta-value">${completedGames.length} матчей</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="team-section">
                <h3 class="team-section-title">Матчи команды</h3>
                <div class="team-games-list">
                    ${games.length > 0 ? games.map(game => {
                        const normalizedTeamName = this.dataManager.normalizeTeamName(team.name);
                        const isHome = this.dataManager.normalizeTeamName(game.teamHome) === normalizedTeamName;
                        const opponentName = isHome ? game.teamAway : game.teamHome;
                        const hasScore = game.scoreHome !== null && game.scoreAway !== null;
                        
                        let teamScore, opponentScore;
                        if (hasScore) {
                            teamScore = isHome ? game.scoreHome : game.scoreAway;
                            opponentScore = isHome ? game.scoreAway : game.scoreHome;
                        }
                        
                        const isWin = hasScore && teamScore > opponentScore;
                        const scoreClass = hasScore ? (isWin ? 'win' : 'loss') : '';
                        
                        // Определяем статус матча
                        let matchStatus = '';
                        let statusClass = '';
                        
                        if (hasScore) {
                            matchStatus = 'Завершен';
                            statusClass = 'status-finished';
                        } else {
                            const now = new Date();
                            const gameDate = game._fullDate ? new Date(game._fullDate) : null;
                            
                            if (gameDate) {
                                // Нормализуем даты до начала дня в UTC
                                const gameDay = new Date(Date.UTC(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()));
                                const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
                                const diffTime = gameDay - today;
                                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                
                                if (diffDays === 0) {
                                    matchStatus = 'Сегодня';
                                } else if (diffDays === 1) {
                                    matchStatus = 'Завтра';
                                } else {
                                    matchStatus = 'Предстоящий';
                                }
                            } else {
                                matchStatus = 'Предстоящий';
                            }
                            statusClass = 'status-upcoming';
                        }

                        return `
                            <div class="team-game-item" data-game-id="${game.id}" data-league="${league}">
                                <div class="game-info">
                                    <div class="game-date-status">
                                        <div class="game-date">${this.formatDate(game._fullDate)}</div>
                                        <div class="game-status ${statusClass}">${matchStatus}</div>
                                    </div>
                                    <div class="game-versus">
                                        <span class="game-home-away">${isHome ? '🏠 Дома' : '✈️ В гостях'}</span>
                                        <span class="game-vs">vs</span>
                                        <span class="game-opponent">${opponentName}</span>
                                    </div>
                                </div>
                                <div class="game-score">
                                    ${hasScore ? 
                                        `<div class="${scoreClass}-game-score">
                                            <span class="score-team">${teamScore}</span>
                                            <span class="score-separator">:</span>
                                            <span class="score-opponent">${opponentScore}</span>
                                        </div>` : 
                                        '<div class="no-score">- : -</div>'
                                    }
                                </div>
                            </div>
                        `;
                    }).join('') : '<p class="no-games-message">Матчей не найдено</p>'}
                </div>
            </div>
        `;

        body.innerHTML = html;
        modal.style.display = 'block';
        
        // Добавляем обработчики кликов по карточкам матчей
        setTimeout(() => {
            const gameItems = body.querySelectorAll('.team-game-item');
            gameItems.forEach(item => {
                item.addEventListener('click', async (e) => {
                    // Не открываем результат если кликнули на счет (это просто текст)
                    if (e.target.closest('.game-score')) return;
                    
                    const gameId = item.dataset.gameId;
                    const league = item.dataset.league;
                    
                    // Получаем данные игры
                    const game = this.dataManager.getGameById(gameId);
                    if (game) {
                        // Показываем модальное окно с деталями матча
                        // Нужно получить доступ к matchesRenderer из глобальной области
                        if (window.homePage && window.homePage.matchesRenderer) {

                            // Проверяем наличие картинки результата
                            const resultImageUrl = this.dataManager.getGameResultImage(game.id);
                            const hasResultImage = await this.dataManager.checkImageExists(resultImageUrl);
                    
                            if (hasResultImage) {
                                window.homePage.matchesRenderer.showFullscreenImage(resultImageUrl, `${game.teamHome} vs ${game.teamAway}`);
                            } else {
                                window.homePage.matchesRenderer.showMatchDetailsModal(game, league);
                            }
                        }
                    }
                });
            });
        }, 100);
    }

    formatDate(date) {
        if (!date || isNaN(date.getTime())) {
            return 'Дата не указана';
        }
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // UI будет инициализирован после загрузки данных в home.js
    console.log('UI module loaded');
});