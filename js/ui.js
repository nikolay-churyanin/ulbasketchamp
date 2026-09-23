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
            const leagues = this.dataManager.getLeagueIds();
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

        title.textContent = this.dataManager.getLeaguesForTeam(team.name).length > 1
            ? `${team.name} · ${this.dataManager.getLeagueName(league)}`
            : team.name;

        const games = this.dataManager.getGamesByTeam(team.name, league);
        const completedGames = games.filter(game => game.scoreHome !== null && game.scoreAway !== null);
        const wins = completedGames.filter(game => {
            const isHome = this.dataManager.normalizeTeamName(game.teamHome) === this.dataManager.normalizeTeamName(team.name);
            return isHome ? game.scoreHome > game.scoreAway : game.scoreAway > game.scoreHome;
        }).length;
        const losses = completedGames.length - wins;

        const placeholderLogo = BasketballUtils.placeholderLogo;
        const gamesHtml = games.length > 0
            ? games.map(game => this.renderTeamGameItem(game, team, league, placeholderLogo)).join('')
            : '<p class="no-games-message">Матчей не найдено</p>';

        let html = `
            <div class="team-info-header">
                <div class="team-logo-container">
                    <img src="${BasketballUtils.resolveTeamLogo(team.logo)}" alt="${team.name}" class="team-info-logo" onerror="this.src='${placeholderLogo}'">
                </div>
                <div class="team-info-details">
                    <h2>${team.name}</h2>
                    <div class="team-meta-info">
                        <div class="meta-item">
                            <span class="meta-label">Город</span>
                            <span class="meta-value">${team.city || 'Не указан'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Лига</span>
                            <span class="meta-value">${this.dataManager.getLeagueName(league)}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Рекорд</span>
                            <span class="meta-value record-value">${wins}–${losses}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Сыграно</span>
                            <span class="meta-value">${completedGames.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="team-section">
                <h3 class="team-section-title">Матчи команды</h3>
                <div class="team-games-list">${gamesHtml}</div>
            </div>
        `;

        body.innerHTML = html;
        modal.style.display = 'block';
        
        // Добавляем обработчики кликов по карточкам матчей
        setTimeout(() => {
            const gameItems = body.querySelectorAll('.team-game-item');
            gameItems.forEach(item => {
                item.addEventListener('click', async (e) => {
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

    renderTeamGameItem(game, team, league, placeholderLogo) {
        const hasScore = game.scoreHome !== null && game.scoreAway !== null;
        const currentName = this.dataManager.normalizeTeamName(team.name);
        const isTeamA = this.dataManager.normalizeTeamName(game.teamHome) === currentName;
        const isTeamB = this.dataManager.normalizeTeamName(game.teamAway) === currentName;
        const teamA = this.dataManager.getTeamByName(game.teamHome, league);
        const teamB = this.dataManager.getTeamByName(game.teamAway, league);
        const logoA = teamA?.logo || placeholderLogo;
        const logoB = teamB?.logo || placeholderLogo;
        const isPlayoff = game.gameType === 'playoff';
        let resultClass = '';
        let statusText = isPlayoff ? 'Плей-офф' : 'Анонс';
        let statusClass = 'status-upcoming';
        if (hasScore) {
            const currentWon = (isTeamA && game.scoreHome > game.scoreAway)
                || (isTeamB && game.scoreAway > game.scoreHome);
            const currentLost = (isTeamA && game.scoreHome < game.scoreAway)
                || (isTeamB && game.scoreAway < game.scoreHome);
            if (currentWon) {
                resultClass = 'is-win';
                statusText = 'Победа';
                statusClass = 'status-win';
            } else if (currentLost) {
                resultClass = 'is-loss';
                statusText = 'Поражение';
                statusClass = 'status-loss';
            } else {
                statusText = 'Ничья';
                statusClass = 'status-finished';
            }
        }

        const typeBadge = isPlayoff && hasScore ? '<span class="team-game-type">Плей-офф</span>' : '';

        return `
            <div class="team-game-item ${resultClass}" data-game-id="${game.id}" data-league="${game.league || league}">
                <div class="team-game-top">
                    <div class="team-game-when">
                        <span class="team-game-date">${this.formatDate(game._fullDate)}</span>
                        ${game.time ? `<span class="team-game-time">${game.time}</span>` : ''}
                    </div>
                    <div class="team-game-badges">
                        ${typeBadge}
                        <span class="game-status ${statusClass}">${statusText}</span>
                    </div>
                </div>
                <div class="team-game-main">
                    <div class="team-game-side${isTeamA ? ' is-current' : ''}">
                        <img src="${logoA}" alt="${game.teamHome}" class="team-game-logo" onerror="this.src='${placeholderLogo}'">
                        <span class="team-game-name">${game.teamHome}</span>
                    </div>
                    <div class="team-game-score">
                        ${hasScore
                            ? `<span>${game.scoreHome}</span>
                               <span class="score-separator">:</span>
                               <span>${game.scoreAway}</span>`
                            : '<span class="no-score">VS</span>'}
                    </div>
                    <div class="team-game-side team-game-side-right${isTeamB ? ' is-current' : ''}">
                        <span class="team-game-name">${game.teamAway}</span>
                        <img src="${logoB}" alt="${game.teamAway}" class="team-game-logo" onerror="this.src='${placeholderLogo}'">
                    </div>
                </div>
            </div>
        `;
    }

    formatDate(date) {
        if (!date || isNaN(date.getTime())) {
            return 'Дата не указана';
        }
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // UI будет инициализирован после загрузки данных в home.js
    console.log('UI module loaded');
});