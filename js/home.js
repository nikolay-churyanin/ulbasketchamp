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
        this.setupNewsFilter();
        this.updateLeagueIndicator('home');
        
        if (this.dataManager.ready) {
            this.dataManager.ready.then(async () => {
                this.setupSeasonSwitcher();
                this.renderLeagueShell();
                await this.renderHomePage();
            }).catch(error => {
                console.error('Ошибка отрисовки сезона:', error);
                this.dataManager.hideLoading();
            });
        }
    }

    setupSeasonSwitcher() {
        const select = document.getElementById('season-select');
        if (!select) return;

        const seasons = this.dataManager.getSeasonList();
        select.innerHTML = seasons.map(season => {
            const archived = season.archived ? ' (архив)' : '';
            return `<option value="${season.id}">${season.label}${archived}</option>`;
        }).join('');
        select.value = this.dataManager.seasonId;

        select.addEventListener('change', async () => {
            try {
                const changed = await this.dataManager.switchSeason(select.value);
                if (changed) {
                    this.newsManager.newsCache = null;
                    await this.refreshAfterSeasonChange();
                } else {
                    select.value = this.dataManager.seasonId;
                }
            } catch (error) {
                console.error('Ошибка обновления сезона:', error);
                select.value = this.dataManager.seasonId;
            } finally {
                this.dataManager.hideLoading();
            }
        });

        this.updateSeasonChrome();
    }

    updateSeasonChrome() {
        const label = this.dataManager.getSeasonLabel();
        document.title = `Чемпионат по баскетболу — ${label}`;
    }

    async refreshAfterSeasonChange() {
        this.updateSeasonChrome();
        this.renderLeagueShell();
        await this.renderHomePage();

        const active = document.querySelector('.nav-link.active');
        const sectionId = active?.dataset.section || 'home';

        if (sectionId === 'news') {
            if (!this.dataManager.hasNews()) {
                this.openSection('home');
                return;
            }
            await this.newsManager.loadAndDisplayNews('news-container', this.newsManager.currentFilter || 'all');
            return;
        }
        if (sectionId === 'top-stats' && window.topStatsManager) {
            const leagues = this.dataManager.getLeaguesReadyForTopStats();
            if (!leagues.length) {
                this.openSection('home');
                return;
            }
            window.topStatsManager.syncLeagueFilters(leagues);
            window.topStatsManager.loadAndDisplayStats(window.topStatsManager.currentFilter);
            return;
        }
        if (sectionId.startsWith('league-')) {
            const league = this.dataManager.getLeagueBySectionId(sectionId);
            if (league) {
                this.currentLeague = league.id;
                this.renderLeaguePage(league.id);
            } else {
                this.openSection('home');
            }
        }
    }

    setupNavigation() {
        const nav = document.querySelector('.main-nav');
        nav?.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (!link) return;
            e.preventDefault();
            this.openSection(link.dataset.section);
        });

        this.showSection('home');
    }

    openSection(sectionId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });

        this.updateLeagueIndicator(sectionId);
        this.showSection(sectionId);

        if (sectionId === 'news') {
            this.newsManager.loadAndDisplayNews('news-container', 'all');
        } else if (sectionId === 'top-stats') {
            if (window.topStatsManager) {
                const leagues = this.dataManager.getLeaguesReadyForTopStats();
                window.topStatsManager.syncLeagueFilters(leagues);
                window.topStatsManager.loadAndDisplayStats(window.topStatsManager.currentFilter);
            }
        } else if (sectionId === 'home') {
            this.renderHomePage();
        } else {
            const league = this.dataManager.getLeagueBySectionId(sectionId);
            if (league) {
                this.currentLeague = league.id;
                this.renderLeaguePage(league.id);
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Настройка фильтра новостей
    setupNewsFilter() {
        document.querySelector('.news-filter')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.news-filter-btn');
            if (!btn) return;
            e.preventDefault();

            const filter = btn.dataset.filter;
            document.querySelectorAll('.news-filter-btn').forEach(item => {
                item.classList.toggle('active', item === btn);
            });

            if (this.newsManager) {
                this.newsManager.loadAndDisplayNews('news-container', filter);
            }
        });
    }

    renderLeagueShell() {
        this.renderLeagueNav();
        this.renderLeaguePages();
        this.renderNewsFilters();
        const active = document.querySelector('.nav-link.active');
        this.showSection(active?.dataset.section || 'home');
    }

    renderLeagueNav() {
        const nav = document.querySelector('.main-nav');
        const newsLink = nav?.querySelector('[data-section="news"]');
        if (!nav || !newsLink) return;

        nav.querySelectorAll('.nav-link[data-section^="league-"]').forEach(link => link.remove());

        this.dataManager.getLeagues().forEach(league => {
            const link = document.createElement('a');
            link.href = `#${league.sectionId}`;
            link.className = 'nav-link';
            link.dataset.section = league.sectionId;
            link.textContent = league.name;
            nav.insertBefore(link, newsLink);
        });
    }

    renderLeaguePages() {
        const host = document.getElementById('league-pages');
        if (!host) return;

        host.innerHTML = this.dataManager.getLeagues().map(league => `
            <section id="${league.sectionId}" class="league-section hidden-section">
                <div class="league-header ${league.cssClass}">
                    <h2>${league.name}</h2>
                </div>
                <h3 class="league-section-title">Положение команд</h3>
                <div class="teams-container" id="${league.sectionId}-teams"></div>
                <div class="league-content-divider"></div>
                <h3 class="league-section-title">Матчи</h3>
                <div class="matches-container" id="${league.sectionId}-matches"></div>
            </section>
        `).join('');
    }

    renderNewsFilters() {
        const el = document.querySelector('.news-filter');
        if (!el) return;

        const leagueButtons = this.dataManager.getLeagues().map(league =>
            `<button class="news-filter-btn" data-filter="${league.id}">${league.name}</button>`
        ).join('');

        el.innerHTML = `
            <button class="news-filter-btn active" data-filter="all">Все новости</button>
            ${leagueButtons}
            <button class="news-filter-btn" data-filter="general">Общие</button>
        `;
    }

    updateLeagueIndicator(sectionId, leagueId) {
        const indicator = document.getElementById('league-indicator');
        const header = document.querySelector('header');
        const leagueClasses = ['league-a', 'league-b', 'league-f', 'home'];

        header?.classList.remove(...leagueClasses);
        if (indicator) {
            indicator.className = 'current-league-indicator';
        }

        let league = null;
        if (sectionId === 'top-stats') {
            league = this.dataManager.getLeagueById(leagueId || window.topStatsManager?.currentFilter);
        } else if (sectionId && sectionId !== 'home' && sectionId !== 'news') {
            league = this.dataManager.getLeagueBySectionId(sectionId);
        }

        if (league) {
            header?.classList.add(league.cssClass);
            indicator?.classList.add(league.cssClass);
        }
    }

    showSection(sectionId) {
        document.querySelectorAll('section').forEach(section => {
            section.style.display = 'none';
            section.classList.add('hidden-section');
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden-section');
            targetSection.style.display = 'block';
        }
    }

    async renderHomePage() {
        if (!this.dataManager) {
            return;
        }

        this.updateSeasonChrome();
        this.updateHomeIntro();
        await this.renderLeagueOverview();
        await this.renderUpcomingGames();
        this.updateStats();
        this.updateSeasonNav();
    }

    updateHomeIntro() {
        const el = document.getElementById('home-intro');
        if (!el) return;

        const archived = Boolean(this.dataManager.seasonMeta?.archived);
        const games = this.dataManager.getAllGamesForDisplay().filter(game =>
            game._fullDate && !isNaN(game._fullDate.getTime())
        );
        const total = games.length;
        const played = games.filter(game => game._hasResult).length;
        const remaining = Math.max(0, total - played);
        const lateThreshold = Math.min(8, Math.max(3, Math.ceil(total * 0.1)));

        const setIntro = (state, title, badge, text) => {
            el.dataset.state = state;
            el.innerHTML = `
                <div class="home-intro-row">
                    <h2>${title}</h2>
                    <span class="home-intro-badge">${badge}</span>
                </div>
                <p>${text}</p>
            `;
        };

        if (archived || (total > 0 && remaining === 0 && played > 0)) {
            setIntro(
                archived ? 'archived' : 'done',
                'Сезон завершён',
                archived ? 'Архив' : 'Финиш',
                'Все матчи сыграны. Таблицы, плей-офф остаются здесь — спасибо командам, судьям и болельщикам.'
            );
            return;
        }

        if (total === 0 || played === 0) {
            if (total === 0) {
                setIntro(
                    'upcoming',
                    'Сезон начинается',
                    'Скоро',
                    'Добро пожаловать на чемпионат Ульяновской области. Расписание и результаты появятся здесь.'
                );
                return;
            }

            setIntro(
                'start',
                'Старт сезона',
                'Анонс',
                `В календаре уже ${total} ${this.getPluralFormMatch(total)} — первый результат откроет таблицу. Следите за анонсами ближайшего тура.`
            );
            return;
        }

        if (remaining <= lateThreshold) {
            setIntro(
                'stretch',
                'Финишная прямая',
                'Финиш',
                `Осталось ${remaining} ${this.getPluralFormMatch(remaining)}. Таблица и плей-офф решаются в ближайших матчах.`
            );
            return;
        }

        setIntro(
            'live',
            'Сезон в разгаре',
            'Идёт',
            `Сыграно ${played} из ${total} ${this.getPluralFormMatch(total)}. Результаты появляются по ходу туров — следите за таблицей и ближайшими играми.`
        );
    }

    updateSeasonNav() {
        const newsLink = document.querySelector('.nav-link[data-section="news"]');
        const topsLink = document.querySelector('.nav-link[data-section="top-stats"]');
        const hasNews = this.dataManager.hasNews();
        const topLeagues = this.dataManager.getLeaguesReadyForTopStats();

        if (newsLink) newsLink.hidden = !hasNews;
        if (topsLink) topsLink.hidden = topLeagues.length === 0;

        if (window.topStatsManager) {
            window.topStatsManager.syncLeagueFilters(topLeagues);
            if (!topLeagues.includes(window.topStatsManager.currentFilter)) {
                window.topStatsManager.currentFilter = topLeagues[0] || 'A';
            }
        }

        const active = document.querySelector('.nav-link.active');
        if (active?.hidden) {
            active.classList.remove('active');
            const homeLink = document.querySelector('.nav-link[data-section="home"]');
            homeLink?.classList.add('active');
            this.updateLeagueIndicator('home');
            this.showSection('home');
        }
    }

    async renderLeagueOverview() {
        const container = document.getElementById('league-overview');
        if (!container) return;

        const leagues = this.dataManager.getLeagues();

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
                    <div class="league-card-header ${league.cssClass}">
                        <h3>${league.name}</h3>
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
                const league = this.dataManager.getLeagueById(link.dataset.league);
                if (!league) return;
                this.openSection(league.sectionId);
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
        BasketballUtils.handleImageError({ target: img });
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
            .sort((a, b) => a._fullDate - b._fullDate);
        const section = container.closest('.upcoming-games-section');

        const seasonArchived = Boolean(this.dataManager.seasonMeta?.archived);
        if (upcomingGames.length === 0 || seasonArchived) {
            if (section) section.hidden = true;
            container.innerHTML = '';
            return;
        }

        if (section) section.hidden = false;

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
        return BasketballUtils.getPluralForm(count, ['команда','команды','команд']);
    }

    getPluralFormPlayed(count) {
        return BasketballUtils.getPluralForm(count, ['сыгран','сыграно','сыграно']);
    }

    setupGamePreviewClickHandlers() {
        document.querySelectorAll('.game-preview-card').forEach(card => {
            card.addEventListener('click', () => {
                const league = this.dataManager.getLeagueById(card.dataset.league);
                if (!league) return;
                this.openSection(league.sectionId);
                const matchesSection = document.getElementById(`${league.sectionId}-matches`);
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
                                    const playoffCount = Number(config?.playoffTeams) || 0;
                                    const isPlayoffTeam = playoffCount > 0 && index < playoffCount;
                                    const isLastPlayoff = isPlayoffTeam && index === playoffCount - 1;

                                    return `<tr class="clickable-row${isPlayoffTeam ? ' playoff-spot' : ''}${isLastPlayoff ? ' playoff-spot-last' : ''}" data-team-name="${stand.teamName}">
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
        const format = quarterfinals.length > 0 ? '6' : '4';

        const getTeamSeed = (teamName) => {
            if (!teamName) return null;
            const teamIndex = standings.findIndex(t =>
                this.dataManager.normalizeTeamName(t.teamName) === this.dataManager.normalizeTeamName(teamName)
            );
            return teamIndex >= 0 ? teamIndex + 1 : null;
        };

        const isPlaceholder = (name) => {
            if (!name) return true;
            return /^(TBD|Win |Lose |Победитель|Проигравший)/i.test(name);
        };

        const scoresForPlace = (place, game) => {
            if (!game || game.scoreHome == null || game.scoreAway == null) {
                return [null, null];
            }
            const home = this.dataManager.normalizeTeamName(game.teamHome);
            const team1 = this.dataManager.normalizeTeamName(place.team1);
            if (home === team1) {
                return [game.scoreHome, game.scoreAway];
            }
            return [game.scoreAway, game.scoreHome];
        };

        const renderLine = (teamName, seed, score, isWinner, isLoser) => {
            const waiting = isPlaceholder(teamName);
            const display = teamName || 'Ожидается';
            const logo = waiting ? '' : this.getTeamLogo(teamName, league);
            return `
                <div class="bracket-line ${isWinner ? 'is-winner' : ''} ${isLoser ? 'is-loser' : ''} ${waiting ? 'is-wait' : ''}">
                    ${seed ? `<span class="bracket-seed ${this.getSeedBadgeClass(seed)}" title="Место в регулярке: ${seed}">${seed}</span>` : '<span class="bracket-seed bracket-seed--empty"></span>'}
                    ${logo
                        ? `<img src="${logo}" alt="" class="bracket-logo" onerror="this.onImageError(this)">`
                        : '<span class="bracket-logo bracket-logo--empty"></span>'}
                    <span class="bracket-name">${display}</span>
                    <span class="bracket-score">${score == null ? '' : score}</span>
                </div>
            `;
        };

        const renderGame = (place, game, label) => {
            const done = place.winner != null;
            const [score1, score2] = scoresForPlace(place, game);
            const gameId = game?.id || '';
            return `
                <div class="bracket-game playoff-match ${done ? 'is-done' : 'is-pending'}"
                     data-game-id="${gameId}"
                     data-league="${league}">
                    <div class="bracket-game-label">${label}</div>
                    ${renderLine(place.team1, place.team1Seed, score1, done && place.winner === place.team1, done && place.winner && place.winner !== place.team1)}
                    ${renderLine(place.team2, place.team2Seed, score2, done && place.winner === place.team2, done && place.winner && place.winner !== place.team2)}
                </div>
            `;
        };

        const qfHtml = quarterfinals.map((qf, index) => {
            const game = qf.games?.[0] || null;
            return renderGame(qf, game, `1/4 · ${index + 1}`);
        }).join('');

        const sfHtml = semifinals.map((sf, index) => {
            const game = sf.games?.[0] || null;
            const place = {
                ...sf,
                team2: sf.team2 || (quarterfinals.length ? `Победитель 1/4 ${index + 1}` : 'TBD')
            };
            return renderGame(place, game, `1/2 · ${index + 1}`);
        }).join('');

        let finalHtml = '';
        if (final[0]) {
            const match = final[0];
            const game = match.games?.[0] || null;
            const place = {
                ...match,
                team1: match.team1 || 'Победитель 1/2 1',
                team2: match.team2 || 'Победитель 1/2 2'
            };
            finalHtml = renderGame(place, game, 'Финал');
        }

        let thirdHtml = '';
        if (thirdPlace[0]) {
            const match = thirdPlace[0];
            const game = match.games?.[0] || null;
            const place = {
                ...match,
                team1: match.team1 || 'Проигравший 1/2 1',
                team2: match.team2 || 'Проигравший 1/2 2'
            };
            thirdHtml = renderGame(place, game, 'За 3-е место');
        }

        let championHtml = '';
        if (champion) {
            const championSeed = getTeamSeed(champion);
            championHtml = `
                <div class="champion-team">
                    <span class="trophy">Чемпион</span>
                    <strong class="champion-name">${champion}</strong>
                    ${championSeed ? `<span class="champion-seed-info">${championSeed} место в регулярке</span>` : ''}
                </div>
            `;
        }

        const qfColumn = quarterfinals.length ? `
            <div class="bracket-round" data-round="qf">
                <div class="bracket-round-label">1/4 финала</div>
                <div class="bracket-round-games">${qfHtml}</div>
            </div>
            <div class="bracket-join" aria-hidden="true"></div>
        ` : '';

        return `
            <div class="bracket-wrap">
                <div class="bracket bracket--${format}">
                    ${qfColumn}
                    <div class="bracket-round" data-round="sf">
                        <div class="bracket-round-label">1/2 финала</div>
                        <div class="bracket-round-games">${sfHtml}</div>
                    </div>
                    <div class="bracket-join" aria-hidden="true"></div>
                    <div class="bracket-round" data-round="final">
                        <div class="bracket-round-label">Финал</div>
                        <div class="bracket-round-games">
                            ${finalHtml}
                            ${championHtml}
                            ${thirdHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
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
        return BasketballUtils.resolveTeamLogo(team?.logo);
    }

    getLeagueName(leagueCode) {
        return this.dataManager.getLeagueName(leagueCode);
    }

    updateStats() {
        if (!this.dataManager) return;
        
        const totalTeams = this.dataManager.teams.length;
        const totalGames = this.dataManager.games.length;
        
        // Подсчет игроков: 12 игроков * количество команд
        const estimatedPlayers = totalTeams * 12;
        
        const leaguesCount = this.dataManager.getLeagues().length;
        document.getElementById('active-leagues').textContent = leaguesCount;
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
                if (!gameId) return;
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