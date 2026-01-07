// auth.js - Функционал авторизации и регистрации (IndexedDB версия)
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadCurrentUser();
    }

    // Загрузка текущего пользователя из localStorage
    loadCurrentUser() {
        try {
            const userData = localStorage.getItem('current_user');
            const token = localStorage.getItem('auth_token');
            
            if (userData && token) {
                this.currentUser = JSON.parse(userData);
                console.log('Пользователь загружен из localStorage:', this.currentUser);
            }
        } catch (error) {
            console.error('Ошибка при загрузке пользователя:', error);
            this.logout();
        }
    }

    // Регистрация
    async register(login, password) {
        try {
            console.log('Начало регистрации:', login);
            
            const result = await transportDBCompat.registerUser({ login, password });
            
            if (result.success && result.user && result.token) {
                // Сохраняем пользователя и токен
                this.setCurrentUser(result.user, result.token);
                return { success: true, user: result.user };
            } else {
                throw new Error('Неверный ответ от сервера');
            }

        } catch (error) {
            console.error('Ошибка регистрации:', error);
            throw error;
        }
    }

    // Вход
    async login(login, password) {
        try {
            console.log('Начало входа:', login);
            
            const result = await transportDBCompat.loginUser(login, password);
            
            if (result.success && result.user && result.token) {
                // Сохраняем пользователя и токен
                this.setCurrentUser(result.user, result.token);
                return { success: true, user: result.user };
            } else {
                throw new Error('Неверный ответ от сервера');
            }

        } catch (error) {
            console.error('Ошибка входа:', error);
            throw error;
        }
    }

    // Сохранение пользователя
    setCurrentUser(user, token) {
        this.currentUser = user;
        
        localStorage.setItem('current_user', JSON.stringify(user));
        localStorage.setItem('auth_token', token);
        
        console.log('Пользователь сохранен:', user);
        
        // Обновляем интерфейс если есть элементы для отображения пользователя
        this.updateUI();
    }

    // Выход
    logout() {
        this.currentUser = null;
        localStorage.removeItem('current_user');
        localStorage.removeItem('auth_token');
        console.log('Пользователь вышел из системы');
        
        // Перенаправляем на главную страницу
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('register.html') &&
            !window.location.pathname.includes('Web.html')) {
            window.location.href = 'Web.html';
        }
    }

    // Проверка авторизации
    isAuthenticated() {
        return this.currentUser !== null;
    }

    // Проверка является ли пользователь администратором
    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    // Получение текущего пользователя
    getCurrentUser() {
        return this.currentUser;
    }

    // Проверка защищенных страниц
    checkProtectedPage() {
        const protectedPages = ['cabinet.html', 'Bid.html'];
        const currentPage = window.location.pathname.split('/').pop();
        
        if (protectedPages.includes(currentPage) && !this.isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        
        return true;
    }

    // Проверка доступа к админ-панели
    checkAdminAccess() {
        if (!this.isAuthenticated() || !this.isAdmin()) {
            alert('Доступ запрещен. Только для администраторов.');
            window.location.href = 'Web.html';
            return false;
        }
        return true;
    }

    // Обновление профиля
    async updateProfile(profileData) {
        try {
            // Администраторы не могут обновлять профиль через обычный интерфейс
            if (this.isAdmin()) {
                throw new Error('Обновление профиля администратора недоступно');
            }
            
            const result = await transportDBCompat.updateUserProfile(profileData);
            
            if (result.success && result.user) {
                // Обновляем пользователя
                this.setCurrentUser(result.user, localStorage.getItem('auth_token'));
                return { success: true, user: result.user };
            } else {
                throw new Error('Неверный ответ от сервера');
            }
            
        } catch (error) {
            console.error('Ошибка при обновлении профиля:', error);
            throw error;
        }
    }

    // Обновление интерфейса
    updateUI() {
        // Обновляем навигацию для администратора
        const adminElements = document.querySelectorAll('[data-admin]');
        adminElements.forEach(element => {
            if (this.isAdmin()) {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        });

        // Обновляем навигацию для обычных пользователей
        const userElements = document.querySelectorAll('[data-user]');
        userElements.forEach(element => {
            if (this.isAuthenticated() && !this.isAdmin()) {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        });

        const guestElements = document.querySelectorAll('[data-guest]');
        guestElements.forEach(element => {
            if (!this.isAuthenticated()) {
                element.style.display = 'block';
            } else {
                element.style.display = 'none';
            }
        });

        // Обновляем имя пользователя если есть элементы
        const userNameElements = document.querySelectorAll('[data-user-name]');
        if (this.isAuthenticated() && userNameElements.length > 0) {
            userNameElements.forEach(element => {
                let displayName = this.currentUser.login || 'Пользователь';
                if (this.isAdmin()) {
                    displayName += ' (Админ)';
                }
                element.textContent = displayName;
            });
        }
    }
}

// Создаем глобальный экземпляр менеджера авторизации
const authManager = new AuthManager();