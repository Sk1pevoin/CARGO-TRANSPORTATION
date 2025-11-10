// contacts.js - Обработка формы контактов с IndexedDB
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleContactFormSubmit(e);
        });
        
        // Инициализация маски для телефона
        initializePhoneMask();
        
        // Загрузка сохраненных данных пользователя
        loadUserData();
    }
    
    // Инициализация интерактивной карты
    initializeMap();
});

// Обработка отправки формы контактов
async function handleContactFormSubmit(event) {
    const formData = new FormData(event.target);
    const contactData = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        subject: formData.get('subject'),
        message: formData.get('message')
    };
    
    // Валидация
    if (!validateContactForm(contactData)) {
        return;
    }
    
    try {
        // Сохраняем контактные данные в IndexedDB
        await transportDBCompat.addContact(contactData);
        
        // Показываем сообщение об успехе
        showContactSuccess();
        
        // Очищаем форму
        event.target.reset();
        
        // Сохраняем данные пользователя для будущих обращений
        saveUserContactData(contactData);
        
    } catch (error) {
        showContactError('Ошибка при отправке сообщения: ' + error.message);
    }
}

// Валидация формы контактов
function validateContactForm(data) {
    if (!data.name || data.name.trim().length < 2) {
        showContactError('Введите корректное имя (минимум 2 символа)');
        return false;
    }
    
    if (!data.phone || data.phone.replace(/\D/g, '').length < 7) {
        showContactError('Введите корректный номер телефона');
        return false;
    }
    
    if (!data.email || !isValidEmail(data.email)) {
        showContactError('Введите корректный email адрес');
        return false;
    }
    
    if (!data.subject) {
        showContactError('Выберите тему обращения');
        return false;
    }
    
    if (!data.message || data.message.trim().length < 10) {
        showContactError('Сообщение должно содержать минимум 10 символов');
        return false;
    }
    
    return true;
}

// Проверка email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Сохранение данных пользователя
function saveUserContactData(contactData) {
    try {
        const userData = {
            name: contactData.name,
            phone: contactData.phone,
            email: contactData.email
        };
        
        localStorage.setItem('user_contact_data', JSON.stringify(userData));
    } catch (error) {
        console.error('Ошибка при сохранении данных пользователя:', error);
    }
}

// Загрузка данных пользователя
function loadUserData() {
    try {
        const userData = JSON.parse(localStorage.getItem('user_contact_data') || '{}');
        const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
        
        const contactName = document.getElementById('contactName');
        const contactPhone = document.getElementById('contactPhone');
        const contactEmail = document.getElementById('contactEmail');
        
        if (contactName && !contactName.value) {
            contactName.value = userData.name || currentUser.name || currentUser.login || '';
        }
        
        if (contactEmail && !contactEmail.value) {
            contactEmail.value = userData.email || currentUser.email || '';
        }
        
        if (contactPhone && !contactPhone.value) {
            contactPhone.value = userData.phone || currentUser.phone || '';
        }
        
    } catch (error) {
        console.error('Ошибка при загрузке данных пользователя:', error);
    }
}

// Инициализация маски телефона
function initializePhoneMask() {
    const phoneInput = document.getElementById('contactPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            
            if (value.length > 0) {
                value = '+375 (' + value;
                
                if (value.length > 9) {
                    value = value.slice(0, 9) + ') ' + value.slice(9);
                }
                if (value.length > 14) {
                    value = value.slice(0, 14) + '-' + value.slice(14);
                }
                if (value.length > 17) {
                    value = value.slice(0, 17) + '-' + value.slice(17);
                }
            }
            
            e.target.value = value;
        });
    }
}

// Инициализация карты
function initializeMap() {
    const mapContainer = document.querySelector('.map-placeholder');
    if (mapContainer) {
        mapContainer.addEventListener('click', function() {
            showMapModal();
        });
    }
}

// Показ модального окна с картой
function showMapModal() {
    const modalHtml = `
        <div class="modal" style="display: block; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5);">
            <div class="modal-content" style="background-color: white; margin: 5% auto; padding: 20px; border-radius: 8px; width: 90%; max-width: 800px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <span class="close" onclick="closeMapModal()" style="color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
                <h3>Наш офис на карте</h3>
                <div style="height: 400px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; border-radius: 8px; margin: 15px 0;">
                    <div style="text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 15px;">🗺️</div>
                        <p style="margin: 0; font-size: 16px; color: #666;">Минск, улица Примерная, 1</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #999;">Здесь будет интерактивная карта</p>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
                    <div>
                        <h4 style="margin: 0 0 10px 0;">Контактная информация</h4>
                        <p style="margin: 5px 0;">📞 +375 (29) 000-00-00</p>
                        <p style="margin: 5px 0;">📧 example@gmail.com</p>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 10px 0;">Время работы</h4>
                        <p style="margin: 5px 0;">Пн-Пт: 9:00 - 18:00</p>
                        <p style="margin: 5px 0;">Сб: 10:00 - 16:00</p>
                        <p style="margin: 5px 0;">Вс: выходной</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // Обработчик закрытия по клику вне окна
    window.onclick = function(event) {
        if (event.target === modalContainer.firstChild) {
            closeMapModal();
        }
    }
}

function closeMapModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// Показ успешного сообщения
function showContactSuccess() {
    const successMessage = document.getElementById('contactSuccessMessage');
    if (successMessage) {
        successMessage.style.display = 'block';
        successMessage.scrollIntoView({ behavior: 'smooth' });
        
        // Скрываем сообщение через 5 секунд
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 5000);
    }
}

// Показ ошибки
function showContactError(message) {
    alert(message);
}

// Быстрая связь через Telegram
function contactViaTelegram() {
    const phone = document.getElementById('contactPhone')?.value;
    const message = document.getElementById('contactMessage')?.value;
    
    if (phone && message) {
        const telegramUrl = `https://t.me/?text=Здравствуйте! Хочу задать вопрос: ${encodeURIComponent(message)}. Мой телефон: ${phone}`;
        window.open(telegramUrl, '_blank');
    } else {
        window.open('https://t.me/', '_blank');
    }
}

// Быстрая связь по телефону
function contactViaPhone() {
    const phoneNumber = '+375290000000';
    window.location.href = `tel:${phoneNumber}`;
}