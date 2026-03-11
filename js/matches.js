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

        // Проверяем, завершен ли чемпионат (есть ли чемпион в плей-офф)
        const playoffBracket = this.dataManager.getPlayoffBracket(league);
        const champion = playoffBracket?.champion;
        const isChampionshipCompleted = champion !== null && champion !== undefined;

        // Создаем HTML с вкладками
        let html = '';
        
        if (isChampionshipCompleted && scheduleGames.length === 0) {
            // Если чемпионат завершен и нет предстоящих матчей - показываем только результаты
            html = `
                <div class="matches-section-container">
                    <div class="matches-tabs">
                        <button class="matches-tab active" data-tab="results">
                            📊 Результаты
                            ${resultsGames.length > 0 ? `<span class="tab-badge">${resultsGames.length}</span>` : ''}
                        </button>
                    </div>
                    
                    <div class="matches-tab-content active" id="results-tab">
                        ${this.renderResultsTab(resultsGames, league)}
                    </div>
                </div>
            `;
        } else {
            // Иначе показываем обе вкладки (по умолчанию активна вкладка Расписание)
            html = `
                <div class="matches-section-container">
                    <div class="matches-tabs">
                        <button class="matches-tab active" data-tab="schedule">
                            📅 Расписание
                            ${scheduleGames.length > 0 ? `<span class="tab-badge">${scheduleGames.length}</span>` : ''}
                        </button>
                        <button class="matches-tab" data-tab="results">
                            📊 Результаты
                            ${resultsGames.length > 0 ? `<span class="tab-badge">${resultsGames.length}</span>` : ''}
                        </button>
                    </div>
                    
                    <div class="matches-tab-content" id="results-tab">
                        ${this.renderResultsTab(resultsGames, league)}
                    </div>
                    <div class="matches-tab-content active" id="schedule-tab">
                        ${this.renderScheduleTab(scheduleGames, league)}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;

        // Настраиваем вкладки (если они есть)
        if (!isChampionshipCompleted || scheduleGames.length > 0) {
            this.setupMatchesTabs(container);
        }
        
        // Добавляем обработчики для кликов по карточкам
        this.setupMatchCardClickHandlers(container, league);
    }

    // Новый метод для рендера вкладки результатов
    renderResultsTab(resultsGames, league) {
        if (resultsGames.length === 0) {
            return this.renderNoMatches('Нет завершенных матчей', '🏀');
        }
        return this.renderMatchesGrid(resultsGames, league, 'results');
    }

    // Новый метод для рендера вкладки расписания
    renderScheduleTab(scheduleGames, league) {
        if (scheduleGames.length === 0) {
            return this.renderNoMatches('Нет предстоящих матчей', '📅');
        }
        return this.renderMatchesGrid(scheduleGames, league, 'schedule');
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
                            <span class="matches-group-subtitle">${dateGames.length} ${this.getPluralForm(dateGames.length)}</span>
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
        return BasketballUtils.getPluralForm(count, ['матч','матча','матчей']);
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

    // Получение статистики команды
    getTeamStats(teamName, league) {
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
}