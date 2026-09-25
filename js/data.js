class BasketballData {
    constructor() {
        this.teams = [];
        this.games = [];
        this.leagueConfigs = {};
        this.newsIndex = [];
        this.seasonsCatalog = { current: '2025-26', seasons: [] };
        this.seasonId = null;
        this.seasonMeta = null;
        this.dataVersion = '3.5';
        this.ready = this.init();
    }

    async init() {
        try {
            this.showLoading();
            await this.loadSeasonsCatalog();
            const requested = this.readRequestedSeasonId();
            await this.loadSeason(this.resolveSeasonId(requested));
        } catch (error) {
            console.error('Error in init:', error);
        } finally {
            this.hideLoading();
        }
    }

    showLoading() {
        const overlay = document.getElementById('fullscreen-loading');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.style.display = 'flex';
        }
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.classList.add('active');
    }

    getLeagueConfig(league) {
        return this.leagueConfigs[league];
    }

    getLeagueFormat(league) {
        const config = typeof league === 'string' ? this.getLeagueConfig(league) : league;
        return config?.format || 'round';
    }

    getFormatSettings(league) {
        const config = typeof league === 'string' ? this.getLeagueConfig(league) : league;
        if (!config) return null;
        const format = config.format || 'round';
        return config[format] || null;
    }

    getPlayoffTeamsCount(league) {
        const format = this.getLeagueFormat(league);
        const settings = this.getFormatSettings(league);
        if (format === 'split-groups') {
            return (settings?.groups || []).reduce((sum, group) => sum + (Number(group.playoffTeams) || 0), 0);
        }
        return Number(settings?.playoffTeams) || 0;
    }

    pluralRu(n, one, few, many) {
        const abs = Math.abs(Number(n) || 0);
        const n10 = abs % 10;
        const n100 = abs % 100;
        if (n10 === 1 && n100 !== 11) return one;
        if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
        return many;
    }

    formatRoundCount(n) {
        const count = Number(n) || 0;
        return `${count} ${this.pluralRu(count, 'круг', 'круга', 'кругов')}`;
    }

    formatTeamCount(n) {
        const count = Number(n) || 0;
        return `${count} ${this.pluralRu(count, 'команда', 'команды', 'команд')}`;
    }

    getLeagueFormatDescription(leagueId) {
        const format = this.getLeagueFormat(leagueId);
        const settings = this.getFormatSettings(leagueId);
        const teams = this.getTeamsByLeague(leagueId).length;

        if (format === 'split-groups' && settings) {
            const groups = Array.isArray(settings.groups) ? settings.groups : [];
            const stage1 = this.formatRoundCount(settings.stage1Rounds || 1);
            const groupRounds = this.formatRoundCount(settings.groupRounds || 1);
            const groupBits = [];
            let offset = 0;
            const qualifyBits = [];

            groups.forEach(group => {
                const size = Number(group.size) || 0;
                const from = offset + 1;
                const to = offset + size;
                offset += size;
                const name = group.name || `Группа ${group.id}`;
                groupBits.push(`${name} (места ${from}–${to})`);
                const playoff = Number(group.playoffTeams) || 0;
                if (!playoff) return;
                if (playoff >= size) {
                    qualifyBits.push(`${name} — все команды`);
                } else {
                    qualifyBits.push(`${name} — ${playoff} ${this.pluralRu(playoff, 'лучшая', 'лучшие', 'лучших')}`);
                }
            });

            const head = teams
                ? `${this.formatTeamCount(teams)} играют чемпионат в несколько этапов.`
                : 'Чемпионат проходит в несколько этапов.';
            const splitText = groupBits.length
                ? ` Затем по итогам первого этапа команды делятся: ${groupBits.join('; ')} — и играют ещё ${groupRounds} внутри группы. В таблицу группы идут все игры с начала сезона.`
                : '';
            const playoffText = qualifyBits.length
                ? ` В плей-офф выходят: ${qualifyBits.join('; ')}.`
                : '';

            return `${head} Сначала ${stage1}.${splitText}${playoffText}`.replace(/\s+/g, ' ').trim();
        }

        const rounds = Number(settings?.numberOfRounds) || 1;
        const playoff = this.getPlayoffTeamsCount(leagueId);
        const head = teams
            ? `${this.formatTeamCount(teams)} играют ${this.formatRoundCount(rounds)}.`
            : `Регулярный сезон — ${this.formatRoundCount(rounds)}.`;
        const playoffText = playoff
            ? ` В плей-офф выходят ${this.formatTeamCount(playoff)}.`
            : '';
        return `${head}${playoffText}`;
    }

    getLeagues() {
        return Object.entries(this.leagueConfigs || {}).map(([id, config]) => {
            const slug = String(id).toLowerCase();
            return {
                id,
                name: config?.name || id,
                slug,
                sectionId: `league-${slug}`,
                cssClass: `league-${slug}`,
                format: this.getLeagueFormat(id),
                playoffTeams: this.getPlayoffTeamsCount(id)
            };
        });
    }

    getLeagueIds() {
        return this.getLeagues().map(league => league.id);
    }

    getLeagueById(id) {
        return this.getLeagues().find(league => league.id === id) || null;
    }

    getLeagueBySectionId(sectionId) {
        return this.getLeagues().find(league => league.sectionId === sectionId) || null;
    }

    getSeasonList() {
        return this.seasonsCatalog.seasons || [];
    }

    getSeasonLabel() {
        return this.seasonMeta?.label || this.seasonId || '';
    }

    hasNews() {
        return Array.isArray(this.newsIndex) && this.newsIndex.length > 0;
    }

    getSplitConfig(league) {
        if (this.getLeagueFormat(league) !== 'split-groups') return null;
        return this.getFormatSettings(league);
    }

    getRegularSeasonGameTotal(league) {
        const totalTeams = this.getTeamsByLeague(league).length;
        if (totalTeams < 2) return 0;

        const split = this.getSplitConfig(league);
        if (split) {
            const stage1Rounds = Number(split.stage1Rounds) || 1;
            const groupRounds = Number(split.groupRounds) || 1;
            const stage1 = (totalTeams * (totalTeams - 1) * stage1Rounds) / 2;
            const groups = Array.isArray(split.groups) ? split.groups : [];
            const groupGames = groups.reduce((sum, group) => {
                const size = Number(group.size) || 0;
                if (size < 2) return sum;
                return sum + (size * (size - 1) * groupRounds) / 2;
            }, 0);
            return stage1 + groupGames;
        }

        const rounds = Number(this.getFormatSettings(league)?.numberOfRounds) || 0;
        if (!rounds) return 0;
        return (totalTeams * (totalTeams - 1) * rounds) / 2;
    }

    getRegularSeasonTotals(league) {
        const total = this.getRegularSeasonGameTotal(league);
        const played = this.games.filter(game =>
            game.league === league &&
            game.scoreHome !== null &&
            game.scoreAway !== null &&
            game.gameType !== 'playoff'
        ).length;

        return { played, total };
    }

    getPairKey(teamA, teamB) {
        return [this.normalizeTeamName(teamA), this.normalizeTeamName(teamB)].sort().join('|');
    }

    getScoredRegularGames(league) {
        return this.games
            .filter(game =>
                game.league === league &&
                game.gameType !== 'playoff' &&
                game.scoreHome !== null &&
                game.scoreAway !== null
            )
            .slice()
            .sort((a, b) => (a._fullDate || 0) - (b._fullDate || 0));
    }

    getStage1Games(league) {
        const split = this.getSplitConfig(league);
        const stage1Rounds = Number(split?.stage1Rounds) || 1;
        const pairCount = new Map();
        const stage1 = [];

        this.getScoredRegularGames(league).forEach(game => {
            const key = this.getPairKey(game.teamHome, game.teamAway);
            const played = (pairCount.get(key) || 0) + 1;
            pairCount.set(key, played);
            if (played <= stage1Rounds) stage1.push(game);
        });

        return stage1;
    }

    getStage1ExpectedGames(league) {
        const totalTeams = this.getTeamsByLeague(league).length;
        const split = this.getSplitConfig(league);
        if (!split || totalTeams < 2) return 0;
        const rounds = Number(split.stage1Rounds) || 1;
        return (totalTeams * (totalTeams - 1) * rounds) / 2;
    }

    isSplitStage1Complete(league) {
        if (!this.getSplitConfig(league)) return false;
        return this.getStage1Games(league).length >= this.getStage1ExpectedGames(league);
    }

    getSplitGroupTables(league) {
        const split = this.getSplitConfig(league);
        if (!split || !this.isSplitStage1Complete(league)) return null;

        const stage1Standings = this.getLeagueStandings(league, { games: this.getStage1Games(league) });
        const groups = Array.isArray(split.groups) ? split.groups : [];
        let offset = 0;

        return groups.map(group => {
            const size = Number(group.size) || 0;
            const members = stage1Standings.slice(offset, offset + size);
            offset += size;
            const teamNames = members.map(row => row.teamName);
            return {
                id: group.id,
                name: group.name || `Группа ${group.id}`,
                playoffTeams: Number(group.playoffTeams) || 0,
                standings: this.getLeagueStandings(league, { teamNames })
            };
        }).filter(group => group.standings.length > 0);
    }

    isLeagueReadyForTopStats(league) {
        const { played, total } = this.getRegularSeasonTotals(league);
        return total > 0 && played >= total / 2;
    }

    getLeaguesReadyForTopStats() {
        return this.getLeagueIds().filter(league => this.isLeagueReadyForTopStats(league));
    }

    seasonFile(filename) {
        return `data/seasons/${this.seasonId}/${filename}`;
    }

    withVersion(url) {
        const version = this.seasonsCatalog.version || this.dataVersion;
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}v=${encodeURIComponent(version)}`;
    }

    readRequestedSeasonId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('season');
    }

    resolveSeasonId(requested) {
        const seasons = this.getSeasonList();
        if (requested && seasons.some(season => season.id === requested)) {
            return requested;
        }
        const unfinished = seasons.find(season => !season.archived);
        if (unfinished) {
            return unfinished.id;
        }
        if (this.seasonsCatalog.current && seasons.some(season => season.id === this.seasonsCatalog.current)) {
            return this.seasonsCatalog.current;
        }
        return seasons[0]?.id || '2025-26';
    }

    persistSeasonId(seasonId) {
        try {
            window.localStorage.setItem('ulbasket-season', seasonId);
        } catch (error) {
            /* ignore quota / private mode */
        }
        const url = new URL(window.location.href);
        url.searchParams.set('season', seasonId);
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    async loadSeasonsCatalog() {
        this.updateProgress(5, 'Загрузка списка сезонов...');
        this.seasonsCatalog = await this.loadJSON('data/seasons.json');
        this.dataVersion = this.seasonsCatalog.version || this.dataVersion;
    }

    async loadSeason(seasonId) {
        const previousId = this.seasonId;
        const previousMeta = this.seasonMeta;
        const previousTeams = this.teams;
        const previousGames = this.games;
        const previousConfigs = this.leagueConfigs;
        const previousNews = this.newsIndex;

        this.seasonId = seasonId;
        this.seasonMeta = this.getSeasonList().find(season => season.id === seasonId) || { id: seasonId };

        try {
            this.teams = [];
            this.games = [];
            this.leagueConfigs = {};
            this.newsIndex = [];

            this.updateProgress(15, 'Загрузка конфигурации лиг...');
            this.leagueConfigs = await this.loadJSON(this.seasonFile('leagues-config.json'));

            this.updateProgress(35, 'Загрузка команд...');
            const teams = await this.loadJSON(this.seasonFile('teams.json'));
            this.teams = (Array.isArray(teams) ? teams : []).map(team => ({
                ...team,
                logo: BasketballUtils.resolveTeamLogo(team.logo)
            }));

            this.updateProgress(55, 'Загрузка матчей...');
            const packedGames = await this.loadJSON(this.seasonFile('games.json'));
            this.ingestPackedGames(packedGames);

            try {
                this.newsIndex = await this.loadJSON(this.seasonFile('news-index.json'));
            } catch (error) {
                this.newsIndex = [];
            }

            this.persistSeasonId(seasonId);
            this.updateProgress(100, 'Готово!');
        } catch (error) {
            this.seasonId = previousId;
            this.seasonMeta = previousMeta;
            this.teams = previousTeams;
            this.games = previousGames;
            this.leagueConfigs = previousConfigs;
            this.newsIndex = previousNews;
            throw error;
        }
    }

    async switchSeason(seasonId) {
        if (!seasonId || seasonId === this.seasonId) {
            return false;
        }
        this.showLoading();
        try {
            await this.loadSeason(seasonId);
            return true;
        } catch (error) {
            console.error('Ошибка смены сезона:', error);
            return false;
        } finally {
            this.hideLoading();
        }
    }

    ingestPackedGames(packedGames) {
        this.games = [];
        (packedGames || []).forEach((game, index) => {
            const gameId = game.id || `game_${String(index + 1).padStart(3, '0')}`;
            this.normalizeGameData(game, gameId);
            this.games.push(game);
        });
    }

    updateProgress(percent, text) {
        const fill = document.getElementById('progress-fill');
        const textElem = document.getElementById('progress-text');
        
        if (fill) {
            // Плавная анимация
            fill.style.transition = 'width 0.3s ease';
            fill.style.width = percent + '%';
        }
        
        if (textElem) {
            textElem.textContent = text;
        }
        
        // Также обновляем текст в индикаторе хедера
        const headerIndicator = document.getElementById('loading-indicator');
        if (headerIndicator) {
            const span = headerIndicator.querySelector('span');
            if (span) span.textContent = text;
        }
    }

    hideLoading() {
        const overlay = document.getElementById('fullscreen-loading');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
        }
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.classList.remove('active');
    }

    async loadJSON(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // Таймаут 5 секунд
            
            const response = await fetch(this.withVersion(url), { 
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${url}`);
            }
            
            const text = await response.text();
            const cleanedText = text.trim().replace(/^\uFEFF/, '');
            return JSON.parse(cleanedText);
        } catch (error) {
            console.error(`Ошибка загрузки ${url}:`, error);
            throw error;
        }
    }

    async loadAllNews() {
        try {
            // Список всех .md файлов в папке news
            const newsFiles = Array.isArray(this.newsIndex) ? this.newsIndex : [];
            
            let allNews = [];
            
            for (const file of newsFiles) {
                const news = await this.loadNewsFile(file);
                if (news) {
                    allNews.push(news);
                }
            }
            
            // Сортируем по дате (новые сверху)
            allNews.sort((a, b) => {
                const dateA = this.parseDate(a.date);
                const dateB = this.parseDate(b.date);
                return dateB - dateA;
            });
            
            return allNews;
            
        } catch (error) {
            console.error('Error loading all news:', error);
            return [];
        }
    }

    // Загрузка одного файла новости
    async loadNewsFile(filename) {
        try {
            const response = await fetch(this.withVersion(this.seasonFile(`news/${filename}`)));
            if (!response.ok) return null;
            
            const content = await response.text();
            return this.parseNewsFile(content, filename);
            
        } catch (error) {
            console.log(`News file ${filename} not found`);
            return null;
        }
    }

    // Парсинг одного файла новости
    parseNewsFile(content, filename) {
        const lines = content.split('\n');
        
        let title = '';
        let date = '';
        let image = null;
        let content_start = 0;
        
        // Ищем заголовок (первая строка с #)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('# ')) {
                title = lines[i].substring(2).trim();
                content_start = i + 1;
                break;
            }
        }
        
        // Ищем дату (строка с "Дата:")
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('Дата:')) {
                date = lines[i].substring(5).trim();
                break;
            }
        }
        
        // Ищем изображение (строка с "Изображение:")
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('Изображение:')) {
                image = lines[i].substring(11).trim();
                break;
            }
        }
        
        // Если не нашли дату или заголовок, пропускаем
        if (!title || !date) {
            console.warn(`Invalid news file: ${filename}`, { title, date });
            return null;
        }
        
        // Весь остальной контент - тело новости
        let body = '';
        for (let i = content_start; i < lines.length; i++) {
            // Пропускаем строки с мета-данными
            if (lines[i].startsWith('Дата:') || lines[i].startsWith('Изображение:')) {
                continue;
            }
            body += lines[i] + '\n';
        }
        
        return {
            id: filename.replace('.md', ''),
            title: title,
            date: date,
            image: image,
            league: this.extractLeagueFromNews(filename),
            content: body.trim(),
            filename: filename,
            timestamp: this.parseDate(date)
        };
    }

    // Парсинг даты из формата ДД.ММ.ГГГГ
    parseDate(dateString) {
        const [day, month, year] = dateString.split('.');
        return new Date(`${year}-${month}-${day}`).getTime();
    }

    // Загрузка новостей по фильтру
    async loadNewsByFilter(filter = 'all') {
        const allNews = await this.loadAllNews();
        
        if (filter === 'all') {
            return allNews;
        }
        
        return allNews.filter(news => {
            return news.league === filter;
        });
    }

    // Определяем лигу новости по имени файла или контенту
    extractLeagueFromNews(newsFileName) {
        const filename = newsFileName.toLowerCase();
        
        if (filename.includes('league-a') || filename.includes('лига-а')) return 'A';
        if (filename.includes('league-b') || filename.includes('лига-б')) return 'B';
        if (filename.includes('league-f') || filename.includes('женская')) return 'F';
        if (filename.includes('general') || filename.includes('общее')) return 'general';
        
        // По умолчанию - общая новость
        return 'general';
    }

    normalizeGameData(game, gameId) {
        if (!game.match_info) {
            return;
        }

        const info = game.match_info;
        const score = typeof info.score === 'string' ? info.score.split(':') : [];
        const scoreHome = score.length === 2 ? parseInt(score[0], 10) : NaN;
        const scoreAway = score.length === 2 ? parseInt(score[1], 10) : NaN;

        game.id = gameId;
        game.teamHome = info.team_a;
        game.teamAway = info.team_b;
        game.scoreHome = Number.isFinite(scoreHome) ? scoreHome : null;
        game.scoreAway = Number.isFinite(scoreAway) ? scoreAway : null;
        game.date = info.date;
        game.time = info.time;
        game.location = info.venue;
        game.gameType = info.gameType || 'regular';
        game.league = info.league || 'A';
        game._fullDate = this.createValidDate(game.date, game.time);
    }

    hasGameScore(game) {
        return Number.isFinite(game?.scoreHome) && Number.isFinite(game?.scoreAway);
    }

    normalizeTeamName(teamName) {
        return String(teamName || '').trim().toUpperCase();
    }

    getLeagueName(league) {
        return this.getLeagueConfig(league)?.name || league;
    }

    getTeamByName(teamName, league) {
        const normalizedName = this.normalizeTeamName(teamName);
        return this.teams.find(team => 
            this.normalizeTeamName(team.name) === normalizedName && team.league === league
        );
    }

    getLeaguesForTeam(teamName) {
        const normalizedName = this.normalizeTeamName(teamName);
        return this.getLeagueIds().filter(leagueId =>
            this.teams.some(team =>
                this.normalizeTeamName(team.name) === normalizedName && team.league === leagueId
            )
        );
    }

    getTeamsByLeague(league) {
        if (league === 'all') {
            return this.teams;
        }
        return this.teams.filter(team => team.league === league);
    }

    getAllGamesForDisplay() {
        const resultGames = this.games.map(game => {
            const gameDate = this.createValidDate(game.date, game.time);
            const hasResult = this.hasGameScore(game);

            return {
                id: game.id,
                _fullDate: gameDate,
                _hasResult: hasResult,
                _isFromResults: hasResult,
                teamHome: game.teamHome,
                teamAway: game.teamAway,
                scoreHome: game.scoreHome,
                scoreAway: game.scoreAway,
                gameType: game.gameType,
                date: game.date,
                league: game.league,
                time: game.time || this.extractTimeFromDate(gameDate),
                location: game.location || game.venue || 'Не указано',
                _gameData: game
            };
        });

        const uniqueGames = this.removeDuplicateGames(resultGames);
        uniqueGames.sort((a, b) => b._fullDate - a._fullDate);
        return uniqueGames;
    }

    removeDuplicateGames(games) {
        const seen = new Set();
        return games.filter(game => {
            if (!game.teamHome || !game.teamAway || !game._fullDate || isNaN(game._fullDate.getTime())) {
                return false;
            }
            const key = `${game.league}_${this.normalizeTeamName(game.teamHome)}_${this.normalizeTeamName(game.teamAway)}_${game._fullDate.toISOString().split('T')[0]}`;
            
            if (seen.has(key)) {
                console.log(`Removing duplicate: ${game.teamHome} vs ${game.teamAway}`);
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    getGamesByLeague(league) {
        const allGames = this.getAllGamesForDisplay();
        
        if (league === 'all') {
            return allGames;
        }
        
        const leagueTeams = this.getTeamsByLeague(league).map(team => team.name);
        
        const filteredGames = allGames.filter(game => {
            if (game.league !== league) {
                return false;
            }

            const homeInLeague = leagueTeams.some(team => 
                this.normalizeTeamName(team) === this.normalizeTeamName(game.teamHome)
            );
            const awayInLeague = leagueTeams.some(team => 
                this.normalizeTeamName(team) === this.normalizeTeamName(game.teamAway)
            );
            
            const isInLeague = homeInLeague || awayInLeague;
            if (isInLeague) {
                console.log(`✅ Game in league ${league}: ${game.teamHome} vs ${game.teamAway}`);
            }
            return isInLeague;
        });
        
        return filteredGames;
    }

    getGamesByTeam(teamName, league) {
        const allGames = this.getAllGamesForDisplay();
        const normalizedTeamName = this.normalizeTeamName(teamName);
        return allGames.filter(game =>
            game.league === league && (
            this.normalizeTeamName(game.teamHome) === normalizedTeamName ||
            this.normalizeTeamName(game.teamAway) === normalizedTeamName)
        );
    }

    getLeagueStandings(league, options = {}) {
        const teamNameFilter = Array.isArray(options.teamNames) ? options.teamNames : null;
        const allowedNames = teamNameFilter
            ? new Set(teamNameFilter.map(name => this.normalizeTeamName(name)))
            : null;

        const teamsInLeague = this.getTeamsByLeague(league).filter(team =>
            !allowedNames || allowedNames.has(this.normalizeTeamName(team.name))
        );
        const standings = new Map();

        teamsInLeague.forEach(team => {
            standings.set(this.normalizeTeamName(team.name), {
                teamName: team.name,
                team: team,
                played: 0,
                wins: 0,
                losses: 0,
                pointsFor: 0,
                pointsAgainst: 0,
                points: 0,
                trand: ""
            });
        });

        const sourceGames = Array.isArray(options.games) ? options.games : this.games;
        const leagueGames = sourceGames
            .filter(game =>
                game.scoreHome !== null &&
                game.scoreAway !== null &&
                game.league === league &&
                game.gameType != 'playoff'
            )
            .slice()
            .sort((a, b) => (a._fullDate || 0) - (b._fullDate || 0));

        const applySide = (team, scored, conceded, won) => {
            if (!team) return;
            team.played++;
            team.pointsFor += scored;
            team.pointsAgainst += conceded;
            if (won) {
                team.wins++;
                team.points += 2;
                team.trand += "1";
                return;
            }
            if (scored < conceded) {
                if (!(conceded === 20 && scored === 0)) {
                    team.points += 1;
                }
                team.losses++;
                team.trand += "0";
            }
        };

        leagueGames.forEach(game => {
            const home = standings.get(this.normalizeTeamName(game.teamHome));
            const away = standings.get(this.normalizeTeamName(game.teamAway));
            if (!home && !away) return;

            if (game.scoreHome > game.scoreAway) {
                applySide(home, game.scoreHome, game.scoreAway, true);
                applySide(away, game.scoreAway, game.scoreHome, false);
            } else if (game.scoreHome < game.scoreAway) {
                applySide(away, game.scoreAway, game.scoreHome, true);
                applySide(home, game.scoreHome, game.scoreAway, false);
            }
        });

        let standingsArray = Array.from(standings.values());
        standingsArray.sort((a, b) => b.points - a.points);

        const result = [];
        let i = 0;

        while (i < standingsArray.length) {
            const currentPoints = standingsArray[i].points;
            const group = [];

            while (i < standingsArray.length && standingsArray[i].points === currentPoints) {
                group.push(standingsArray[i]);
                i++;
            }

            if (group.length > 1) {
                this.sortGroupByHeadToHeadDiff(group, leagueGames);
            }

            result.push(...group);
        }

        return result;
    }

    // Новый метод для сортировки группы по разнице в личных встречах
    sortGroupByHeadToHeadDiff(group, allGames) {
        // Создаем Map для хранения статистики личных встреч внутри группы
        const h2hStats = new Map();
        
        // Инициализируем статистику для каждой команды в группе
        group.forEach(team => {
            const normName = this.normalizeTeamName(team.teamName);
            h2hStats.set(normName, {
                teamName: team.teamName,
                pointsFor: 0,      // забито в матчах с командами из группы
                pointsAgainst: 0,   // пропущено в матчах с командами из группы
                diff: 0,            // разница (+/-)
                gamesPlayed: 0
            });
        });
        
        // Получаем список нормализованных имен команд группы
        const groupNormNames = Array.from(h2hStats.keys());
        
        // Собираем ВСЕ игры между командами из группы
        allGames.forEach(game => {
            const homeNorm = this.normalizeTeamName(game.teamHome);
            const awayNorm = this.normalizeTeamName(game.teamAway);
            
            // Проверяем, что обе команды входят в нашу группу
            if (groupNormNames.includes(homeNorm) && groupNormNames.includes(awayNorm)) {
                const homeStats = h2hStats.get(homeNorm);
                const awayStats = h2hStats.get(awayNorm);
                
                if (homeStats && awayStats) {
                    homeStats.pointsFor += game.scoreHome;
                    homeStats.pointsAgainst += game.scoreAway;
                    homeStats.diff += (game.scoreHome - game.scoreAway);
                    homeStats.gamesPlayed++;
                    
                    awayStats.pointsFor += game.scoreAway;
                    awayStats.pointsAgainst += game.scoreHome;
                    awayStats.diff += (game.scoreAway - game.scoreHome);
                    awayStats.gamesPlayed++;
                }
            }
        });
        
        // Сортируем группу по разнице очков в личных встречах
        group.sort((a, b) => {
            const aNorm = this.normalizeTeamName(a.teamName);
            const bNorm = this.normalizeTeamName(b.teamName);
            
            const aH2H = h2hStats.get(aNorm);
            const bH2H = h2hStats.get(bNorm);
            
            // Если команды не играли между собой или нет статистики,
            // используем общую разницу
            if (!aH2H || !bH2H || aH2H.gamesPlayed === 0 || bH2H.gamesPlayed === 0) {
                const aTotalDiff = a.pointsFor - a.pointsAgainst;
                const bTotalDiff = b.pointsFor - b.pointsAgainst;
                if (bTotalDiff !== aTotalDiff) {
                    return bTotalDiff - aTotalDiff;
                }
                // Если и общая разница одинаковая - по забитым
                if (b.pointsFor !== a.pointsFor) {
                    return b.pointsFor - a.pointsFor;
                }
                return a.teamName.localeCompare(b.teamName);
            }
            
            // Сравниваем по разнице в личных встречах (чем больше, тем выше)
            if (bH2H.diff !== aH2H.diff) {
                return bH2H.diff - aH2H.diff;
            }
            
            // Если разница одинаковая - по забитым в личных встречах
            if (bH2H.pointsFor !== aH2H.pointsFor) {
                return bH2H.pointsFor - aH2H.pointsFor;
            }
            
            // Если и это одинаково - по общей разнице
            const aTotalDiff = a.pointsFor - a.pointsAgainst;
            const bTotalDiff = b.pointsFor - b.pointsAgainst;
            if (bTotalDiff !== aTotalDiff) {
                return bTotalDiff - aTotalDiff;
            }
            
            // Если и общая разница одинаковая - по забитым
            if (b.pointsFor !== a.pointsFor) {
                return b.pointsFor - a.pointsFor;
            }
            
            // Последний критерий - алфавит
            return a.teamName.localeCompare(b.teamName);
        });
    }

    getTotalGamesPlayedByLeague(league) {
        const gamesInLeague = this.games.filter(game => 
            game.league === league && 
            game.scoreHome !== null && 
            game.scoreAway !== null
        );
        return gamesInLeague.length;
    }

    extractTimeFromDate(date) {
        if (!date || isNaN(date.getTime())) {
            return '12:00';
        }
        
        return date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    findGameResult(teamHome, teamAway, gameDateTime) {
        if (!gameDateTime || isNaN(gameDateTime.getTime())) {
            return null;
        }
        
        const normalizedHome = this.normalizeTeamName(teamHome);
        const normalizedAway = this.normalizeTeamName(teamAway);
        
        const foundGame = this.games.find(game => {
            if (!game.teamHome || !game.teamAway) return false;
            
            const gameHome = this.normalizeTeamName(game.teamHome);
            const gameAway = this.normalizeTeamName(game.teamAway);
            
            const teamsMatch = (gameHome === normalizedHome && gameAway === normalizedAway) ||
                              (gameHome === normalizedAway && gameAway === normalizedHome);
            
            if (!teamsMatch) return false;
            
            // Создаем дату для игры из результатов
            const resultGameDate = this.createValidDate(game.date, game.time);
            if (!resultGameDate) return false;
            
            // Проверяем что даты близки (в пределах 3 дней)
            const timeDiff = Math.abs(gameDateTime - resultGameDate);
            const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
            
            return timeDiff <= threeDaysMs;
        });
        
        if (foundGame) {
            return {
                scoreHome: foundGame.scoreHome,
                scoreAway: foundGame.scoreAway,
                gameData: foundGame
            };
        }
        
        return null;
    }

    getFilteredScheduledGames(games) {
        const now = new Date();
        const ninetyMinutesMs = 90 * 60 * 1000;
        
        return games.filter(game => {
            // Игры с результатами показываем всегда
            if (game._hasResult || game._isFromResults) {
                return true;
            }
            
            // Для игр без результатов проверяем время
            const gameTime = game._fullDate;
            const timeDiff = now - gameTime;
            
            return timeDiff <= ninetyMinutesMs;
        });
    }

    getGameById(gameId) {
        if (gameId.startsWith('game_')) {
            const allGames = this.getAllGamesForDisplay();
            const foundGame = allGames.find(game => game.id === gameId);
            
            if (foundGame && foundGame._gameData) {
                return {
                    ...foundGame,
                    ...foundGame._gameData,
                    id: gameId
                };
            }
            return foundGame;
        }
        
        const id = this.normalizeGameId(gameId);
        return this.games.find(g => this.normalizeGameId(g.id) === id) || null;
    }

    createValidDate(dateString, timeString = '12:00') {
        try {
            let dateStr = `${dateString}`
            if (dateStr.includes('.')) {
                const [day, month, year] = `${dateString}`.split('.');
                dateStr = `${year}-${month}-${day}`
            }

            let dateTimeString = `${dateStr}T${timeString}:00`;
            const date = new Date(dateTimeString);
            
            return date;
        } catch (error) {
            console.error('Error creating date:', error);
            return null;
        }
    }

    // Новые методы для работы с изображениями результатов
    getGameResultImage(gameId) {
        return this.seasonFile(`result/${gameId}.jpg`);
    }

    // Метод проверки существования изображения
    async checkImageExists(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            // Добавляем timestamp для избежания кеширования
            img.src = url + '?t=' + Date.now();
        });
    }

    getPlayoffBracket(league) {
        const playoffGames = this.games.filter(game =>
            game.gameType === 'playoff' &&
            game.league === league
        );

        if (playoffGames.length === 0) {
            return this.generateEmptyBracket(league);
        }

        return this.buildBracketFromGames(playoffGames, league);
    }

    generateEmptyBracket(league) {
        const standings = this.getLeagueStandings(league);
        const playoffTeamsCount = this.getPlayoffTeamsCount(league) || 6;
        
        // Берем топ команд
        const topTeams = standings.slice(0, playoffTeamsCount);
        
        if (playoffTeamsCount === 8) {
            return {
                quarterfinals: [
                    {
                        id: 'qf_1',
                        team1: topTeams[0]?.teamName,
                        team1Seed: 1,
                        team2: topTeams[7]?.teamName,
                        team2Seed: 8,
                        winner: null,
                        games: []
                    },
                    {
                        id: 'qf_2',
                        team1: topTeams[3]?.teamName,
                        team1Seed: 4,
                        team2: topTeams[4]?.teamName,
                        team2Seed: 5,
                        winner: null,
                        games: []
                    },
                    {
                        id: 'qf_3',
                        team1: topTeams[1]?.teamName,
                        team1Seed: 2,
                        team2: topTeams[6]?.teamName,
                        team2Seed: 7,
                        winner: null,
                        games: []
                    },
                    {
                        id: 'qf_4',
                        team1: topTeams[2]?.teamName,
                        team1Seed: 3,
                        team2: topTeams[5]?.teamName,
                        team2Seed: 6,
                        winner: null,
                        games: []
                    }
                ],
                semifinals: [
                    {
                        id: 'sf_1',
                        team1: null,
                        team1Seed: null,
                        team2: null,
                        team2Seed: null,
                        winner: null,
                        games: []
                    },
                    {
                        id: 'sf_2',
                        team1: null,
                        team1Seed: null,
                        team2: null,
                        team2Seed: null,
                        winner: null,
                        games: []
                    }
                ],
                thirdPlace: [
                    {
                        id: 'tp',
                        team1: null,
                        team1Seed: null,
                        team2: null,
                        team2Seed: null,
                        winner: null,
                        games: []
                    }
                ],
                final: [
                    {
                        id: 'final',
                        team1: null,
                        team1Seed: null,
                        team2: null,
                        team2Seed: null,
                        winner: null,
                        games: []
                    }
                ],
                champion: null
            };
        }

        if (playoffTeamsCount === 6) {
            // ПРАВИЛЬНАЯ СЕТКА ДЛЯ 6 КОМАНД:
            // 3-6 и 4-5 играют в 1/4
            // 1 играет с победителем 4-5
            // 2 играет с победителем 3-6
            
            return {
                quarterfinals: [
                    {
                        id: 'qf_1',
                        team1: topTeams[2]?.teamName, // 3-е место
                        team1Seed: 3,
                        team2: topTeams[5]?.teamName, // 6-е место
                        team2Seed: 6,
                        winner: null,
                        games: []
                    },
                    {
                        id: 'qf_2',
                        team1: topTeams[3]?.teamName, // 4-е место
                        team1Seed: 4,
                        team2: topTeams[4]?.teamName, // 5-е место
                        team2Seed: 5,
                        winner: null,
                        games: []
                    }
                ],
                semifinals: [
                    {
                        id: 'sf_1',
                        team1: topTeams[0]?.teamName, // 1-е место
                        team1Seed: 1,
                        team2: null, // Победитель qf_2 (4-5)
                        team2Seed: null,
                        winner: null,
                        games: []
                    },
                    {
                        id: 'sf_2',
                        team1: topTeams[1]?.teamName, // 2-е место
                        team1Seed: 2,
                        team2: null, // Победитель qf_1 (3-6)
                        team2Seed: null,
                        winner: null,
                        games: []
                    }
                ],
                thirdPlace: [
                    {
                        id: 'tp',
                        team1: null, // Проигравший sf_1
                        team1Seed: null,
                        team2: null, // Проигравший sf_2
                        team2Seed: null,
                        winner: null,
                        games: []
                    }
                ],
                final: [
                    {
                        id: 'final',
                        team1: null, // Победитель sf_1
                        team1Seed: null,
                        team2: null, // Победитель sf_2
                        team2Seed: null,
                        winner: null,
                        games: []
                    }
                ],
                champion: null
            };
        } else if (playoffTeamsCount === 4) {
            // Сетка для 4 команд: 1-4 и 2-3 в 1/2
            return {
                quarterfinals: [],
                semifinals: [
                    {
                        id: 'sf_1',
                        team1: topTeams[0]?.teamName, // 1-е место
                        team1Seed: 1,
                        team2: topTeams[3]?.teamName, // 4-е место
                        team2Seed: 4,
                        winner: null,
                        games: []
                    },
                    {
                        id: 'sf_2',
                        team1: topTeams[1]?.teamName, // 2-е место
                        team1Seed: 2,
                        team2: topTeams[2]?.teamName, // 3-е место
                        team2Seed: 3,
                        winner: null,
                        games: []
                    }
                ],
                thirdPlace: [
                    {
                        id: 'tp',
                        team1: null,
                        team1Seed: null,
                        team2: null,
                        winner: null,
                        games: []
                    }
                ],
                final: [
                    {
                        id: 'final',
                        team1: null,
                        team1Seed: null,
                        team2: null,
                        winner: null,
                        games: []
                    }
                ],
                champion: null
            };
        }
        
        return {
            quarterfinals: [],
            semifinals: [],
            thirdPlace: [],
            final: [],
            champion: null
        };
    }

    buildBracketFromGames(allPlayoffGames, league) {
        // Начинаем с пустой сетки
        let bracket = this.generateEmptyBracket(league);
        
        allPlayoffGames.sort((a, b) => {
            const dateA = a._fullDate || this.createValidDate(a.date, a.time);
            const dateB = b._fullDate || this.createValidDate(b.date, b.time);
            return dateA - dateB;
        });
        
        const gamesMap = new Map();
        allPlayoffGames.forEach(game => {
            if (game.teamHome && game.teamAway) {
                const key1 = `${this.normalizeTeamName(game.teamHome)}_${this.normalizeTeamName(game.teamAway)}`;
                const key2 = `${this.normalizeTeamName(game.teamAway)}_${this.normalizeTeamName(game.teamHome)}`;
                gamesMap.set(key1, game);
                gamesMap.set(key2, game);
            }
        });
        
        if (bracket.quarterfinals && bracket.quarterfinals.length > 0) {
            bracket.quarterfinals.forEach(qf => {
                if (!qf.team1 || !qf.team2) return;
                
                const gameKey = `${this.normalizeTeamName(qf.team1)}_${this.normalizeTeamName(qf.team2)}`;
                const game = gamesMap.get(gameKey);
                
                if (game) {
                    if (game.scoreHome !== null && game.scoreAway !== null) {
                        // Игра с результатом
                        const winner = game.scoreHome > game.scoreAway ? game.teamHome : game.teamAway;
                        qf.winner = winner;
                        qf.games.push(this.createGameData(game));
                        
                        // Продвигаем победителя в полуфинал
                        const winnerSeed = this.getTeamSeed(winner, league);
                        this.placeQuarterfinalWinner(bracket, qf, winner, winnerSeed);
                    } else {
                        // Запланированная игра
                        qf.games.push({
                            id: game.id,
                            teamHome: game.teamHome,
                            teamAway: game.teamAway,
                            scoreHome: null,
                            scoreAway: null,
                            gameType: 'playoff',
                            date: game.date,
                            time: game.time,
                            location: game.location,
                            _fullDate: game._fullDate,
                            winner: null
                        });
                    }
                }
            });
        }
        
        bracket.semifinals.forEach(sf => {
            // Если команда 2 еще не определена (из четвертьфинала), пропускаем
            if (!sf.team1 || !sf.team2) return;
            
            const gameKey = `${this.normalizeTeamName(sf.team1)}_${this.normalizeTeamName(sf.team2)}`;
            const game = gamesMap.get(gameKey);
            
            if (game) {
                if (game.scoreHome !== null && game.scoreAway !== null) {
                    // Игра с результатом
                    const winner = game.scoreHome > game.scoreAway ? game.teamHome : game.teamAway;
                    const loser = winner === sf.team1 ? sf.team2 : sf.team1;
                    
                    sf.winner = winner;
                    sf.games.push(this.createGameData(game));
                    
                    // Получаем seed команд
                    const winnerSeed = this.getTeamSeed(winner, league);
                    const loserSeed = this.getTeamSeed(loser, league);
                    
                    // Определяем индекс полуфинала по составу команд
                    const sfIndex = bracket.semifinals.findIndex(s => 
                        this.normalizeTeamName(s.team1) === this.normalizeTeamName(sf.team1) &&
                        this.normalizeTeamName(s.team2) === this.normalizeTeamName(sf.team2)
                    );
                    
                    if (sfIndex !== -1) {
                        // Продвигаем победителя в финал
                        this.placeSemifinalWinner(bracket, sfIndex, winner, winnerSeed);
                        
                        // Продвигаем проигравшего в матч за 3-е место
                        this.placeSemifinalLoser(bracket, sfIndex, loser, loserSeed);
                    }
                } else {
                    // Запланированная игра
                    sf.games.push({
                        id: game.id,
                        teamHome: game.teamHome,
                        teamAway: game.teamAway,
                        scoreHome: null,
                        scoreAway: null,
                        gameType: 'playoff',
                        date: game.date,
                        time: game.time,
                        location: game.location,
                        _fullDate: game._fullDate,
                        winner: null
                    });
                }
            }
        });
        
        const thirdPlace = bracket.thirdPlace[0];
        if (thirdPlace && thirdPlace.team1 && thirdPlace.team2) {
            const gameKey = `${this.normalizeTeamName(thirdPlace.team1)}_${this.normalizeTeamName(thirdPlace.team2)}`;
            const game = gamesMap.get(gameKey);
            
            if (game) {
                if (game.scoreHome !== null && game.scoreAway !== null) {
                    const winner = game.scoreHome > game.scoreAway ? game.teamHome : game.teamAway;
                    thirdPlace.winner = winner;
                    thirdPlace.games.push(this.createGameData(game));
                } else {
                    // Запланированная игра
                    thirdPlace.games.push({
                        id: game.id,
                        teamHome: game.teamHome,
                        teamAway: game.teamAway,
                        scoreHome: null,
                        scoreAway: null,
                        gameType: 'playoff',
                        date: game.date,
                        time: game.time,
                        location: game.location,
                        _fullDate: game._fullDate,
                        winner: null
                    });
                }
            }
        }
        
        const final = bracket.final[0];
        if (final && final.team1 && final.team2) {
            const gameKey = `${this.normalizeTeamName(final.team1)}_${this.normalizeTeamName(final.team2)}`;
            const game = gamesMap.get(gameKey);
            
            if (game) {
                if (game.scoreHome !== null && game.scoreAway !== null) {
                    const winner = game.scoreHome > game.scoreAway ? game.teamHome : game.teamAway;
                    final.winner = winner;
                    final.games.push(this.createGameData(game));
                    bracket.champion = winner;
                } else {
                    // Запланированная игра
                    final.games.push({
                        id: game.id,
                        teamHome: game.teamHome,
                        teamAway: game.teamAway,
                        scoreHome: null,
                        scoreAway: null,
                        gameType: 'playoff',
                        date: game.date,
                        time: game.time,
                        location: game.location,
                        _fullDate: game._fullDate,
                        winner: null
                    });
                }
            }
        }
        
        return bracket;
    }

    placeQuarterfinalWinner(bracket, quarterfinal, winner, winnerSeed) {
        const qfIndex = bracket.quarterfinals.indexOf(quarterfinal);
        
        if (qfIndex === 0) {
            // Победитель qf_1 (3-6) идет к 2-му месту (sf_2)
            if (bracket.semifinals[1]) {
                bracket.semifinals[1].team2 = winner;
                bracket.semifinals[1].team2Seed = winnerSeed;
            }
        } else if (qfIndex === 1) {
            // Победитель qf_2 (4-5) идет к 1-му месту (sf_1)
            if (bracket.semifinals[0]) {
                bracket.semifinals[0].team2 = winner;
                bracket.semifinals[0].team2Seed = winnerSeed;
            }
        }
    }

    placeSemifinalWinner(bracket, semifinalIndex, winner, winnerSeed) {
        const final = bracket.final[0];
        if (!final) return;
        
        if (final.team1) {
            if (final.team1Seed > winnerSeed) {
                final.team2 = final.team1;
                final.team2Seed = final.team1Seed;
                final.team1 = winner;
                final.team1Seed = winnerSeed;    
            } else {
                final.team2 = winner;
                final.team2Seed = winnerSeed;
            }
        } else {
            final.team1 = winner;
            final.team1Seed = winnerSeed;
        }
    }

    placeSemifinalLoser(bracket, semifinalIndex, loser, loserSeed) {
        const thirdPlace = bracket.thirdPlace[0];
        if (!thirdPlace) return;
        
        if (thirdPlace.team1) {
            if (thirdPlace.team1Seed > loserSeed) {
                thirdPlace.team2 = thirdPlace.team1;
                thirdPlace.team2Seed = thirdPlace.team1Seed;
                thirdPlace.team1 = loser;
                thirdPlace.team1Seed = loserSeed;    
            } else {
                thirdPlace.team2 = loser;
                thirdPlace.team2Seed = loserSeed;
            }
        } else {
            thirdPlace.team1 = loser;
            thirdPlace.team1Seed = loserSeed;
        }
    }

    // Новый метод для определения раунда на основе seed команд
    determinePlayoffRound(homeSeed, awaySeed, bracket) {
        // 1. Проверяем, есть ли такая пара в четвертьфиналах
        for (const qf of bracket.quarterfinals) {
            if ((qf.team1Seed === homeSeed && qf.team2Seed === awaySeed) ||
                (qf.team1Seed === awaySeed && qf.team2Seed === homeSeed)) {
                return 'quarterfinal';
            }
        }
        
        // 2. Проверяем полуфиналы
        for (const sf of bracket.semifinals) {
            if ((sf.team1Seed === homeSeed && sf.team2Seed === awaySeed) ||
                (sf.team1Seed === awaySeed && sf.team2Seed === homeSeed)) {
                return 'semifinal';
            }
        }
        
        // 3. Если это финал или матч за 3-е место, определим позже
        return 'unknown';
    }

    // Методы для поиска матчей по командам
    findQuarterfinalByTeams(bracket, team1, team2) {
        return bracket.quarterfinals.find(qf => 
            (this.normalizeTeamName(qf.team1) === this.normalizeTeamName(team1) && 
             this.normalizeTeamName(qf.team2) === this.normalizeTeamName(team2)) ||
            (this.normalizeTeamName(qf.team1) === this.normalizeTeamName(team2) && 
             this.normalizeTeamName(qf.team2) === this.normalizeTeamName(team1))
        );
    }

    findSemifinalByTeams(bracket, team1, team2) {
        return bracket.semifinals.find(sf => 
            (this.normalizeTeamName(sf.team1) === this.normalizeTeamName(team1) && 
             this.normalizeTeamName(sf.team2) === this.normalizeTeamName(team2)) ||
            (this.normalizeTeamName(sf.team1) === this.normalizeTeamName(team2) && 
             this.normalizeTeamName(sf.team2) === this.normalizeTeamName(team1))
        );
    }

    createGameData(game) {
        return {
            id: game.id,
            teamHome: game.teamHome,
            teamAway: game.teamAway,
            scoreHome: game.scoreHome,
            scoreAway: game.scoreAway,
            gameType: game.gameType,
            date: game.date,
            time: game.time,
            location: game.location,
            winner: game.scoreHome > game.scoreAway ? game.teamHome : game.teamAway
        };
    }

    getTeamSeed(teamName, league) {
        const standings = this.getLeagueStandings(league);
        const teamIndex = standings.findIndex(team => 
            this.normalizeTeamName(team.teamName) === this.normalizeTeamName(teamName)
        );
        return teamIndex >= 0 ? teamIndex + 1 : null;
    }

    calculateRegularSeasonCompleted(league) {
        const { played, total } = this.getRegularSeasonTotals(league);
        return total > 0 && played >= total;
    }

    generatePlayoffBracket(league) {
        const standings = this.getLeagueStandings(league);
        const playoffTeamsCount = this.getPlayoffTeamsCount(league) || 6;
        
        // Берем топ команд для плей-офф с их местами
        const playoffTeams = standings.slice(0, playoffTeamsCount).map((team, index) => ({
            ...team,
            seed: index + 1 // Добавляем номер посева
        }));
        
        let bracket = {
            quarterfinals: [],
            semifinals: [],
            thirdPlace: [],
            final: [],
            champion: null
        };
        
        if (playoffTeamsCount === 8) {
            bracket.quarterfinals = [
                {
                    team1: playoffTeams[0]?.teamName || "TBD",
                    team1Seed: 1,
                    team2: playoffTeams[7]?.teamName || "TBD",
                    team2Seed: 8,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                },
                {
                    team1: playoffTeams[3]?.teamName || "TBD",
                    team1Seed: 4,
                    team2: playoffTeams[4]?.teamName || "TBD",
                    team2Seed: 5,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                },
                {
                    team1: playoffTeams[1]?.teamName || "TBD",
                    team1Seed: 2,
                    team2: playoffTeams[6]?.teamName || "TBD",
                    team2Seed: 7,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                },
                {
                    team1: playoffTeams[2]?.teamName || "TBD",
                    team1Seed: 3,
                    team2: playoffTeams[5]?.teamName || "TBD",
                    team2Seed: 6,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                }
            ];
            bracket.semifinals = [
                {
                    team1: "Победитель 1/4 1",
                    team1Seed: null,
                    team2: "Победитель 1/4 2",
                    team2Seed: null,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                },
                {
                    team1: "Победитель 1/4 3",
                    team1Seed: null,
                    team2: "Победитель 1/4 4",
                    team2Seed: null,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                }
            ];
            bracket.thirdPlace = [
                {
                    team1: "Проигравший 1/2 1",
                    team1Seed: null,
                    team2: "Проигравший 1/2 2",
                    team2Seed: null,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null,
                    isThirdPlace: true
                }
            ];
        } else if (playoffTeamsCount === 6) {
            // Формат для 6 команд: 3-6, 4-5 в четвертьфинале
            bracket.quarterfinals = [
                {
                    team1: playoffTeams[2]?.teamName || "TBD",
                    team1Seed: 3,
                    team2: playoffTeams[5]?.teamName || "TBD",
                    team2Seed: 6,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                },
                {
                    team1: playoffTeams[3]?.teamName || "TBD",
                    team1Seed: 4,
                    team2: playoffTeams[4]?.teamName || "TBD",
                    team2Seed: 5,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                }
            ];
            
            bracket.semifinals = [
                {
                    team1: playoffTeams[0]?.teamName || "TBD",
                    team1Seed: 1,
                    team2: "Победитель 1/4 1",
                    team2Seed: null,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                },
                {
                    team1: playoffTeams[1]?.teamName || "TBD",
                    team1Seed: 2,
                    team2: "Победитель 1/4 2",
                    team2Seed: null,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                }
            ];
            
            // Матч за 3-е место (проигравшие в полуфиналах)
            bracket.thirdPlace = [
                {
                    team1: "Проигравший 1/2 1",
                    team1Seed: null,
                    team2: "Проигравший 1/2 2",
                    team2Seed: null,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null,
                    isThirdPlace: true
                }
            ];
            
        } else if (playoffTeamsCount === 4) {
            // Формат для 4 команд: 1-4, 2-3 в полуфинале
            bracket.semifinals = [
                {
                    team1: playoffTeams[0]?.teamName || "TBD",
                    team1Seed: 1,
                    team2: playoffTeams[3]?.teamName || "TBD",
                    team2Seed: 4,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                },
                {
                    team1: playoffTeams[1]?.teamName || "TBD",
                    team1Seed: 2,
                    team2: playoffTeams[2]?.teamName || "TBD",
                    team2Seed: 3,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null
                }
            ];
            
            // Матч за 3-е место для формата 4 команд
            bracket.thirdPlace = [
                {
                    team1: "Проигравший 1/2 1",
                    team1Seed: null,
                    team2: "Проигравший 1/2 2",
                    team2Seed: null,
                    score1: 0,
                    score2: 0,
                    winner: null,
                    winnerSeed: null,
                    isThirdPlace: true
                }
            ];
        }
        
        bracket.final = [
            {
                team1: "Победитель 1/2 1",
                team1Seed: null,
                team2: "Победитель 1/2 2",
                team2Seed: null,
                score1: 0,
                score2: 0,
                winner: null,
                winnerSeed: null
            }
        ];
        
        return bracket;
    }

    // Обновляем метод продвижения команд
    advancePlayoffTeams(league, matchType, matchIndex, winner, winnerSeed) {
        const config = this.getLeagueConfig(league);
        if (!config || !config.playoffBracket) return;
        
        const bracket = config.playoffBracket;
        
        if (matchType === 'quarterfinal' && bracket.quarterfinals[matchIndex]) {
            const match = bracket.quarterfinals[matchIndex];
            match.winner = winner;
            match.winnerSeed = winnerSeed;
            
            // Победитель идет в полуфинал
            const semifinalIndex = matchIndex === 0 ? 0 : 1;
            if (bracket.semifinals[semifinalIndex]) {
                const targetTeam = matchIndex === 0 ? 'team2' : 'team2';
                const targetSeed = matchIndex === 0 ? 'team2Seed' : 'team2Seed';
                
                bracket.semifinals[semifinalIndex][targetTeam] = winner;
                bracket.semifinals[semifinalIndex][targetSeed] = winnerSeed;
            }
        } else if (matchType === 'semifinal' && bracket.semifinals[matchIndex]) {
            const match = bracket.semifinals[matchIndex];
            match.winner = winner;
            match.winnerSeed = winnerSeed;
            
            // Определяем проигравшего для матча за 3-е место
            const loser = winner === match.team1 ? match.team2 : match.team1;
            const loserSeed = winner === match.team1 ? match.team2Seed : match.team1Seed;
            
            // Добавляем проигравшего в матч за 3-е место
            if (bracket.thirdPlace[0]) {
                const targetTeam = matchIndex === 0 ? 'team1' : 'team2';
                const targetSeed = matchIndex === 0 ? 'team1Seed' : 'team2Seed';
                
                bracket.thirdPlace[0][targetTeam] = loser;
                bracket.thirdPlace[0][targetSeed] = loserSeed;
            }
            
            // Победитель идет в финал
            if (bracket.final[0]) {
                const targetTeam = matchIndex === 0 ? 'team1' : 'team2';
                const targetSeed = matchIndex === 0 ? 'team1Seed' : 'team2Seed';
                
                bracket.final[0][targetTeam] = winner;
                bracket.final[0][targetSeed] = winnerSeed;
            }
        } else if (matchType === 'thirdplace' && bracket.thirdPlace[matchIndex]) {
            const match = bracket.thirdPlace[matchIndex];
            match.winner = winner;
            match.winnerSeed = winnerSeed;
        } else if (matchType === 'final' && bracket.final[matchIndex]) {
            const match = bracket.final[matchIndex];
            match.winner = winner;
            match.winnerSeed = winnerSeed;
            bracket.champion = winner;
        }
        
        this.updatePlayoffBracket(league, bracket);
    }

    // Получаем команду с ее местом в регулярке
    getTeamWithSeed(teamName, league) {
        const standings = this.getLeagueStandings(league);
        const teamIndex = standings.findIndex(team => 
            this.normalizeTeamName(team.teamName) === this.normalizeTeamName(teamName)
        );
        
        return {
            teamName,
            seed: teamIndex + 1,
            teamData: standings[teamIndex]
        };
    }

    updatePlayoffBracket(league, bracket) {
        const config = this.getLeagueConfig(league);
        if (!config) return;
        
        config.playoffBracket = bracket;
        config.showPlayoffTab = true;
    }
}