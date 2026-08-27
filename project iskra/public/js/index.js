(async function() {
    var burger = document.getElementById('navBurger');
    var menu = document.getElementById('mobileMenu');
    if (burger && menu) {
        burger.addEventListener('click', function() {
            menu.classList.toggle('open');
        });
        menu.querySelectorAll('.mobile-link').forEach(function(link) {
            link.addEventListener('click', function() {
                menu.classList.remove('open');
            });
        });
    }

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

    loadEvents();
    loadGallery();
})();

async function loadEvents() {
    try {
        var res = await fetch('/api/events');
        var data = await res.json();
        var events = (data.events || []).sort(function(a, b) { return a.date.localeCompare(b.date); });

        var now = new Date();
        var todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        var upcoming = [];
        var past = [];
        events.forEach(function(ev) {
            var evDate = new Date(ev.date);
            var evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());
            if (evDay >= todayDay) upcoming.push(ev);
            else past.push(ev);
        });

        var nextUpcoming = upcoming[0];
        if (nextUpcoming) {
            renderNextEvent(nextUpcoming);
        } else {
            var card = document.getElementById('nextEventCard');
            if (card) card.style.display = 'none';
        }

        var list = document.getElementById('eventsList');
        if (events.length === 0) {
            list.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3);font-size:0.85rem;">Немає подій</div>';
            return;
        }

        var html = '';
        events.forEach(function(ev) {
            var date = new Date(ev.date);
            var day = date.getDate();
            var month = date.toLocaleDateString('uk', { month: 'short' }).toUpperCase();
            var evDateObj = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            var isPast = evDateObj < todayDay;
            var soldOut = ev.remaining !== null && ev.remaining <= 0;
            var statusClass = isPast ? 'past' : soldOut ? 'sold-out' : 'upcoming';
            var statusText = isPast ? 'ЗАВЕРШЕНО' : soldOut ? 'РОЗПРОДАНО' : (ev.price > 0 ? '$' + ev.price : 'Безкоштовно');

            html += '<a href="/buy?event=' + encodeURIComponent(ev.id) + '" class="event-row">' +
                '<div class="event-row-date">' +
                    '<div class="event-row-day">' + day + '</div>' +
                    '<div class="event-row-month">' + month + '</div>' +
                '</div>' +
                '<div class="event-row-info">' +
                    '<div class="event-row-title">' + escapeHtml(ev.title) + '</div>' +
                    '<div class="event-row-meta">' + (ev.location ? escapeHtml(ev.location) : '') + (ev.time ? ' · ' + escapeHtml(ev.time) : '') + '</div>' +
                '</div>' +
                '<div class="event-row-status ' + statusClass + '">' + statusText + '</div>' +
            '</a>';
        });
        list.innerHTML = html;
    } catch (e) {}
}

function renderNextEvent(ev) {
    var date = new Date(ev.date);
    var day = date.getDate();
    var monthUk = ['СІЧНЯ', 'ЛЮТОГО', 'БЕРЕЗНЯ', 'КВІТНЯ', 'ТРАВНЯ', 'ЧЕРВНЯ', 'ЛИПНЯ', 'СЕРПНЯ', 'ВЕРЕСНЯ', 'ЖОВТНЯ', 'ЛИСТОПАДА', 'ГРУДНЯ'][date.getMonth()];

    document.getElementById('neDay').textContent = day;
    document.getElementById('neMonth').textContent = monthUk;
    document.getElementById('neTitle').textContent = ev.title;

    var venueEl = document.getElementById('neVenue');
    var venueParts = [];
    if (ev.artist) venueParts.push(ev.artist);
    if (ev.venue) venueParts.push(ev.venue);
    venueEl.textContent = venueParts.join(' \u2014 ');
    venueEl.style.display = venueParts.length ? '' : 'none';

    var locEl = document.getElementById('neLocation');
    locEl.textContent = ev.location || '';
    locEl.style.display = ev.location ? '' : 'none';

    var btn = document.getElementById('neBtn');
    btn.href = '/buy?event=' + encodeURIComponent(ev.id);

    var poster = document.getElementById('nextEventPoster');
    if (ev.image) {
        poster.innerHTML = '<img src="' + escapeHtml(ev.image) + '" alt="' + escapeHtml(ev.title) + '">';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function loadGallery() {
    try {
        var res = await fetch('/api/gallery');
        var data = await res.json();
        var grid = document.getElementById('galleryGrid');
        var images = data.images || [];

        if (images.length === 0) {
            grid.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.3);font-size:0.85rem;grid-column:1/-1;">Немає фото</div>';
            return;
        }

        grid.innerHTML = images.map(function(img) {
            return '<div class="gallery-card">' +
                '<img src="' + escapeHtml(img.url) + '" alt="' + escapeHtml(img.alt || '') + '" loading="lazy">' +
                (img.alt ? '<div class="gallery-card-info"><span>' + escapeHtml(img.alt) + '</span></div>' : '') +
            '</div>';
        }).join('');
    } catch (e) {}
}
