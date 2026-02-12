class BasketballData {
    constructor() {
        this.teams = [];
        this.games = [];
        this.schedule = [];
        this.leagueConfigs = {};
        this.dataVersion = '2.1';
        this.ready = this.init();
    }

    async init() {
        try {
            this.showLoading();
            
            await this.loadLeagueConfigs();

            // Разбиваем загрузку на этапы с прогрессом
            await this.loadDataWithProgress();
            
            this.hideLoading();
        } catch (error) {
            console.error('Error in init:', error);
            this.hideLoading();
        }
    }

    showLoading() {
        // Показываем оба индикатора
        document.getElementById('fullscreen-loading').style.display = 'flex';
        document.getElementById('loading-indicator').classList.add('active');
    }

    async loadLeagueConfigs() {
        try {
            this.updateProgress(5, 'Загрузка конфигурации лиг...');
            
            const response = await fetch('data/leagues-config.json?' + Date.now(), {
                cache: 'no-cache'
            });
            
            if (response.ok) {
                this.leagueConfigs = await response.json();
                console.log('Конфигурация лиг загружена:', this.leagueConfigs);
            } else {
                console.warn('Не удалось загрузить конфигурацию лиг, используем значения по умолчанию');
            }
        } catch (error) {
            console.error('Ошибка загрузки конфигурации лиг:', error)
        }
    }

    getLeagueConfig(league) {
        return this.leagueConfigs[league];
    }

    getLeagueName(league) {
        const config = this.getLeagueConfig(league);
        return config.name;
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
        // Скрываем оба индикатора
        document.getElementById('fullscreen-loading').style.display = 'none';
        document.getElementById('loading-indicator').classList.remove('active');
    }

    async loadData() {
        try {
            this.updateProgress(10, 'Загрузка команд...');
            this.teams = await this.loadJSON('data/teams.json?' + Date.now());
            
            this.updateProgress(30, 'Загрузка расписания...');
            this.schedule = await this.loadJSON('data/schedule.json?' + Date.now());
            
            this.updateProgress(50, 'Загрузка матчей...');
            await this.loadGameFiles();
            
            this.updateProgress(100, 'Готово!');
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            throw error;
        }
    }

    async loadJSON(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // Таймаут 5 секунд
            
            const response = await fetch(url, { 
                signal: controller.signal,
                cache: 'no-cache'
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

    async loadGameFiles() {
        try {
            this.updateProgress(50, 'Определение количества игр...');
            const maxGameNumber = await this.findMaxGameNumber();
            
            if (maxGameNumber === 0) {
                console.log('Файлы игр не найдены');
                return;
            }
            
            console.log(`Найдено ${maxGameNumber} игр для загрузки`);
            
            // Загружаем игры параллельными блоками
            const batchSize = 10; // Увеличиваем размер блока
            const totalBatches = Math.ceil(maxGameNumber / batchSize);
            
            for (let batch = 0; batch < totalBatches; batch++) {
                const start = batch * batchSize + 1;
                const end = Math.min(start + batchSize - 1, maxGameNumber);
                
                // Создаем промисы для текущего блока
                const batchPromises = [];
                for (let i = start; i <= end; i++) {
                    batchPromises.push(this.loadGameFile(i, maxGameNumber));
                }
                
                // Ждем завершения текущего блока
                await Promise.allSettled(batchPromises);
                
                // Обновляем прогресс после каждого блока
                const progress = 50 + Math.floor((end / maxGameNumber) * 40);
                this.updateProgress(progress, `Загружено ${end}/${maxGameNumber} игр`);
            }
            
            this.updateProgress(90, 'Обработка данных игр...');
        } catch (error) {
            console.warn('Ошибка загрузки файлов игр:', error);
        }
    }

    // Новый метод для загрузки одного файла игры
    async loadGameFile(gameNumber, totalGames) {
        try {
            const gameId = `game_${gameNumber.toString().padStart(3, '0')}`;
            const gamePath = `data/games/${gameId}.json?${Date.now()}`;
            
            const game = await this.loadJSON(gamePath);
            this.normalizeGameData(game, gameId);
            this.games.push(game);
        } catch (error) {
            console.warn(`Не удалось загрузить игру ${gameNumber}:`, error);
        }
    }

    async findMaxGameNumber() {
        // Используем бинарный поиск для быстрого определения максимального номера
        let low = 1;
        let high = 200; // Максимально возможное количество игр (можно увеличить)
        let lastFound = 0;
        
        // Быстрая проверка: если нет первой игры, значит игр нет
        if (!await this.checkGameFileExists(1)) {
            return 0;
        }
        
        // Если есть последняя возможная игра, возвращаем её
        if (await this.checkGameFileExists(high)) {
            // Проверяем, есть ли игры выше этого номера
            let current = high;
            while (await this.checkGameFileExists(current + 100)) {
                current += 100;
            }
            while (await this.checkGameFileExists(current + 10)) {
                current += 10;
            }
            while (await this.checkGameFileExists(current + 1)) {
                current++;
            }
            return current;
        }
        
        // Бинарный поиск между 1 и high
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const exists = await this.checkGameFileExists(mid);
            
            if (exists) {
                lastFound = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        
        return lastFound;
    }

    // Улучшенная проверка файла с таймаутом
    async checkGameFileExists(gameNumber) {
        const gameId = `game_${gameNumber.toString().padStart(3, '0')}`;
        const gamePath = `data/games/${gameId}.json`;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // Таймаут 2 секунды
            
            const response = await fetch(gamePath, { 
                method: 'HEAD',
                signal: controller.signal,
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`Таймаут проверки файла ${gameId}`);
            }
            return false;
        }
    }

    async loadDataWithProgress() {
        try {
            this.updateProgress(10, 'Загрузка команд...');
            this.teams = await this.loadJSON('data/teams.json?' + Date.now());
            
            this.updateProgress(30, 'Загрузка расписания...');
            this.schedule = await this.loadJSON('data/schedule.json?' + Date.now());
            
            this.updateProgress(50, 'Загрузка игр...');
            await this.loadGameFiles(); // Здесь уже есть свой прогресс
            
            this.updateProgress(95, 'Обработка данных...');
            
            this.updateProgress(100, 'Готово!');
            
            // Добавляем небольшую задержку для плавного завершения
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error('Ошибка в loadDataWithProgress:', error);
            throw error;
        }
    }

    async loadAllNews() {
        try {
            // Список всех .md файлов в папке news
            const newsFiles = [
                'league-b-playoff-preview.md',
                'league-b-last-tour.md',
                'league-a-tour.md'
            ];
            
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
            const response = await fetch(`data/news/${filename}?t=${Date.now()}`);
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
        if (game.match_info) {
            game.id = gameId
            game.teamHome = game.match_info.team_a;
            game.teamAway = game.match_info.team_b;
            game.scoreHome = parseInt(game.match_info.score.split(':')[0]);
            game.scoreAway = parseInt(game.match_info.score.split(':')[1]);
            game.date = game.match_info.date;
            game.time = game.match_info.time;
            game.location = game.match_info.venue;
            game.gameType = game.match_info.gameType || 'regular';
            
            game.league = game.match_info.league || 'A';
        }
    }

    normalizeTeamName(teamName) {
        return teamName.trim().toUpperCase();
    }

    getLeagueName(league) {
        if (league === 'A') {
            return 'Лига А'
        } else if (league === 'B') {
            return 'Лига Б'
        } else {
            return 'Жен. Лига'
        }
    }

    getTeamByName(teamName, league) {
        const normalizedName = this.normalizeTeamName(teamName);
        return this.teams.find(team => 
            this.normalizeTeamName(team.name) === normalizedName && team.league === league
        );
    }

    getTeamsByLeague(league) {
        if (league === 'all') {
            return this.teams;
        }
        return this.teams.filter(team => team.league === league);
    }

    getAllScheduledGames() {
        if (!this.schedule || !Array.isArray(this.schedule.stages)) {
            console.log('No schedule data found');
            return [];
        }
        
        const list = [];
        let gameCounter = 1;
        
        this.schedule.stages.forEach(stage => {
            (stage.games || []).forEach(game => {
                if (!game) return;
                
                // Исправляем создание даты
                const gameDateTime = this.createValidDate(game.date, game.time);
                if (!gameDateTime) {
                    console.warn(`Invalid date for game: ${game.teamHome} vs ${game.teamAway}`);
                    return;
                }
                
                list.push({ 
                    date: game.date,
                    time: game.time,
                    location: game.location,
                    teamHome: game.teamHome,
                    teamAway: game.teamAway,
                    league: game.league,
                    gameType: game.gameType || 'regular',
                    scoreHome: null,
                    scoreAway: null,
                    id: `scheduled_${gameDateTime}`,
                    _fullDate: gameDateTime,
                    _hasResult: false
                });
            });
        });
        
        return list;
    }

    getAllGamesForDisplay() {
        
        // 1. Получаем игры из расписания
        const scheduledGames = this.getAllScheduledGames();
        
        // 2. Получаем игры из файлов (уже загружены в this.games)
        const resultGames = this.games.map(game => {
            // Создаем корректную дату для игр из результатов
            const gameDate = this.createValidDate(game.date, game.time);
            
            return {
                id: game.id,
                _fullDate: gameDate,
                _hasResult: true,
                _isFromResults: true,
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
        
        // 3. Объединяем и сортируем
        const allGames = [...scheduledGames, ...resultGames];
        
        // Убираем дубликаты
        const uniqueGames = this.removeDuplicateGames(allGames);
        
        // Сортируем по дате (новые сверху)
        uniqueGames.sort((a, b) => b._fullDate - a._fullDate);
        
        return uniqueGames;
    }

    removeDuplicateGames(games) {
        const seen = new Set();
        return games.filter(game => {
            // Создаем ключ на основе команд и даты
            const key = `${this.normalizeTeamName(game.teamHome)}_${this.normalizeTeamName(game.teamAway)}_${game._fullDate.toISOString().split('T')[0]}`;
            
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
            game.league == league && (
            this.normalizeTeamName(game.teamHome) === normalizedTeamName || 
            this.normalizeTeamName(game.teamAway) === normalizedTeamName)
        );
    }

    getLeagueStandings(league) {
        const teamsInLeague = this.getTeamsByLeague(league);
        const standings = new Map();
        
        // Инициализируем все команды лиги
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
                trand: "",
                headToHead: { // Добавляем для личных встреч
                    wins: 0,
                    losses: 0,
                    pointsFor: 0,
                    pointsAgainst: 0
                }
            });
        });
        
        // Обрабатываем все игры с результатами
        const leagueGames = this.games
            .filter(game => game.scoreHome !== null && game.scoreAway !== null && game.league === league && game.gameType != 'playoff')
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        leagueGames.forEach(game => {
            const homeTeamName = game.teamHome;
            const awayTeamName = game.teamAway;
            
            const homeNormalized = this.normalizeTeamName(homeTeamName);
            const awayNormalized = this.normalizeTeamName(awayTeamName);
            
            const home = standings.get(homeNormalized);
            const away = standings.get(awayNormalized);
            
            if (home && away) {
                // Обновляем общую статистику
                home.played++; 
                away.played++;
                home.pointsFor += game.scoreHome; 
                home.pointsAgainst += game.scoreAway;
                away.pointsFor += game.scoreAway; 
                away.pointsAgainst += game.scoreHome;
                
                // Обновляем статистику личных встреч
                home.headToHead.pointsFor += game.scoreHome;
                home.headToHead.pointsAgainst += game.scoreAway;
                away.headToHead.pointsFor += game.scoreAway;
                away.headToHead.pointsAgainst += game.scoreHome;
                
                if (game.scoreHome > game.scoreAway) {
                    home.wins++; 
                    home.points += 2;
                    home.trand += "1"; 
                    home.headToHead.wins++;
                    
                    away.losses++; 
                    away.points += 1;
                    away.trand += "0";
                    away.headToHead.losses++;
                } else if (game.scoreHome < game.scoreAway) {
                    away.wins++; 
                    away.points += 2;
                    away.trand += "1";
                    away.headToHead.wins++;
                    
                    home.losses++; 
                    home.points += 1;
                    home.trand += "0";
                    home.headToHead.losses++;
                } else {
                    home.points += 1; 
                    away.points += 1;
                    home.trand += "0";
                    away.trand += "0";
                    // Ничья - не учитываем в личных встречах
                }
            }
        });
        
        // Конвертируем в массив для сортировки
        let standingsArray = Array.from(standings.values());
        
        // Сортируем по сложному алгоритму
        standingsArray.sort((a, b) => {
            // 1. По очкам (главный критерий)
            if (b.points !== a.points) return b.points - a.points;
            
            // 2. По результатам личных встреч (если команды играли друг с другом)
            const haveHeadToHead = this.haveHeadToHeadGames(a.teamName, b.teamName, leagueGames);
            if (haveHeadToHead) {
                // Сравниваем результаты личных встреч
                const headToHeadComparison = this.compareHeadToHead(a, b, leagueGames);
                if (headToHeadComparison !== 0) return headToHeadComparison;
            }
            
            // 3. По разнице очков во всех играх
            const diffA = a.pointsFor - a.pointsAgainst;
            const diffB = b.pointsFor - b.pointsAgainst;
            if (diffB !== diffA) return diffB - diffA;
            
            // 4. По количеству набранных очков
            if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
            
            // 5. По алфавиту (последний критерий)
            return a.teamName.localeCompare(b.teamName);
        });
        
        return standingsArray;
    }

    // Вспомогательный метод: проверяем, играли ли команды друг с другом
    haveHeadToHeadGames(teamA, teamB, games) {
        const normA = this.normalizeTeamName(teamA);
        const normB = this.normalizeTeamName(teamB);
        
        return games.some(game => {
            const home = this.normalizeTeamName(game.teamHome);
            const away = this.normalizeTeamName(game.teamAway);
            return (home === normA && away === normB) || (home === normB && away === normA);
        });
    }

    // Вспомогательный метод: сравниваем результаты личных встреч
    compareHeadToHead(teamA, teamB, games) {
        const normA = this.normalizeTeamName(teamA.teamName);
        const normB = this.normalizeTeamName(teamB.teamName);
        
        // Собираем статистику личных встреч
        let aWins = 0, bWins = 0;
        let aPointsFor = 0, aPointsAgainst = 0;
        let bPointsFor = 0, bPointsAgainst = 0;
        
        games.forEach(game => {
            const home = this.normalizeTeamName(game.teamHome);
            const away = this.normalizeTeamName(game.teamAway);
            
            // Проверяем, что это матч между этими двумя командами
            if ((home === normA && away === normB) || (home === normB && away === normA)) {
                const isAHome = home === normA;
                
                if (isAHome) {
                    aPointsFor += game.scoreHome;
                    aPointsAgainst += game.scoreAway;
                    bPointsFor += game.scoreAway;
                    bPointsAgainst += game.scoreHome;
                    
                    if (game.scoreHome > game.scoreAway) {
                        aWins++;
                    } else if (game.scoreHome < game.scoreAway) {
                        bWins++;
                    }
                } else {
                    aPointsFor += game.scoreAway;
                    aPointsAgainst += game.scoreHome;
                    bPointsFor += game.scoreHome;
                    bPointsAgainst += game.scoreAway;
                    
                    if (game.scoreAway > game.scoreHome) {
                        aWins++;
                    } else if (game.scoreAway < game.scoreHome) {
                        bWins++;
                    }
                }
            }
        });
        
        // 1. По победам в личных встречах
        if (aWins !== bWins) return bWins - aWins;
        
        // 2. По разнице очков в личных встречах
        const aDiff = aPointsFor - aPointsAgainst;
        const bDiff = bPointsFor - bPointsAgainst;
        if (bDiff !== aDiff) return bDiff - aDiff;
        
        // 3. По количеству набранных очков в личных встречах
        if (bPointsFor !== aPointsFor) return bPointsFor - aPointsFor;
        
        // 4. Равны
        return 0;
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
        console.log(`Looking for game with ID: ${gameId}`);
        
        // Для scheduled игр
        if (gameId.startsWith('scheduled_')) {
            const allGames = this.getAllGamesForDisplay();
            const foundGame = allGames.find(game => game.id === gameId);
            return foundGame || null;
        }
        
        // Для result игр
        if (gameId.startsWith('game_')) {
            const allGames = this.getAllGamesForDisplay();
            const foundGame = allGames.find(game => game.id === gameId);
            
            if (foundGame && foundGame._gameData) {
                console.log('Found result game with full data');
                return {
                    ...foundGame,
                    ...foundGame._gameData,
                    id: gameId
                };
            }
            return foundGame;
        }
        
        // Для обычных игр
        const id = this.normalizeGameId(gameId);
        const actual = this.games.find(g => this.normalizeGameId(g.id) === id) || null;
        
        return actual;
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
        // gameId может быть в формате "game_001" или "result_2024-01-15T12:00:00.000Z"
        
        // Возвращаем путь к изображению
        return `data/result/${gameId}.jpg`;
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
        // 1. Получаем все игры плей-офф для лиги
        const playoffGames = this.games.filter(game => 
            game.gameType === 'playoff' && 
            game.league === league
        )
        const scheduledGames = this.getAllScheduledGames();
        
        // Фильтруем игры плей-офф из расписания
        const scheduledPlayoffGames = scheduledGames.filter(game => 
            game.gameType === 'playoff' && 
            game.league === league
        );
        
        // 2. Объединяем сыгранные игры плей-офф с запланированными
        const allPlayoffGames = [...playoffGames, ...scheduledPlayoffGames.map(game => ({
            ...game,
            gameType: 'playoff',
            league: league,
            // Преобразуем scheduled объект в формат игры
            id: game.id,
            _fullDate: game._fullDate,
            _hasResult: false,
        }))];

        if (allPlayoffGames.length === 0) {
            return this.generateEmptyBracket(league);
        }
        
        // 2. Анализируем игры и строим сетку
        return this.buildBracketFromGames(allPlayoffGames, league);
    }

    generateEmptyBracket(league) {
        const standings = this.getLeagueStandings(league);
        const config = this.getLeagueConfig(league);
        const playoffTeamsCount = config.playoffTeams || 6;
        
        // Берем топ команд
        const topTeams = standings.slice(0, playoffTeamsCount);
        
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
        
        if (semifinalIndex === 0) {
            // Проигравший первого полуфинала идет в первую позицию матча за 3-е место
            thirdPlace.team1 = loser;
            thirdPlace.team1Seed = loserSeed;
        } else if (semifinalIndex === 1) {
            // Проигравший второго полуфинала идет во вторую позицию матча за 3-е место
            thirdPlace.team2 = loser;
            thirdPlace.team2Seed = loserSeed;
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
        const config = this.getLeagueConfig(league);
        if (!config || !config.regularSeasonRounds) return false;
        
        const teams = this.getTeamsByLeague(league);
        const totalTeams = teams.length;
        
        // Общее количество игр в регулярке
        const totalRegularGames = (totalTeams * (totalTeams - 1) * config.regularSeasonRounds) / 2;
        
        // Подсчитываем сыгранные игры в регулярке (без playoff)
        const playedRegularGames = this.games.filter(game => 
            game.league === league && 
            game.scoreHome !== null && 
            game.scoreAway !== null &&
            game.gameType !== 'playoff'
        ).length;
        
        return playedRegularGames >= totalRegularGames;
    }

    generatePlayoffBracket(league) {
        const standings = this.getLeagueStandings(league);
        const config = this.getLeagueConfig(league);
        const playoffTeamsCount = config.playoffTeams || 6;
        
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
        
        if (playoffTeamsCount === 6) {
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