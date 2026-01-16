// home.js - обновленная версия с группировкой матчей на главной
class HomePage {
    constructor(dataManager, ui) {
        this.dataManager = dataManager;
        this.ui = ui;
        this.matchesRenderer = new MatchesRenderer(dataManager);
        this.currentLeague = null;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupScrollSpy();
        this.updateLeagueIndicator('home');
        
        // Ждем загрузки данных перед рендерингом
        if (this.dataManager.ready) {
            this.dataManager.ready.then(() => {
                this.renderHomePage();
            });
        }
    }

    setupNavigation() {
        // Обработка кликов по навигации по лигам
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.dataset.section;
                
                // Обновляем активную ссылку
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Обновляем индикатор лиги
                this.updateLeagueIndicator(sectionId);
                
                // Показываем нужную секцию
                this.showSection(sectionId);
                
                // Если это не главная, загружаем данные лиги
                if (sectionId !== 'home') {
                    const league = sectionId.split('-')[1].toUpperCase();
                    this.currentLeague = league;
                    this.renderLeaguePage(league);
                } else {
                    this.renderHomePage();
                }
                
                // Прокручиваем к верху страницы
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        // Показываем главную страницу по умолчанию
        this.showSection('home');
    }

    updateLeagueIndicator(sectionId) {
        const indicator = document.getElementById('league-indicator');
        indicator.className = 'current-league-indicator';
        
        if (sectionId === 'home') {
            indicator.classList.add('home');
        } else if (sectionId === 'league-a') {
            indicator.classList.add('league-a');
        } else if (sectionId === 'league-b') {
            indicator.classList.add('league-b');
        } else if (sectionId === 'league-f') {
            indicator.classList.add('league-f');
        }
    }

    showSection(sectionId) {
        // Скрываем все секции
        document.querySelectorAll('section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Показываем нужную секцию
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
        }
    }

    setupScrollSpy() {
        // Отслеживаем прокрутку для обновления активной ссылки
        let isScrolling = false;
        
        window.addEventListener('scroll', () => {
            if (isScrolling) return;
            
            isScrolling = true;
            
            setTimeout(() => {
                const sections = document.querySelectorAll('section');
                let currentSection = 'home';
                
                sections.forEach(section => {
                    if (section.style.display !== 'none' && section.offsetParent !== null) {
                        const sectionTop = section.offsetTop - 100;
                        const sectionHeight = section.clientHeight;
                        
                        if (window.pageYOffset >= sectionTop && 
                            window.pageYOffset < sectionTop + sectionHeight) {
                            currentSection = section.id;
                        }
                    }
                });
                
                // Обновляем активную ссылку
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    if (link.dataset.section === currentSection) {
                        link.classList.add('active');
                        this.updateLeagueIndicator(currentSection);
                    }
                });
                
                isScrolling = false;
            }, 100);
        });
    }

    async renderHomePage() {
        if (!this.dataManager || !this.dataManager.teams || this.dataManager.teams.length === 0) {
            console.log('Waiting for data to load...');
            return;
        }
        
        await this.renderLeagueOverview();
        await this.renderUpcomingGames();
        this.updateStats();
    }

    async renderLeagueOverview() {
        const container = document.getElementById('league-overview');
        if (!container) return;

        const leagues = [
            { id: 'A', name: 'Лига А', color: 'league-a', icon: '⭐' },
            { id: 'B', name: 'Лига Б', color: 'league-b', icon: '🔥' },
            { id: 'F', name: 'Женская лига', color: 'league-f', icon: '💥' }
        ];

        let html = '';

        for (const league of leagues) {
            const teams = this.dataManager.getTeamsByLeague(league.id);
            const standings = this.dataManager.getLeagueStandings(league.id);
            const totalGames = this.dataManager.getTotalGamesPlayedByLeague(league.id);
            
            // Берем топ-3 команды
            const topTeams = standings.slice(0, 3);
            
            html += `
                <div class="league-card">
                    <div class="league-card-header ${league.color}">
                        <h3>${league.icon} ${league.name}</h3>
                        <p>${teams.length} команд • ${totalGames} матчей сыграно</p>
                    </div>
                    <div class="league-card-body">
                        <div class="league-teams-preview">
                            ${topTeams.map((team, index) => `
                                <div class="league-team-preview" data-team-name="${team.teamName}" data-league="${league.id}">
                                    <span style="font-weight: bold; color: #0055a5;">${index + 1}</span>
                                    <img src="${team.team.logo}" alt="${team.teamName}" 
                                         onerror="this.onImageError(this)">
                                    <span>${team.teamName}</span>
                                    <span class="team-record">${team.wins}-${team.losses}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="league-card-footer">
                        <a href="#league-${league.id.toLowerCase()}" class="league-link" data-league="${league.id}">Смотреть лигу</a>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
        
        // Добавляем обработчики для кликов по командам
        this.setupTeamPreviewClickHandlers();
        
        // Добавляем обработчики для ссылок на лиги
        document.querySelectorAll('.league-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const league = link.dataset.league;
                const leagueId = `league-${league.toLowerCase()}`;
                
                // Показываем страницу лиги
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                document.querySelector(`.nav-link[data-section="${leagueId}"]`).classList.add('active');
                this.updateLeagueIndicator(leagueId);
                this.showSection(leagueId);
                
                // Устанавливаем текущую лигу
                this.currentLeague = league;
                this.renderLeaguePage(league);
                
                // Прокручиваем к верху
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    onImageError(img) {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
        img.onerror = null;
    }

    setupTeamPreviewClickHandlers() {
        document.querySelectorAll('.league-team-preview').forEach(preview => {
            preview.addEventListener('click', () => {
                const teamName = preview.dataset.teamName;
                const league = preview.dataset.league;
                
                // Показываем модальное окно команды
                this.ui.showTeamModal(teamName, league);
            });
        });
    }

    async renderUpcomingGames() {
        const container = document.getElementById('upcoming-games');
        if (!container) return;

        // Получаем ближайшие игры из всех лиг
        const allGames = this.dataManager.getAllGamesForDisplay();
        
        // Фильтруем предстоящие игры (без результатов)
        const now = new Date();
        const upcomingGames = allGames
            .filter(game => !game._hasResult && game._fullDate > now)
            .sort((a, b) => a._fullDate - b._fullDate); // Сортировка по времени

        if (upcomingGames.length === 0) {
            container.innerHTML = `
                <div class="no-upcoming-games">
                    <div class="no-upcoming-games-icon">📅</div>
                    <h3>Нет предстоящих матчей</h3>
                    <p>Следите за обновлениями расписания</p>
                </div>
            `;
            return;
        }

        // Группируем игры по датам для заголовков
        const gamesByDate = this.groupGamesByDate(upcomingGames);
        const dates = Object.keys(gamesByDate).sort();

        let html = '';
        
        // Ограничиваем количество отображаемых дней
        const maxDaysToShow = 5;
        let daysShown = 0;
        
        for (const date of dates) {
            if (daysShown >= maxDaysToShow) break;
            
            const dateGames = gamesByDate[date];
            const dateObj = new Date(dateGames[0]._fullDate);
            const dateStr = this.formatGroupDate(dateObj);
            
            // Определяем класс для сегодня/завтра
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const isToday = dateObj.toDateString() === today.toDateString();
            const isTomorrow = dateObj.toDateString() === tomorrow.toDateString();
            
            let dayClass = '';
            if (isToday) {
                dayClass = 'today-matches';
            } else if (isTomorrow) {
                dayClass = 'tomorrow-matches';
            }
            
            html += `
                <div class="${dayClass}">
                    <div class="upcoming-day-header">
                        <div class="upcoming-day-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18"/>
                            </svg>
                            ${dateStr}
                        </div>
                        <span class="upcoming-day-matches-count">
                            ${dateGames.length} матч${this.getPluralForm(dateGames.length)}
                        </span>
                    </div>
                    
                    <div class="upcoming-matches-grid">
            `;
            
            // Выводим матчи этого дня в порядке времени
            dateGames.sort((a, b) => a._fullDate - b._fullDate).forEach(game => {
                html += this.renderUpcomingMatchCard(game);
            });
            
            html += `
                    </div>
                </div>
            `;
            
            daysShown++;
        }

        container.innerHTML = html;

        // Добавляем обработчики для кликов по карточкам
        this.setupUpcomingMatchClickHandlers();
    }

    // Рендер карточки матча для главной
    renderUpcomingMatchCard(game) {
        const gameDate = new Date(game._fullDate);
        const homeLogo = this.getTeamLogo(game.teamHome, game.league);
        const awayLogo = this.getTeamLogo(game.teamAway, game.league);
        
        const leagueName = this.getLeagueName(game.league);
        const leagueBadgeClass = `league-badge-${game.league.toLowerCase()}`;
        
        const now = new Date();

        // Нормализуем даты до начала дня в UTC для правильного сравнения
        const gameDay = new Date(Date.UTC(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()));
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

        // Вычисляем разницу в днях
        const diffTime = gameDay - today;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let timeLeftText = '';
        if (diffDays === 0) {
            // Для сегодняшних матчей показываем точное время
            const timeDiff = game._fullDate - now;
            const hoursDiff = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutesDiff = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hoursDiff === 0 && minutesDiff < 60) {
                timeLeftText = `Через ${minutesDiff} мин`;
            } else {
                timeLeftText = `Через ${hoursDiff} ч ${minutesDiff} мин`;
            }
        } else if (diffDays === 1) {
            timeLeftText = 'Завтра';
        } else if (diffDays <= 7) {
            timeLeftText = `Через ${diffDays} дн`;
        } else {
            timeLeftText = `${Math.floor(diffDays / 7)} нед`;
        }

        return `
            <div class="upcoming-match-card" data-game-id="${game.id}" data-league="${game.league}">
                <div class="upcoming-match-league-badge ${leagueBadgeClass}">
                    ${leagueName}
                </div>
                
                <div class="upcoming-match-time-header">
                    <div class="upcoming-match-time">
                        <div class="match-exact-time">
                            ${gameDate.toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                        <div class="match-time-left">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            ${timeLeftText}
                        </div>
                    </div>
                </div>
                
                <div class="upcoming-match-teams">
                    <div class="upcoming-match-team">
                        <img src="${homeLogo}" alt="${game.teamHome}" onerror="this.onImageError(this)">
                        <span>${game.teamHome}</span>
                    </div>
                    
                    <div class="upcoming-match-vs">VS</div>
                    
                    <div class="upcoming-match-team">
                        <img src="${awayLogo}" alt="${game.teamAway}" onerror="this.onImageError(this)">
                        <span>${game.teamAway}</span>
                    </div>
                </div>
                
                <div class="upcoming-match-footer">
                    <div class="upcoming-match-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        ${game.location || 'Место уточняется'}
                    </div>
                </div>
            </div>
        `;
    }

    // Получение цвета для лиги
    getLeagueColor(leagueCode) {
        const colors = {
            'A': '#0055a5',
            'B': '#28a745',
            'F': '#e91e63'
        };
        return colors[leagueCode] || '#6c757d';
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

    // Рендер карточки матча для главной страницы
    renderGamePreviewCard(game) {
        const gameDate = new Date(game._fullDate);
        const homeLogo = this.getTeamLogo(game.teamHome, game.league);
        const awayLogo = this.getTeamLogo(game.teamAway, game.league);
        
        const leagueColors = {
            'A': '#0055a5',
            'B': '#28a745',
            'F': '#e91e63'
        };
        
        const leagueColor = leagueColors[game.league] || '#6c757d';
        const leagueName = this.getLeagueName(game.league);
        
        const now = new Date();

        // Нормализуем даты до начала дня в UTC для правильного сравнения
        const gameDay = new Date(Date.UTC(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()));
        const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

        // Вычисляем разницу в днях
        const diffTime = gameDay - today;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let timeStatus = '';
        if (diffDays === 0) {
            // Для сегодня показываем точное время
            const timeDiff = game._fullDate - now;
            const hoursDiff = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            timeStatus = `Через ${hoursDiff} ч`;
        } else if (diffDays === 1) {
            timeStatus = 'Завтра';
        } else if (diffDays <= 7) {
            timeStatus = `Через ${diffDays} д`;
        } else {
            timeStatus = `${diffDays} д`;
        }

        return `
            <div class="game-preview-card" data-game-id="${game._id}" data-league="${game.league}">
                <div class="game-preview-header">
                    <div class="game-date-time">
                        <div class="date">
                            ${gameDate.toLocaleDateString('ru-RU', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short'
                            })}
                        </div>
                        <div class="time">
                            ${gameDate.toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })} • ${timeStatus}
                        </div>
                    </div>
                    <div class="game-league-badge" style="background: ${leagueColor}20; color: ${leagueColor};">
                        ${leagueName}
                    </div>
                </div>
                
                <div class="game-preview-teams">
                    <div class="game-preview-team">
                        <img src="${homeLogo}" alt="${game.teamHome}" onerror="this.onImageError(this)">
                        <span>${game.teamHome}</span>
                    </div>
                    
                    <div class="game-preview-vs">VS</div>
                    
                    <div class="game-preview-team">
                        <img src="${awayLogo}" alt="${game.teamAway}" onerror="this.onImageError(this)">
                        <span>${game.teamAway}</span>
                    </div>
                </div>
                
                <div class="game-preview-footer">
                    <div class="game-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        ${game.location || 'Место уточняется'}
                    </div>
                </div>
            </div>
        `;
    }

    setupGamePreviewClickHandlers() {
        document.querySelectorAll('.game-preview-card').forEach(card => {
            card.addEventListener('click', () => {
                const league = card.dataset.league;
                const leagueId = `league-${league.toLowerCase()}`;
                
                // Показываем страницу лиги
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                document.querySelector(`.nav-link[data-section="${leagueId}"]`).classList.add('active');
                this.updateLeagueIndicator(leagueId);
                this.showSection(leagueId);
                
                // Устанавливаем текущую лигу
                this.currentLeague = league;
                this.renderLeaguePage(league);
                
                // Прокручиваем к матчам
                const matchesSection = document.getElementById(`${leagueId}-matches`);
                if (matchesSection) {
                    matchesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    renderLeaguePage(league) {
        // Рендерим положение команд
        this.renderLeagueStandings(league);
        
        // Рендерим матчи с использованием нового рендерера
        this.renderLeagueMatches(league);
    }

    renderLeagueStandings(league) {
        const container = document.getElementById(`league-${league.toLowerCase()}-teams`);
        if (!container) return;

        const standings = this.dataManager.getLeagueStandings(league);
        
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
                            <th>В/П</th>
                            <th>%</th>
                            <th>Последние<br>5 игр</th>
                            <th>Забито</th>
                            <th>Пропущено</th>
                            <th>+/-</th>
                            <th>О</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${standings.map((stand, index) => `
                            <tr class="clickable-row" data-team-name="${stand.teamName}">
                                <td>${index + 1}</td>
                                <td>
                                    <div class="team-row">
                                        <img src="${stand.team.logo}" alt="${stand.teamName}" class="team-logo-small" onerror="this.onImageError(this)">
                                        ${stand.teamName}
                                    </div>
                                </td>
                                <td>${stand.played}</td>
                                <td>${stand.wins}/${stand.losses}</td>
                                <td>${stand.played > 0 ? Math.round(stand.wins / stand.played * 1000) / 10 : 0}</td>
                                <td>
                                    ${this.renderTrendDots(stand.trand)}
                                </td>
                                <td>${stand.pointsFor}</td>
                                <td>${stand.pointsAgainst}</td>
                                <td class="${stand.pointsFor - stand.pointsAgainst >= 0 ? 'positive' : 'negative'}">
                                    ${stand.pointsFor - stand.pointsAgainst >= 0 ? '+' : ''}${stand.pointsFor - stand.pointsAgainst}
                                </td>
                                <td><strong>${stand.points}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Добавляем обработчики для кликов по командам
        container.querySelectorAll('[data-team-name]').forEach(element => {
            element.addEventListener('click', (e) => {
                const teamName = e.currentTarget.dataset.teamName;
                this.ui.showTeamModal(teamName, league);
            });
        });
    }

    renderTrendDots(trand) {
        // Берем последние 5 игр или меньше, если игр было меньше
        const lastGames = trand.slice(-5);
        let html = '';
        
        for (let i = 0; i < 5; i++) {
            if (i < lastGames.length) {
                const result = lastGames[i];
                html += `<div class="dot ${result === '1' ? 'green' : 'red'}"></div>`;
            } else {
                html += '<div class="dot" style="background-color: #ccc;"></div>';
            }
        }
        
        return html;
    }

    renderLeagueMatches(league) {
        const containerId = `league-${league.toLowerCase()}-matches`;
        this.matchesRenderer.renderLeagueMatches(league, containerId);
    }

    getTeamLogo(teamName, league) {
        const team = this.dataManager.getTeamByName(teamName, league);
        return team?.logo || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
    }

    getLeagueName(leagueCode) {
        const leagues = {
            'A': 'Лига А',
            'B': 'Лига Б',
            'F': 'Женская лига'
        };
        return leagues[leagueCode] || leagueCode;
    }

    updateStats() {
        if (!this.dataManager) return;
        
        const totalTeams = this.dataManager.teams.length;
        const totalGames = this.dataManager.games.length;
        
        // Подсчет игроков: 12 игроков * количество команд
        const estimatedPlayers = totalTeams * 12;
        
        document.getElementById('total-teams').textContent = totalTeams;
        document.getElementById('total-games').textContent = totalGames;
        document.getElementById('total-players').textContent = `${estimatedPlayers}+`;
    }

    // Также обновляем setupUpcomingMatchClickHandlers для главной страницы
    setupUpcomingMatchClickHandlers() {
        document.querySelectorAll('.upcoming-match-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const gameId = card.dataset.gameId;
                const league = card.dataset.league;
                const game = this.dataManager.getGameById(gameId);
                
                if (game) {
                    this.showMatchDetailsModal(game, league);
                }
            });
        });
    }

    // Добавляем метод для показа модального окна с деталями матча
    showMatchDetailsModal(game, league) {
        // Используем тот же метод, что и в MatchesRenderer
        this.matchesRenderer.showMatchDetailsModal(game, league);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    
    const dataManager = new BasketballData();
    
    dataManager.ready.then(() => {
        // Создаем базовый UI
        const ui = new BasketballUI(dataManager);
        
        // Создаем главную страницу
        const homePage = new HomePage(dataManager, ui);
        
        // Сохраняем в глобальной области
        window.basketballUI = ui;
        window.basketballData = dataManager;
        window.homePage = homePage;
        
        console.log('Приложение инициализировано');
    }).catch(error => {
        console.error('Ошибка инициализации:', error);
        // Даже при ошибке скрываем loading
        document.getElementById('fullscreen-loading').style.display = 'none';
    });
});