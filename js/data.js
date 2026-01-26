class BasketballData {
    constructor() {
        this.teams = [];
        this.players = [];
        this.games = [];
        this.schedule = [];
        this.playerStats = {};
        this.dataVersion = '2.1';
        this.ready = this.init();
    }

    async init() {
        try {
            this.showLoading();
            
            // Разбиваем загрузку на этапы с прогрессом
            await this.loadDataWithProgress();
            
            // Параллельные вычисления
            await Promise.all([
                this.collectPlayersFromGames(),
                this.calculatePlayerStats()
            ]);
            
            this.hideLoading();
        } catch (error) {
            console.error('Error in init:', error);
            this.hideLoading();
        }
    }

    async loadDataWithProgress() {
        const steps = [
            { name: 'Загрузка команд', weight: 15 },
            { name: 'Загрузка расписания', weight: 15 },
            { name: 'Поиск матчей', weight: 20 },
            { name: 'Загрузка матчей', weight: 40 },
            { name: 'Обработка данных', weight: 10 }
        ];
        
        let currentProgress = 0;
        
        // Шаг 1: Команды
        this.updateProgress(currentProgress, steps[0].name);
        this.teams = await this.loadJSON('data/teams.json?' + Date.now());
        currentProgress += steps[0].weight;
        
        // Шаг 2: Расписание
        this.updateProgress(currentProgress, steps[1].name);
        this.schedule = await this.loadJSON('data/schedule.json?' + Date.now());
        currentProgress += steps[1].weight;
        
        // Шаг 3: Игры
        this.updateProgress(currentProgress, steps[2].name);
        await this.loadGameFiles(); // Этот метод теперь обновляет прогресс внутри
        currentProgress = 80; // После loadGameFiles мы должны быть на ~80%
        
        // Шаг 4: Финальная обработка
        this.updateProgress(currentProgress, steps[4].name);
        currentProgress = 100;
        this.updateProgress(currentProgress, 'Готово!');
    }

    showLoading() {
        // Показываем оба индикатора
        document.getElementById('fullscreen-loading').style.display = 'flex';
        document.getElementById('loading-indicator').classList.add('active');
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
            const cacheBusterUrl = url.includes('?') ? url + '&' + Date.now() : url + '?' + Date.now();
            const response = await fetch(cacheBusterUrl);
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
            const gameFiles = [];
            let gameNumber = 1;
            
            // Определяем какие файлы игр существуют БЫСТРЕЕ
            const checkPromises = [];
            for (let i = 1; i <= 200; i++) {
                const gameId = `game_${i.toString().padStart(3, '0')}`;
                const gamePath = `data/games/${gameId}.json?${Date.now()}`;
                
                checkPromises.push(
                    fetch(gamePath, { method: 'HEAD' })
                        .then(response => {
                            if (response.ok) {
                                gameFiles.push(`data/games/${gameId}.json`);
                            }
                        })
                        .catch(() => {}) // Игнорируем ошибки
                );
                
                // Разбиваем на группы по 10 для обновления прогресса
                if (i % 10 === 0) {
                    await Promise.all(checkPromises);
                    const progress = 50 + Math.floor((i / 200) * 30);
                    this.updateProgress(progress, `Поиск файлов... (${i}/200)`);
                }
            }
            
            await Promise.all(checkPromises);
            
            // Загружаем найденные файлы параллельно, но с ограничением
            const totalFiles = gameFiles.length;
            const BATCH_SIZE = 5; // Загружаем по 5 файлов одновременно
            
            for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
                const batch = gameFiles.slice(i, i + BATCH_SIZE);
                const loadPromises = batch.map(async (file, batchIndex) => {
                    try {
                        const gameId = file.split('/').pop().split('.')[0];
                        const game = await this.loadJSON(file);
                        this.normalizeGameData(game, gameId);
                        this.games.push(game);
                        
                        // Обновляем прогресс для каждого файла в батче
                        const currentProgress = 60 + Math.floor(((i + batchIndex) / totalFiles) * 35);
                        this.updateProgress(currentProgress, `Загрузка ${i + batchIndex + 1}/${totalFiles}`);
                    } catch (error) {
                        console.warn(`Не удалось загрузить игру: ${file}`);
                    }
                });
                
                await Promise.all(loadPromises);
            }
            
        } catch (error) {
            console.warn('Ошибка загрузки файлов игр:', error);
        }
    }

    collectPlayersFromGames() {
        const playersMap = new Map();
        
        this.games.forEach(game => {
            if (game.team_a_stats && game.team_a_stats.players) {
                game.team_a_stats.players.forEach(playerData => {
                    const playerName = this.normalizePlayerName(playerData.name);
                    if (!playersMap.has(playerName)) {
                        playersMap.set(playerName, {
                            name: playerData.name, // Оригинальное имя
                            teamName: game.team_a_stats.team_name,
                            position: this.determinePosition(playerData), // Определяем позицию по статистике
                            number: playerData.number || 0
                        });
                    }
                });
            }
            
            if (game.team_b_stats && game.team_b_stats.players) {
                game.team_b_stats.players.forEach(playerData => {
                    const playerName = this.normalizePlayerName(playerData.name);
                    if (!playersMap.has(playerName)) {
                        playersMap.set(playerName, {
                            name: playerData.name, // Оригинальное имя
                            teamName: game.team_b_stats.team_name,
                            position: this.determinePosition(playerData),
                            number: playerData.number || 0
                        });
                    }
                });
            }
        });
        
        this.players = Array.from(playersMap.values());
    }

    determinePosition(playerData) {
        // Простая эвристика для определения позиции по статистике
        const points = playerData.points || 0;
        const rebounds = playerData.rebounds?.total || 0;
        const assists = playerData.assists || 0;
        const blocks = playerData.blocks || 0;
        
        if (assists > 5 && points > 10) return 'Разыгрывающий';
        if (points > 15 && rebounds < 5) return 'Атакующий защитник';
        if (rebounds > 8 && blocks > 2) return 'Центровой';
        if (rebounds > 6 && points > 10) return 'Тяжелый форвард';
        if (points > 12 && rebounds > 4) return 'Легкий форвард';
        
        return 'Защитник'; // По умолчанию
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
            
            game.league = game.original_match?.league || 'A';
        }
        
        if (game.team_a_stats && game.team_b_stats) {
            game.playerStats = {};
            
            // Обрабатываем команду A
            game.team_a_stats.players.forEach(player => {
                const playerName = this.normalizePlayerName(player.name);
                game.playerStats[playerName] = {
                    teamName: game.team_a_stats.team_name,
                    points: player.points || 0,
                    rebounds: player.rebounds?.total || 0,
                    assists: player.assists || 0,
                    steals: player.steals || 0,
                    blocks: player.blocks || 0,
                    fouls: player.fouls || 0,
                    number: player.number || 0
                };
            });
            
            // Обрабатываем команду B
            game.team_b_stats.players.forEach(player => {
                const playerName = this.normalizePlayerName(player.name);
                game.playerStats[playerName] = {
                    teamName: game.team_b_stats.team_name,
                    points: player.points || 0,
                    rebounds: player.rebounds?.total || 0,
                    assists: player.assists || 0,
                    steals: player.steals || 0,
                    blocks: player.blocks || 0,
                    fouls: player.fouls || 0,
                    number: player.number || 0
                };
            });
        }
    }

    normalizePlayerName(name) {
        return name.trim().toUpperCase();
    }

    normalizeTeamName(teamName) {
        return teamName.trim().toUpperCase();
    }

    getLeagueName(league) {
        if (league === 'A') {
            return 'Лига А'
        } else if (league === 'B') {
            return 'Лиги Б'
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

    getPlayerByName(playerName) {
        const normalizedName = this.normalizePlayerName(playerName);
        return this.players.find(player => 
            this.normalizePlayerName(player.name) === normalizedName
        );
    }

    calculatePlayerStats() {
        this.playerStats = {};
        
        this.games.forEach(game => {
            if (game.playerStats) {
                Object.entries(game.playerStats).forEach(([playerName, stats]) => {
                    if (!this.playerStats[playerName]) {
                        this.playerStats[playerName] = {
                            playerName: playerName,
                            gamesPlayed: 0,
                            totalPoints: 0,
                            totalRebounds: 0,
                            totalAssists: 0,
                            totalSteals: 0,
                            totalBlocks: 0,
                            totalFouls: 0,
                            teamName: stats.teamName
                        };
                    }
                    
                    const playerStat = this.playerStats[playerName];
                    playerStat.gamesPlayed++;
                    playerStat.totalPoints += stats.points || 0;
                    playerStat.totalRebounds += stats.rebounds || 0;
                    playerStat.totalAssists += stats.assists || 0;
                    playerStat.totalSteals += stats.steals || 0;
                    playerStat.totalBlocks += stats.blocks || 0;
                    playerStat.totalFouls += stats.fouls || 0;
                });
            }
        });
    }

    getTeamsByLeague(league) {
        if (league === 'all') {
            return this.teams;
        }
        return this.teams.filter(team => team.league === league);
    }

    getPlayersByTeam(teamName) {
        const normalizedTeamName = this.normalizeTeamName(teamName);
        return this.players.filter(player => {
            const playerTeamName = this.normalizeTeamName(player.teamName);
            return playerTeamName === normalizedTeamName;
        });
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
                    scoreHome: null,
                    sccoreAway: null,
                    id: `scheduled_${gameDateTime}`,
                    _stageName: stage.name || 'Регулярный сезон',
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
                _id: `result_${gameDate}`,
                _stageName: 'Результаты',
                _fullDate: gameDate,
                _hasResult: true,
                _isFromResults: true,
                teamHome: game.teamHome,
                teamAway: game.teamAway,
                scoreHome: game.scoreHome,
                scoreAway: game.scoreAway,
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
                trand: ""
            });
        });
        
        // Обрабатываем все игры с результатами
        this.games
        .filter(game => game.scoreHome !== null && game.scoreAway !== null && game.league === league)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(game => {
            const homeTeamName = game.teamHome;
            const awayTeamName = game.teamAway;
            
            const homeNormalized = this.normalizeTeamName(homeTeamName);
            const awayNormalized = this.normalizeTeamName(awayTeamName);
            
            const home = standings.get(homeNormalized);
            const away = standings.get(awayNormalized);
            
            if (home && away) {
                home.played++; 
                away.played++;
                home.pointsFor += game.scoreHome; 
                home.pointsAgainst += game.scoreAway;
                away.pointsFor += game.scoreAway; 
                away.pointsAgainst += game.scoreHome;
                
                if (game.scoreHome > game.scoreAway) {
                    home.wins++; 
                    home.points += 2;
                    home.trand += "1"; 
                    away.losses++; 
                    away.points += 1;
                    away.trand += "0";
                } else if (game.scoreHome < game.scoreAway) {
                    away.wins++; 
                    away.points += 2;
                    away.trand += "1";
                    home.losses++; 
                    home.points += 1;
                    home.trand += "0";
                } else {
                    home.points += 1; 
                    away.points += 1;
                    home.trand += "0";
                    away.trand += "0";
                }
            }
        });
        
        // Сортируем по очкам, затем по разнице очков
        return Array.from(standings.values()).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const diffA = a.pointsFor - a.pointsAgainst;
            const diffB = b.pointsFor - b.pointsAgainst;
            if (diffB !== diffA) return diffB - diffA;
            return b.pointsFor - a.pointsFor;
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

    getPlayerStatsByLeague(league, statType, minGames = 1, hideZeroStats = true) {
        let playersToShow = Object.values(this.playerStats).filter(stats => 
            stats.gamesPlayed >= minGames
        );
        
        if (league !== 'all') {
            const teamNamesInLeague = this.getTeamsByLeague(league).map(team => team.name);
            playersToShow = playersToShow.filter(player => 
                teamNamesInLeague.some(teamName => 
                    this.normalizeTeamName(teamName) === this.normalizeTeamName(player.teamName)
                )
            );
        }
        
        // Фильтруем игроков с нулевыми показателями, если включена опция
        if (hideZeroStats) {
            playersToShow = playersToShow.filter(playerStats => {
                const statValue = statType === 'points' ? playerStats.totalPoints :
                                statType === 'rebounds' ? playerStats.totalRebounds :
                                statType === 'assists' ? playerStats.totalAssists :
                                statType === 'steals' ? playerStats.totalSteals :
                                statType === 'blocks' ? playerStats.totalBlocks : 0;
                
                return statValue > 0;
            });
        }
        
        const sortedPlayers = playersToShow
            .map(playerStats => {
                const player = this.getPlayerByName(playerStats.playerName) || {
                    name: playerStats.playerName,
                    teamName: playerStats.teamName,
                    position: 'Неизвестно'
                };
                
                const pointsPerGame = playerStats.gamesPlayed > 0 ? playerStats.totalPoints / playerStats.gamesPlayed : 0;
                const reboundsPerGame = playerStats.gamesPlayed > 0 ? playerStats.totalRebounds / playerStats.gamesPlayed : 0;
                const assistsPerGame = playerStats.gamesPlayed > 0 ? playerStats.totalAssists / playerStats.gamesPlayed : 0;
                const stealsPerGame = playerStats.gamesPlayed > 0 ? playerStats.totalSteals / playerStats.gamesPlayed : 0;
                const blocksPerGame = playerStats.gamesPlayed > 0 ? playerStats.totalBlocks / playerStats.gamesPlayed : 0;
                
                return {
                    ...player,
                    teamName: player.teamName,
                    gamesPlayed: playerStats.gamesPlayed,
                    pointsPerGame: pointsPerGame,
                    reboundsPerGame: reboundsPerGame,
                    assistsPerGame: assistsPerGame,
                    stealsPerGame: stealsPerGame,
                    blocksPerGame: blocksPerGame,
                    pointsTotal: playerStats.totalPoints,
                    reboundsTotal: playerStats.totalRebounds,
                    assistsTotal: playerStats.totalAssists,
                    stealsTotal: playerStats.totalSteals,
                    blocksTotal: playerStats.totalBlocks,
                    sortValue: statType === 'points' ? pointsPerGame :
                              statType === 'rebounds' ? reboundsPerGame :
                              statType === 'assists' ? assistsPerGame :
                              statType === 'steals' ? stealsPerGame :
                              statType === 'blocks' ? blocksPerGame : 0
                };
            })
            .sort((a, b) => b.sortValue - a.sortValue)
            .slice(0, 10);

        return sortedPlayers;
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
}