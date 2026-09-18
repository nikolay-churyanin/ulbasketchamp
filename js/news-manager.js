// news-manager.js
class NewsManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentFilter = 'all';
        this.newsCache = null;
    }

    // Загрузка и отображение новостей
    async loadAndDisplayNews(containerId, filter = 'all') {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.currentFilter = filter;
        
        container.innerHTML = `
            <div class="news-loading">
                <div class="spinner"></div>
                <p>Загрузка новостей...</p>
            </div>
        `;

        try {
            const news = await this.dataManager.loadNewsByFilter(filter);
            this.newsCache = news;
            this.displayNews(container, news);
        } catch (error) {
            console.error('Error loading news:', error);
            container.innerHTML = `
                <div class="news-error">
                    <div class="error-icon">📰</div>
                    <h3>Не удалось загрузить новости</h3>
                    <p>Попробуйте обновить страницу позже</p>
                    <button class="news-retry-btn" onclick="window.newsManager.loadAndDisplayNews('news-container', '${filter}')">
                        Повторить
                    </button>
                </div>
            `;
        }
    }

    // Отображение новостей
    displayNews(container, news) {
        if (!news || news.length === 0) {
            container.innerHTML = `
                <div class="no-news">
                    <div class="no-news-icon">📭</div>
                    <h3>Новостей пока нет</h3>
                    <p>Следите за обновлениями</p>
                </div>
            `;
            return;
        }

        let html = '<div class="news-grid">';
        
        news.forEach(item => {
            html += this.renderNewsCard(item);
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        this.setupReadMoreHandlers();
    }

    // Рендер карточки новости
    renderNewsCard(news) {
        const leagueBadge = this.getLeagueBadge(news.league);
        const date = this.formatDate(news.date);
        const previewText = this.getPreviewText(news.content);
        
        return `
            <div class="news-card" data-news-id="${news.id}">
                <div class="news-card-header">
                    ${leagueBadge}
                    <span class="news-date">${date}</span>
                </div>
                
                ${news.image ? `
                    <div class="news-image">
                        <img src="${news.image}" alt="${news.title}" 
                             onerror="this.style.display='none'">
                    </div>
                ` : ''}
                
                <div class="news-content">
                    <h3 class="news-title">${this.escapeHtml(news.title)}</h3>
                    <div class="news-preview">
                        ${this.escapeHtml(previewText)}
                    </div>
                </div>
                
                <div class="news-footer">
                    <button class="news-read-more" data-news='${this.escapeJson(JSON.stringify(news))}'>
                        Читать далее
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    // Получить бейдж лиги
    getLeagueBadge(league) {
        if (!league || league === 'general') {
            return '<span class="news-badge general">Общее</span>';
        }

        const item = this.dataManager.getLeagueById(league);
        if (!item) {
            return '<span class="news-badge general">Общее</span>';
        }

        return `<span class="news-badge ${item.cssClass}">${item.name}</span>`;
    }

    // Форматирование даты
    formatDate(dateString) {
        if (!dateString) return '';
        
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        
        const [day, month, year] = dateString.split('.');
        return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
    }

    // Получить превью текст
    getPreviewText(content) {
        // Убираем markdown разметку
        let plainText = content
            .replace(/^#.*$/gm, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/!\[.*?\]\(.*?\)/g, '')
            .replace(/\[.*?\]\(.*?\)/g, '$1')
            .replace(/\|.*\|/g, '') // Убираем строки таблиц
            .replace(/[\|\-:\s]/g, ' ') // Убираем спецсимволы таблиц
            .replace(/\s+/g, ' ')
            .trim();
        
        if (plainText.length > 150) {
            return plainText.substring(0, 150) + '...';
        }
        return plainText;
    }

    // Настройка обработчиков для кнопок "Читать далее"
    setupReadMoreHandlers() {
        document.querySelectorAll('.news-read-more').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    const newsData = JSON.parse(btn.dataset.news);
                    this.showNewsModal(newsData);
                } catch (error) {
                    console.error('Error parsing news data:', error);
                }
            });
        });
    }

    // Показать модальное окно с полной новостью
    showNewsModal(news) {
        const modalContent = this.renderFullNews(news);
        
        if (window.homePage && window.homePage.ui && window.homePage.ui.showModal) {
            window.homePage.ui.showModal(news.title, modalContent);
        } else if (window.simpleModal) {
            window.simpleModal.show(news.title, modalContent);
        } else {
            this.createSimpleNewsModal(news.title, modalContent);
        }
    }

    renderFullNews(news) {
        const date = this.formatDate(news.date);
        const leagueBadge = this.getLeagueBadge(news.league);
        
        // Используем улучшенный Markdown парсер
        let htmlContent = this.parseMarkdown(news.content);
        
        return `
            <div class="news-modal-content">
                <div class="news-modal-body markdown-body">
                    <div class="news-modal-meta">
                        ${leagueBadge}
                        <span class="news-modal-date">📅 ${date}</span>
                    </div>
                    
                    ${news.image ? `
                        <div class="news-modal-image">
                            <img src="${news.image}" alt="${this.escapeHtml(news.title)}">
                        </div>
                    ` : ''}
                    
                    ${htmlContent}
                </div>
            </div>
        `;
    }

    parseMarkdown(text) {
        if (!text) return '';
        
        // Экранируем HTML
        let html = this.escapeHtml(text);
        
        // 1. ТАБЛИЦЫ - обрабатываем первыми
        html = this.parseTables(html);
        
        // 2. ЗАГОЛОВКИ
        const headingRegex = /^(#{1,3})\s+(.+)$/gm;
        html = html.replace(headingRegex, (match, hashes, content) => {
            const level = hashes.length;
            return `<h${level}>${content}</h${level}>`;
        });
        
        // 3. ГОРИЗОНТАЛЬНАЯ ЛИНИЯ (---) - обрабатываем ДО разделения на блоки
        html = html.replace(/^---$/gm, '<hr>');
        
        // 4. РАЗДЕЛЯЕМ НА БЛОКИ ПО ДВОЙНЫМ ПЕРЕНОСАМ
        const blocks = html.split(/\n\s*\n/);
        const processedBlocks = [];
        
        for (let block of blocks) {
            block = block.trim();
            if (!block) continue;
            
            // Пропускаем уже обработанные таблицы
            if (block.includes('<div class="table-responsive"')) {
                processedBlocks.push(block);
                continue;
            }
            
            // Пропускаем уже обработанные горизонтальные линии
            if (block === '<hr>') {
                processedBlocks.push(block);
                continue;
            }
            
            // 5. СПИСКИ - обрабатываем блок целиком
            if (this.isListBlock(block)) {
                processedBlocks.push(this.parseListBlock(block));
                continue;
            }
            
            // 6. ЦИТАТЫ
            if (block.startsWith('<blockquote>') || block.startsWith('>')) {
                const quoteContent = block.replace(/^>?\s?/gm, '').trim();
                processedBlocks.push(`<blockquote>${quoteContent}</blockquote>`);
                continue;
            }
            
            // 7. ОБЫЧНЫЙ ТЕКСТ - обрабатываем форматирование и оборачиваем в p
            block = this.applyInlineFormatting(block);
            processedBlocks.push(`<p>${block.replace(/\n/g, '<br>')}</p>`);
        }
        
        return processedBlocks.join('\n');
    }

    // Обновленный парсер таблиц
    parseTables(text) {
        const lines = text.split('\n');
        const result = [];
        let i = 0;
        
        while (i < lines.length) {
            const line = lines[i];
            
            // Пропускаем горизонтальные линии
            if (line.trim() === '---') {
                result.push(line);
                i++;
                continue;
            }
            
            // Ищем начало таблицы
            if (line.includes('|') && i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (nextLine.includes('|') && nextLine.replace(/\|/g, '').trim().match(/^[:\-\s]+$/)) {
                    // Собираем таблицу
                    const tableLines = [line, nextLine];
                    i += 2;
                    
                    while (i < lines.length && lines[i].includes('|')) {
                        tableLines.push(lines[i]);
                        i++;
                    }
                    
                    result.push(this.buildTable(tableLines));
                    continue;
                }
            }
            
            result.push(line);
            i++;
        }
        
        return result.join('\n');
    }

    // Проверка, является ли блок списком
    isListBlock(block) {
        const lines = block.split('\n');
        // Проверяем первую непустую строку
        for (let line of lines) {
            line = line.trim();
            if (line) {
                return line.startsWith('- ') || line.match(/^\d+\.\s/);
            }
        }
        return false;
    }

    // Парсинг блока со списком
    parseListBlock(block) {
        const lines = block.split('\n');
        let currentList = null;
        let listItems = [];
        let result = [];
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // Маркированный список
            if (line.startsWith('- ')) {
                const content = line.substring(2).trim();
                const formattedContent = this.applyInlineFormatting(content);
                
                if (currentList !== 'ul') {
                    if (currentList) {
                        result.push(this.buildList(currentList, listItems));
                        listItems = [];
                    }
                    currentList = 'ul';
                }
                listItems.push(formattedContent);
            }
            // Нумерованный список
            else if (line.match(/^\d+\.\s/)) {
                const content = line.replace(/^\d+\.\s/, '').trim();
                const formattedContent = this.applyInlineFormatting(content);
                
                if (currentList !== 'ol') {
                    if (currentList) {
                        result.push(this.buildList(currentList, listItems));
                        listItems = [];
                    }
                    currentList = 'ol';
                }
                listItems.push(formattedContent);
            }
            // Не список - закрываем текущий список если есть
            else {
                if (currentList) {
                    result.push(this.buildList(currentList, listItems));
                    listItems = [];
                    currentList = null;
                }
                // Обычный текст внутри блока списка (например, отступы)
                if (line) {
                    result.push(`<p>${this.applyInlineFormatting(line)}</p>`);
                }
            }
        }
        
        // Закрываем последний список
        if (currentList && listItems.length > 0) {
            result.push(this.buildList(currentList, listItems));
        }
        
        return result.join('\n');
    }

    // Построение HTML списка
    buildList(type, items) {
        const tag = type === 'ul' ? 'ul' : 'ol';
        const listItems = items.map(item => `<li>${item}</li>`).join('');
        return `<${tag}>${listItems}</${tag}>`;
    }

    // Применение inline-форматирования (жирный, курсив, ссылки)
    applyInlineFormatting(text) {
        if (!text) return text;
        
        let result = text;
        
        // Жирный + курсив
        result = result.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        
        // Жирный
        result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        result = result.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Курсив
        result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
        result = result.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Ссылки
        result = result.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        return result;
    }

    // Построение HTML таблицы
    buildTable(tableLines) {
        if (tableLines.length < 2) return tableLines.join('\n');
        
        const header = tableLines[0];
        const separator = tableLines[1];
        const body = tableLines.slice(2);
        
        // Определяем выравнивание
        const alignments = separator.split('|')
            .filter(cell => cell.trim() !== '')
            .map(cell => {
                const trimmed = cell.trim();
                if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
                if (trimmed.endsWith(':')) return 'right';
                if (trimmed.startsWith(':')) return 'left';
                return 'left';
            });
        
        let html = '<div class="table-responsive">\n';
        html += '<table class="news-table">\n';
        
        // Заголовок
        html += '<thead>\n<tr>\n';
        header.split('|')
            .filter(cell => cell.trim() !== '')
            .forEach((cell, i) => {
                const align = alignments[i] || 'left';
                const formattedCell = this.applyInlineFormatting(cell.trim());
                html += `<th style="text-align: ${align};">${formattedCell}</th>\n`;
            });
        html += '</tr>\n</thead>\n';
        
        // Тело
        if (body.length > 0) {
            html += '<tbody>\n';
            body.forEach(row => {
                if (!row.includes('|')) return;
                html += '<tr>\n';
                row.split('|')
                    .filter(cell => cell.trim() !== '')
                    .forEach((cell, i) => {
                        const align = alignments[i] || 'left';
                        const formattedCell = this.applyInlineFormatting(cell.trim());
                        html += `<td style="text-align: ${align};">${formattedCell}</td>\n`;
                    });
                html += '</tr>\n';
            });
            html += '</tbody>\n';
        }
        
        html += '</table>\n</div>\n';
        
        return html;
    }

    // Экранирование HTML
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // Экранирование JSON для data-атрибута
    escapeJson(json) {
        return json.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
    }

    createSimpleNewsModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'news-modal';
        modal.innerHTML = `
            <div class="news-modal-overlay">
                <div class="news-modal-window">
                    <div class="news-modal-header">
                        <h3>${this.escapeHtml(title)}</h3>
                        <button class="news-modal-close">&times;</button>
                    </div>
                    <div class="news-modal-body-wrapper markdown-body">
                        ${content}
                    </div>
                    <div class="news-modal-footer">
                        <button class="news-modal-close-btn">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const closeModal = () => modal.remove();
        
        modal.querySelector('.news-modal-close').onclick = closeModal;
        modal.querySelector('.news-modal-close-btn').onclick = closeModal;
        modal.querySelector('.news-modal-overlay').onclick = (e) => {
            if (e.target === modal.querySelector('.news-modal-overlay')) {
                closeModal();
            }
        };
    }
}