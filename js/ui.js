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
        
        // Добавляем стили для модального окна
        this.addTeamModalStyles();
        
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

    addTeamModalStyles() {
        if (document.getElementById('team-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'team-modal-styles';
        style.textContent = `
            /* Стили для модального окна команды */
            .team-info-header {
                display: flex;
                gap: 20px;
                margin-bottom: 25px;
                padding-bottom: 20px;
                border-bottom: 1px solid #e9ecef;
                align-items: flex-start;
            }
            
            .team-logo-container {
                flex-shrink: 0;
            }
            
            .team-info-logo {
                width: 100px;
                height: 100px;
                object-fit: contain;
                border-radius: 12px;
                background: #f8f9fa;
                padding: 10px;
                border: 2px solid #e9ecef;
                box-sizing: border-box;
            }
            
            .team-info-details {
                flex: 1;
                min-width: 0;
            }
            
            .team-info-details h2 {
                margin: 0 0 15px 0;
                color: #2c3e50;
                font-size: 1.6rem;
                line-height: 1.2;
                word-break: break-word;
            }
            
            .team-meta-info {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            
            .meta-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .meta-label {
                font-size: 0.85rem;
                color: #6c757d;
                font-weight: 500;
            }
            
            .meta-value {
                font-size: 1rem;
                color: #2c3e50;
                font-weight: 600;
            }
            
            .record-value {
                color: #28a745;
                font-weight: 700;
            }
            
            /* Секция матчей */
            .team-section {
                margin-top: 10px;
            }
            
            .team-section-title {
                margin: 0 0 15px 0;
                color: #0055a5;
                font-size: 1.2rem;
                padding-bottom: 10px;
                border-bottom: 2px solid #e9ecef;
            }
            
            /* Список матчей */
            .team-games-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-height: 500px;
                overflow-y: auto;
                padding-right: 5px;
            }
            
            .team-game-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 15px;
                padding: 12px;
                background: #f8f9fa;
                border-radius: 10px;
                border: 1px solid #e9ecef;
                transition: all 0.3s ease;
            }
            
            .team-game-item:hover {
                background: #e9ecef;
                border-color: #dee2e6;
            }
            
            .game-info {
                flex: 1;
                min-width: 0;
            }
            
            .game-date-status {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 8px;
            }
            
            .game-date {
                font-size: 0.9rem;
                color: #6c757d;
                font-weight: 500;
            }
            
            .game-status {
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 600;
            }
            
            .status-finished {
                background: rgba(40, 167, 69, 0.1);
                color: #28a745;
            }
            
            .status-upcoming {
                background: rgba(0, 123, 255, 0.1);
                color: #007bff;
            }
            
            .game-versus {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.95rem;
            }
            
            .game-home-away {
                font-size: 0.85rem;
                color: #6c757d;
            }
            
            .game-vs {
                color: #adb5bd;
                font-weight: 600;
            }
            
            .game-opponent {
                font-weight: 600;
                color: #2c3e50;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .game-score {
                flex-shrink: 0;
            }
            
            .win-game-score,
            .loss-game-score,
            .no-score {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 1.1rem;
                font-weight: 700;
                padding: 6px 10px;
                border-radius: 8px;
                min-width: 85px;
                justify-content: center;
            }
            
            .win-game-score {
                background: rgba(40, 167, 69, 0.1);
                color: #28a745;
            }
            
            .loss-game-score {
                background: rgba(220, 53, 69, 0.1);
                color: #dc3545;
            }
            
            .no-score {
                background: #f8f9fa;
                color: #6c757d;
            }
            
            .score-team,
            .score-opponent {
                min-width: 25px;
                text-align: center;
            }
            
            .score-separator {
                font-weight: 600;
                color: inherit;
            }
            
            .no-games-message {
                text-align: center;
                padding: 30px 20px;
                color: #6c757d;
                font-size: 1rem;
                background: #f8f9fa;
                border-radius: 10px;
                border: 1px solid #e9ecef;
            }
            
            /* Анимации */
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            /* Адаптивность для мобильных */
            @media (max-width: 768px) {
                .team-info-header {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    gap: 15px;
                    margin-bottom: 20px;
                    padding-bottom: 15px;
                }
                
                .team-info-logo {
                    width: 80px;
                    height: 80px;
                }
                
                .team-info-details h2 {
                    font-size: 1.4rem;
                    margin-bottom: 12px;
                }
                
                .team-meta-info {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }
                
                .meta-item {
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .meta-label {
                    font-size: 0.8rem;
                }
                
                .meta-value {
                    font-size: 0.9rem;
                }
                
                .team-section-title {
                    font-size: 1.1rem;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                }
                
                .team-game-item {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 10px;
                    padding: 10px;
                }
                
                .game-info {
                    width: 100%;
                }
                
                .game-score {
                    width: 100%;
                }
                
                .win-game-score,
                .loss-game-score,
                .no-score {
                    width: 100%;
                    justify-content: center;
                }
            }
            
            @media (max-width: 480px) {
                .team-info-logo {
                    width: 70px;
                    height: 70px;
                }
                
                .team-info-details h2 {
                    font-size: 1.3rem;
                }
                
                .team-games-list {
                    max-height: 400px;
                }
                
                .game-date-status {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 5px;
                }
                
                .game-status {
                    align-self: flex-start;
                }
                
                .game-versus {
                    flex-wrap: wrap;
                    gap: 5px;
                }
                
                .win-game-score,
                .loss-game-score,
                .no-score {
                    min-width: 70px;
                    font-size: 1rem;
                    padding: 5px 8px;
                }
            }
            
            @media (max-width: 360px) {
                .team-info-logo {
                    width: 60px;
                    height: 60px;
                }
                
                .team-info-details h2 {
                    font-size: 1.2rem;
                }
                
                .game-versus {
                    font-size: 0.9rem;
                }
                
                .team-games-list {
                    max-height: 350px;
                }
            }
            
            /* Скроллбар */
            .team-games-list::-webkit-scrollbar {
                width: 6px;
            }
            
            .team-games-list::-webkit-scrollbar-track {
                background: #f1f3f5;
                border-radius: 3px;
            }
            
            .team-games-list::-webkit-scrollbar-thumb {
                background: #adb5bd;
                border-radius: 3px;
            }
            
            .team-games-list::-webkit-scrollbar-thumb:hover {
                background: #6c757d;
            }
        `;
        
        document.head.appendChild(style);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // UI будет инициализирован после загрузки данных в home.js
    console.log('UI module loaded');
});