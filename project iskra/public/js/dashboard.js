var ownedEventIds = new Set();
var currentUserEmail = null;
var currentTickets = [];
var pendingEventId = null;

(async function() {
    var langBtns = document.querySelectorAll('.lang-btn-nav');
    langBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var lang = this.getAttribute('data-lang');
            if (window.IskraI18n) window.IskraI18n.setLang(lang);
            langBtns.forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
        });
    });
    var savedLang = localStorage.getItem('iskra_lang') || 'uk';
    langBtns.forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-lang') === savedLang);
    });

    var params = new URLSearchParams(window.location.search);
    var token = params.get('token');

    if (token) {
        await verifyMagicToken(token);
        return;
    }

    await tryAutoAuth();
})();

function t(key) {
    return window.IskraI18n ? window.IskraI18n.t(key) : key;
}

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function verifyMagicToken(token) {
    try {
        var res = await fetch('/api/auth/verify?token=' + encodeURIComponent(token));
        var data = await res.json();
        if (res.ok && data.email) {
            currentUserEmail = data.email;
            showDashboard();
        } else {
            showGate(t('gate-invalid-token') || 'Invalid or expired link');
        }
    } catch (e) {
        showGate(t('error-load'));
    }
    window.history.replaceState({}, '', '/dashboard');
}

async function tryAutoAuth() {
    try {
        var res = await fetch('/api/tickets/by-email');
        if (res.ok) {
            var data = await res.json();
            currentUserEmail = data.email;
            currentTickets = data.tickets || [];
            showDashboard();
            return;
        }
    } catch (e) {}

    try {
        var myRes = await fetch('/api/tickets/my');
        if (myRes.ok) {
            var myData = await myRes.json();
            if (myData.tickets && myData.tickets.length > 0) {
                currentTickets = myData.tickets;
                ownedEventIds = new Set(myData.tickets.filter(function(tk) {
                    return tk.status === 'active';
                }).map(function(tk) { return tk.eventId; }));
                showDashboard();
                return;
            }
        }
    } catch (e) {}

    showGate();
}

function showGate(errorMsg) {
    document.getElementById('emailGate').style.display = '';
    document.getElementById('eventDetail').style.display = 'none';
    document.getElementById('ticketsSection').style.display = 'none';
    if (errorMsg) {
        var msgEl = document.getElementById('gateMsg');
        msgEl.textContent = errorMsg;
        msgEl.className = 'gate-msg error';
        msgEl.style.display = '';
    }
}

function showDashboard() {
    document.getElementById('emailGate').style.display = 'none';
    document.getElementById('eventDetail').style.display = '';
    document.getElementById('ticketsSection').style.display = '';
    loadEventDetail();
    loadTickets();
}

document.getElementById('magicLinkForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    var email = document.getElementById('gateEmail').value.trim();
    if (!email) return;

    var btn = document.getElementById('gateBtn');
    var msg = document.getElementById('gateMsg');
    btn.disabled = true;
    btn.textContent = '...';
    msg.style.display = 'none';

    try {
        var res = await fetch('/api/auth/magic-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        var data = await res.json();
        if (res.ok) {
            msg.textContent = t('gate-check-email') || 'Check your email for the link!';
            msg.className = 'gate-msg success';
            msg.style.display = '';
            currentUserEmail = email;
        } else {
            msg.textContent = data.error || t('error-load');
            msg.className = 'gate-msg error';
            msg.style.display = '';
        }
    } catch (err) {
        msg.textContent = t('connection-error');
        msg.className = 'gate-msg error';
        msg.style.display = '';
    }
    btn.disabled = false;
    btn.textContent = t('gate-btn');
});

async function loadEventDetail() {
    var params = new URLSearchParams(window.location.search);
    var eventId = params.get('event');
    if (!eventId) {
        document.getElementById('eventDetail').style.display = 'none';
        return;
    }

    var section = document.getElementById('eventDetail');
    section.style.display = '';

    try {
        var res = await fetch('/api/events');
        var data = await res.json();
        var ev = (data.events || []).find(function(e) { return e.id === eventId; });
        if (!ev) {
            section.innerHTML = '<div class="container"><p style="padding:100px 0;text-align:center;color:rgba(255,255,255,0.3);">Подію не знайдено</p></div>';
            return;
        }

        var date = new Date(ev.date);
        var day = date.getDate();
        var month = date.toLocaleDateString('en', { month: 'long' }).toUpperCase();
        var timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        var price = ev.price > 0 ? ev.price + ' $' : t('free');
        var soldOut = ev.remaining !== null && ev.remaining <= 0;

        document.getElementById('tchDay').textContent = day;
        document.getElementById('tchMonth').textContent = month;
        document.getElementById('tchTitle').textContent = ev.title;

        var flyerEl = document.getElementById('tchFlyer');
        var flyerImg = document.getElementById('tchFlyerImg');
        if (ev.image) {
            flyerImg.src = ev.image;
            flyerImg.alt = ev.title;
            flyerEl.style.display = '';
            flyerImg.onerror = function() { flyerEl.style.display = 'none'; };
        } else {
            flyerEl.style.display = 'none';
        }

        var locEl = document.getElementById('tchLocation');
        var addrEl = document.getElementById('tchAddress');
        if (ev.location) {
            var parts = ev.location.split(',');
            locEl.textContent = parts[0] ? parts[0].trim() : ev.location;
            addrEl.textContent = parts.length > 1 ? parts.slice(1).join(',').trim() : '';
        } else {
            locEl.textContent = '';
            addrEl.textContent = '';
        }

        document.getElementById('tchPrice').textContent = price;

        var seatsEl = document.getElementById('tchSeats');
        if (ev.remaining !== null) {
            if (soldOut) {
                seatsEl.textContent = t('event-sold-out');
                seatsEl.style.color = '#e63946';
            } else {
                seatsEl.textContent = t('seats-left').replace('{n}', ev.remaining);
            }
        }

        var descEl = document.getElementById('tchDesc');
        if (ev.description) {
            descEl.textContent = ev.description;
            descEl.style.display = '';
        } else {
            descEl.style.display = 'none';
        }

        var actionEl = document.getElementById('tchAction');
        if (ownedEventIds.has(ev.id)) {
            actionEl.innerHTML = '<button class="ed-reserve-btn done" disabled>' + t('btn-bought') + '</button>';
        } else if (soldOut) {
            actionEl.innerHTML = '<button class="ed-reserve-btn done" disabled>' + t('event-sold-out') + '</button>';
        } else if (ev.price > 0) {
            actionEl.innerHTML = '<a href="/buy?event=' + ev.id + '" class="ed-reserve-btn">' + t('btn-buy') + '</a>';
        } else {
            actionEl.innerHTML = '<button class="ed-reserve-btn" data-id="' + ev.id + '">' + t('btn-buy') + '</button>';
            actionEl.querySelector('.ed-reserve-btn').addEventListener('click', function() {
                openBuyModal(this.getAttribute('data-id'));
            });
        }
    } catch (e) {
        section.innerHTML = '<div class="container"><p style="padding:100px 0;text-align:center;color:rgba(255,255,255,0.3);">Помилка завантаження</p></div>';
    }
}

async function loadTickets() {
    try {
        var res;
        if (currentUserEmail) {
            res = await fetch('/api/tickets/by-email');
        } else {
            res = await fetch('/api/tickets/my');
        }
        var data = await res.json();
        var list = document.getElementById('ticketsList');

        currentTickets = data.tickets || [];
        ownedEventIds = new Set(currentTickets.filter(function(tk) {
            return tk.paymentStatus !== 'pending' && tk.paymentStatus !== 'failed' && tk.paymentStatus !== 'expired';
        }).map(function(tk) { return tk.eventId; }));

        if (currentTickets.length === 0) {
            list.innerHTML = '<div class="empty-state">' + t('empty-tickets') + '</div>';
            return;
        }

        list.innerHTML = currentTickets.map(function(ticket, idx) {
            var date = new Date(ticket.eventDate);
            var dateStr = date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
            var timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
            var priceText;
            if (ticket.paymentStatus === 'paid') {
                priceText = '$' + ticket.price.toFixed(2) + ' - ' + (t('paid') || 'Оплачено');
            } else if (ticket.paymentStatus === 'free') {
                priceText = t('free') || 'Безкоштовно';
            } else if (ticket.price > 0) {
                priceText = t('price-due').replace('{n}', ticket.price);
            } else {
                priceText = t('free') || 'Безкоштовно';
            }

            var statusLabel;
            var statusClass;
            if (ticket.status === 'used') {
                statusLabel = 'ВИКОРИСТАНО';
                statusClass = 'used';
            } else if (ticket.status === 'cancelled') {
                statusLabel = 'СКАСОВАНО';
                statusClass = 'cancelled';
            } else if (ticket.paymentStatus === 'paid' || ticket.paymentStatus === 'free') {
                statusLabel = 'ОПЛАЧЕНО';
                statusClass = 'paid';
            } else {
                statusLabel = 'ОЧІКУЄ ОПЛАТИ';
                statusClass = 'pending';
            }

            var imgHtml = ticket.eventImage
                ? '<img src="' + escapeHtml(ticket.eventImage) + '" alt="" class="ticket-card-img">'
                : '<div class="ticket-card-img ticket-card-img-placeholder">&#127916;</div>';

            return '<div class="ticket-card-new">' +
                imgHtml +
                '<div class="ticket-card-body">' +
                    '<div class="ticket-card-header">' +
                        '<h3 class="ticket-card-title">' + escapeHtml(ticket.eventTitle) + '</h3>' +
                        '<span class="ticket-status ' + statusClass + '">' + statusLabel + '</span>' +
                    '</div>' +
                    (ticket.eventArtist ? '<div class="ticket-card-artist">' + escapeHtml(ticket.eventArtist) + '</div>' : '') +
                    '<div class="ticket-card-meta">' +
                        '<span class="ticket-card-date">' + dateStr + ', ' + timeStr + '</span>' +
                        '<span class="ticket-card-email">' + escapeHtml(ticket.buyerEmail || '') + '</span>' +
                    '</div>' +
                    '<div class="ticket-card-bottom">' +
                        '<span class="ticket-price">' + priceText + '</span>' +
                        '<button class="ticket-qr-btn" data-ticket-idx="' + idx + '">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="3" height="3"></rect></svg>' +
                            ' QR' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        list.querySelectorAll('.ticket-qr-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var i = parseInt(this.getAttribute('data-ticket-idx'));
                if (currentTickets[i]) openTicketModal(currentTickets[i]);
            });
        });
    } catch (e) {
        document.getElementById('ticketsList').innerHTML = '<div class="empty-state">' + t('error-load') + '</div>';
    }
}

function openBuyModal(eventId) {
    pendingEventId = eventId;
    var overlay = document.getElementById('buyModal');
    var err = document.getElementById('buyError');
    err.style.display = 'none';
    document.getElementById('buyName').value = currentUserEmail ? '' : '';
    document.getElementById('buyEmail').value = currentUserEmail || '';
    document.getElementById('buySubmitBtn').disabled = false;
    document.getElementById('buySubmitBtn').querySelector('span').textContent = t('buy-submit');
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeBuyModal() {
    document.getElementById('buyModal').style.display = 'none';
    document.body.style.overflow = '';
    pendingEventId = null;
}

document.getElementById('buyModalClose').addEventListener('click', closeBuyModal);
document.getElementById('cancelBuyBtn').addEventListener('click', closeBuyModal);
document.getElementById('buyModal').addEventListener('click', function(e) {
    if (e.target === this) closeBuyModal();
});

document.getElementById('buyForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!pendingEventId) return;

    var name = document.getElementById('buyName').value.trim();
    var email = document.getElementById('buyEmail').value.trim().toLowerCase();
    var errEl = document.getElementById('buyError');
    errEl.style.display = 'none';

    if (!name) {
        errEl.textContent = 'Введіть ім\'я';
        errEl.style.display = 'block';
        return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Введіть коректний email';
        errEl.style.display = 'block';
        return;
    }

    var btn = document.getElementById('buySubmitBtn');
    btn.disabled = true;
    btn.querySelector('span').textContent = '...';

    try {
        var res = await fetch('/api/tickets/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: pendingEventId, name: name, email: email })
        });
        var data = await res.json();

        if (res.ok) {
            currentUserEmail = email;
            closeBuyModal();
            loadTickets().then(function() {
                loadEventDetail();
                if (data && data.ticket) {
                    setTimeout(function() { openTicketModal(data.ticket); }, 300);
                }
            });
        } else {
            errEl.textContent = data.error || t('error-load');
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.querySelector('span').textContent = t('buy-submit');
        }
    } catch (err) {
        errEl.textContent = t('connection-error');
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.querySelector('span').textContent = t('buy-submit');
    }
});

function openTicketModal(ticket) {
    var overlay = document.getElementById('ticketModal');
    if (!overlay) return;

    var badge = document.getElementById('ticketModalBadge');
    var status = ticket.status || 'active';
    badge.textContent = status === 'used' ? 'USED' : status === 'cancelled' ? 'CANCELLED' : 'ACTIVE';
    badge.className = 'ticket-modal-badge' + (status === 'used' || status === 'cancelled' ? ' used' : '');

    document.getElementById('ticketModalId').textContent = '#' + (ticket.id || '').slice(0, 8).toUpperCase();
    document.getElementById('ticketModalCode').textContent = ticket.qrCode || '';
    document.getElementById('ticketModalEvent').textContent = ticket.eventTitle || '';

    var date = new Date(ticket.eventDate);
    var dateStr = date.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('ticketModalDate').innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
        escapeHtml(dateStr) + ' · ' + escapeHtml(timeStr);

    var locEl = document.getElementById('ticketModalLocation');
    if (ticket.eventLocation) {
        locEl.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
            escapeHtml(ticket.eventLocation);
        locEl.style.display = '';
    } else {
        locEl.style.display = 'none';
    }

    document.getElementById('ticketModalBuyer').textContent = ticket.buyerName || '';
    document.getElementById('ticketModalPrice').textContent = ticket.paymentStatus === 'paid' ? (t('paid') || 'Оплачено') : (ticket.price > 0 ? t('price-due').replace('{n}', ticket.price) : t('free'));

    var qrImg = document.getElementById('ticketModalQr');
    qrImg.src = '';
    if (ticket.qrCode && typeof QRCode !== 'undefined') {
        QRCode.toDataURL(ticket.qrCode, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
            .then(function(url) { qrImg.src = url; })
            .catch(function() {});
    }

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeTicketModal() {
    var overlay = document.getElementById('ticketModal');
    if (!overlay) return;
    overlay.style.display = 'none';
    document.body.style.overflow = '';
}

document.getElementById('ticketModalClose').addEventListener('click', closeTicketModal);
document.getElementById('ticketModal').addEventListener('click', function(e) {
    if (e.target === this) closeTicketModal();
});

document.getElementById('ticketModalSave').addEventListener('click', function() {
    var img = document.getElementById('ticketModalQr');
    if (!img.src) return;
    var a = document.createElement('a');
    a.href = img.src;
    a.download = 'ticket-qr.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});
