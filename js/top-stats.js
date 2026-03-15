// js/top-stats.js
class TopStatsManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentFilter = 'A'; // По умолчанию Лига А
        this.init();
    }

    init() {
        this.setupFilterListeners();
    }

    // Настройка фильтров
    setupFilterListeners() {
        document.querySelectorAll('.top-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                const filter = e.currentTarget.dataset.filter;
                
                // Обновляем активную кнопку
                document.querySelectorAll('.top-filter-btn').forEach(b => {
                    b.classList.remove('active');
                });
                e.currentTarget.classList.add('active');
                
                // Загружаем статистику с фильтром
                this.loadAndDisplayStats(filter);
            });
        });
    }

    // Основной метод загрузки и отображения статистики
    loadAndDisplayStats(filter = 'A') {
        this.currentFilter = filter;
        
        // Получаем данные для отображения
        const stats = this.calculateAllStats(filter);
        
        // Рендерим основную сетку
        this.renderMainStats(stats);
    }

    // Расчет всех статистик
    calculateAllStats(filter) {
        const league = filter;
        
        // Получаем команды только выбранной лиги
        let allTeams = [];
        const teams = this.dataManager.getTeamsByLeague(league);
        const standings = this.dataManager.getLeagueStandings(league);
        
        teams.forEach(team => {
            const teamStats = standings.find(s => 
                this.dataManager.normalizeTeamName(s.teamName) === this.dataManager.normalizeTeamName(team.name)
            ) || {
                teamName: team.name,
                team: team,
                played: 0,
                wins: 0,
                losses: 0,
                pointsFor: 0,
                pointsAgainst: 0
            };
            
            // Убеждаемся, что у нас есть объект team
            const teamObject = teamStats.team || team;
            
            allTeams.push({
                teamName: team.name,
                team: teamObject,
                league: league,
                played: teamStats.played || 0,
                wins: teamStats.wins || 0,
                losses: teamStats.losses || 0,
                pointsFor: teamStats.pointsFor || 0,
                pointsAgainst: teamStats.pointsAgainst || 0,
                avgScored: teamStats.played > 0 ? (teamStats.pointsFor / teamStats.played) : 0,
                avgConceded: teamStats.played > 0 ? (teamStats.pointsAgainst / teamStats.played) : 0,
                avgDiff: teamStats.played > 0 ? ((teamStats.pointsFor - teamStats.pointsAgainst) / teamStats.played) : 0
            });
        });

        // Получаем игры только выбранной лиги
        const games = this.dataManager.getGamesByLeague(league);
        
        // Фильтруем технические победы
        const realGames = games.filter(g => {
            if (!g._hasResult) return false;
            // Исключаем технические победы (20:0 или 0:20)
            if (g.scoreHome === 20 && g.scoreAway === 0) return false;
            if (g.scoreHome === 0 && g.scoreAway === 20) return false;
            return true;
        });

        // Пересчитываем средние показатели БЕЗ технических побед
        const teamsWithRealGames = this.calculateRealAverages(league, realGames);

        return {
            bestOffense: this.getTopTeams(teamsWithRealGames, 'avgScored', 'desc', 5),
            bestDefense: this.getTopTeams(teamsWithRealGames, 'avgConceded', 'asc', 5),
            bestDiff: this.getTopTeams(teamsWithRealGames, 'avgDiff', 'desc', 5),
            biggestWin: this.getBiggestWins(realGames, league, 5),
            highestScoring: this.getHighestScoringGames(realGames, league, 5),
            bestSingleDefense: this.getBestSingleDefense(realGames, league, 5),
            winStreaks: this.getWinStreaks(realGames, league, teamsWithRealGames, 5),
            hotStreaks: this.getHotStreaks(realGames, league, teamsWithRealGames)
        };
    }

    // Пересчет средних показателей без технических побед
    calculateRealAverages(league, realGames) {
        const teamsMap = new Map();
        
        // Собираем все команды лиги
        const teams = this.dataManager.getTeamsByLeague(league);
        teams.forEach(team => {
            const key = this.dataManager.normalizeTeamName(team.name);
            teamsMap.set(key, {
                teamName: team.name,
                team: team,
                league: league,
                played: 0,
                pointsFor: 0,
                pointsAgainst: 0
            });
        });
        
        // Учитываем только реальные игры (без технических побед)
        realGames.forEach(game => {
            const homeKey = this.dataManager.normalizeTeamName(game.teamHome);
            const awayKey = this.dataManager.normalizeTeamName(game.teamAway);
            
            const homeTeam = teamsMap.get(homeKey);
            const awayTeam = teamsMap.get(awayKey);
            
            if (homeTeam) {
                homeTeam.played++;
                homeTeam.pointsFor += game.scoreHome;
                homeTeam.pointsAgainst += game.scoreAway;
            }
            
            if (awayTeam) {
                awayTeam.played++;
                awayTeam.pointsFor += game.scoreAway;
                awayTeam.pointsAgainst += game.scoreHome;
            }
        });
        
        // Преобразуем Map в массив и добавляем средние показатели
        const result = [];
        teamsMap.forEach(team => {
            if (team.played > 0) {
                result.push({
                    ...team,
                    avgScored: team.pointsFor / team.played,
                    avgConceded: team.pointsAgainst / team.played,
                    avgDiff: (team.pointsFor - team.pointsAgainst) / team.played
                });
            } else {
                // Команды без игр тоже добавляем с нулевыми показателями
                result.push({
                    ...team,
                    avgScored: 0,
                    avgConceded: 0,
                    avgDiff: 0
                });
            }
        });
        
        return result;
    }

    // Получение топ команд по показателю
    getTopTeams(teams, metric, order = 'desc', limit = 5) {
        return teams
            .filter(team => team.played > 0 && team[metric] !== undefined)
            .sort((a, b) => order === 'desc' ? b[metric] - a[metric] : a[metric] - b[metric])
            .slice(0, limit)
            .map((team, index) => ({
                ...team,
                rank: index + 1,
                value: team[metric].toFixed(1)
            }));
    }

    // Самые крупные победы
    getBiggestWins(games, league, limit = 5) {
        const blowouts = [];
        
        games.forEach(game => {
            if (game && game.scoreHome !== null && game.scoreAway !== null) {
                // Пропускаем технические победы
                if ((game.scoreHome === 20 && game.scoreAway === 0) || 
                    (game.scoreHome === 0 && game.scoreAway === 20)) {
                    return;
                }
                
                const diff = Math.abs(game.scoreHome - game.scoreAway);
                const winner = game.scoreHome > game.scoreAway ? game.teamHome : game.teamAway;
                const loser = game.scoreHome > game.scoreAway ? game.teamAway : game.teamHome;
                const winnerScore = Math.max(game.scoreHome, game.scoreAway);
                const loserScore = Math.min(game.scoreHome, game.scoreAway);
                
                const winnerTeam = this.dataManager.getTeamByName(winner, league);
                const loserTeam = this.dataManager.getTeamByName(loser, league);
                
                blowouts.push({
                    ...game,
                    diff: diff,
                    winner: winner,
                    loser: loser,
                    winnerScore: winnerScore,
                    loserScore: loserScore,
                    winnerTeam: winnerTeam,
                    loserTeam: loserTeam,
                    displayValue: `+${diff} (${winnerScore}:${loserScore})`,
                    details: `${winner} ${winnerScore} - ${loserScore} ${loser}`,
                    date: game._fullDate,
                    teamName: winner,
                    team: winnerTeam,
                    league: league,
                    teams: [
                        { name: winner, team: winnerTeam, league: league },
                        { name: loser, team: loserTeam, league: league }
                    ]
                });
            }
        });
        
        return blowouts
            .sort((a, b) => b.diff - a.diff)
            .slice(0, limit);
    }

    // Самые результативные матчи
    getHighestScoringGames(games, league, limit = 5) {
        const highScoring = [];
        
        games.forEach(game => {
            if (game && game.scoreHome !== null && game.scoreAway !== null) {
                // Пропускаем технические победы
                if ((game.scoreHome === 20 && game.scoreAway === 0) || 
                    (game.scoreHome === 0 && game.scoreAway === 20)) {
                    return;
                }
                
                const total = game.scoreHome + game.scoreAway;
                
                // Получаем объекты обеих команд
                const homeTeam = this.dataManager.getTeamByName(game.teamHome, league);
                const awayTeam = this.dataManager.getTeamByName(game.teamAway, league);
                
                highScoring.push({
                    ...game,
                    total: total,
                    homeTeam: game.teamHome,
                    awayTeam: game.teamAway,
                    homeScore: game.scoreHome,
                    awayScore: game.scoreAway,
                    homeTeamObj: homeTeam,
                    awayTeamObj: awayTeam,
                    displayValue: `${game.scoreHome}:${game.scoreAway} (${total} очков)`,
                    details: `${game.teamHome} ${game.scoreHome} - ${game.scoreAway} ${game.teamAway}`,
                    date: game._fullDate,
                    league: league,
                    teams: [
                        { name: game.teamHome, team: homeTeam, league: league },
                        { name: game.teamAway, team: awayTeam, league: league }
                    ]
                });
            }
        });
        
        return highScoring
            .sort((a, b) => b.total - a.total)
            .slice(0, limit);
    }

    // Лучшая защита в одном матче (команда, которая меньше всех пропустила)
    getBestSingleDefense(games, league, limit = 5) {
        const bestDefense = [];
        
        games.forEach(game => {
            if (game && game.scoreHome !== null && game.scoreAway !== null) {
                // Пропускаем технические победы
                if ((game.scoreHome === 20 && game.scoreAway === 0) || 
                    (game.scoreHome === 0 && game.scoreAway === 20)) {
                    return;
                }
                
                const conceded = Math.min(game.scoreHome, game.scoreAway);
                const defender = game.scoreHome < game.scoreAway ? game.teamHome : game.teamAway;
                const opponent = game.scoreHome < game.scoreAway ? game.teamAway : game.teamHome;
                const opponentScore = Math.max(game.scoreHome, game.scoreAway);
                const defenderScore = conceded;
                
                const defenderTeam = this.dataManager.getTeamByName(defender, league);
                const opponentTeam = this.dataManager.getTeamByName(opponent, league);
                
                bestDefense.push({
                    ...game,
                    conceded: conceded,
                    defender: defender,
                    opponent: opponent,
                    defenderScore: defenderScore,
                    opponentScore: opponentScore,
                    defenderTeam: defenderTeam,
                    opponentTeam: opponentTeam,
                    displayValue: `${defender} пропустил ${conceded} (vs ${opponent} - ${opponentScore})`,
                    shortDisplay: `${conceded} проп.`,
                    details: `${defender} ${defenderScore} - ${opponentScore} ${opponent}`,
                    date: game._fullDate,
                    teamName: defender,
                    team: defenderTeam,
                    league: league,
                    teams: [
                        { name: defender, team: defenderTeam, league: league },
                        { name: opponent, team: opponentTeam, league: league }
                    ]
                });
            }
        });
        
        return bestDefense
            .sort((a, b) => a.conceded - b.conceded)
            .slice(0, limit);
    }

    // Расчет победных серий
    getWinStreaks(games, league, teams, limit = 5) {
        const streaks = [];
        
        teams.forEach(team => {
            const teamGames = games
                .filter(game => 
                    game && (
                        this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(team.teamName) ||
                        this.dataManager.normalizeTeamName(game.teamAway) === this.dataManager.normalizeTeamName(team.teamName)
                    )
                )
                .sort((a, b) => a._fullDate - b._fullDate);
            
            let currentStreak = 0;
            let maxStreak = 0;
            
            teamGames.forEach(game => {
                const isHome = this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(team.teamName);
                const isWin = isHome ? game.scoreHome > game.scoreAway : game.scoreAway > game.scoreHome;
                
                if (isWin) {
                    currentStreak++;
                    maxStreak = Math.max(maxStreak, currentStreak);
                } else {
                    currentStreak = 0;
                }
            });
            
            if (maxStreak > 0) {
                streaks.push({
                    ...team,
                    streak: maxStreak,
                    value: maxStreak, // Добавляем поле value для единообразия
                    displayValue: `${maxStreak} ${this.getPluralFormStreak(maxStreak)} подряд`
                });
            }
        });
        
        return streaks
            .sort((a, b) => b.streak - a.streak)
            .slice(0, limit);
    }

    // Текущие горячие серии
    getHotStreaks(games, league, teams) {
        const hotStreaks = [];
        
        teams.forEach(team => {
            const teamGames = games
                .filter(game => 
                    game && (
                        this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(team.teamName) ||
                        this.dataManager.normalizeTeamName(game.teamAway) === this.dataManager.normalizeTeamName(team.teamName)
                    )
                )
                .sort((a, b) => b._fullDate - a._fullDate)
                .slice(0, 5); // Последние 5 игр
            
            if (teamGames.length === 0) return;
            
            let currentStreak = 0;
            let streakType = null;
            
            for (let i = 0; i < teamGames.length; i++) {
                const game = teamGames[i];
                if (!game) continue;
                
                const isHome = this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(team.teamName);
                const isWin = isHome ? game.scoreHome > game.scoreAway : game.scoreAway > game.scoreHome;
                
                if (i === 0) {
                    streakType = isWin ? 'win' : 'loss';
                    currentStreak = 1;
                } else {
                    const prevGame = teamGames[i-1];
                    if (!prevGame) continue;
                    
                    const prevIsHome = this.dataManager.normalizeTeamName(prevGame.teamHome) === this.dataManager.normalizeTeamName(team.teamName);
                    const prevIsWin = prevIsHome ? prevGame.scoreHome > prevGame.scoreAway : prevGame.scoreAway > prevGame.scoreHome;
                    
                    if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin)) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
            
            if (currentStreak >= 2 && streakType === 'win') {
                hotStreaks.push({
                    ...team,
                    streak: currentStreak,
                    streakType: 'win',
                    displayValue: `${currentStreak} ${this.getPluralFormStreak(currentStreak)} подряд`,
                    icon: '🔥'
                });
            }
        });
        
        return hotStreaks
            .sort((a, b) => b.streak - a.streak)
            .slice(0, 3);
    }

    // Рендер основной сетки статистики
    renderMainStats(stats) {
        const container = document.getElementById('top-stats-grid');
        if (!container) return;

        const cards = [
            {
                title: 'Самая результативная',
                emoji: '🏀',
                color: '#0055a5',
                data: stats.bestOffense,
                unit: 'очков/игру',
                valueKey: 'avgScored',
                type: 'team'
            },
            {
                title: 'Лучшая защита',
                emoji: '🛡️',
                color: '#28a745',
                data: stats.bestDefense,
                unit: 'проп/игру',
                valueKey: 'avgConceded',
                type: 'team'
            },
            {
                title: 'Лучшая разница',
                emoji: '📈',
                color: '#dc3545',
                data: stats.bestDiff,
                unit: '± за игру',
                valueKey: 'avgDiff',
                type: 'team'
            },
            {
                title: 'Победные серии',
                emoji: '⚡',
                color: '#ffc107',
                data: stats.winStreaks,
                unit: '',
                valueKey: 'streak',
                type: 'team',
                customDisplay: (item) => item.displayValue,
                listDisplay: (item) => item.displayValue // Добавляем это поле
            },
            {
                title: 'Крупнейшие победы',
                emoji: '💪',
                color: '#6f42c1',
                data: stats.biggestWin,
                unit: '',
                valueKey: 'diff',
                type: 'game',
                customDisplay: (item) => {
                    return `
                        <div class="match-teams-display">
                            <div class="match-teams-row winner">
                                <span class="match-team">🏆 ${item.winner}</span>
                                <span class="match-score">${item.winnerScore}</span>
                            </div>
                            <div class="match-teams-row loser">
                                <span class="match-team">${item.loser}</span>
                                <span class="match-score">${item.loserScore}</span>
                            </div>
                            <div class="match-total">Разница: +${item.diff}</div>
                        </div>
                    `;
                },
                listDisplay: (item) => {
                    return `${item.winner} ${item.winnerScore} - ${item.loserScore} ${item.loser} (+${item.diff})`;
                }
            },
            {
                title: 'Результативные матчи',
                emoji: '🎯',
                color: '#fd7e14',
                data: stats.highestScoring,
                unit: '',
                valueKey: 'total',
                type: 'game',
                customDisplay: (item) => {
                    return `
                        <div class="match-teams-display">
                            <div class="match-teams-row">
                                <span class="match-team">${item.homeTeam}</span>
                                <span class="match-score">${item.homeScore}</span>
                            </div>
                            <div class="match-teams-row">
                                <span class="match-team">${item.awayTeam}</span>
                                <span class="match-score">${item.awayScore}</span>
                            </div>
                            <div class="match-total">Всего: ${item.total} очков</div>
                        </div>
                    `;
                },
                listDisplay: (item) => {
                    return `${item.homeTeam} ${item.homeScore} - ${item.awayScore} ${item.awayTeam} (${item.total} очков)`;
                }
            },
            {
                title: 'Сухая защита',
                emoji: '🔒',
                color: '#17a2b8',
                data: stats.bestSingleDefense,
                unit: '',
                valueKey: 'conceded',
                type: 'game',
                customDisplay: (item) => {
                    return `
                        <div class="match-teams-display">
                            <div class="match-teams-row defender">
                                <span class="match-team">🛡️ ${item.defender}</span>
                                <span class="match-score">${item.defenderScore}</span>
                            </div>
                            <div class="match-teams-row opponent">
                                <span class="match-team">${item.opponent}</span>
                                <span class="match-score">${item.opponentScore}</span>
                            </div>
                            <div class="match-total">Пропущено: ${item.conceded}</div>
                        </div>
                    `;
                },
                listDisplay: (item) => {
                    return `${item.defender} ${item.defenderScore} - ${item.opponentScore} ${item.opponent} (проп. ${item.conceded})`;
                }
            }
        ];

        let html = '';
        
        cards.forEach(card => {
            html += this.renderStatCard(card);
        });

        container.innerHTML = html;
        
        // Добавляем обработчики кликов
        this.setupClickHandlers();
    }

    // Рендер одной карточки статистики
    renderStatCard(card) {
        if (!card.data || card.data.length === 0) {
            return `
                <div class="top-stat-card">
                    <div class="stat-card-header" style="--header-color: ${card.color}; --header-color-light: ${this.lightenColor(card.color, 20)};">
                        <h3>
                            <span class="stat-emoji">${card.emoji}</span>
                            ${card.title}
                        </h3>
                        ${this.getTechWinIndicator(card.title)}
                    </div>
                    <div class="stat-card-body">
                        <div class="no-data">Нет данных</div>
                    </div>
                </div>
            `;
        }

        const topItem = card.data[0];
        
        return `
            <div class="top-stat-card" data-stat-type="${card.title}" data-stat-data='${this.escapeJson(JSON.stringify(card.data))}'>
                <div class="stat-card-header" style="--header-color: ${card.color}; --header-color-light: ${this.lightenColor(card.color, 20)};">
                    <h3>
                        <span class="stat-emoji">${card.emoji}</span>
                        ${card.title}
                    </h3>
                    ${this.getTechWinIndicator(card.title)}
                </div>
                <div class="stat-card-body">
                    <!-- Топ элемент -->
                    ${card.type === 'team' ? this.renderTopTeam(topItem, card) : this.renderTopGame(topItem, card)}
                <!-- Список остальных -->
                <div class="top-teams-list">
                    ${card.data.slice(1).map(item => {
                        if (card.type === 'game') {
                            return `
                                <div class="top-list-item game-list-item" 
                                     data-game='${this.escapeJson(JSON.stringify(item))}'
                                     data-league="${item.league}">
                                    <span class="list-item-name game-name">${card.listDisplay ? card.listDisplay(item) : item.displayValue}</span>
                                </div>
                            `;
                        } else {
                            const teamLogo = item.team && item.team.logo 
                                ? item.team.logo 
                                : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
                            
                            // Для карточки "Победные серии" используем специальное отображение
                            let displayValue = '';
                            if (card.title === 'Победные серии') {
                                displayValue = item.displayValue || `${item.streak} ${this.getPluralFormStreak(item.streak)}`;
                            } else {
                                displayValue = card.listDisplay ? card.listDisplay(item) : (item.value || '0');
                            }
                            
                            return `
                                <div class="top-list-item" data-team-name="${item.teamName}" data-league="${item.league || 'A'}">
                                    <img src="${teamLogo}" alt="${item.teamName}" class="list-item-logo" onerror="this.onImageError(this)">
                                    <span class="list-item-name">${item.teamName}</span>
                                    <span class="list-item-value">
                                        ${displayValue}
                                        ${card.unit && card.title !== 'Победные серии' ? ` ${card.unit}` : ''}
                                    </span>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
                </div>
            </div>
        `;
    }

    // Рендер топ команды
    renderTopTeam(item, card) {
        const teamLogo = item.team && item.team.logo 
            ? item.team.logo 
            : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
        
        return `
            <div class="top-team" data-team-name="${item.teamName}" data-league="${item.league || 'A'}">
                <img src="${teamLogo}" alt="${item.teamName}" class="top-team-logo" onerror="this.onImageError(this)">
                <div class="top-team-info">
                    <div class="top-team-name">${item.teamName}</div>
                    <div class="top-team-value">
                        ${card.customDisplay ? card.customDisplay(item) : (item.value || '0')}
                        ${card.unit ? `<span class="value-unit">${card.unit}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // Рендер топ игры
    renderTopGame(item, card) {
        return `
            <div class="top-game" data-game='${this.escapeJson(JSON.stringify(item))}' data-league="${item.league}">
                ${card.customDisplay ? card.customDisplay(item) : item.displayValue}
            </div>
        `;
    }

    // Индикатор учета технических побед
    getTechWinIndicator(cardTitle) {
        // Категории, где НЕ учитываются техпобеды
        const noTechCategories = [
            'Самая результативная',
            'Лучшая защита',
            'Лучшая разница',
            'Крупнейшие победы',
            'Результативные матчи',
            'Сухая защита'
        ];
        
        // Категории, где УЧИТЫВАЮТСЯ техпобеды
        const techCategories = [
            'Победные серии'
        ];
        
        if (noTechCategories.includes(cardTitle)) {
            return `<span class="tech-indicator no-tech" title="Технические победы (20:0) не учитываются">⚖️❌</span>`;
        } else if (techCategories.includes(cardTitle)) {
            return `<span class="tech-indicator with-tech" title="Технические победы (20:0) учитываются">⚖️✓</span>`;
        }
        return '';
    }

    // Настройка обработчиков кликов
    setupClickHandlers() {
        // Клик по топ команде
        document.querySelectorAll('.top-team').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const teamName = el.dataset.teamName;
                const league = el.dataset.league;
                if (window.basketballUI && teamName) {
                    window.basketballUI.showTeamModal(teamName, league);
                }
            });
        });

        // Клик по топ игре
        document.querySelectorAll('.top-game').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const gameData = JSON.parse(el.dataset.game);
                    if (window.homePage && window.homePage.matchesRenderer) {
                        window.homePage.matchesRenderer.showMatchDetailsModal(gameData, gameData.league);
                    }
                } catch (error) {
                    console.error('Error parsing game data:', error);
                }
            });
        });

        // Клик по элементу списка команд
        document.querySelectorAll('.top-list-item:not([data-game])').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const teamName = el.dataset.teamName;
                const league = el.dataset.league;
                if (window.basketballUI && teamName) {
                    window.basketballUI.showTeamModal(teamName, league);
                }
            });
        });

        // Клик по элементу списка игр
        document.querySelectorAll('.top-list-item[data-game]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const gameData = JSON.parse(el.dataset.game);
                    if (window.homePage && window.homePage.matchesRenderer) {
                        window.homePage.matchesRenderer.showMatchDetailsModal(gameData, gameData.league);
                    }
                } catch (error) {
                    console.error('Error parsing game data:', error);
                }
            });
        });

        // Клик по карточке для показа деталей
        document.querySelectorAll('.top-stat-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Не открываем модалку если кликнули на команду или игру (уже обработано)
                if (e.target.closest('.top-team') || e.target.closest('.top-game') || e.target.closest('.top-list-item')) {
                    return;
                }
                
                const statType = card.dataset.statType;
                if (statType && card.dataset.statData) {
                    try {
                        const statData = JSON.parse(card.dataset.statData);
                        this.showStatDetailsModal(statType, statData);
                    } catch (error) {
                        console.error('Error parsing stat data:', error);
                    }
                }
            });
        });
    }

    // Показ модального окна с деталями
    showStatDetailsModal(statType, data) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'top-stats-modal';
        
        let html = `
            <div class="modal-content top-stats-modal">
                <div class="modal-header">
                    <h3>${statType}</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="top-stats-detail">
                        <div class="top-stats-detail-list">
        `;

        data.forEach((item, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            
            // Определяем, это команда или игра
            if (item.teamName && !item.homeTeam) {
                // Это команда
                const teamLogo = item.team && item.team.logo 
                    ? item.team.logo 
                    : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
                
                html += `
                    <div class="top-stats-detail-item" data-team-name="${item.teamName}" data-league="${item.league || 'A'}">
                        <span class="detail-rank">${medal}</span>
                        <img src="${teamLogo}" alt="${item.teamName}" class="detail-item-logo" onerror="this.onImageError(this)">
                        <div class="detail-item-info">
                            <div class="detail-item-name">${item.teamName}</div>
                            ${item.displayValue ? `
                                <div class="detail-item-meta">${item.displayValue}</div>
                            ` : ''}
                        </div>
                        <div class="detail-item-value">
                            ${item.value || item.streak || ''}
                            ${item.avgScored ? ' очков' : ''}
                            ${item.avgConceded ? ' проп' : ''}
                        </div>
                    </div>
                `;
            } else {
                // Это игра
                const gameDisplay = item.details || `${item.homeTeam || item.winner || item.defender} - ${item.awayTeam || item.loser || item.opponent}`;
                
                html += `
                    <div class="top-stats-detail-item game-detail-item" data-game='${this.escapeJson(JSON.stringify(item))}' data-league="${item.league}">
                        <span class="detail-rank">${medal}</span>
                        <div class="detail-item-info game-info">
                            <div class="detail-item-name">${gameDisplay}</div>
                            <div class="detail-item-meta">${item.date ? new Date(item.date).toLocaleDateString('ru-RU') : ''}</div>
                        </div>
                        <div class="detail-item-value">
                            ${item.total ? item.total + ' очков' : ''}
                            ${item.diff ? '+' + item.diff : ''}
                            ${item.conceded ? item.conceded + ' проп' : ''}
                        </div>
                    </div>
                `;
            }
        });

        html += `
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.innerHTML = html;
        document.body.appendChild(modal);
        modal.style.display = 'block';

        // Обработчики закрытия
        const closeBtn = modal.querySelector('.close');
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            setTimeout(() => document.body.removeChild(modal), 300);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                setTimeout(() => document.body.removeChild(modal), 300);
            }
        });

        // Обработчики кликов по командам в модалке
        modal.querySelectorAll('.top-stats-detail-item[data-team-name]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const teamName = item.dataset.teamName;
                const league = item.dataset.league;
                if (teamName) {
                    modal.style.display = 'none';
                    setTimeout(() => {
                        document.body.removeChild(modal);
                        if (window.basketballUI) {
                            window.basketballUI.showTeamModal(teamName, league);
                        }
                    }, 300);
                }
            });
        });

        // Обработчики кликов по играм в модалке
        modal.querySelectorAll('.top-stats-detail-item[data-game]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                try {
                    const gameData = JSON.parse(item.dataset.game);
                    modal.style.display = 'none';
                    setTimeout(() => {
                        document.body.removeChild(modal);
                        if (window.homePage && window.homePage.matchesRenderer) {
                            window.homePage.matchesRenderer.showMatchDetailsModal(gameData, gameData.league);
                        }
                    }, 300);
                } catch (error) {
                    console.error('Error parsing game data:', error);
                }
            });
        });
    }

    // Вспомогательные методы
    lightenColor(color, percent) {
        if (!color || !color.startsWith('#')) return '#0055a5';
        
        try {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            return '#' + (
                0x1000000 +
                (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                (B < 255 ? B < 1 ? 0 : B : 255)
            ).toString(16).slice(1);
        } catch (error) {
            return color;
        }
    }

    getPluralFormStreak(count) {
        if (typeof BasketballUtils !== 'undefined' && BasketballUtils.getPluralForm) {
            return BasketballUtils.getPluralForm(count, ['победа', 'победы', 'побед']);
        }
        
        // Fallback
        const lastTwo = Math.abs(count) % 100;
        const lastOne = lastTwo % 10;
        
        if (lastTwo >= 11 && lastTwo <= 19) return 'побед';
        if (lastOne === 1) return 'победа';
        if (lastOne >= 2 && lastOne <= 4) return 'победы';
        return 'побед';
    }

    escapeJson(json) {
        return json.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
    }

    onImageError(img) {
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
        img.onerror = null;
    }
}