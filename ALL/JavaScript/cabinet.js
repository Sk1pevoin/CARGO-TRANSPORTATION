// cabinet.js - Скрипт для личного кабинета (IndexedDB версия)
document.addEventListener('DOMContentLoaded', function() {
    console.log('Личный кабинет инициализирован (IndexedDB версия)');
    
    // Ждем инициализации базы данных
    setTimeout(() => {
        checkAuth();
        loadCabinetData();
        
        // Обработка формы редактирования профиля
        const editProfileForm = document.getElementById('editProfileForm');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', function(e) {
                e.preventDefault();
                saveProfileChanges();
            });
        }
        
        // Загружаем данные из калькулятора если находимся на странице заявки
        // (эта функция определена в script.js)
        if (window.location.pathname.includes('Bid.html') && typeof loadCalculatorData === 'function') {
            loadCalculatorData();
        }
        
        // Инициализация UI авторизации
        if (typeof authManager !== 'undefined') {
            authManager.updateUI();
        }
    }, 100);
});

// Проверка авторизации
function checkAuth() {
    if (!authManager.isAuthenticated()) {
        // Пользователь не авторизован
        document.getElementById('authCheck').style.display = 'block';
        document.getElementById('cabinetContent').style.display = 'none';
        return false;
    }
    
    // Пользователь авторизован
    document.getElementById('authCheck').style.display = 'none';
    document.getElementById('cabinetContent').style.display = 'block';
    
    updateUserInfo(authManager.getCurrentUser());
    return true;
}

// Обновление информации о пользователе
function updateUserInfo(userData) {
    if (document.getElementById('userName')) {
        let displayName = userData.name || userData.login || 'Пользователь';
        if (authManager.isAdmin()) {
            displayName += ' (Администратор)';
        }
        document.getElementById('userName').textContent = displayName;
    }
    
    if (document.getElementById('userLogin')) {
        document.getElementById('userLogin').textContent = '@' + (userData.login || 'login');
    }
    
    // Заполняем форму редактирования текущими данными
    if (document.getElementById('editUserName')) {
        document.getElementById('editUserName').value = userData.name || '';
    }
    if (document.getElementById('editUserEmail')) {
        document.getElementById('editUserEmail').value = userData.email || '';
    }
    if (document.getElementById('editUserPhone')) {
        document.getElementById('editUserPhone').value = userData.phone || '';
    }
    
    // Обновляем контактную информацию на странице
    updateUserInfoOnPage(userData);
    
    // Скрываем форму редактирования для администратора
    if (authManager.isAdmin()) {
        const editButton = document.querySelector('.btn-edit');
        if (editButton) {
            editButton.style.display = 'none';
        }
        const editForm = document.getElementById('editProfileForm');
        if (editForm) {
            editForm.style.display = 'none';
        }
    }
}

// Функция немедленного обновления данных на странице
function updateUserInfoOnPage(userData) {
    // Обновляем основную информацию
    if (document.getElementById('userName')) {
        let displayName = userData.name || userData.login || 'Пользователь';
        if (authManager.isAdmin()) {
            displayName += ' (Администратор)';
        }
        document.getElementById('userName').textContent = displayName;
    }
    
    if (document.getElementById('userLogin')) {
        document.getElementById('userLogin').textContent = '@' + (userData.login || 'login');
    }
    
    // Обновляем контактную информацию
    const contactInfo = document.querySelector('.user-contact-info');
    if (contactInfo) {
        let html = '';
        if (userData.name) {
            html += `<p><strong>Имя:</strong> ${userData.name}</p>`;
        }
        if (userData.email) {
            html += `<p><strong>Email:</strong> ${userData.email}</p>`;
        }
        if (userData.phone) {
            html += `<p><strong>Телефон:</strong> ${userData.phone}</p>`;
        }
        if (!userData.name && !userData.email && !userData.phone) {
            html = '<p style="color: #666;">Контактная информация не указана</p>';
        }
        contactInfo.innerHTML = html;
    }
    
    // Обновляем статистику в реальном времени
    loadCabinetData();
}

// Загрузка данных кабинета
async function loadCabinetData() {
    if (!checkAuth()) return;
    
    try {
        // Для администратора показываем общую статистику
        if (authManager.isAdmin()) {
            await loadAdminCabinetData();
        } else {
            // Для обычного пользователя показываем его данные
            await loadUserCabinetData();
        }
        
    } catch (error) {
        console.error('Ошибка при загрузке данных кабинета:', error);
        showError('Ошибка при загрузке данных');
    }
}
let isLoadingCabinetData = false;
// Загрузка данных для обычного пользователя
async function loadUserCabinetData() {
    // Загружаем заявки пользователя из IndexedDB
    const bids = await transportDBCompat.getMyBids();
    displayBids(bids);
    updateStats(bids);
    
    // Загружаем историю расчетов из IndexedDB
    if (isLoadingCabinetData) return;
    isLoadingCabinetData = true;
    
    try {
        console.log('Loading cabinet data...');
        const bids = await transportDBCompat.getMyBids();
        displayBids(bids);
        updateStats(bids);
        
        await displayCalculationHistory();
        
        const quickActionsSection = document.querySelector('.quick-actions');
        if (quickActionsSection) {
            quickActionsSection.style.display = 'grid';
        }
    } catch (error) {
        console.error('Ошибка загрузки данных кабинета:', error);
    } finally {
        isLoadingCabinetData = false;
    }
    
    // Показываем раздел быстрых действий
    const quickActionsSection = document.querySelector('.quick-actions');
    if (quickActionsSection) {
        quickActionsSection.style.display = 'grid';
    }
}

// Загрузка данных для администратора
async function loadAdminCabinetData() {
    // Загружаем общую статистику из IndexedDB
    const stats = await transportDBCompat.getStats();
    displayAdminStats(stats);
    
    // Загружаем все заявки из IndexedDB
    const allBids = await transportDBCompat.getAllBids();
    displayAdminBids(allBids);
    
    // Скрываем раздел быстрых действий для администратора
    const quickActionsSection = document.querySelector('.quick-actions');
    if (quickActionsSection) {
        quickActionsSection.style.display = 'none';
    }
    
    // Показываем административную информацию
    showAdminInfo();
}

// Отображение заявок для обычного пользователя
function displayBids(bids) {
    const bidsList = document.getElementById('bidsList');
    if (!bidsList) return;
    
    if (!bids || bids.length === 0) {
        bidsList.innerHTML = `
            <div class="no-bids-message" style="text-align: center; padding: 40px 20px;">
                <div class="empty-icon" style="font-size: 64px; margin-bottom: 20px;">📝</div>
                <h4 style="color: #666; margin: 0 0 10px 0;">У вас пока нет заявок</h4>
                <p style="color: #999; margin: 0 0 25px 0;">Создайте первую заявку на перевозку</p>
                <a href="Bid.html" class="btn-primary" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Создать заявку</a>
            </div>
        `;
        return;
    }
    
    let html = '';
    bids.forEach(bid => {
        const statusColor = getStatusColor(bid.status);
        html += `
            <div class="bid-card" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0 0 5px 0; color: #0a1a33;">${bid.wherefrom} → ${bid.towhere}</h4>
                        <p style="margin: 5px 0; color: #666; font-size: 14px;">ID: ${bid.id}</p>
                        <p style="margin: 5px 0; color: #666; font-size: 14px;">Вес: ${bid.weight || '0'} кг</p>
                        <p style="margin: 5px 0; color: #666; font-size: 14px;">Тип: ${bid.type || 'Обычный'}</p>
                        <p style="margin: 5px 0; color: #666; font-size: 14px;">Дата: ${bid.date || 'Не указана'}</p>
                    </div>
                    <span style="background: ${statusColor}; color: white; padding: 5px 15px; border-radius: 15px; font-size: 12px; font-weight: bold;">
                        ${bid.status}
                    </span>
                </div>
                ${bid.status === 'новая' ? `
                <div style="margin-top: 10px; text-align: right;">
                    <button onclick="cancelBid(${bid.id})" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 12px;">
                        Отменить заявку
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    });
    
    bidsList.innerHTML = html;
}

// Отображение заявок для администратора
function displayAdminBids(bids) {
    const bidsList = document.getElementById('bidsList');
    if (!bidsList) return;
    
    if (!bids || bids.length === 0) {
        bidsList.innerHTML = '<p style="text-align: center; color: #666;">Нет заявок в системе</p>';
        return;
    }
    
    // Показываем только последние 10 заявок
    const recentBids = bids.slice(0, 10);
    
    let html = '<h3 style="color: #0a1a33; margin-bottom: 15px;">Последние заявки</h3>';
    
    recentBids.forEach(bid => {
        const statusColor = getStatusColor(bid.status);
        html += `
            <div class="bid-card" style="border: 1px solid #ddd; padding: 12px; margin: 8px 0; border-radius: 5px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <strong style="color: #0a1a33;">#${bid.id} ${bid.wherefrom} → ${bid.towhere}</strong>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            <span>Вес: ${bid.weight || '0'} кг</span> • 
                            <span>Тип: ${bid.type || 'Обычный'}</span> • 
                            <span>Дата: ${bid.date || 'Не указана'}</span>
                        </div>
                    </div>
                    <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                        ${bid.status}
                    </span>
                </div>
            </div>
        `;
    });
    
    if (bids.length > 10) {
        html += `<p style="text-align: center; color: #666; margin-top: 10px;">... и еще ${bids.length - 10} заявок</p>`;
    }
    
    bidsList.innerHTML = html;
}

// Отображение статистики для администратора
function displayAdminStats(stats) {
    // Обновляем основную статистику
    if (document.getElementById('totalBidsCount')) {
        document.getElementById('totalBidsCount').textContent = stats.totalBids || 0;
    }
    if (document.getElementById('queueBidsCount')) {
        document.getElementById('queueBidsCount').textContent = stats.newBids || 0;
    }
    if (document.getElementById('activeBidsCount')) {
        document.getElementById('activeBidsCount').textContent = stats.activeBids || 0;
    }
    if (document.getElementById('completedBidsCount')) {
        document.getElementById('completedBidsCount').textContent = stats.completedBids || 0;
    }
    
    // Добавляем дополнительную информацию для администратора
    const statsContainer = document.querySelector('.stats-cards');
    if (statsContainer) {
        statsContainer.innerHTML += `
            <div class="stat-card-small" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div class="stat-icon">🚛</div>
                <div class="stat-info">
                    <p class="stat-label">Доступный транспорт</p>
                    <p class="stat-value">${stats.availableTrucks || 0}</p>
                </div>
            </div>
            <div class="stat-card-small" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white;">
                <div class="stat-icon">👥</div>
                <div class="stat-info">
                    <p class="stat-label">Всего пользователей</p>
                    <p class="stat-value">${stats.totalUsers || 1}</p>
                </div>
            </div>
        `;
    }
}

// Показ информации для администратора
function showAdminInfo() {
    const userInfoSection = document.querySelector('.user-info');
    if (userInfoSection) {
        userInfoSection.innerHTML += `
            <div style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 5px; border-left: 4px solid #2196f3;">
                <p style="margin: 0; color: #1565c0; font-size: 14px;">
                    <strong>Режим администратора</strong><br>
                    У вас есть доступ ко всем функциям системы
                </p>
            </div>
        `;
    }
}

// Обновление статистики
function updateStats(bids) {
    const stats = {
        total: bids ? bids.length : 0,
        queue: bids ? bids.filter(b => b.status === 'новая').length : 0,
        active: bids ? bids.filter(b => b.status === 'в работе').length : 0,
        completed: bids ? bids.filter(b => b.status === 'выполнена').length : 0
    };
    
    if (document.getElementById('totalBidsCount')) {
        document.getElementById('totalBidsCount').textContent = stats.total;
    }
    if (document.getElementById('queueBidsCount')) {
        document.getElementById('queueBidsCount').textContent = stats.queue;
    }
    if (document.getElementById('activeBidsCount')) {
        document.getElementById('activeBidsCount').textContent = stats.active;
    }
    if (document.getElementById('completedBidsCount')) {
        document.getElementById('completedBidsCount').textContent = stats.completed;
    }
}

// Получение цвета статуса
function getStatusColor(status) {
    const colors = {
        'новая': '#007bff',
        'в работе': '#ffc107',
        'выполнена': '#28a745',
        'отменена': '#dc3545'
    };
    return colors[status] || '#6c757d';
}

// Фильтрация заявок
async function filterBids(status) {
    // Убираем активный класс со всех вкладок
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Добавляем активный класс на выбранную вкладку
    const tabId = 'filter-' + (status === 'all' ? 'all' : 
                              status === 'новая' ? 'new' : 
                              status === 'в работе' ? 'active' : 'completed');
    const tabElement = document.getElementById(tabId);
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    // Для администратора не фильтруем заявки
    if (authManager.isAdmin()) {
        loadCabinetData();
        return;
    }
    
    // Для обычного пользователя загружаем и фильтруем заявки
    try {
        const bids = await transportDBCompat.getMyBids();
        const bidsList = document.getElementById('bidsList');
        
        if (!bidsList) return;
        
        // Фильтруем заявки по статусу
        let filteredBids = bids;
        if (status !== 'all') {
            filteredBids = bids.filter(bid => bid.status === status);
        }
        
        // Отображаем отфильтрованные заявки
        displayBids(filteredBids);
        
        // Обновляем статистику на основе отфильтрованных заявок
        updateStats(filteredBids);
        
    } catch (error) {
        console.error('Ошибка при фильтрации заявок:', error);
        showError('Ошибка при загрузке заявок');
    }
}

// Отмена заявки
async function cancelBid(bidId) {
    if (!confirm('Вы уверены, что хотите отменить эту заявку?')) {
        return;
    }
    
    try {
        await transportDBCompat.updateBidStatus(bidId, 'отменена');
        showSuccess('Заявка отменена');
        loadCabinetData();
    } catch (error) {
        showError('Ошибка при отмене заявки: ' + error.message);
    }
}

// Редактирование профиля
function editProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Закрытие модального окна
function closeEditModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Сохранение изменений профиля
async function saveProfileChanges() {
    const nameInput = document.getElementById('editUserName');
    const emailInput = document.getElementById('editUserEmail');
    const phoneInput = document.getElementById('editUserPhone');
    
    const profileData = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: phoneInput.value.trim()
    };
    
    // Валидация
    if (profileData.name && profileData.name.length < 2) {
        showError('Имя должно содержать минимум 2 символа');
        return;
    }
    
    if (profileData.email && !isValidEmail(profileData.email)) {
        showError('Введите корректный email адрес');
        return;
    }
    
    if (profileData.phone && profileData.phone.replace(/\D/g, '').length < 7) {
        showError('Введите корректный номер телефона');
        return;
    }
    
    // Проверка что хотя бы одно поле заполнено
    if (!profileData.name && !profileData.email && !profileData.phone) {
        showError('Заполните хотя бы одно поле');
        return;
    }
    
    try {
        const result = await authManager.updateProfile(profileData);
        if (result.success) {
            showSuccess('Профиль успешно обновлен');
            closeEditModal();
            
            // НЕМЕДЛЕННОЕ ОБНОВЛЕНИЕ ДАННЫХ НА СТРАНИЦЕ
            updateUserInfoOnPage(result.user);
        }
    } catch (error) {
        showError('Ошибка при обновлении профиля: ' + error.message);
    }
}

// Проверка email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Показ ошибки
function showError(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-weight: bold;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Показ успешного сообщения
function showSuccess(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-weight: bold;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Отображение истории расчетов из IndexedDB
async function displayCalculationHistory() {
    try {
        const calculations = await transportDBCompat.getUserCalculations();
        const historySection = document.querySelector('.cabinet-section:nth-child(4)');
        
        if (!historySection || calculations.length === 0) return;
        
        let html = `
            <h3 class="section-title">📈 История расчетов</h3>
            <div class="calculation-history">
        `;
        
        calculations.slice(0, 5).forEach(calc => {
            html += `
                <div class="calculation-item" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; background: white;">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong>${calc.from} → ${calc.to}</strong>
                            <p style="margin: 5px 0; color: #666;">Расстояние: ${calc.distance} км</p>
                            <p style="margin: 5px 0; color: #666;">Вес: ${calc.weight} кг</p>
                            <p style="margin: 5px 0; color: #666;">Тип: ${calc.typeName}</p>
                        </div>
                        <div style="text-align: right;">
                            <strong style="color: #28a745;">${calc.cost} руб.</strong>
                            <p style="margin: 5px 0; color: #666; font-size: 12px;">${new Date(calc.timestamp).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Добавляем историю расчетов после раздела быстрых действий
        const quickActionsSection = document.querySelector('.quick-actions');
        if (quickActionsSection && quickActionsSection.parentElement) {
            quickActionsSection.parentElement.insertAdjacentHTML('afterend', html);
        }
    } catch (error) {
        console.error('Ошибка при загрузке истории расчетов:', error);
    }
}

// Быстрые действия
function quickAction(action) {
    switch(action) {
        case 'newBid':
            window.location.href = 'Bid.html';
            break;
        case 'calculator':
            window.location.href = 'Calc.html';
            break;
        case 'contacts':
            window.location.href = 'contacts.html';
            break;
        case 'adminPanel':
            if (authManager.isAdmin()) {
                window.location.href = 'admin.html';
            } else {
                showError('Доступно только для администраторов');
            }
            break;
        default:
            console.log('Неизвестное действие:', action);
    }
}

// Выход из системы
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        authManager.logout();
    }
}

// Обработчик закрытия модальных окон по клику вне области
document.addEventListener('DOMContentLoaded', function() {
    // Закрытие модального окна редактирования профиля
    window.onclick = function(event) {
        const modal = document.getElementById('editProfileModal');
        if (event.target === modal) {
            closeEditModal();
        }
    }
    
    // Добавляем обработчики для быстрых действий
    const quickActionButtons = document.querySelectorAll('[data-action]');
    quickActionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.getAttribute('data-action');
            quickAction(action);
        });
    });
});

// Глобальный обработчик ошибок
window.addEventListener('error', function(e) {
    console.error('Global error in cabinet:', e.error);
});