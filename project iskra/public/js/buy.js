(async function() {
    var params = new URLSearchParams(window.location.search);
    var eventId = params.get('event');
    var loading = document.getElementById('buyLoading');
    var errBox = document.getElementById('buyError');
    var content = document.getElementById('buyContent');

    if (!eventId) {
        loading.style.display = 'none';
        errBox.textContent = 'Невірне посилання. Немає ID події.';
        errBox.style.display = '';
        return;
    }

    try {
        var res = await fetch('/api/events');
        var data = await res.json();
        var ev = (data.events || []).find(function(e) { return e.id === eventId; });

        if (!ev) {
            loading.style.display = 'none';
            errBox.textContent = 'Подію не знайдено.';
            errBox.style.display = '';
            return;
        }

        loading.style.display = 'none';
        content.style.display = '';

        var poster = document.getElementById('buyPoster');
        if (ev.image) {
            poster.innerHTML = '<img src="' + escapeHtml(ev.image) + '" alt="' + escapeHtml(ev.title) + '">';
        } else {
            poster.innerHTML = '<div class="buy-poster-placeholder">Немає фото</div>';
        }

        document.getElementById('buyTitle').textContent = ev.title || '';

        var days = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];
        var months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
        var date = new Date(ev.date);
        var dateStr = days[date.getDay()] + ', ' + date.getDate() + ' ' + months[date.getMonth()] + ', ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
        document.getElementById('buyDate').textContent = dateStr;

        var venueParts = [];
        if (ev.venue) venueParts.push(ev.venue);
        if (ev.location) venueParts.push(ev.location);
        var venueText = venueParts.join(', ');
        var venueRow = document.getElementById('buyVenueRow');
        if (venueText) {
            document.getElementById('buyVenue').textContent = venueText;
        } else {
            venueRow.style.display = 'none';
        }

        var desc = ev.description || '';
        var descEl = document.getElementById('buyDesc');
        if (desc) {
            descEl.textContent = desc;
        } else {
            descEl.parentElement.querySelector('.buy-section-label').style.display = 'none';
            descEl.style.display = 'none';
        }

        var priceVal = document.getElementById('buyPrice');
        if (ev.price > 0) {
            priceVal.textContent = '$' + ev.price.toFixed(2);
        } else {
            priceVal.textContent = 'Безкоштовно';
        }

        document.getElementById('buyForm').addEventListener('submit', function(e) {
            e.preventDefault();
            var first = document.getElementById('buyerFirst').value.trim();
            var last = document.getElementById('buyerLast').value.trim();
            var email = document.getElementById('buyerEmail').value.trim();
            var errEl = document.getElementById('buyFormError');
            var submitBtn = document.getElementById('buySubmit');

            if (!first) {
                errEl.textContent = 'Введіть ім\'я';
                errEl.classList.add('show');
                return;
            }
            if (!last) {
                errEl.textContent = 'Введіть прізвище';
                errEl.classList.add('show');
                return;
            }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errEl.textContent = 'Введіть коректний email';
                errEl.classList.add('show');
                return;
            }

            errEl.classList.remove('show');
            submitBtn.disabled = true;
            submitBtn.textContent = 'ОБРОБКА...';

            fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: ev.id, name: first + ' ' + last, email: email })
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.error) {
                    errEl.textContent = data.error;
                    errEl.classList.add('show');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Оформити замовлення';
                    return;
                }
                if (data.url) {
                    window.location.href = data.url;
                } else if (data.ticket) {
                    window.location.href = '/success?ticket=' + data.ticket.id;
                }
            })
            .catch(function() {
                errEl.textContent = 'Помилка з\'єднання. Спробуйте ще раз.';
                errEl.classList.add('show');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Оформити замовлення';
            });
        });

    } catch (e) {
        loading.style.display = 'none';
        errBox.textContent = 'Помилка завантаження.';
        errBox.style.display = '';
    }
})();

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
