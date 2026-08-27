(async function() {
    var params = new URLSearchParams(window.location.search);
    var ticketId = params.get('ticket');
    var sessionId = params.get('session_id');
    var card = document.getElementById('successCard');

    if (!ticketId && !sessionId) {
        card.innerHTML = '<div class="success-desc">Невірне посилання.</div>';
        return;
    }

    if (sessionId) {
        try {
            var res = await fetch('/api/tickets/by-session?session_id=' + encodeURIComponent(sessionId));
            var data = await res.json();
            if (data.ticket) ticketId = data.ticket.id;
        } catch (e) {}
    }

    if (ticketId) {
        try {
            var res2 = await fetch('/api/tickets/' + encodeURIComponent(ticketId));
            var t = await res2.json();
            if (t.ticket) {
                var tk = t.ticket;
                var qrHtml = '';
                if (tk.qrCode) {
                    qrHtml = '<div class="qr-wrapper">' +
                        '<img src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&bgcolor=ffffff&color=000000&data=' + encodeURIComponent(tk.qrCode) + '" alt="QR Code" width="260" height="260">' +
                        '</div>' +
                        '<div class="ticket-code">' + tk.qrCode + '</div>';
                }
                card.innerHTML =
                    '<div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#00d060" stroke-width="3" width="28" height="28"><polyline points="20 6 9 17 4 12"/></svg></div>' +
                    '<div class="success-title">Квиток придбано!</div>' +
                    '<div class="success-desc">Квиток на <strong>' + (tk.eventTitle || '') + '</strong><br>Надіслано на вашу пошту.</div>' +
                    qrHtml +
                    '<div class="success-btns">' +
                    '<a href="/dashboard" class="success-btn">МОЇ КВИТКИ</a>' +
                    '<a href="/" class="success-btn">НА ГОЛОВНУ</a>' +
                    '</div>';
                return;
            }
        } catch (e) {}
    }

    card.innerHTML =
        '<div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#00d060" stroke-width="3" width="28" height="28"><polyline points="20 6 9 17 4 12"/></svg></div>' +
        '<div class="success-title">Оплату отримано!</div>' +
        '<div class="success-desc">Ваш квиток буде створено автоматично.<br>Перевірте пошту.</div>' +
        '<br><a href="/" class="success-btn">НА ГОЛОВНУ</a>';
})();
