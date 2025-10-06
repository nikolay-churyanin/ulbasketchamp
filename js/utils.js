// Utils.js - Вспомогательные функции
class BasketballUtils {
    static formatNumber(number) {
        return new Intl.NumberFormat('ru-RU').format(number);
    }

    static formatDate(date, options = {}) {
        const defaultOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };
        return new Date(date).toLocaleDateString('ru-RU', { ...defaultOptions, ...options });
    }

    static formatTime(date) {
        return new Date(date).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static getLeagueName(leagueCode) {
        const leagues = {
            'A': 'Лига А',
            'B': 'Лига Б',
            'all': 'Все лиги'
        };
        return leagues[leagueCode] || leagueCode;
    }

    static getPositionName(positionCode) {
        const positions = {
            'G': 'Защитник',
            'F': 'Форвард',
            'C': 'Центровой',
            'PG': 'Разыгрывающий',
            'SG': 'Атакующий защитник',
            'SF': 'Легкий форвард',
            'PF': 'Тяжелый форвард'
        };
        return positions[positionCode] || positionCode;
    }

    static calculateWinPercentage(wins, losses) {
        const total = wins + losses;
        return total > 0 ? (wins / total) * 100 : 0;
    }

    static getTeamColor(teamId) {
        const colors = [
            '#0055a5', '#dc3545', '#28a745', '#ffc107', '#6f42c1', '#fd7e14',
            '#20c997', '#e83e8c', '#17a2b8', '#6c757d', '#007bff', '#6610f2'
        ];
        return colors[teamId % colors.length];
    }

    static generateGradient(teamId) {
        const baseColor = this.getTeamColor(teamId);
        return `linear-gradient(135deg, ${baseColor}, ${this.lightenColor(baseColor, 30)})`;
    }

    static lightenColor(color, percent) {
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
    }

    static formatStatValue(value, statType) {
        switch (statType) {
            case 'points':
            case 'rebounds':
            case 'assists':
            case 'steals':
            case 'blocks':
                return Math.round(value * 10) / 10;
            case 'percentage':
                return `${Math.round(value * 100)}%`;
            default:
                return value;
        }
    }

    static getStatusBadge(status) {
        const statuses = {
            'finished': { class: 'finished', text: 'Завершен' },
            'live': { class: 'live', text: 'LIVE' },
            'upcoming': { class: 'upcoming', text: 'Предстоящий' }
        };
        return statuses[status] || { class: 'upcoming', text: 'Предстоящий' };
    }

    static handleImageError(event) {
        event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZGRkIi8+Cjx0ZXh0IHg9IjEyIiB5PSIxMiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCI+VEVBTTwvdGV4dD4KPC9zdmc+';
        event.target.onerror = null;
    }

    static isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    static getViewportSize() {
        return {
            width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
            height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
        };
    }

    static scrollToElement(elementId, offset = 0) {
        const element = document.getElementById(elementId);
        if (element) {
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }

    static copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Текст скопирован в буфер обмена');
        }).catch(err => {
            console.error('Ошибка при копировании текста: ', err);
        });
    }

    static shareContent(title, text, url) {
        if (navigator.share) {
            navigator.share({
                title: title,
                text: text,
                url: url
            }).then(() => {
                console.log('Контент успешно опубликован');
            }).catch(err => {
                console.error('Ошибка при публикации: ', err);
            });
        } else {
            console.log('Web Share API не поддерживается');
        }
    }

    static getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
    }

    static parseQueryParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        });
        
        return params;
    }

    static setQueryParam(key, value) {
        const params = new URLSearchParams(window.location.search);
        params.set(key, value);
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    }

    static removeQueryParam(key) {
        const params = new URLSearchParams(window.location.search);
        params.delete(key);
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    }

    static getStorage(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            return localStorage.getItem(key);
        }
    }

    static setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            localStorage.setItem(key, value);
        }
    }

    static removeStorage(key) {
        localStorage.removeItem(key);
    }

    static clearStorage() {
        localStorage.clear();
    }
}

// Полифиллы для старых браузеров
if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
        if (typeof start !== 'number') {
            start = 0;
        }
        if (start + search.length > this.length) {
            return false;
        }
        return this.indexOf(search, start) !== -1;
    };
}

if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement, fromIndex) {
        if (this == null) {
            throw new TypeError('Array.prototype.includes called on null or undefined');
        }
        var O = Object(this);
        var len = O.length >>> 0;
        if (len === 0) {
            return false;
        }
        var n = fromIndex | 0;
        var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
        while (k < len) {
            if (O[k] === searchElement) {
                return true;
            }
            k++;
        }
        return false;
    };
}

// Инициализация утилит
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем обработчики ошибок для всех изображений
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', BasketballUtils.handleImageError);
    });

    // Сохраняем в глобальной области для доступа из консоли
    window.BasketballUtils = BasketballUtils;
});