class AdminPanel {
    constructor() {
        this.init();
    }

    init() {
        this.loadStats();
        this.loadBids();
    }

    async loadStats() {
        const bids = await transportDB.getAllBids();
        const users = await transportDB.getData('client_auth');
        const trucks = await transportDB.getData('trucks');
        const drivers = await transportDB.getData('drivers');

        const stats = {
            totalBids: bids.length,
            newBids: bids.filter(bid => bid.status === 'новая').length,
            activeBids: bids.filter(bid => bid.status === 'в работе').length,
            totalUsers: users.length,
            totalTrucks: trucks.length,
            totalDrivers: drivers.length
        };

        this.displayStats(stats);
    }

    displayStats(stats) {
        // Можно добавить отображение статистики на странице
        console.log('Статистика:', stats);
    }

    async loadBids() {
        const bids = await transportDB.getAllBids();
        this.displayBids(bids);
    }

    displayBids(bids) {
        const bidsList = document.getElementById('zayavkiList');
        
        if (bids.length === 0) {
            bidsList.innerHTML = '<p>Нет заявок</p>';
            return;
        }

        let html = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 12px; border: 1px solid #ddd;">ID</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Маршрут</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Дата создания</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Статус</th>
                            <th style="padding: 12px; border: 1px solid #ddd;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        bids.forEach(bid => {
            const statusColor = this.getStatusColor(bid.status);
            html += `
                <tr>
                    <td style="padding: 12px; border: 1px solid #ddd;">${bid.id}</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">
                        <strong>${bid.wherefrom}</strong> → <strong>${bid.towhere}</strong>
                    </td>
                    <td style="padding: 12px; border: 1px solid #ddd;">${bid.date}</td>
                    <td style="padding: 12px; border: 1px solid #ddd;">
                        <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                            ${bid.status}
                        </span>
                    </td>
                    <td style="padding: 12px; border: 1px solid #ddd;">
                        <select onchange="adminPanel.updateBidStatus(${bid.id}, this.value)" 
                                style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
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
    }

    getStatusColor(status) {
        const colors = {
            'новая': '#007bff',
            'в работе': '#ffc107',
            'выполнена': '#28a745',
            'отменена': '#dc3545'
        };
        return colors[status] || '#6c757d';
    }

    async updateBidStatus(bidId, newStatus) {
        try {
            await transportDB.updateBidStatus(bidId, newStatus);
            this.loadBids(); // Обновляем список
            this.loadStats(); // Обновляем статистику
        } catch (error) {
            alert('Ошибка при обновлении статуса: ' + error.message);
        }
    }
}

// Создаем глобальный экземпляр админ-панели
const adminPanel = new AdminPanel();