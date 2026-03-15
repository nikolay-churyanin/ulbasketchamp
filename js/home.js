// home.js - обновленная версия с пьедесталом призеров
class HomePage {
    constructor(dataManager, ui) {
        this.dataManager = dataManager;
        this.ui = ui;
        this.matchesRenderer = new MatchesRenderer(dataManager);
        this.currentLeague = null;
        this.newsManager = new NewsManager(dataManager);
        
        // Сохраняем в глобальную область
        window.newsManager = this.newsManager;
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
                this.setupNewsFilter();
            });
        }
    }

    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.dataset.section;
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                this.updateLeagueIndicator(sectionId);
                this.showSection(sectionId);
                
                if (sectionId === 'news') {
                    // Загружаем новости при переходе на вкладку
                    this.newsManager.loadAndDisplayNews('news-container', 'all');
                } else if (sectionId === 'top-stats') {
                    // Загружаем топ статистику
                    if (window.topStatsManager) {
                        window.topStatsManager.loadAndDisplayStats('A');
                    }
                } else if (sectionId !== 'home') {
                    const league = sectionId.split('-')[1].toUpperCase();
                    this.currentLeague = league;
                    this.renderLeaguePage(league);
                } else {
                    this.renderHomePage();
                }
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        this.showSection('home');
    }

    // Настройка фильтра новостей
    setupNewsFilter() {
        document.querySelectorAll('.news-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                const filter = e.currentTarget.dataset.filter;
                
                // Обновляем активную кнопку
                document.querySelectorAll('.news-filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                e.currentTarget.classList.add('active');
                
                // Загружаем новости с фильтром
                if (this.newsManager) {
                    this.newsManager.loadAndDisplayNews('news-container', filter);
                }
            });
        });
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
            
            // Проверяем, завершен ли чемпионат (есть ли чемпион в плей-офф)
            const playoffBracket = this.dataManager.getPlayoffBracket(league.id);
            const champion = playoffBracket?.champion;
            const regularSeasonCompleted = this.dataManager.calculateRegularSeasonCompleted(league.id);
            
            html += `
                <div class="league-card">
                    <div class="league-card-header ${league.color}">
                        <h3>${league.icon} ${league.name}</h3>
                        <p>${teams.length} команд • ${totalGames} ${this.getPluralFormMatch(totalGames)}</p>
                    </div>
                    <div class="league-card-body">
            `;

            // Если есть чемпион - показываем пьедестал
            if (champion) {
                html += this.renderPodium(playoffBracket, standings, league.id);
            } else {
                // Иначе показываем топ-3 команды регулярки
                html += this.renderTopTeamsPreview(standings.slice(0, 3), league.id);
            }

            html += `
                    </div>
                    <div class="league-card-footer">
                        <a href="#league-${league.id.toLowerCase()}" class="league-link" data-league="${league.id}">Смотреть лигу</a>
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
        
        this.setupTeamPreviewClickHandlers();
        
        document.querySelectorAll('.league-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const league = link.dataset.league;
                const leagueId = `league-${league.toLowerCase()}`;
                
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                document.querySelector(`.nav-link[data-section="${leagueId}"]`).classList.add('active');
                this.updateLeagueIndicator(leagueId);
                this.showSection(leagueId);
                
                this.currentLeague = league;
                this.renderLeaguePage(league);
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // Новый метод для рендера топ-3 команд регулярки
    renderTopTeamsPreview(topTeams, league) {
        return `
            <div class="league-teams-preview">
                ${topTeams.map((team, index) => `
                    <div class="league-team-preview" data-team-name="${team.teamName}" data-league="${league}">
                        <span class="team-position position-${index + 1}">${index + 1}</span>
                        <img src="${team.team.logo}" alt="${team.teamName}" 
                             onerror="this.onImageError(this)">
                        <span class="team-name">${team.teamName}</span>
                        <span class="team-record">${team.wins}-${team.losses}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Новый метод для рендера пьедестала призеров
    renderPodium(playoffBracket, standings, league) {
        const champion = playoffBracket.champion;
        
        // Находим серебряного и бронзового призера
        const finalMatch = playoffBracket.final?.[0];
        const thirdPlaceMatch = playoffBracket.thirdPlace?.[0];
        
        // Серебряный призер - проигравший в финале
        let silverMedalist = null;
        if (finalMatch && finalMatch.winner) {
            silverMedalist = finalMatch.winner === finalMatch.team1 ? finalMatch.team2 : finalMatch.team1;
        }
        
        // Бронзовый призер - победитель матча за 3-е место
        let bronzeMedalist = null;
        if (thirdPlaceMatch && thirdPlaceMatch.winner) {
            bronzeMedalist = thirdPlaceMatch.winner;
        } else if (thirdPlaceMatch && thirdPlaceMatch.team1 && thirdPlaceMatch.team2 && !thirdPlaceMatch.winner) {
            // Если матч за 3-е место не сыгран, показываем участников
            bronzeMedalist = 'Матч за 3-е место';
        }

        // Получаем полные данные команд
        const championData = standings.find(t => t.teamName === champion);
        const silverData = standings.find(t => t.teamName === silverMedalist);
        const bronzeData = bronzeMedalist && !bronzeMedalist.includes('Матч') 
            ? standings.find(t => t.teamName === bronzeMedalist) 
            : null;

        return `
            <div class="podium-container">
                <div class="podium">
                    <!-- 2-е место (серебро) -->
                    <div class="podium-item silver">
                        <div class="podium-medal">
                            <span class="medal-icon">🥈</span>
                            <span class="medal-place">2-е место</span>
                        </div>
                        <div class="podium-team" data-team-name="${silverMedalist || ''}" data-league="${league}">
                            <img src="${silverData ? silverData.team.logo : ''}" 
                                 alt="${silverMedalist || 'Второе место'}" 
                                 onerror="this.onImageError(this)">
                            <span class="podium-team-name">${silverMedalist || 'Второе место'}</span>
                            ${silverData ? `<span class="podium-team-record">${silverData.wins}-${silverData.losses}</span>` : ''}
                        </div>
                    </div>
                    
                    <!-- 1-е место (золото) - центральное и самое высокое -->
                    <div class="podium-item gold">
                        <div class="podium-medal">
                            <span class="medal-icon">🥇</span>
                            <span class="medal-place">Чемпион</span>
                        </div>
                        <div class="podium-team" data-team-name="${champion || ''}" data-league="${league}">
                            <img src="${championData ? championData.team.logo : ''}" 
                                 alt="${champion || 'Чемпион'}" 
                                 onerror="this.onImageError(this)">
                            <span class="podium-team-name">${champion || 'Чемпион'}</span>
                            ${championData ? `<span class="podium-team-record">${championData.wins}-${championData.losses}</span>` : ''}
                        </div>
                    </div>
                    
                    <!-- 3-е место (бронза) -->
                    <div class="podium-item bronze">
                        <div class="podium-medal">
                            <span class="medal-icon">🥉</span>
                            <span class="medal-place">3-е место</span>
                        </div>
                        <div class="podium-team" data-team-name="${bronzeMedalist || ''}" data-league="${league}">
                            <img src="${bronzeData ? bronzeData.team.logo : ''}" 
                                 alt="${bronzeMedalist || 'Третье место'}" 
                                 onerror="this.onImageError(this)">
                            <span class="podium-team-name">${bronzeMedalist || 'Третье место'}</span>
                            ${bronzeData ? `<span class="podium-team-record">${bronzeData.wins}-${bronzeData.losses}</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Если матч за 3-е место не сыгран, показываем дополнительную информацию -->
                ${bronzeMedalist === 'Матч за 3-е место' ? `
                    <div class="podium-third-place-info">
                        <div class="third-place-contenders">
                            <div class="contender" data-team-name="${thirdPlaceMatch.team1}" data-league="${league}">
                                <img src="${this.getTeamLogo(thirdPlaceMatch.team1, league)}" alt="${thirdPlaceMatch.team1}">
                                <span>${thirdPlaceMatch.team1}</span>
                            </div>
                            <span class="vs-small">VS</span>
                            <div class="contender" data-team-name="${thirdPlaceMatch.team2}" data-league="${league}">
                                <img src="${this.getTeamLogo(thirdPlaceMatch.team2, league)}" alt="${thirdPlaceMatch.team2}">
                                <span>${thirdPlaceMatch.team2}</span>
                            </div>
                        </div>
                        <p class="third-place-note">Матч за 3-е место ожидается</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    onImageError(img) {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
        img.onerror = null;
    }

    setupTeamPreviewClickHandlers() {
        document.querySelectorAll('.league-team-preview, .podium-team, .contender').forEach(preview => {
            preview.addEventListener('click', () => {
                const teamName = preview.dataset.teamName;
                const league = preview.dataset.league;
                
                if (teamName && !teamName.includes('Матч') && !teamName.includes('место')) {
                    // Показываем модальное окно команды
                    this.ui.showTeamModal(teamName, league);
                }
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
                            ${dateGames.length} ${this.getPluralFormMatch(dateGames.length)}
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
    getPluralFormMatch(count) {
        return BasketballUtils.getPluralForm(count, ['матч','матча','матчей']);
    }

    getPluralFormTeam(count) {
        return BasketballUtils.getPluralForm(count, ['команда','команды','команды']);
    }

    getPluralFormPlayed(count) {
        return BasketballUtils.getPluralForm(count, ['сыгран','сыграно','сыграно']);
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

    async renderLeagueStandings(league) {
        const container = document.getElementById(`league-${league.toLowerCase()}-teams`);
        if (!container) return;

        const standings = this.dataManager.getLeagueStandings(league);
        const config = this.dataManager.getLeagueConfig(league);
        
        if (standings.length === 0) {
            container.innerHTML = '<p class="no-teams">Команды не найдены</p>';
            return;
        }

        // Проверяем, завершена ли регулярка
        const regularSeasonCompleted = this.dataManager.calculateRegularSeasonCompleted(league);
        
        // Получаем сетку плей-офф (автоматически строится из игр)
        const playoffBracket = this.dataManager.getPlayoffBracket(league);
        
        // Показываем вкладку плей-офф если регулярка завершена ИЛИ уже есть игры плей-офф
        const hasPlayoffGames = this.dataManager.games.some(game => 
            game.gameType === 'playoff' && game.league === league
        );
        
        const shouldShowPlayoffTab = regularSeasonCompleted || hasPlayoffGames;

        let html = `
            <div class="standings-container">
                <div class="playoff-tabs">
                    <button class="playoff-tab active" data-tab="regular">
                        <span class="playoff-tab-icon">📊</span>
                        Регулярный сезон
                    </button>
                    ${shouldShowPlayoffTab ? `
                        <button class="playoff-tab" data-tab="playoff">
                            <span class="playoff-tab-icon">🏆</span>
                            Плей-офф
                        </button>
                    ` : ''}
                </div>
                
                <!-- Вкладка регулярного сезона -->
                <div class="playoff-tab-content active" id="regular-tab">
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
                                ${standings.map((stand, index) => {
                                    const isPlayoffTeam = index < config.playoffTeams;
                                    const style = isPlayoffTeam ? 'background-color: rgba(40, 167, 69, 0.05);' : '';

                                    return `<tr class="clickable-row" data-team-name="${stand.teamName}" style="${style}">
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
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Вкладка плей-офф -->
                <div class="playoff-tab-content" id="playoff-tab">
        `;

        if (shouldShowPlayoffTab) {
            html += this.renderPlayoffBracket(playoffBracket, league, standings);
        } else {
            html += `
                <div class="playoff-not-available">
                    <div class="playoff-locked">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        <h3>Плей-офф еще не начался</h3>
                        <p>Сетка плей-офф будет доступна после завершения регулярного сезона</p>
                    </div>
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Настраиваем вкладки
        this.setupPlayoffTabs(container);
        
        // Добавляем обработчики для кликов по командам в регулярке
        container.querySelectorAll('.clickable-row').forEach(element => {
            element.addEventListener('click', (e) => {
                const teamName = e.currentTarget.dataset.teamName;
                this.ui.showTeamModal(teamName, league);
            });
        });
        
        // Добавляем обработчики для кликов по матчам плей-офф
        setTimeout(() => {
            this.setupPlayoffMatchClickHandlers(league);
        }, 100);
    }

    getSeedBadgeClass(seed) {
        if (!seed) return '';
        if (seed === 1) return 'playoff-seed-1';
        if (seed === 2) return 'playoff-seed-2';
        if (seed === 3) return 'playoff-seed-3';
        if (seed <= 6) return 'playoff-seed-4';
        return '';
    }

    renderPlayoffBracket(bracket, league, standings) {
        const quarterfinals = bracket.quarterfinals || [];
        const semifinals = bracket.semifinals || [];
        const thirdPlace = bracket.thirdPlace || [];
        const final = bracket.final || [];
        const champion = bracket.champion;

        // Функция для получения seed команды
        const getTeamSeed = (teamName) => {
            if (!teamName) return null;
            const teamIndex = standings.findIndex(t => 
                this.dataManager.normalizeTeamName(t.teamName) === this.dataManager.normalizeTeamName(teamName)
            );
            return teamIndex >= 0 ? teamIndex + 1 : null;
        };
        
        const renderTeamForPlace = (title, place, game, team1Display, team2Display) => {
            const isCompleted = place.winner !== null;
            return `
                <div class="playoff-match" data-game-id="${game ? game.id : -1}" data-league="${league}">
                    <div class="playoff-match-header">
                        <div class="playoff-match-title">${title}</div>
                    </div>
                    <!-- Команда 1 -->
                    <div class="playoff-team ${place.team1 && place.winner === place.team1 ? 'winner' : ''}">
                        <div class="playoff-team-with-seed">
                            ${place.team1Seed ? `
                                <div class="playoff-team-seed-info">
                                    <div class="playoff-seed-badge ${this.getSeedBadgeClass(place.team1Seed)}" 
                                         title="Место в регулярке: ${place.team1Seed}">
                                        ${place.team1Seed}
                                    </div>
                                </div>
                            ` : ''}
                                        
                            <div class="playoff-team-info">
                                <img src="${place.team1 ? this.getTeamLogo(place.team1, league) : 
                                        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEJEPC90ZXh0Pgo8L3N2Zz4='}" 
                                     alt="${team1Display}" class="playoff-team-logo" onerror="this.onImageError(this)">
                                <div class="playoff-team-details">
                                    <span class="playoff-team-name">${team1Display}</span>
                                </div>
                            </div>
                            
                            ${game && game.scoreHome ? `
                                <div class="playoff-team-score">
                                    ${game.scoreHome}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Команда 2 -->
                    <div class="playoff-team ${place.team2 && place.winner === place.team2 ? 'winner' : ''}">
                        <div class="playoff-team-with-seed">
                            ${place.team2Seed ? `
                                <div class="playoff-team-seed-info">
                                    <div class="playoff-seed-badge ${this.getSeedBadgeClass(place.team2Seed)}" 
                                         title="Место в регулярке: ${place.team2Seed}">
                                        ${place.team2Seed}
                                    </div>
                                </div>
                            ` : ''}
                            
                             <div class="playoff-team-info">
                                <img src="${place.team2 ? this.getTeamLogo(place.team2, league) : 
                                        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEJEPC90ZXh0Pgo8L3N2Zz4='}" 
                                     alt="${team2Display}" class="playoff-team-logo" onerror="this.onImageError(this)">
                                <div class="playoff-team-details">
                                    <span class="playoff-team-name">${team2Display}</span>
                                </div>
                            </div>
                            
                            ${game && game.scoreAway ? `
                                <div class="playoff-team-score">
                                    ${game.scoreAway}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="playoff-match-footer">
                        <div class="playoff-match-status ${isCompleted ? 'completed' : 'scheduled'}">
                            ${isCompleted ? 'Завершено' : 'Запланировано'}
                        </div>
                    </div>
                </div>
            `;
        };

        let html = `
            <div class="playoff-bracket-container">
                <div class="playoff-bracket">
        `;
        
        // Четвертьфиналы (только для 6 команд)
        if (quarterfinals.length > 0) {
            html += `
                <div class="playoff-round playoff-round-quartefinals">
                    <div class="playoff-round-title">1/4 финала</div>
                    <div class="playoff-round-matches">
            `;
            
            quarterfinals.forEach((qf, index) => {
                const game = qf.games && qf.games.length > 0 ? qf.games[0] : null;
                
                html += renderTeamForPlace(`1/4 финала ${index + 1}`, qf, game, qf.team1, qf.team2);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Полуфиналы
        if (semifinals.length > 0) {
            html += `
                <div class="playoff-round playoff-round-semifinals">
                    <div class="playoff-round-title">1/2 финала</div>
                    <div class="playoff-round-matches">
            `;
            
            semifinals.forEach((sf, index) => {
                const game = sf.games && sf.games.length > 0 ? sf.games[0] : null;
                const team2Display = sf.team2 || (quarterfinals.length > 0 ? 
                    (index === 0 ? 'Win 1/4 2' : 'Win 1/4 1') : 
                    'TBD');
                
                html += renderTeamForPlace(`1/2 финала ${index + 1}`, sf, game, sf.team1, team2Display);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Матч за 3-е место
        if (thirdPlace.length > 0) {
            const tp = thirdPlace[0];
            const game = tp.games && tp.games.length > 0 ? tp.games[0] : null;
            const team1Display = tp.team1 || 'Lose 1/2 1';
            const team2Display = tp.team2 || 'Lose 1/2 2';
            
            html += `
                <div class="playoff-third-place-container">
                    <div class="playoff-third-place-match-wrapper">
                        <div class="playoff-round playoff-round-third-place">
                            <div class="playoff-round-title">
                                <span class="bronze-icon">🥉</span> Матч за 3-е место
                            </div>
                            <div class="playoff-round-matches">
                                ${renderTeamForPlace('Матч за 3-е место', tp, game, team1Display, team2Display)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Финал
        if (final.length > 0) {
            const finalMatch = final[0];
            const game = finalMatch.games && finalMatch.games.length > 0 ? finalMatch.games[0] : null;
            const team1Display = finalMatch.team1 || 'Win 1/2 1';
            const team2Display = finalMatch.team2 || 'Win 1/2 2';
            
            html += `
                <div class="playoff-round playoff-round-finals">
                    <div class="playoff-round-title">Финал</div>
                    <div class="playoff-round-matches">
                        ${renderTeamForPlace('Финал', finalMatch, game, team1Display, team2Display)}
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        // Чемпион
        if (champion) {
            const championSeed = getTeamSeed(champion);
            
            html += `
                <div class="champion-team">
                    <div class="trophy">🏆</div>
                    <h3>Чемпион ${this.dataManager.getLeagueName(league)}</h3>
                    <div class="champion-name">${champion}</div>
                    ${championSeed ? `
                        <div class="champion-seed-info">
                            <span class="playoff-seed-badge ${this.getSeedBadgeClass(championSeed)}">
                                ${championSeed}
                            </span>
                            <span>Место в регулярке</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        return html;
    }

    // Новый метод для настройки вкладок плей-офф
    setupPlayoffTabs(container) {
        const tabs = container.querySelector('.playoff-tabs');
        
        tabs?.querySelectorAll('.playoff-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = e.currentTarget.dataset.tab;
                
                // Убираем активный класс у всех вкладок
                tabs.querySelectorAll('.playoff-tab').forEach(t => {
                    t.classList.remove('active');
                });
                
                // Добавляем активный класс текущей вкладке
                e.currentTarget.classList.add('active');
                
                // Убираем активный класс у всех контентов
                container.querySelectorAll('.playoff-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Показываем нужный контент
                container.querySelector(`#${tabName}-tab`).classList.add('active');
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
        document.getElementById('total-teams-label').textContent = this.getPluralFormTeam(totalTeams);;
        document.getElementById('total-games').textContent = totalGames;
        document.getElementById('total-games-label').textContent = this.getPluralFormMatch(totalGames);
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

    // Добавьте этот метод в класс HomePage после метода setupUpcomingMatchClickHandlers

    setupPlayoffMatchClickHandlers(league) {
        document.querySelectorAll('.playoff-match').forEach(card => {
            card.addEventListener('click', async (e) => {
                             
                const gameId = card.dataset.gameId;
                const game = this.dataManager.getGameById(gameId);

                if (game) {
                    // Проверяем наличие картинки результата
                    const resultImageUrl = this.dataManager.getGameResultImage(game.id);
                    const hasResultImage = await this.dataManager.checkImageExists(resultImageUrl);
                
                    if (hasResultImage) {
                        window.homePage.matchesRenderer.showFullscreenImage(resultImageUrl, `${game.teamHome} vs ${game.teamAway}`);
                    } else {
                        this.showMatchDetailsModal(game, league);
                    }
                }           
            });
        });
    }
}

// Инициализация при загрузке страницы
// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    
    const dataManager = new BasketballData();
    
    dataManager.ready.then(() => {
        // Создаем базовый UI
        const ui = new BasketballUI(dataManager);
        
        // Создаем главную страницу
        const homePage = new HomePage(dataManager, ui);
        
        // Создаем менеджер топ статистики
        const topStatsManager = new TopStatsManager(dataManager);
        
        // Сохраняем в глобальной области
        window.basketballUI = ui;
        window.basketballData = dataManager;
        window.homePage = homePage;
        window.topStatsManager = topStatsManager;
        
        console.log('Приложение инициализировано');
    }).catch(error => {
        console.error('Ошибка инициализации:', error);
        // Даже при ошибке скрываем loading
        document.getElementById('fullscreen-loading').style.display = 'none';
    });
});