document.addEventListener('DOMContentLoaded', function() {
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
    }

    // Загрузка заявок для администратора
    if (window.location.pathname.includes('admin.html')) {
        loadBidsForAdmin();
    }

    // Загрузка заявок для страницы Bid.html
    if (window.location.pathname.includes('Bid.html')) {
        loadBidsForUser();
    }
});

// 📝 ОБРАБОТКА РЕГИСТРАЦИИ
async function handleRegister(event) {
    event.preventDefault();
    
    const login = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    
    try {
        await transportDB.registerUser({ login, password });
        
        // Показываем сообщение об успехе
        const successMessage = document.getElementById('success-message');
        successMessage.style.display = 'block';
        
        // Очищаем форму
        event.target.reset();
        
        // Перенаправляем на страницу входа через 2 секунды
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        
    } catch (error) {
        alert('Ошибка регистрации: ' + error.message);
    }
}

// 🔐 ОБРАБОТКА ВХОДА
async function handleLogin(event) {
    event.preventDefault();
    
    const login = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const user = await transportDB.loginUser(login, password);
    
    if (user) {
        // Сохраняем информацию о пользователе
        localStorage.setItem('current_user', JSON.stringify(user));
        
        // Перенаправляем на главную страницу
        window.location.href = 'Web.html';
    } else {
        // Показываем сообщение об ошибке
        const errorMessage = document.getElementById('error-message');
        errorMessage.style.display = 'block';
    }
}

// 📋 ОБРАБОТКА ЗАЯВКИ
async function handleZayavka(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const bidData = {
        name: 'Заявка на перевозку',
        wherefrom: formData.get('otkuda'),
        towhere: formData.get('kuda'),
        weight: formData.get('ves'),
        type: formData.get('tip'),
        date: formData.get('date')
    };
    
    try {
        await transportDB.addBid(bidData);
        alert('✅ Заявка успешно отправлена!');
        event.target.reset();
        
        // Обновляем список заявок если находимся на странице Bid.html
        if (window.location.pathname.includes('Bid.html')) {
            loadBidsForUser();
        }
        
    } catch (error) {
        alert('❌ Ошибка при отправке заявки: ' + error.message);
    }
}

// 👨‍💼 ЗАГРУЗКА ЗАЯВОК ДЛЯ АДМИНИСТРАТОРА
async function loadBidsForAdmin() {
    const bids = await transportDB.getAllBids();
    const bidsList = document.getElementById('zayavkiList');
    
    if (bids.length === 0) {
        bidsList.innerHTML = '<p>Нет заявок</p>';
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 10px; border: 1px solid #ddd;">ID</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Маршрут</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Дата</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Статус</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    bids.forEach(bid => {
        html += `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${bid.id}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">
                    ${bid.wherefrom} → ${bid.towhere}
                </td>
                <td style="padding: 10px; border: 1px solid #ddd;">${bid.date}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${bid.status}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">
                    <select onchange="updateBidStatus(${bid.id}, this.value)" 
                            style="padding: 5px; border: 1px solid #ddd;">
                        <option value="новая" ${bid.status === 'новая' ? 'selected' : ''}>Новая</option>
                        <option value="в работе" ${bid.status === 'в работе' ? 'selected' : ''}>В работе</option>
                        <option value="выполнена" ${bid.status === 'выполнена' ? 'selected' : ''}>Выполнена</option>
                        <option value="отменена" ${bid.status === 'отменена' ? 'selected' : ''}>Отменена</option>
                    </select>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    bidsList.innerHTML = html;
}

// 👤 ЗАГРУЗКА ЗАЯВОК ДЛЯ ПОЛЬЗОВАТЕЛЯ
async function loadBidsForUser() {
    const bids = await transportDB.getAllBids();
    const bidsList = document.getElementById('zayavkiList');
    
    if (!bidsList) return;
    
    if (bids.length === 0) {
        bidsList.innerHTML = '<p style="text-align: center; margin: 20px 0;">У вас пока нет заявок</p>';
        return;
    }
    
    let html = '<h3 style="margin-top: 30px;">Ваши заявки</h3>';
    html += '<div class="bids-list">';
    
    bids.forEach(bid => {
        const statusColor = getStatusColor(bid.status);
        
        html += `
            <div class="bid-card" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${bid.wherefrom} → ${bid.towhere}</strong>
                        <p style="margin: 5px 0; color: #666;">Дата: ${bid.date}</p>
                    </div>
                    <span style="background: ${statusColor}; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px;">
                        ${bid.status}
                    </span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    bidsList.innerHTML = html;
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
        await transportDB.updateBidStatus(bidId, newStatus);
        // Перезагружаем список заявок
        loadBidsForAdmin();
    } catch (error) {
        alert('Ошибка при обновлении статуса: ' + error.message);
    }
}

// 🔗 ПЕРЕХОД ПО ССЫЛКАМ В УСЛУГАХ
document.addEventListener('DOMContentLoaded', function() {
    const orderButtons = document.querySelectorAll('.order-btn');
    orderButtons.forEach(button => {
        button.addEventListener('click', function() {
            const link = this.getAttribute('data-link');
            if (link) {
                window.location.href = link;
            }
        });
    });
});