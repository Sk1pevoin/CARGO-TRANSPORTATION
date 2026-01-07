// about.js - Функционал страницы "О нас"
document.addEventListener('DOMContentLoaded', function() {
    initializeStatsCounter();
    initializeFAQ();
    loadCompanyStats();
});

// Анимация счетчиков статистики
function initializeStatsCounter() {
    const statElements = document.querySelectorAll('.stat-num');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const finalValue = parseInt(target.getAttribute('data-target'));
                animateCounter(target, finalValue);
                observer.unobserve(target);
            }
        });
    }, { threshold: 0.5 });
    
    statElements.forEach(stat => observer.observe(stat));
}

function animateCounter(element, finalValue) {
    let currentValue = 0;
    const duration = 2000; // 2 секунды
    const increment = finalValue / (duration / 16); // 60fps
    
    function updateCounter() {
        currentValue += increment;
        if (currentValue < finalValue) {
            element.textContent = Math.floor(currentValue);
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = finalValue;
        }
    }
    
    updateCounter();
}

// Функционал FAQ
function initializeFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-q');
        const answer = item.querySelector('.faq-a');
        
        question.addEventListener('click', () => {
            const isOpen = answer.style.display === 'block';
            
            // Закрываем все ответы
            document.querySelectorAll('.faq-a').forEach(a => {
                a.style.display = 'none';
            });
            
            // Открываем/закрываем текущий ответ
            if (!isOpen) {
                answer.style.display = 'block';
            }
        });
    });
}

// Загрузка статистики компании
async function loadCompanyStats() {
    try {
        // В реальном приложении здесь был бы запрос к API
        const stats = await transportDB.getStats();
        
        // Обновляем счетчики на странице
        updateStatsOnPage(stats);
    } catch (error) {
        console.error('Ошибка при загрузке статистики:', error);
        // Используем данные по умолчанию
        const defaultStats = {
            totalBids: 5000,
            availableTrucks: 120,
            completedBids: 4900
        };
        updateStatsOnPage(defaultStats);
    }
}

function updateStatsOnPage(stats) {
    // Обновляем элементы статистики, если они есть на странице
    const statElements = {
        '5000': stats.totalBids,
        '120': stats.availableTrucks,
        '98': Math.round((stats.completedBids / stats.totalBids) * 100) || 98
    };
    
    Object.keys(statElements).forEach(key => {
        const element = document.querySelector(`[data-target="${key}"]`);
        if (element) {
            element.setAttribute('data-target', statElements[key]);
        }
    });
}

// Показ модального окна с детальной информацией о команде
function showTeamMemberDetails(memberId) {
    const teamMembers = {
        1: {
            name: 'Иван Петров',
            position: 'Руководитель',
            experience: '10 лет в логистике',
            description: 'Основатель компании, эксперт в области грузоперевозок и логистики.',
            email: 'ivan@cargo-transport.by'
        },
        2: {
            name: 'Елена Сидорова',
            position: 'Операционный менеджер',
            experience: '7 лет в управлении',
            description: 'Координирует работу операторов и обеспечивает качество обслуживания.',
            email: 'elena@cargo-transport.by'
        },
        3: {
            name: 'Алексей Иванов',
            position: 'Логист',
            experience: '5 лет в логистике',
            description: 'Специалист по планированию маршрутов и оптимизации перевозок.',
            email: 'alexey@cargo-transport.by'
        }
    };
    
    const member = teamMembers[memberId];
    if (member) {
        const modalHtml = `
            <div class="modal" style="display: block;">
                <div class="modal-content">
                    <span class="close" onclick="closeModal()">&times;</span>
                    <h3>${member.name}</h3>
                    <p><strong>Должность:</strong> ${member.position}</p>
                    <p><strong>Опыт:</strong> ${member.experience}</p>
                    <p><strong>Описание:</strong> ${member.description}</p>
                    <p><strong>Email:</strong> ${member.email}</p>
                </div>
            </div>
        `;
        
        // Создаем модальное окно
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);
        
        // Обработчик закрытия по клику вне окна
        window.onclick = function(event) {
            if (event.target === modalContainer.firstChild) {
                closeModal();
            }
        }
    }
}

function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// Инициализация интерактивной временной шкалы
function initializeTimeline() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    timelineItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            const year = item.querySelector('span').textContent;
            showTimelineDetails(year, index);
        });
    });
}

function showTimelineDetails(year, index) {
    const details = {
        '2015': 'Основание компании с парком из 5 грузовиков. Первые клиенты - местные предприятия.',
        '2017': 'Расширение автопарка до 20 единиц техники. Выход на межгородские перевозки.',
        '2020': 'Запуск системы онлайн-заявок и отслеживания. Парк вырос до 50 автомобилей.',
        '2023': 'Достигнута отметка в 5000+ выполненных заказов. Технопарк - 120+ единиц техники.'
    };
    
    alert(`${year}: ${details[year] || 'Информация о этом годе'}`);
}