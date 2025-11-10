// script.js - Основной функционал (IndexedDB версия)
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Приложение грузоперевозок запущено (IndexedDB версия)');
    
    // Ждем инициализации базы данных
    setTimeout(() => {
        // Инициализируем UI авторизации
        if (typeof authManager !== 'undefined') {
            authManager.updateUI();
        }
        
        // Обработка формы регистрации
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }

        // Обработка формы входа
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        // Обработка формы заявки
        const zayavkaForm = document.getElementById('zayavkaForm');
        if (zayavkaForm) {
            zayavkaForm.addEventListener('submit', handleZayavka);
            
            // Загрузка данных из калькулятора, если они есть
            loadCalculatorData();
        }

        // Загрузка заявок для администратора
        if (window.location.pathname.includes('admin.html')) {
            // Проверяем права администратора
            if (typeof authManager !== 'undefined' && authManager.checkAdminAccess()) {
                loadBidsForAdmin();
                loadAdminStats();
            }
        }

        // Загрузка заявок для страницы Bid.html
        if (window.location.pathname.includes('Bid.html')) {
            loadBidsForUser();
        }
        
        // Проверка авторизации на защищенных страницах
        checkPageAuthorization();
        
        // Инициализация калькулятора если на странице Calc.html
        if (window.location.pathname.includes('Calc.html')) {
            initializeCalculator();
        }
    }, 100);
});

// Инициализация калькулятора
function initializeCalculator() {
    const calculatorForm = document.getElementById('calculatorForm');
    if (calculatorForm) {
        console.log('Калькулятор инициализирован');
        
        // Устанавливаем минимальную дату как сегодня
        const dateInput = document.getElementById('date');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
            dateInput.value = today;
        }
    }
}

// 📝 ОБРАБОТКА РЕГИСТРАЦИИ
async function handleRegister(event) {
    event.preventDefault();
    
    const login = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    
    // Валидация
    if (login.length < 3) {
        showError('Логин должен содержать минимум 3 символа');
        return;
    }
    
    if (password.length < 6) {
        showError('Пароль должен содержать минимум 6 символов');
        return;
    }
    
    try {
        const result = await authManager.register(login, password);
        
        if (result.success) {
            // Показываем сообщение об успехе
            showSuccessMessage('✅ Регистрация прошла успешно! Перенаправление...');
            
            // Очищаем форму
            event.target.reset();
            
            // Перенаправляем на главную страницу через 2 секунды
            setTimeout(() => {
                window.location.href = 'Web.html';
            }, 2000);
        }
        
    } catch (error) {
        showError('Ошибка регистрации: ' + error.message);
    }
}

// 🔐 ОБРАБОТКА ВХОДА
async function handleLogin(event) {
    event.preventDefault();
    
    const login = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const result = await authManager.login(login, password);
        
        if (result.success) {
            showSuccessMessage('✅ Вход выполнен успешно! Перенаправление...');
            
            // Перенаправляем на главную страницу через 1 секунду
            setTimeout(() => {
                window.location.href = 'Web.html';
            }, 1000);
        }
    } catch (error) {
        showError('Ошибка входа: ' + error.message);
    }
}

// 📋 ОБРАБОТКА ЗАЯВКИ
async function handleZayavka(event) {
    event.preventDefault();
    
    const user = authManager.getCurrentUser();
    if (!user || !user.id) {
        showError('Для создания заявки необходимо войти в систему');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    const formData = new FormData(event.target);
    
    // Конвертируем вес в килограммы если указан в тоннах
    let weight = parseFloat(formData.get('weightValue')) || 0;
    const unit = formData.get('weightUnit');
    if (unit === 'т') {
        weight = weight * 1000; // Конвертируем тонны в килограммы
    }
    
    const bidData = {
        wherefrom: formData.get('otkuda'),
        towhere: formData.get('kuda'),
        weight: weight,
        type: formData.get('tip'),
        date: formData.get('date')
    };
    
    // Валидация
    if (!bidData.wherefrom || !bidData.towhere) {
        showError('Пожалуйста, заполните пункты отправления и назначения');
        return;
    }
    
    if (bidData.weight <= 0) {
        showError('Пожалуйста, укажите вес груза');
        return;
    }
    
    try {
        const result = await transportDBCompat.addBid(bidData);
        
        if (result && result.id) {
            showSuccess('✅ Заявка успешно отправлена! Номер заявки: #' + result.id);
            event.target.reset();
            
            // Очищаем данные калькулятора
            sessionStorage.removeItem('calculator_bid_data');
            
            // Обновляем список заявок если находимся на странице Bid.html
            if (window.location.pathname.includes('Bid.html')) {
                setTimeout(() => {
                    loadBidsForUser();
                }, 1000);
            }
        } else {
            throw new Error('Не удалось создать заявку');
        }
        
    } catch (error) {
        console.error('Ошибка при отправке заявки:', error);
        showError('❌ Ошибка при отправке заявки: ' + (error.message || 'Попробуйте позже'));
    }
}

// Загрузка данных из калькулятора
function loadCalculatorData() {
    try {
        const calculatorData = sessionStorage.getItem('calculator_bid_data');
        if (calculatorData) {
            const data = JSON.parse(calculatorData);
            const form = document.getElementById('zayavkaForm');
            
            if (form && data) {
                if (data.wherefrom) form.querySelector('input[name="otkuda"]').value = data.wherefrom;
                if (data.towhere) form.querySelector('input[name="kuda"]').value = data.towhere;
                if (data.weight) {
                    form.querySelector('#weightValue').value = data.weight;
                    form.querySelector('#weightUnit').value = 'кг';
                }
                if (data.type) form.querySelector('select[name="tip"]').value = data.type;
                if (data.date) form.querySelector('input[name="date"]').value = data.date;
                
                // Удаляем данные после загрузки
                sessionStorage.removeItem('calculator_bid_data');
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке данных калькулятора:', error);
    }
}

// 👨‍💼 ЗАГРУЗКА ЗАЯВОК ДЛЯ АДМИНИСТРАТОРА
async function loadBidsForAdmin() {
    try {
        const bids = await transportDBCompat.getAllBids();
        const bidsList = document.getElementById('zayavkiList');
        
        if (!bidsList) return;
        
        if (!bids || bids.length === 0) {
            bidsList.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">Нет заявок</p>';
            return;
        }
        
        let html = `
            <div class="table-wrap">
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; border: 1px solid #ddd;">ID</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Маршрут</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Вес</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Тип</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Дата</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Статус</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        bids.forEach(bid => {
            const statusColor = getStatusColor(bid.status);
            html += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${bid.id}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        <strong>${bid.wherefrom}</strong> → <strong>${bid.towhere}</strong>
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${bid.weight || '0'} кг</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${bid.type || 'Обычный'}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${bid.date || 'Не указана'}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        <span style="color: ${statusColor}; font-weight: bold;">
                            ${bid.status}
                        </span>
                    </td>
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        <select onchange="updateBidStatus(${bid.id}, this.value)" 
                                style="padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="новая" ${bid.status === 'новая' ? 'selected' : ''}>Новая</option>
                            <option value="в работе" ${bid.status === 'в работе' ? 'selected' : ''}>В работе</option>
                            <option value="выполнена" ${bid.status === 'выполнена' ? 'selected' : ''}>Выполнена</option>
                            <option value="отменена" ${bid.status === 'отменена' ? 'selected' : ''}>Отменена</option>
                        </select>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        bidsList.innerHTML = html;
    } catch (error) {
        console.error('Ошибка при загрузке заявок:', error);
        showError('Ошибка при загрузке заявок');
    }
}

// Загрузка статистики для админ-панели
async function loadAdminStats() {
    try {
        const stats = await transportDBCompat.getStats();
        
        // Обновляем элементы статистики
        if (document.getElementById('totalBids')) {
            document.getElementById('totalBids').textContent = stats.totalBids || 0;
        }
        if (document.getElementById('queueBids')) {
            document.getElementById('queueBids').textContent = stats.newBids || 0;
        }
        if (document.getElementById('activeBids')) {
            document.getElementById('activeBids').textContent = stats.activeBids || 0;
        }
        if (document.getElementById('availableTransport')) {
            document.getElementById('availableTransport').textContent = stats.availableTrucks || 0;
        }
        
    } catch (error) {
        console.error('Ошибка при загрузке статистики:', error);
    }
}

// 👤 ЗАГРУЗКА ЗАЯВОК ДЛЯ ПОЛЬЗОВАТЕЛЯ
async function loadBidsForUser() {
    try {
        const bids = await transportDBCompat.getMyBids();
        const bidsList = document.getElementById('zayavkiList');
        
        if (!bidsList) return;
        
        if (!bids || bids.length === 0) {
            bidsList.innerHTML = '<p style="text-align: center; margin: 20px 0; color: #666;">У вас пока нет заявок</p>';
            return;
        }
        
        let html = '<h3 style="margin-top: 30px; color: #0a1a33;">Ваши заявки</h3>';
        html += '<div class="bids-list">';
        
        bids.forEach(bid => {
            const statusColor = getStatusColor(bid.status);
            
            html += `
                <div class="bid-card" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: #0a1a33;">${bid.wherefrom} → ${bid.towhere}</strong>
                            <p style="margin: 5px 0; color: #666;">Вес: ${bid.weight || '0'} кг</p>
                            <p style="margin: 5px 0; color: #666;">Тип: ${bid.type || 'Обычный'}</p>
                            <p style="margin: 5px 0; color: #666;">Дата: ${bid.date || 'Не указана'}</p>
                        </div>
                        <span style="background: ${statusColor}; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold;">
                            ${bid.status}
                        </span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        bidsList.innerHTML = html;
    } catch (error) {
        console.error('Ошибка при загрузке заявок:', error);
        showError('Ошибка при загрузке заявок');
    }
}

// 🎨 ПОЛУЧЕНИЕ ЦВЕТА ДЛЯ СТАТУСА
function getStatusColor(status) {
    const colors = {
        'новая': '#007bff',
        'в работе': '#ffc107',
        'выполнена': '#28a745',
        'отменена': '#dc3545'
    };
    return colors[status] || '#6c757d';
}

// 🔄 ОБНОВЛЕНИЕ СТАТУСА ЗАЯВКИ
async function updateBidStatus(bidId, newStatus) {
    try {
        await transportDBCompat.updateBidStatus(bidId, newStatus);
        showSuccess('Статус заявки обновлен');
        // Перезагружаем список заявок
        setTimeout(() => {
            loadBidsForAdmin();
            loadAdminStats();
        }, 500);
    } catch (error) {
        showError('Ошибка при обновлении статуса: ' + error.message);
    }
}

// Вспомогательные функции
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.querySelector('span:last-child').textContent = message;
        errorDiv.style.display = 'block';
        
        // Автоскрытие через 5 секунд
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

function showSuccess(message) {
    // Создаем временное уведомление
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
    
    // Автоскрытие через 3 секунды
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showSuccessMessage(message) {
    const successDiv = document.getElementById('success-message');
    if (successDiv) {
        successDiv.querySelector('span:last-child').textContent = message;
        successDiv.style.display = 'block';
        
        // Автоскрытие через 5 секунд
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

function checkPageAuthorization() {
    const protectedPages = ['cabinet.html', 'Bid.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        authManager.checkProtectedPage();
    }
}

// Функции для админ-панели
function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('bidsSection').style.display = 'none';
    document.getElementById('transportSection').style.display = 'none';
    document.getElementById('queueSection').style.display = 'none';
}

function showBids() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('bidsSection').style.display = 'block';
    document.getElementById('transportSection').style.display = 'none';
    document.getElementById('queueSection').style.display = 'none';
    loadBidsForAdmin();
}

function showTransport() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('bidsSection').style.display = 'none';
    document.getElementById('transportSection').style.display = 'block';
    document.getElementById('queueSection').style.display = 'none';
}

function showQueue() {
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('bidsSection').style.display = 'none';
    document.getElementById('transportSection').style.display = 'none';
    document.getElementById('queueSection').style.display = 'block';
    
    // Загружаем заявки в очереди
    loadQueueBids();
}

// Загрузка заявок в очереди
async function loadQueueBids() {
    try {
        const bids = await transportDBCompat.getAllBids();
        const queueBids = bids.filter(bid => bid.status === 'новая');
        const queueList = document.getElementById('queueList');
        
        if (!queueList) return;
        
        if (queueBids.length === 0) {
            queueList.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">Нет заявок в очереди</p>';
            return;
        }
        
        let html = '<h3>Заявки в очереди на обработку</h3>';
        html += '<div class="queue-grid">';
        
        queueBids.forEach(bid => {
            html += `
                <div class="queue-card" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; background: white;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <strong>#${bid.id} ${bid.wherefrom} → ${bid.towhere}</strong>
                            <p style="margin: 5px 0; color: #666;">Вес: ${bid.weight || '0'} кг</p>
                            <p style="margin: 5px 0; color: #666;">Тип: ${bid.type || 'Обычный'}</p>
                            <p style="margin: 5px 0; color: #666;">Дата: ${bid.date || 'Не указана'}</p>
                        </div>
                        <button onclick="updateBidStatus(${bid.id}, 'в работе')" 
                                style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer;">
                            Взять в работу
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        queueList.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка при загрузке очереди:', error);
    }
}

// Глобальный обработчик ошибок
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
});