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
            
            const topTeams = standings.slice(0, 3);
            
            // Проверяем наличие превью
            const hasPreview = await this.dataManager.hasPreviewFile(league.id);
            
            html += `
                <div class="league-card">
                    <div class="league-card-header ${league.color}">
                        <h3>${league.icon} ${league.name}</h3>
                        <p>${teams.length} команд • ${totalGames} ${this.getPluralFormMatch(totalGames)} ${this.getPluralFormPlayed(totalGames)}</p>
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
                        
                        ${hasPreview ? `
                            <button class="playoff-preview-btn" onclick="window.homePage.showPlayoffPreview('${league.id}')">
                                <span class="preview-icon">🔮</span>
                                Превью плей-офф
                            </button>
                        ` : ''}
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

    async showPlayoffPreview(league) {
        try {
            // Показываем загрузку
            const modal = new SimpleModal();
            modal.show('Загрузка...', '<div style="padding: 40px; text-align: center;">Загружаем превью...</div>');
            
            // Загружаем превью
            const previewText = await this.dataManager.loadPlayoffPreview(league);
            const leagueName = this.dataManager.getLeagueName(league);
            
            // Конвертируем Markdown в HTML с сохранением форматирования
            const htmlContent = this.convertMarkdownToHTML(previewText);
            
            // Обновляем модальное окно
            const fullContent = `
                <div style="padding: 30px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <div style="font-size: 3rem; margin-bottom: 10px;">🔮</div>
                        <h2 style="margin: 0 0 5px 0; color: #2c3e50;">${leagueName}</h2>
                        <div style="color: #7f8c8d; font-size: 0.9rem;">Прогноз и анализ плей-офф</div>
                    </div>
                    <div style="line-height: 1.7; color: #333; font-size: 1rem;">
                        ${htmlContent}
                    </div>
                </div>
            `;
            
            modal.show('Превью плей-офф', fullContent);
            
        } catch (error) {
            console.error('Error loading playoff preview:', error);
            
            // Показываем ошибку
            const modal = new SimpleModal();
            const errorContent = `
                <div style="padding: 40px; text-align: center;">
                    <div style="font-size: 3rem; color: #e74c3c; margin-bottom: 20px;">⚠️</div>
                    <h3 style="color: #2c3e50; margin-bottom: 10px;">Не удалось загрузить превью</h3>
                    <p style="color: #6c757d;">Попробуйте обновить страницу позже</p>
                    <button onclick="window.location.reload()" style="
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 6px;
                        cursor: pointer;
                        margin-top: 20px;
                        font-size: 1rem;
                    ">Обновить страницу</button>
                </div>
            `;
            
            modal.show('Ошибка', errorContent);
        }
    }
    
    convertMarkdownToHTML(markdown) {
        if (!markdown) return '<p>Нет данных</p>';
        
        // 1. Сначала обрабатываем таблицы
        let html = this.convertSimpleMarkdownTables(markdown);
        
        // 2. Разделяем на строки для обработки
        const lines = html.split('\n');
        let result = [];
        let inParagraph = false;
        let currentParagraph = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            
            // Пропускаем пустые строки
            if (!line) {
                if (inParagraph && currentParagraph.length > 0) {
                    // Завершаем текущий параграф
                    const paragraphText = currentParagraph.join(' ');
                    result.push(`<p style="margin-bottom: 1em; line-height: 1.6;">${paragraphText}</p>`);
                    inParagraph = false;
                    currentParagraph = [];
                }
                continue;
            }
            
            // Проверяем, является ли строка HTML-тегом (таблица, заголовок, список и т.д.)
            const isHtmlTag = line.startsWith('<');
            const isHeading = line.startsWith('<h');
            const isList = line.startsWith('<ul') || line.startsWith('<li') || line.includes('</ul>');
            const isTable = line.includes('<table') || line.includes('</table>') || 
                           line.includes('<tr') || line.includes('<td') || line.includes('<th');
            
            if (isHtmlTag || isHeading || isList || isTable) {
                // Если у нас был незакрытый параграф, закрываем его
                if (inParagraph && currentParagraph.length > 0) {
                    const paragraphText = currentParagraph.join(' ');
                    result.push(`<p style="margin-bottom: 1em; line-height: 1.6;">${paragraphText}</p>`);
                    inParagraph = false;
                    currentParagraph = [];
                }
                // Добавляем HTML-тег как есть
                result.push(line);
            } 
            // Проверяем, начинается ли список
            else if (line.startsWith('- ') || line.match(/^\d+\./)) {
                // Завершаем текущий параграф если есть
                if (inParagraph && currentParagraph.length > 0) {
                    const paragraphText = currentParagraph.join(' ');
                    result.push(`<p style="margin-bottom: 1em; line-height: 1.6;">${paragraphText}</p>`);
                    inParagraph = false;
                    currentParagraph = [];
                }
                
                // Собираем все элементы списка
                let listItems = [];
                while (i < lines.length && (lines[i].startsWith('- ') || lines[i].match(/^\d+\./))) {
                    let itemText = lines[i].trim();
                    // Убираем маркер списка
                    if (itemText.startsWith('- ')) {
                        itemText = itemText.substring(2);
                    } else if (itemText.match(/^\d+\./)) {
                        itemText = itemText.replace(/^\d+\.\s*/, '');
                    }
                    
                    // Применяем inline-форматирование к элементу списка
                    itemText = this.applyInlineFormatting(itemText);
                    listItems.push(`<li style="margin-bottom: 0.3em;">${itemText}</li>`);
                    i++;
                }
                i--; // Возвращаемся на одну строку назад
                
                if (listItems.length > 0) {
                    result.push(`<ul style="margin: 1em 0 1em 1.5em; padding: 0; list-style-type: disc;">${listItems.join('')}</ul>`);
                }
            }
            // Проверяем заголовки
            else if (line.startsWith('### ')) {
                if (inParagraph && currentParagraph.length > 0) {
                    const paragraphText = currentParagraph.join(' ');
                    result.push(`<p style="margin-bottom: 1em; line-height: 1.6;">${paragraphText}</p>`);
                    inParagraph = false;
                    currentParagraph = [];
                }
                const headingText = line.substring(4);
                const formattedHeading = this.applyInlineFormatting(headingText);
                result.push(`<h3 style="color: #16a085; margin: 1.5em 0 0.8em 0; font-size: 1.2rem;">${formattedHeading}</h3>`);
            }
            else if (line.startsWith('## ')) {
                if (inParagraph && currentParagraph.length > 0) {
                    const paragraphText = currentParagraph.join(' ');
                    result.push(`<p style="margin-bottom: 1em; line-height: 1.6;">${paragraphText}</p>`);
                    inParagraph = false;
                    currentParagraph = [];
                }
                const headingText = line.substring(3);
                const formattedHeading = this.applyInlineFormatting(headingText);
                result.push(`<h2 style="color: #2980b9; margin: 1.8em 0 1em 0; font-size: 1.4rem;">${formattedHeading}</h2>`);
            }
            else if (line.startsWith('# ')) {
                if (inParagraph && currentParagraph.length > 0) {
                    const paragraphText = currentParagraph.join(' ');
                    result.push(`<p style="margin-bottom: 1em; line-height: 1.6;">${paragraphText}</p>`);
                    inParagraph = false;
                    currentParagraph = [];
                }
                const headingText = line.substring(2);
                const formattedHeading = this.applyInlineFormatting(headingText);
                result.push(`<h1 style="color: #2c3e50; margin: 2em 0 1.2em 0; padding-bottom: 10px; border-bottom: 2px solid #3498db; font-size: 1.6rem;">${formattedHeading}</h1>`);
            }
            // Обычный текст
            else {
                if (!inParagraph) {
                    inParagraph = true;
                }
                currentParagraph.push(line);
            }
        }
        
        // Обрабатываем последний параграф если есть
        if (inParagraph && currentParagraph.length > 0) {
            const paragraphText = currentParagraph.join(' ');
            result.push(`<p style="margin-bottom: 1em; line-height: 1.6;">${paragraphText}</p>`);
        }
        
        // Применяем inline-форматирование ко всему результату (кроме уже отформатированных частей)
        return this.applyInlineFormattingToResult(result.join('\n'));
    }

    // Применяем форматирование к уже готовому HTML
    applyInlineFormattingToResult(html) {
        // Находим все текстовые блоки, которые не содержат HTML тегов
        // Ищем позиции между тегами
        let result = '';
        let lastIndex = 0;
        const tagRegex = /<[^>]+>/g;
        let match;
        
        while ((match = tagRegex.exec(html)) !== null) {
            // Текст перед тегом
            const textBefore = html.substring(lastIndex, match.index);
            if (textBefore) {
                result += this.applyInlineFormatting(textBefore);
            }
            
            // Сам тег
            result += match[0];
            
            lastIndex = match.index + match[0].length;
        }
        
        // Оставшийся текст
        const remainingText = html.substring(lastIndex);
        if (remainingText) {
            result += this.applyInlineFormatting(remainingText);
        }
        
        return result || this.applyInlineFormatting(html);
    }

    // Метод для применения inline-форматирования (жирный, курсив)
    applyInlineFormatting(text) {
        if (!text) return text;
        
        // Заменяем **жирный** на <strong>
        let result = text.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #e74c3c; font-weight: 600;">$1</strong>');
        
        // Заменяем *курсив* на <em>
        result = result.replace(/\*(.*?)\*/g, '<em style="color: #9b59b6; font-style: italic;">$1</em>');
        
        return result;
    }

    // Остальные методы оставляем как есть
    convertSimpleMarkdownTables(markdown) {
        const lines = markdown.split('\n');
        let result = [];
        let inTable = false;
        let tableLines = [];
        let currentLineIndex = 0;
        
        while (currentLineIndex < lines.length) {
            let line = lines[currentLineIndex].trim();
            
            // Ищем начало таблицы: строка с | и следующая строка с разделителем
            if (!inTable && line.includes('|') && 
                currentLineIndex + 1 < lines.length && 
                lines[currentLineIndex + 1].trim().includes('|')) {
                
                const nextLine = lines[currentLineIndex + 1].trim();
                // Проверяем, является ли следующая строка разделителем таблицы
                if (nextLine.includes('---') || nextLine.includes(':|') || nextLine.includes('|:')) {
                    inTable = true;
                    tableLines = [line];
                    currentLineIndex++;
                    continue;
                }
            }
            
            if (inTable) {
                tableLines.push(line);
                
                // Проверяем, закончилась ли таблица
                const nextLineIndex = currentLineIndex + 1;
                if (nextLineIndex >= lines.length || 
                    !lines[nextLineIndex].trim() || 
                    (!lines[nextLineIndex].trim().includes('|') && 
                     !lines[nextLineIndex].trim().startsWith('|'))) {
                    
                    // Конвертируем таблицу
                    result.push(this.buildHTMLTable(tableLines));
                    inTable = false;
                    tableLines = [];
                }
            } else {
                // Не таблица, добавляем как есть
                result.push(line);
            }
            
            currentLineIndex++;
        }
        
        // Обрабатываем последнюю таблицу если осталась
        if (inTable && tableLines.length > 0) {
            result.push(this.buildHTMLTable(tableLines));
        }
        
        return result.join('\n');
    }

    buildHTMLTable(tableLines) {
        if (tableLines.length < 2) return tableLines.join('\n');
        
        // Убираем пустые строки
        tableLines = tableLines.filter(line => line.trim());
        
        let html = '<div style="margin: 1em 0; overflow-x: auto;">';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; border: 1px solid #dee2e6;">';
        
        // Определяем выравнивание
        const alignments = [];
        if (tableLines.length > 1) {
            const separatorLine = tableLines[1];
            const separatorCells = separatorLine.split('|').filter(cell => cell.trim() !== '');
            
            separatorCells.forEach(cell => {
                const trimmed = cell.trim();
                if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
                    alignments.push('center');
                } else if (trimmed.endsWith(':')) {
                    alignments.push('right');
                } else if (trimmed.startsWith(':')) {
                    alignments.push('left');
                } else {
                    alignments.push('left');
                }
            });
        }
        
        // Заголовок таблицы
        const headerLine = tableLines[0];
        const headerCells = headerLine.split('|').filter(cell => cell.trim() !== '');
        
        html += '<thead><tr style="background-color: #f8f9fa;">';
        headerCells.forEach((cell, index) => {
            const align = alignments[index] || 'left';
            const formattedCell = this.applyInlineFormatting(cell.trim());
            html += `<th style="padding: 10px 12px; border: 1px solid #dee2e6; text-align: ${align}; font-weight: 600; border-bottom: 2px solid #3498db;">${formattedCell}</th>`;
        });
        html += '</tr></thead>';
        
        // Тело таблицы
        html += '<tbody>';
        
        for (let i = 2; i < tableLines.length; i++) {
            const line = tableLines[i].trim();
            if (!line || !line.includes('|')) continue;
            
            const cells = line.split('|').filter(cell => cell.trim() !== '');
            html += '<tr>';
            
            cells.forEach((cell, index) => {
                const align = alignments[index] || 'left';
                const isEvenRow = (i - 2) % 2 === 0;
                const bgColor = isEvenRow ? '#ffffff' : '#f9f9f9';
                const formattedCell = this.applyInlineFormatting(cell.trim());
                
                html += `<td style="padding: 8px 12px; border: 1px solid #dee2e6; text-align: ${align}; background-color: ${bgColor};">${formattedCell}</td>`;
            });
            
            html += '</tr>';
        }
        
        html += '</tbody></table></div>';
        
        return html;
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
            const team1Display = tp.team1 || 'Loss 1/2 1';
            const team2Display = tp.team2 || 'Loss 1/2 2';
            
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

// Простой класс для модального окна - добавляем в конец home.js перед инициализацией
class SimpleModal {
    constructor() {
        this.modal = null;
        this.overlay = null;
        this.initModal();
    }

    initModal() {
        // Создаем overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            padding: 20px;
        `;

        // Создаем модальное окно
        this.modal = document.createElement('div');
        this.modal.className = 'modal-window';
        this.modal.style.cssText = `
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 800px;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        `;

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        // Закрытие по клику на overlay
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
    }

    show(title, content) {
        // Создаем заголовок
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.style.cssText = `
            background: linear-gradient(135deg, #2c3e50, #4a6572);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        titleElement.style.cssText = `
            margin: 0;
            font-size: 1.4rem;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            line-height: 1;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeBtn.onclick = () => this.close();
        
        header.appendChild(titleElement);
        header.appendChild(closeBtn);

        // Создаем тело
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.style.cssText = `
            padding: 0;
            max-height: 70vh;
            overflow-y: auto;
        `;
        body.innerHTML = content;

        // Очищаем и добавляем содержимое
        this.modal.innerHTML = '';
        this.modal.appendChild(header);
        this.modal.appendChild(body);

        // Показываем
        this.overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Блокируем прокрутку страницы
    }

    close() {
        this.overlay.style.display = 'none';
        document.body.style.overflow = ''; // Возвращаем прокрутку
    }
}