// matches.js - Обновленная версия с показом изображений результатов
class MatchesRenderer {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    // Рендер матчей для лиги с вкладками
    renderLeagueMatches(league, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let games = this.dataManager.getGamesByLeague(league);
        
        // Фильтруем игры с невалидными датами
        games = games.filter(game => game._fullDate && !isNaN(game._fullDate.getTime()));
        
        // Фильтруем игры (скрываем старые без результатов)
        games = this.dataManager.getFilteredScheduledGames(games);
        
        // Разделяем игры на результаты и расписание
        const resultsGames = games.filter(game => game._hasResult || game._isFromResults)
            .sort((a, b) => b._fullDate - a._fullDate); // Новые сверху
        
        const scheduleGames = games.filter(game => !game._hasResult && !game._isFromResults)
            .sort((a, b) => a._fullDate - b._fullDate); // Ближайшие сверху

        // Создаем HTML с вкладками (по умолчанию активна вкладка Расписание)
        let html = `
            <div class="matches-section-container">
                <div class="matches-tabs">
                    <button class="matches-tab" data-tab="schedule">
                        📅 Расписание
                        ${scheduleGames.length > 0 ? `<span class="tab-badge">${scheduleGames.length}</span>` : ''}
                    </button>
                    <button class="matches-tab" data-tab="results">
                        📊 Результаты
                        ${resultsGames.length > 0 ? `<span class="tab-badge">${resultsGames.length}</span>` : ''}
                    </button>
                </div>
                
                <div class="matches-tab-content" id="results-tab">
        `;

        // Вкладка "Результаты"
        if (resultsGames.length === 0) {
            html += this.renderNoMatches('Нет завершенных матчей', '🏀');
        } else {
            html += this.renderMatchesGrid(resultsGames, league, 'results');
        }

        html += `
                </div>
                <div class="matches-tab-content active" id="schedule-tab">
        `;

        // Вкладка "Расписание"
        if (scheduleGames.length === 0) {
            html += this.renderNoMatches('Нет предстоящих матчей', '📅');
        } else {
            html += this.renderMatchesGrid(scheduleGames, league, 'schedule');
        }

        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;

        // Настраиваем вкладки
        this.setupMatchesTabs(container);
        
        // Добавляем обработчики для кликов по карточкам
        this.setupMatchCardClickHandlers(container, league);
    }

    // Рендер сетки карточек матчей
    renderMatchesGrid(games, league, type) {
        let html = '';
        
        // Для предстоящих матчей группируем по датам
        if (type === 'schedule') {
            const gamesByDate = this.groupGamesByDate(games);
            const dates = Object.keys(gamesByDate).sort(); // Сортируем даты
            
            dates.forEach(date => {
                const dateGames = gamesByDate[date];
                const dateObj = new Date(dateGames[0]._fullDate);
                const dateStr = this.formatGroupDate(dateObj);
                
                html += `
                    <div class="matches-group">
                        <h4 class="matches-group-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18"/>
                            </svg>
                            ${dateStr}
                            <span class="matches-group-subtitle">${dateGames.length} матч${this.getPluralForm(dateGames.length)}</span>
                        </h4>
                        <div class="matches-grid">
                            ${dateGames.map(game => this.renderMatchCard(game, league, type)).join('')}
                        </div>
                    </div>
                `;
            });
        } else {
            // Для результатов просто выводим все карточки
            html += `<div class="matches-grid">
                ${games.map(game => this.renderMatchCard(game, league, type)).join('')}
            </div>`;
        }
        
        return html;
    }

    // Форматирование даты для группировки
    formatGroupDate(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Нормализуем даты до начала дня в UTC для правильного сравнения
        const dateDay = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const todayDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const tomorrowDay = new Date(Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()));
        
        const isToday = dateDay.getTime() === todayDay.getTime();
        const isTomorrow = dateDay.getTime() === tomorrowDay.getTime();
        
        if (isToday) {
            return 'Сегодня';
        } else if (isTomorrow) {
            return 'Завтра';
        } else {
            return date.toLocaleDateString('ru-RU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
    }

    // Группировка матчей по датам
    groupGamesByDate(games) {
        const groups = {};
        
        games.forEach(game => {
            if (!game._fullDate) return;
            
            const dateKey = game._fullDate.toISOString().split('T')[0]; // YYYY-MM-DD
            
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(game);
        });
        
        return groups;
    }

    // Получение правильной формы слова
    getPluralForm(count) {
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
            return 'ей';
        }
        
        if (lastDigit === 1) {
            return '';
        }
        
        if (lastDigit >= 2 && lastDigit <= 4) {
            return 'а';
        }
        
        return 'ей';
    }

    // Рендер одной компактной карточки матча
    renderMatchCard(game, league, type) {
        const hasScore = game.scoreHome !== null && game.scoreAway !== null;
        const isFinished = type === 'results';
        const isUpcoming = type === 'schedule';
        
        const gameDate = new Date(game._fullDate);
        const homeLogo = this.getTeamLogo(game.teamHome, league);
        const awayLogo = this.getTeamLogo(game.teamAway, league);
        
        // Определяем победителя для завершенных матчей
        let homeScoreClass = '';
        let awayScoreClass = '';
        
        if (hasScore) {
            if (game.scoreHome > game.scoreAway) {
                homeScoreClass = 'winner';
                awayScoreClass = 'loser';
            } else if (game.scoreHome < game.scoreAway) {
                homeScoreClass = 'loser';
                awayScoreClass = 'winner';
            }
        }
        
        // Статус матча - ФИКС: сравниваем только дни
        let statusText = '';
        let statusClass = '';
        
        if (isFinished) {
            statusText = 'Завершен';
            statusClass = 'status-finished';
        } else if (isUpcoming) {
            const now = new Date();
            
            // Нормализуем даты до начала дня в UTC для правильного сравнения
            const gameDay = new Date(Date.UTC(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()));
            const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
            
            // Вычисляем разницу в днях
            const diffTime = gameDay - today;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                statusText = 'Сегодня';
            } else if (diffDays === 1) {
                statusText = 'Завтра';
            } else if (diffDays <= 7) {
                statusText = 'На этой неделе';
            } else {
                statusText = 'Предстоящий';
            }
            statusClass = 'status-upcoming';
        }
        
        return `
            <div class="match-card" data-game-id="${game.id}" data-league="${league}">
                <div class="match-header">
                    <div class="match-date-time">
                        <div class="match-date">
                            ${gameDate.toLocaleDateString('ru-RU', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short'
                            })}
                        </div>
                        <div class="match-time">
                            ${gameDate.toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                    ${statusText ? `<span class="match-status ${statusClass}">${statusText}</span>` : ''}
                </div>
                
                <div class="match-content">
                    <div class="match-teams">
                        <!-- Команда А -->
                        <div class="team-container">
                            <div class="team-logo-wrapper">
                                <img src="${homeLogo}" alt="${game.teamHome}" class="team-logo-compact" onerror="this.onImageError(this)">
                            </div>
                            <div class="team-name">${game.teamHome}</div>
                        </div>
                        
                        <!-- Центр: VS или счет -->
                        <div class="match-center">
                            ${hasScore ? `
                                <div class="match-score">
                                    <div class="score-home ${homeScoreClass}">${game.scoreHome}</div>
                                    <div class="score-separator">:</div>
                                    <div class="score-away ${awayScoreClass}">${game.scoreAway}</div>
                                </div>
                            ` : `
                                <div class="vs-text">VS</div>
                            `}
                        </div>
                        
                        <!-- Команда Б -->
                        <div class="team-container">
                            <div class="team-logo-wrapper">
                                <img src="${awayLogo}" alt="${game.teamAway}" class="team-logo-compact" onerror="this.onImageError(this)">
                            </div>
                            <div class="team-name">${game.teamAway}</div>
                        </div>
                    </div>
                    
                    <!-- Место проведения -->
                    ${game.location ? `
                        <div class="match-location">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                            ${game.location}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Рендер пустого состояния
    renderNoMatches(message, icon) {
        return `
            <div class="no-matches">
                <div class="no-matches-icon">${icon}</div>
                <h4>${message}</h4>
                <p>Попробуйте позже</p>
            </div>
        `;
    }

    // Настройка вкладок
    setupMatchesTabs(container) {
        const tabsContainer = container.querySelector('.matches-tabs');
        
        tabsContainer.querySelectorAll('.matches-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                
                // Убираем активный класс у всех вкладок
                tabsContainer.querySelectorAll('.matches-tab').forEach(t => {
                    t.classList.remove('active');
                });
                
                // Добавляем активный класс текущей вкладке
                e.target.classList.add('active');
                
                // Убираем активный класс у всех контентов
                container.querySelectorAll('.matches-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Показываем нужный контент
                container.querySelector(`#${tabName}-tab`).classList.add('active');
            });
        });
    }

    // Обработчики кликов по карточкам
    setupMatchCardClickHandlers(container, league) {
        container.querySelectorAll('.match-card').forEach(card => {
            card.addEventListener('click', async (e) => {
                if (e.target.closest('a') || e.target.tagName === 'A') return;
                
                const gameId = card.dataset.gameId;
                const game = this.dataManager.getGameById(gameId);

                if (game) {
                    // Проверяем наличие картинки результата
                    const resultImageUrl = this.dataManager.getGameResultImage(game.id);
                    const hasResultImage = await this.dataManager.checkImageExists(resultImageUrl);
                
                    if (hasResultImage) {
                        this.showFullscreenImage(resultImageUrl, `${game.teamHome} vs ${game.teamAway}`);
                    } else {
                        this.showMatchDetailsModal(game, league);
                    }
                }
            });
        });
    }

    // Показ модального окна с деталями матча
    async showMatchDetailsModal(game, league) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'match-details-modal';
        
        // Получаем статистику команд
        const homeStats = this.getTeamStats(game.teamHome, league);
        const awayStats = this.getTeamStats(game.teamAway, league);
        
        // Определяем статус матча
        const now = new Date();
        const gameDate = game._fullDate ? new Date(game._fullDate) : null;
        let matchStatus = 'Предстоящий';
        let statusClass = 'status-upcoming';
        
        if (game._hasResult || game._isFromResults || (game.scoreHome !== null && game.scoreAway !== null)) {
            matchStatus = 'Завершен';
            statusClass = 'status-finished';
        } else if (gameDate && gameDate < now) {
            matchStatus = 'Завершен';
            statusClass = 'status-finished';
        }
        
        const homeLogo = this.getTeamLogo(game.teamHome, league);
        const awayLogo = this.getTeamLogo(game.teamAway, league);
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>Детали матча</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="match-details-header">
                        <div class="match-status-badge ${statusClass}">${matchStatus}</div>
                        
                        <!-- Десктоп версия команд -->
                        <div class="match-teams-large desktop-teams">
                            <div class="team-large">
                                <img src="${homeLogo}" alt="${game.teamHome}" onerror="this.onImageError(this)">
                                <h4>${game.teamHome}</h4>
                            </div>
                            <div class="match-vs-large">
                                <span>VS</span>
                                ${game.scoreHome !== null && game.scoreAway !== null ? 
                                    `<div class="match-score-large">
                                        <span class="${game.scoreHome > game.scoreAway ? 'winner' : ''}">${game.scoreHome}</span>
                                        <span>:</span>
                                        <span class="${game.scoreAway > game.scoreHome ? 'winner' : ''}">${game.scoreAway}</span>
                                    </div>` : 
                                    '<span class="vs-text-large">VS</span>'
                                }
                            </div>
                            <div class="team-large">
                                <img src="${awayLogo}" alt="${game.teamAway}" onerror="this.onImageError(this)">
                                <h4>${game.teamAway}</h4>
                            </div>
                        </div>
                        
                        <!-- Мобильная версия команд - компактная -->
                        <div class="match-teams-compact mobile-teams">
                            <div class="compact-team-row">
                                <div class="compact-team">
                                    <img src="${homeLogo}" alt="${game.teamHome}" onerror="this.onImageError(this)">
                                    <span class="compact-team-name">${game.teamHome}</span>
                                </div>
                                ${game.scoreHome !== null && game.scoreAway !== null ? 
                                    `<div class="compact-score">
                                        <span class="${game.scoreHome > game.scoreAway ? 'winner' : ''}">${game.scoreHome}</span>
                                        <span class="score-separator">:</span>
                                        <span class="${game.scoreAway > game.scoreHome ? 'winner' : ''}">${game.scoreAway}</span>
                                    </div>` : 
                                    '<div class="compact-vs">VS</div>'
                                }
                                <div class="compact-team">
                                    <img src="${awayLogo}" alt="${game.teamAway}" onerror="this.onImageError(this)">
                                    <span class="compact-team-name">${game.teamAway}</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Обновленный блок информации (адаптивный) -->
                        <div class="match-info-compact">
                            <div class="info-row">
                                <div class="info-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18"/>
                                    </svg>
                                    <span class="info-label">Дата:</span>
                                    <span class="info-value">
                                        ${gameDate ? gameDate.toLocaleDateString('ru-RU', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        }) : 'Не указана'}
                                    </span>
                                </div>
                                
                                <div class="info-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <span class="info-label">Время:</span>
                                    <span class="info-value">
                                        ${gameDate ? gameDate.toLocaleTimeString('ru-RU', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }) : 'Не указано'}
                                    </span>
                                </div>
                            </div>
                            
                            <div class="info-row">
                                <div class="info-item full-width">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    <span class="info-label">Место:</span>
                                    <span class="info-value location">
                                        ${game.location || 'Не указано'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Компактная статистика команд -->
                    <div class="teams-stats">
                        <!-- Десктоп версия -->
                        <div class="stats-desktop">
                            <div class="stats-header">
                                <div class="stats-team-header team-home">${game.teamHome}</div>
                                <div class="stats-metric-header"></div>
                                <div class="stats-team-header team-away">${game.teamAway}</div>
                            </div>
                            
                            <div class="stats-row">
                                <div class="stats-value ${homeStats.wins > awayStats.wins ? 'better' : homeStats.wins < awayStats.wins ? 'worse' : ''}">
                                    ${homeStats.wins}
                                </div>
                                <div class="stats-label">Побед</div>
                                <div class="stats-value ${awayStats.wins > homeStats.wins ? 'better' : awayStats.wins < homeStats.wins ? 'worse' : ''}">
                                    ${awayStats.wins}
                                </div>
                            </div>
                            
                            <div class="stats-row">
                                <div class="stats-value ${homeStats.losses < awayStats.losses ? 'better' : homeStats.losses > awayStats.losses ? 'worse' : ''}">
                                    ${homeStats.losses}
                                </div>
                                <div class="stats-label">Поражений</div>
                                <div class="stats-value ${awayStats.losses < homeStats.losses ? 'better' : awayStats.losses > homeStats.losses ? 'worse' : ''}">
                                    ${awayStats.losses}
                                </div>
                            </div>
                            
                            <div class="stats-row">
                                <div class="stats-value ${homeStats.avgPointsFor > awayStats.avgPointsFor ? 'better' : homeStats.avgPointsFor < awayStats.avgPointsFor ? 'worse' : ''}">
                                    ${homeStats.avgPointsFor.toFixed(1)}
                                </div>
                                <div class="stats-label">Забито</div>
                                <div class="stats-value ${awayStats.avgPointsFor > homeStats.avgPointsFor ? 'better' : awayStats.avgPointsFor < homeStats.avgPointsFor ? 'worse' : ''}">
                                    ${awayStats.avgPointsFor.toFixed(1)}
                                </div>
                            </div>
                            
                            <div class="stats-row">
                                <div class="stats-value ${homeStats.avgPointsAgainst < awayStats.avgPointsAgainst ? 'better' : homeStats.avgPointsAgainst > awayStats.avgPointsAgainst ? 'worse' : ''}">
                                    ${homeStats.avgPointsAgainst.toFixed(1)}
                                </div>
                                <div class="stats-label">Пропущено</div>
                                <div class="stats-value ${awayStats.avgPointsAgainst < homeStats.avgPointsAgainst ? 'better' : awayStats.avgPointsAgainst > homeStats.avgPointsAgainst ? 'worse' : ''}">
                                    ${awayStats.avgPointsAgainst.toFixed(1)}
                                </div>
                            </div>
                        </div>
                        
                        <!-- Мобильная версия -->
                        <div class="stats-mobile">
                            <div class="mobile-stats-card">
                                <div class="mobile-stats-header">
                                    <div class="mobile-team-name home-team">${game.teamHome}</div>
                                    <div class="mobile-vs">VS</div>
                                    <div class="mobile-team-name away-team">${game.teamAway}</div>
                                </div>
                                
                                <div class="mobile-stats-row">
                                    <div class="mobile-stat-value ${homeStats.wins > awayStats.wins ? 'better' : homeStats.wins < awayStats.wins ? 'worse' : ''}">
                                        ${homeStats.wins}
                                    </div>
                                    <div class="mobile-stat-name">Побед</div>
                                    <div class="mobile-stat-value ${awayStats.wins > homeStats.wins ? 'better' : awayStats.wins < homeStats.wins ? 'worse' : ''}">
                                        ${awayStats.wins}
                                    </div>
                                </div>
                                
                                <div class="mobile-stats-row">
                                    <div class="mobile-stat-value ${homeStats.losses < awayStats.losses ? 'better' : homeStats.losses > awayStats.losses ? 'worse' : ''}">
                                        ${homeStats.losses}
                                    </div>
                                    <div class="mobile-stat-name">Поражений</div>
                                    <div class="mobile-stat-value ${awayStats.losses < homeStats.losses ? 'better' : awayStats.losses > homeStats.losses ? 'worse' : ''}">
                                        ${awayStats.losses}
                                    </div>
                                </div>
                                
                                <div class="mobile-stats-row">
                                    <div class="mobile-stat-value ${homeStats.avgPointsFor > awayStats.avgPointsFor ? 'better' : homeStats.avgPointsFor < awayStats.avgPointsFor ? 'worse' : ''}">
                                        ${homeStats.avgPointsFor.toFixed(1)}
                                    </div>
                                    <div class="mobile-stat-name">Забито</div>
                                    <div class="mobile-stat-value ${awayStats.avgPointsFor > homeStats.avgPointsFor ? 'better' : awayStats.avgPointsFor < homeStats.avgPointsFor ? 'worse' : ''}">
                                        ${awayStats.avgPointsFor.toFixed(1)}
                                    </div>
                                </div>
                                
                                <div class="mobile-stats-row">
                                    <div class="mobile-stat-value ${homeStats.avgPointsAgainst < awayStats.avgPointsAgainst ? 'better' : homeStats.avgPointsAgainst > awayStats.avgPointsAgainst ? 'worse' : ''}">
                                        ${homeStats.avgPointsAgainst.toFixed(1)}
                                    </div>
                                    <div class="mobile-stat-name">Пропущено</div>
                                    <div class="mobile-stat-value ${awayStats.avgPointsAgainst < homeStats.avgPointsAgainst ? 'better' : awayStats.avgPointsAgainst > homeStats.avgPointsAgainst ? 'worse' : ''}">
                                        ${awayStats.avgPointsAgainst.toFixed(1)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        // Добавляем стили для модального окна деталей матча
        this.addMatchDetailsStyles();
        
        // Закрытие модального окна
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 300);
            }
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                modal.style.display = 'none';
                setTimeout(() => {
                    document.body.removeChild(modal);
                }, 300);
            }
        });
    }

    // Метод для показа изображения на весь экран
    showFullscreenImage(imageUrl, title) {
        const overlay = document.createElement('div');
        overlay.className = 'fullscreen-image-overlay';
        overlay.innerHTML = `
            <div class="fullscreen-image-container">
                <div class="fullscreen-image-header">
                    <h3>${title}</h3>
                    <button class="close-fullscreen">&times;</button>
                </div>
                <div class="fullscreen-image-content">
                    <img src="${imageUrl}" alt="${title}" class="fullscreen-image">
                </div>
                <div class="fullscreen-image-footer">
                    <button class="download-image" onclick="window.open('${imageUrl}', '_blank')">
                        📥 Открыть в новой вкладке
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        overlay.style.display = 'flex';
        
        // Закрытие по клику на крестик или оверлей
        const closeBtn = overlay.querySelector('.close-fullscreen');
        closeBtn.addEventListener('click', () => {
            overlay.style.display = 'none';
            setTimeout(() => document.body.removeChild(overlay), 300);
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.display = 'none';
                setTimeout(() => document.body.removeChild(overlay), 300);
            }
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', function closeOnEscape(e) {
            if (e.key === 'Escape' && overlay.style.display === 'flex') {
                overlay.style.display = 'none';
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    document.removeEventListener('keydown', closeOnEscape);
                }, 300);
            }
        });
    }

    // Добавление стилей для модального окна деталей матча
    addMatchDetailsStyles() {
        if (document.getElementById('match-details-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'match-details-styles';
        style.textContent = `
            /* Общие стили для заголовка матча */
            .match-details-header {
                text-align: center;
                padding-bottom: 15px;
                border-bottom: 1px solid #e9ecef;
                margin-bottom: 20px;
            }
            
            .match-status-badge {
                display: inline-block;
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 0.85rem;
                font-weight: 600;
                margin-bottom: 15px;
            }
            
            .status-finished {
                background: rgba(40, 167, 69, 0.1);
                color: #28a745;
            }
            
            .status-upcoming {
                background: rgba(0, 123, 255, 0.1);
                color: #007bff;
            }
            
            /* Десктоп версия команд */
            .desktop-teams {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 25px;
                margin: 15px 0;
            }
            
            .team-large {
                display: flex;
                flex-direction: column;
                align-items: center;
                flex: 1;
                max-width: 180px;
            }
            
            .team-large img {
                width: 70px;
                height: 70px;
                border-radius: 10px;
                object-fit: contain;
                background: #f8f9fa;
                padding: 6px;
                border: 2px solid #e9ecef;
                margin-bottom: 8px;
            }
            
            .team-large h4 {
                margin: 0;
                font-size: 1.1rem;
                color: #2c3e50;
                text-align: center;
                line-height: 1.2;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .match-vs-large {
                display: flex;
                flex-direction: column;
                align-items: center;
                min-width: 80px;
            }
            
            .vs-text-large {
                font-size: 1.5rem;
                font-weight: 700;
                color: #adb5bd;
            }
            
            .match-score-large {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 2rem;
                font-weight: 700;
                margin: 8px 0;
            }
            
            .match-score-large span {
                min-width: 40px;
                text-align: center;
            }
            
            .match-score-large .winner {
                color: #28a745;
                font-weight: 800;
            }
            
            /* Мобильная версия команд */
            .mobile-teams {
                display: none;
            }
            
            .match-teams-compact {
                margin: 12px 0;
            }
            
            .compact-team-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            
            .compact-team {
                display: flex;
                flex-direction: column;
                align-items: center;
                flex: 1;
                min-width: 0;
            }
            
            .compact-team img {
                width: 36px;
                height: 36px;
                border-radius: 7px;
                object-fit: contain;
                background: #f8f9fa;
                padding: 3px;
                border: 1px solid #e9ecef;
                margin-bottom: 4px;
            }
            
            .compact-team-name {
                font-size: 0.8rem;
                font-weight: 600;
                color: #2c3e50;
                text-align: center;
                line-height: 1.1;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .compact-score {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 1.1rem;
                font-weight: 700;
                min-width: 60px;
                justify-content: center;
            }
            
            .compact-score span {
                min-width: 22px;
                text-align: center;
            }
            
            .compact-score .winner {
                color: #28a745;
                font-weight: 800;
            }
            
            .compact-vs {
                font-size: 0.85rem;
                font-weight: 700;
                color: #adb5bd;
                min-width: 35px;
                text-align: center;
            }
            
            .score-separator {
                font-weight: 600;
                color: #495057;
            }
            
            /* Компактный блок информации */
            .match-info-compact {
                margin-top: 15px;
                background: #f8f9fa;
                border-radius: 8px;
                padding: 10px;
                border: 1px solid #e9ecef;
            }
            
            .info-row {
                display: flex;
                gap: 8px;
                margin-bottom: 6px;
            }
            
            .info-row:last-child {
                margin-bottom: 0;
            }
            
            .info-item {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 5px 7px;
                background: white;
                border-radius: 5px;
                border: 1px solid #e9ecef;
            }
            
            .info-item.full-width {
                flex: 1 0 100%;
            }
            
            .info-label {
                font-weight: 600;
                color: #495057;
                font-size: 0.75rem;
                white-space: nowrap;
            }
            
            .info-value {
                color: #2c3e50;
                font-size: 0.8rem;
                flex: 1;
                text-align: left;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .info-value.location {
                font-size: 0.75rem;
                color: #6c757d;
            }
            
            .info-item svg {
                color: #0055a5;
                flex-shrink: 0;
                width: 16px;
                height: 16px;
            }
            
            /* Стили для картинки результата матча */
            .match-result-image-section {
                margin-top: 25px;
                padding-top: 20px;
                border-top: 1px solid #e9ecef;
            }
            
            .match-result-image-section h4 {
                text-align: center;
                margin-bottom: 15px;
                color: #2c3e50;
                font-size: 1.2rem;
            }
            
            .result-image-container {
                position: relative;
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
                border-radius: 12px;
                overflow: hidden;
                border: 2px solid #e9ecef;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .result-image-container:hover {
                transform: translateY(-3px);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                border-color: #0055a5;
            }
            
            .result-image {
                width: 100%;
                height: auto;
                display: block;
                transition: transform 0.3s ease;
            }
            
            .result-image-container:hover .result-image {
                transform: scale(1.02);
            }
            
            .result-image-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
                padding: 15px;
                color: white;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .result-image-container:hover .result-image-overlay {
                opacity: 1;
            }
            
            .result-image-text {
                font-size: 0.9rem;
                font-weight: 600;
            }
            
            .result-image-note {
                text-align: center;
                margin-top: 10px;
                color: #6c757d;
                font-size: 0.85rem;
            }
            
            .no-result-image {
                padding: 40px 20px;
                text-align: center;
                background: #f8f9fa;
                color: #6c757d;
                font-size: 0.9rem;
            }
            
            /* Стили для полноэкранного просмотра */
            .fullscreen-image-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.95);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 99999;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }
            
            .fullscreen-image-container {
                background: white;
                border-radius: 12px;
                overflow: hidden;
                max-width: 95vw;
                max-height: 95vh;
                display: flex;
                flex-direction: column;
                animation: scaleIn 0.3s ease;
            }
            
            .fullscreen-image-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                background: #0055a5;
                color: white;
            }
            
            .fullscreen-image-header h3 {
                margin: 0;
                font-size: 1.2rem;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .close-fullscreen {
                background: none;
                border: none;
                color: white;
                font-size: 2rem;
                cursor: pointer;
                padding: 0 10px;
                line-height: 1;
                transition: transform 0.2s ease;
            }
            
            .close-fullscreen:hover {
                transform: scale(1.2);
            }
            
            .fullscreen-image-content {
                flex: 1;
                overflow: auto;
                padding: 10px;
                background: #f8f9fa;
            }
            
            .fullscreen-image {
                max-width: 100%;
                max-height: 70vh;
                display: block;
                margin: 0 auto;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .fullscreen-image-footer {
                padding: 15px 20px;
                background: #f8f9fa;
                border-top: 1px solid #e9ecef;
                text-align: center;
            }
            
            .download-image {
                padding: 10px 20px;
                background: linear-gradient(135deg, #0055a5, #0077cc);
                color: white;
                border: none;
                border-radius: 25px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            
            .download-image:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0, 85, 165, 0.3);
            }
            
            @keyframes scaleIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            /* Компактная статистика команд */
            .teams-stats {
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid #e9ecef;
            }
            
            /* Десктоп версия статистики */
            .stats-desktop {
                display: block;
            }
            
            .stats-mobile {
                display: none;
            }
            
            .stats-header {
                display: flex;
                background: #f8f9fa;
                padding: 7px 10px;
                border-bottom: 1px solid #e9ecef;
                border-radius: 6px 6px 0 0;
            }
            
            .stats-team-header {
                flex: 2;
                text-align: center;
                font-size: 0.9rem;
                font-weight: 700;
                color: #2c3e50;
                padding: 0 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .stats-metric-header {
                flex: 1;
                min-width: 90px;
            }
            
            .stats-row {
                display: flex;
                padding: 8px 10px;
                border-bottom: 1px solid #f1f3f5;
                align-items: center;
                background: white;
                transition: background-color 0.2s ease;
            }
            
            .stats-row:hover {
                background-color: #f8f9fa;
            }
            
            .stats-row:last-child {
                border-bottom: none;
            }
            
            .stats-value {
                flex: 2;
                text-align: center;
                font-size: 1rem;
                font-weight: 700;
                color: #2c3e50;
                padding: 5px 4px;
                border-radius: 5px;
                transition: all 0.3s ease;
                min-width: 45px;
            }
            
            .stats-value.better {
                background: rgba(40, 167, 69, 0.1);
                color: #28a745;
            }
            
            .stats-value.worse {
                background: rgba(220, 53, 69, 0.05);
                color: #dc3545;
            }
            
            .stats-label {
                flex: 1;
                text-align: center;
                font-weight: 600;
                color: #495057;
                padding: 0 4px;
                font-size: 0.85rem;
                min-width: 90px;
            }
            
            /* Мобильная версия статистики */
            .mobile-stats-card {
                background: white;
                border-radius: 8px;
                border: 1px solid #e9ecef;
                overflow: hidden;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
            }
            
            .mobile-stats-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 10px;
                background: #f8f9fa;
                border-bottom: 1px solid #e9ecef;
            }
            
            .mobile-team-name {
                flex: 1;
                text-align: center;
                font-size: 0.8rem;
                font-weight: 700;
                color: #2c3e50;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding: 0 3px;
            }
            
            .home-team {
                text-align: right;
                padding-right: 4px;
            }
            
            .away-team {
                text-align: left;
                padding-left: 4px;
            }
            
            .mobile-vs {
                font-size: 0.7rem;
                color: #6c757d;
                font-weight: 700;
                padding: 0 3px;
                min-width: 22px;
                text-align: center;
            }
            
            .mobile-stats-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 8px;
                border-bottom: 1px solid #f1f3f5;
                gap: 4px;
                background: white;
            }
            
            .mobile-stats-row:last-child {
                border-bottom: none;
            }
            
            .mobile-stat-value {
                flex: 1;
                text-align: center;
                font-size: 0.95rem;
                font-weight: 700;
                color: #2c3e50;
                min-width: 32px;
                max-width: 45px;
                padding: 4px 5px;
                border-radius: 4px;
                transition: all 0.3s ease;
            }
            
            .mobile-stat-name {
                flex: 1.5;
                text-align: center;
                font-weight: 600;
                color: #495057;
                font-size: 0.8rem;
                padding: 0 3px;
                min-width: 75px;
                max-width: 90px;
            }
            
            .mobile-stat-value.better {
                background: rgba(40, 167, 69, 0.1);
                color: #28a745;
            }
            
            .mobile-stat-value.worse {
                background: rgba(220, 53, 69, 0.05);
                color: #dc3545;
            }
            
            /* Адаптивность для мобильных устройств */
            @media (max-width: 768px) {
                .match-details-header {
                    padding-bottom: 12px;
                    margin-bottom: 15px;
                }
                
                .match-status-badge {
                    font-size: 0.8rem;
                    padding: 4px 10px;
                    margin-bottom: 12px;
                }
                
                /* Команды: показываем мобильную версию */
                .desktop-teams {
                    display: none !important;
                }
                
                .mobile-teams {
                    display: block !important;
                }
                
                .compact-team img {
                    width: 32px;
                    height: 32px;
                }
                
                .compact-team-name {
                    font-size: 0.75rem;
                }
                
                .compact-score {
                    font-size: 1rem;
                    min-width: 55px;
                }
                
                .compact-vs {
                    font-size: 0.8rem;
                }
                
                /* Компактная информация */
                .match-info-compact {
                    padding: 8px;
                    margin-top: 12px;
                }
                
                .info-row {
                    flex-direction: column;
                    gap: 5px;
                    margin-bottom: 5px;
                }
                
                .info-item {
                    width: 100%;
                    padding: 4px 6px;
                }
                
                .info-label {
                    font-size: 0.7rem;
                    min-width: 40px;
                }
                
                .info-value {
                    font-size: 0.75rem;
                }
                
                .info-value.location {
                    font-size: 0.7rem;
                }
                
                .info-item svg {
                    width: 14px;
                    height: 14px;
                }
                
                /* Картинка результата */
                .match-result-image-section {
                    margin-top: 20px;
                    padding-top: 15px;
                }
                
                .match-result-image-section h4 {
                    font-size: 1.1rem;
                    margin-bottom: 12px;
                }
                
                .result-image-container {
                    max-width: 100%;
                    border-radius: 10px;
                }
                
                .result-image-overlay {
                    padding: 10px;
                }
                
                .result-image-text {
                    font-size: 0.8rem;
                }
                
                /* Статистика: показываем мобильную версию */
                .stats-desktop {
                    display: none !important;
                }
                
                .stats-mobile {
                    display: block !important;
                }
                
                .teams-stats {
                    margin-top: 15px;
                    padding-top: 12px;
                }
                
                .mobile-stats-header {
                    padding: 7px 8px;
                }
                
                .mobile-team-name {
                    font-size: 0.75rem;
                }
                
                .mobile-stats-row {
                    padding: 5px 6px;
                    gap: 3px;
                }
                
                .mobile-stat-value {
                    font-size: 0.9rem;
                    padding: 3px 4px;
                    min-width: 28px;
                    max-width: 40px;
                }
                
                .mobile-stat-name {
                    font-size: 0.75rem;
                    min-width: 70px;
                    max-width: 85px;
                }
                
                /* Полноэкранный просмотр */
                .fullscreen-image-header {
                    padding: 12px 15px;
                }
                
                .fullscreen-image-header h3 {
                    font-size: 1rem;
                }
                
                .fullscreen-image {
                    max-height: 60vh;
                }
            }
            
            @media (max-width: 480px) {
                .match-details-header {
                    padding-bottom: 10px;
                    margin-bottom: 12px;
                }
                
                .match-status-badge {
                    font-size: 0.75rem;
                    padding: 3px 8px;
                    margin-bottom: 10px;
                }
                
                .compact-team img {
                    width: 28px;
                    height: 28px;
                }
                
                .compact-team-name {
                    font-size: 0.7rem;
                }
                
                .compact-score {
                    font-size: 0.95rem;
                    min-width: 50px;
                    gap: 2px;
                }
                
                .compact-score span {
                    min-width: 18px;
                }
                
                .compact-vs {
                    font-size: 0.75rem;
                    min-width: 30px;
                }
                
                .match-info-compact {
                    padding: 6px;
                    margin-top: 10px;
                }
                
                .info-item {
                    padding: 3px 5px;
                }
                
                .info-label {
                    font-size: 0.65rem;
                    min-width: 35px;
                }
                
                .info-value {
                    font-size: 0.7rem;
                }
                
                .info-item svg {
                    width: 12px;
                    height: 12px;
                }
                
                /* Картинка результата */
                .match-result-image-section {
                    margin-top: 15px;
                    padding-top: 12px;
                }
                
                .match-result-image-section h4 {
                    font-size: 1rem;
                }
                
                .result-image-container {
                    border-radius: 8px;
                    border-width: 1px;
                }
                
                .result-image-note {
                    font-size: 0.8rem;
                }
                
                .teams-stats {
                    margin-top: 12px;
                    padding-top: 10px;
                }
                
                .mobile-stats-header {
                    padding: 6px 7px;
                }
                
                .mobile-team-name {
                    font-size: 0.7rem;
                }
                
                .mobile-vs {
                    font-size: 0.65rem;
                    min-width: 20px;
                }
                
                .mobile-stats-row {
                    padding: 4px 5px;
                }
                
                .mobile-stat-value {
                    font-size: 0.85rem;
                    padding: 2px 3px;
                    min-width: 25px;
                    max-width: 35px;
                }
                
                .mobile-stat-name {
                    font-size: 0.7rem;
                    min-width: 65px;
                    max-width: 75px;
                }
                
                /* Полноэкранный просмотр */
                .fullscreen-image-container {
                    max-width: 100vw;
                    max-height: 100vh;
                    border-radius: 0;
                }
                
                .fullscreen-image-header {
                    padding: 10px 12px;
                }
                
                .close-fullscreen {
                    font-size: 1.8rem;
                }
                
                .download-image {
                    padding: 8px 16px;
                    font-size: 0.9rem;
                }
            }
            
            @media (max-width: 360px) {
                .compact-team img {
                    width: 24px;
                    height: 24px;
                }
                
                .compact-team-name {
                    font-size: 0.65rem;
                }
                
                .compact-score {
                    font-size: 0.9rem;
                    min-width: 45px;
                }
                
                .compact-vs {
                    font-size: 0.7rem;
                    min-width: 25px;
                }
                
                .info-label {
                    min-width: 32px;
                }
                
                /* Статистика */
                .teams-stats {
                    margin-top: 10px;
                    padding-top: 8px;
                }
                
                .mobile-stats-header {
                    padding: 5px 6px;
                    flex-direction: column;
                    gap: 2px;
                    text-align: center;
                }
                
                .mobile-team-name {
                    font-size: 0.65rem;
                    width: 100%;
                    text-align: center !important;
                    padding: 0 !important;
                }
                
                .home-team,
                .away-team {
                    text-align: center !important;
                }
                
                .mobile-vs {
                    order: -1;
                    margin-bottom: 1px;
                }
                
                .mobile-stat-name {
                    font-size: 0.65rem;
                    min-width: 60px;
                    max-width: 70px;
                }
                
                .mobile-stat-value {
                    font-size: 0.8rem;
                    min-width: 22px;
                    max-width: 30px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    // Получение статистики команды
    getTeamStats(teamName, league) {
        const standings = this.dataManager.getLeagueStandings(league);
        const teamStanding = standings.find(team => 
            this.dataManager.normalizeTeamName(team.teamName) === this.dataManager.normalizeTeamName(teamName)
        );
        
        if (teamStanding) {
            return {
                wins: teamStanding.wins,
                losses: teamStanding.losses,
                avgPointsFor: teamStanding.played > 0 ? teamStanding.pointsFor / teamStanding.played : 0,
                avgPointsAgainst: teamStanding.played > 0 ? teamStanding.pointsAgainst / teamStanding.played : 0
            };
        }
        
        // Если команда не найдена в таблице (новые команды)
        const teamGames = this.dataManager.getGamesByTeam(teamName, league)
            .filter(game => game.scoreHome !== null && game.scoreAway !== null);
        
        const wins = teamGames.filter(game => {
            const isHome = this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(teamName);
            return isHome ? game.scoreHome > game.scoreAway : game.scoreAway > game.scoreHome;
        }).length;
        
        const losses = teamGames.length - wins;
        
        let totalPointsFor = 0;
        let totalPointsAgainst = 0;
        
        teamGames.forEach(game => {
            const isHome = this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(teamName);
            totalPointsFor += isHome ? game.scoreHome : game.scoreAway;
            totalPointsAgainst += isHome ? game.scoreAway : game.scoreHome;
        });
        
        return {
            wins: wins,
            losses: losses,
            avgPointsFor: teamGames.length > 0 ? totalPointsFor / teamGames.length : 0,
            avgPointsAgainst: teamGames.length > 0 ? totalPointsAgainst / teamGames.length : 0
        };
    }

    // Вспомогательные методы
    getTeamLogo(teamName, league) {
        const team = this.dataManager.getTeamByName(teamName, league);
        return team?.logo || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
    }

    onImageError(img) {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
        img.onerror = null;
    }

    // Временное уведомление (можно заменить на модальное окно)
    showMatchNotification(matchInfo) {
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.className = 'match-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                animation: slideIn 0.3s ease;
            ">
                <strong>${matchInfo}</strong><br>
                <small>Статистика матча в разработке</small>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}