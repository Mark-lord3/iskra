(function () {
    'use strict';

    function esc(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }
    function fmt(iso) {
        if (!iso) return '-';
        try { return new Date(iso).toLocaleString('uk-UA', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
        catch(e) { return iso; }
    }
    function fmtShort(iso) {
        if (!iso) return '-';
        try { return new Date(iso).toLocaleString('uk-UA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
        catch(e) { return iso; }
    }

    function api(method, path, body) {
        var opts = { method: method, credentials: 'include', headers: {} };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        return fetch(path, opts)
            .then(function(r) { return r.json().then(function(d) { d._ok = r.ok; return d; }); });
    }

    var authGate = document.getElementById('authGate');
    var adminApp = document.getElementById('adminApp');
    var loginForm= document.getElementById('loginForm');
    var loginError=document.getElementById('loginError');
    var loginBtn = document.getElementById('loginBtn');
    var pwEye    = document.getElementById('pwEye');
    var lockTimer= null;

    api('GET', '/api/admin/me').then(function(d) {
        if (d._ok) onAuthed();
    }).catch(function(){});

    if (pwEye) {
        pwEye.addEventListener('click', function() {
            var inp = document.getElementById('loginPw');
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });
    }

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        loginError.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Входимо...';

        var id = document.getElementById('loginId').value.trim();
        var pw = document.getElementById('loginPw').value;

        fetch('/api/admin/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: id, password: pw })
        }).then(function(r) { return r.json().then(function(d){ d._ok = r.ok; return d; }); })
          .then(function(d) {
              if (d._ok) {
                  onAuthed();
              } else if (d.code === 'LOCKED') {
                  startLock(d.retryAfter || 30);
              } else {
                  loginError.textContent = d.error || 'Невірний логін або пароль';
                  loginError.style.display = 'block';
              }
          }).catch(function() {
              loginError.textContent = 'Помилка з\'єднання';
              loginError.style.display = 'block';
          }).finally(function() {
              loginBtn.disabled = false;
              loginBtn.textContent = 'Увійти';
          });
    });

    function startLock(minutes) {
        var pw = document.getElementById('loginPw');
        pw.disabled = loginBtn.disabled = true;
        if (lockTimer) clearInterval(lockTimer);
        var endsAt = Date.now() + minutes * 60 * 1000;
        function tick() {
            var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
            var m = Math.floor(left/60), s = left % 60;
            loginError.textContent = 'Акаунт заморожено. Спробуйте через ' + m + ':' + (s<10?'0':'') + s;
            loginError.style.display = 'block';
            if (left <= 0) { clearInterval(lockTimer); pw.disabled = loginBtn.disabled = false; loginError.style.display = 'none'; }
        }
        tick();
        lockTimer = setInterval(tick, 1000);
    }

    ['logoutBtn','logoutBtnMob'].forEach(function(id) {
        var btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', function() {
            fetch('/api/admin/logout', { method:'POST', credentials:'include' }).finally(function(){ location.reload(); });
        });
    });

    var allEvents  = [];
    var filterMode = 'all';
    var searchQ    = '';
    var activeTab  = 'tickets';
    var selectedEv = null;

    function onAuthed() {
        authGate.style.display = 'none';
        adminApp.removeAttribute('hidden');
        loadData();
    }

    function loadData() {
        Promise.all([
            api('GET', '/api/admin/events'),
            api('GET', '/api/admin/archive/events')
        ]).then(function(res) {
            allEvents = (res[0].events || []).concat(res[1].events || []);
            renderEventList();
        }).catch(function() {
            document.getElementById('archiveEventList').innerHTML =
                '<div class="empty-state">Помилка завантаження</div>';
        });
    }

    function renderEventList() {
        var q = searchQ.toLowerCase();
        var data = allEvents.filter(function(ev) {
            var matchMode = filterMode === 'all' ||
                (filterMode === 'active'   && ev.active !== false) ||
                (filterMode === 'archived' && ev.active === false);
            var matchQ = !q || (ev.title || '').toLowerCase().includes(q);
            return matchMode && matchQ;
        }).slice().sort(function(a,b) {

            return (b.date || '').localeCompare(a.date || '');
        });

        var list = document.getElementById('archiveEventList');

        if (!data.length) {
            list.innerHTML = '<div class="empty-state" style="padding:24px 12px">Подій не знайдено</div>';
            return;
        }

        list.innerHTML = data.map(function(ev) {
            var archived = ev.active === false;
            var sel = selectedEv && selectedEv.id === ev.id ? ' selected' : '';
            var badge = archived
                ? '<span class="arc-badge arch">Архів</span>'
                : '<span class="arc-badge act">Активна</span>';
            var dateStr = ev.date ? new Date(ev.date).toLocaleDateString('uk-UA', {day:'numeric',month:'short',year:'numeric'}) : '';
            return '<button class="arc-ev-item' + sel + '" data-id="' + esc(ev.id) + '">' +
                '<div class="arc-ev-name">' + esc(ev.title) + '</div>' +
                '<div class="arc-ev-meta">' + esc(dateStr) + '</div>' +
                badge +
            '</button>';
        }).join('');

        list.querySelectorAll('[data-id]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var ev = allEvents.find(function(e){ return e.id === id; });
                if (ev) selectEvent(ev);
            });
        });
    }

    function selectEvent(ev) {
        selectedEv = ev;
        renderEventList();

        var empty   = document.getElementById('archiveEmpty');
        var content = document.getElementById('archiveContent');
        empty.style.display = 'none';
        content.removeAttribute('hidden');

        var archived = ev.active === false;
        var priceStr = ev.price > 0 ? ev.price + ' $' : 'Безкоштовно';
        var archiveLine = archived && ev.archivedAt
            ? '<span>· Архівовано: ' + esc(fmtShort(ev.archivedAt)) + '</span>'
            : '';
        var actions = archived
            ? '<div class="arc-actions">' +
                  '<button class="btn-ghost sm" id="restoreEvBtn">Відновити</button>' +
                  '<button class="btn-ev del" id="purgeEvBtn">Видалити назавжди</button>' +
              '</div>'
            : '';

        document.getElementById('archiveEventHead').innerHTML =
            '<div class="arc-head">' +
                '<div>' +
                    '<h2 class="arc-head-title">' + esc(ev.title) + '</h2>' +
                    '<div class="arc-head-meta">' +
                        (ev.date ? '<span>' + esc(fmt(ev.date)) + '</span>' : '') +
                        (ev.location ? '<span>· ' + esc(ev.location) + '</span>' : '') +
                        '<span>· ' + esc(priceStr) + '</span>' +
                        (ev.capacity ? '<span>· Місць: ' + esc(ev.capacity) + '</span>' : '') +
                        archiveLine +
                    '</div>' +
                '</div>' +
                '<span class="arc-badge ' + (archived ? 'arch' : 'act') + '" style="align-self:flex-start">' +
                    (archived ? 'Архів' : 'Активна') +
                '</span>' +
            '</div>' +
            actions;

        var restoreBtn = document.getElementById('restoreEvBtn');
        var purgeBtn   = document.getElementById('purgeEvBtn');
        if (restoreBtn) restoreBtn.addEventListener('click', function() { restoreEvent(ev); });
        if (purgeBtn) purgeBtn.addEventListener('click', function() { purgeEvent(ev); });

        var tkt = document.getElementById('archiveTickets');
        var srv = document.getElementById('archiveSurveys');
        var fbk = document.getElementById('archiveFeedback');
        tkt.innerHTML = '<div class="empty-state">Завантаження...</div>';
        srv.innerHTML = '<div class="empty-state">Завантаження...</div>';
        fbk.innerHTML = '<div class="empty-state">Завантаження...</div>';

        var base = archived ? '/api/admin/archive/events/' + encodeURIComponent(ev.id) : '/api/admin/events/' + encodeURIComponent(ev.id);
        Promise.all([
            api('GET', base + '/tickets'),
            api('GET', base + '/surveys'),
            api('GET', '/api/admin/feedback/' + encodeURIComponent(ev.id))
        ])
            .then(function(res) {
                if (!selectedEv || selectedEv.id !== ev.id) return;
                var evTickets = res[0].tickets || [];
                var evSurveys = res[1].surveys || [];
                var evFeedback = res[2];
                document.getElementById('tabTicketCount').textContent = evTickets.length || '';
                document.getElementById('tabSurveyCount').textContent = evSurveys.length || '';
                document.getElementById('tabFeedbackCount').textContent = evFeedback.total || '';
                renderArchiveTickets(evTickets);
                renderArchiveSurveys(evSurveys);
                renderArchiveFeedback(evFeedback);
            })
            .catch(function() {
                tkt.innerHTML = '<div class="empty-state">Помилка завантаження</div>';
            });
    }

    function restoreEvent(ev) {
        if (!confirm('Відновити подію «' + ev.title + '»?')) return;
        api('PUT', '/api/admin/events/' + encodeURIComponent(ev.id), { active: true })
            .then(function(d) {
                if (d._ok) afterMutation();
                else alert(d.error || 'Помилка відновлення');
            })
            .catch(function() { alert('Помилка з\'єднання'); });
    }

    function purgeEvent(ev) {
        if (!confirm('Видалити назавжди подію «' + ev.title + '» разом з усіма резерваціями та опитуваннями? Це незворотна дія.')) return;
        api('DELETE', '/api/admin/archive/events/' + encodeURIComponent(ev.id))
            .then(function(d) {
                if (d._ok) afterMutation();
                else alert(d.error || 'Помилка видалення');
            })
            .catch(function() { alert('Помилка з\'єднання'); });
    }

    function afterMutation() {
        selectedEv = null;
        document.getElementById('archiveContent').setAttribute('hidden', '');
        document.getElementById('archiveEmpty').style.display = '';
        loadData();
    }

    function renderArchiveTickets(tickets) {
        var list = document.getElementById('archiveTickets');
        if (!tickets.length) {
            list.innerHTML = '<div class="empty-state">Резервацій немає</div>';
            return;
        }
        list.innerHTML = tickets.map(function(t) {
            var st = t.status || 'active';
            var stLabel = { active:'Дійсний', used:'Оплачено', cancelled:'Скасовано' }[st] || st;
            var buyer = esc(t.buyerName || t.buyerEmail || t.buyerPhone || '-');
            var contact = t.buyerEmail || t.buyerPhone || '';
            var usedLine = st === 'used' && t.usedAt ? ' · Оплачено: ' + fmtShort(t.usedAt) : '';
            return '<div class="ticket-card">' +
                '<div class="ticket-status-dot ' + esc(st) + '"></div>' +
                '<div class="ticket-main">' +
                    '<div class="ticket-event-name">' + buyer + (contact && contact !== t.buyerName ? ' · <span style="color:var(--text2)">' + esc(contact) + '</span>' : '') + '</div>' +
                    '<div class="ticket-buyer">' + esc(fmtShort(t.purchasedAt)) + esc(usedLine) + '</div>' +
                '</div>' +
                '<div class="ticket-price' + (t.price > 0 ? '' : ' free') + '">' + (t.price > 0 ? t.price + ' $' : 'Безкоштовно') + '</div>' +
                '<div class="ticket-badge ' + esc(st) + '">' + esc(stLabel) + '</div>' +
            '</div>';
        }).join('');
    }

    function renderArchiveSurveys(surveys) {
        var list = document.getElementById('archiveSurveys');
        if (!surveys.length) {
            list.innerHTML = '<div class="empty-state">Опитувань немає</div>';
            return;
        }
        list.innerHTML = surveys.map(function(s) {
            var contact  = s.userEmail || s.userPhone || 'Невідомо';
            var answers  = s.answers || {};
            var keys     = Object.keys(answers);
            var ansHtml  = keys.length
                ? keys.map(function(k) {
                    return '<div class="answer-item"><div class="answer-key">' + esc(k) + '</div><div class="answer-val">' + esc(answers[k]) + '</div></div>';
                }).join('')
                : '<div class="answer-item"><div class="answer-val" style="color:var(--text3)">Немає відповідей</div></div>';

            return '<div class="survey-card">' +
                '<div class="survey-card-head">' +
                    '<div class="survey-contact">' + esc(contact) + '</div>' +
                    '<div class="survey-date">' + esc(fmtShort(s.updatedAt)) + '</div>' +
                    '<svg class="survey-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>' +
                '</div>' +
                '<div class="survey-answers">' + ansHtml + '</div>' +
            '</div>';
        }).join('');

        list.querySelectorAll('.survey-card-head').forEach(function(h) {
            h.addEventListener('click', function(){ this.closest('.survey-card').classList.toggle('open'); });
        });
    }

    var FB_LABELS = {
        host: 'Ведучий', dj: 'DJ', music: 'Музика', photographer: 'Фотограф',
        barStaff: 'Персонал бару', atmosphere: 'Атмосфера', people: 'Люди',
        party: 'Вечірка', ticketPrice: 'Ціна', organization: 'Організація'
    };

    function renderArchiveFeedback(data) {
        var el = document.getElementById('archiveFeedback');
        if (!data || !data.total) {
            el.innerHTML = '<div class="empty-state">Відгуків немає</div>';
            return;
        }
        var html = '<div class="feedback-summary">';
        html += '<div class="feedback-total">Відгуків: ' + data.total + '</div>';
        var cats = Object.keys(FB_LABELS);
        html += '<div class="feedback-avg-grid">';
        for (var i = 0; i < cats.length; i++) {
            var key = cats[i];
            var avg = data.avgRatings[key];
            html += '<div class="feedback-avg-item">' +
                '<div class="feedback-avg-label">' + FB_LABELS[key] + '</div>' +
                '<div class="feedback-avg-val">' + (avg != null ? '<span class="star-active">★</span> ' + avg : '-') + '</div>' +
            '</div>';
        }
        html += '</div>';
        var ca = data.comeAgainCounts || {};
        html += '<div class="feedback-comeagain">' +
            '<span>Прийдуть ще: <b>' + (ca.yes || 0) + '</b></span>' +
            '<span>Ні: <b>' + (ca.no || 0) + '</b></span>' +
            '<span>Можливо: <b>' + (ca.maybe || 0) + '</b></span>' +
        '</div></div>';

        html += '<div class="feedback-list">';
        var fbArr = data.feedback || [];
        for (var j = 0; j < fbArr.length; j++) {
            var fb = fbArr[j];
            var caLabel = fb.comeAgain === 'yes' ? 'Так' : fb.comeAgain === 'no' ? 'Ні' : 'Можливо';
            html += '<div class="feedback-entry">' +
                '<div class="feedback-entry-head">' +
                    '<span class="feedback-entry-date">' + esc(fmtShort(fb.createdAt)) + '</span>' +
                    '<span class="feedback-entry-come">Прийде ще: ' + esc(caLabel) + '</span>' +
                '</div>' +
                '<div class="feedback-entry-ratings">';
            for (var k = 0; k < cats.length; k++) {
                var rKey = cats[k];
                var rVal = fb.ratings[rKey];
                if (rVal != null) {
                    html += '<span class="feedback-mini-rating">' + FB_LABELS[rKey] + ': ' + rVal + '/5</span>';
                }
            }
            html += '</div>';
            if (fb.comment) {
                html += '<div class="feedback-entry-comment">' + esc(fb.comment) + '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        el.innerHTML = html;
    }

    document.getElementById('archiveTabs').addEventListener('click', function(e) {
        var tab = e.target.closest('.archive-tab');
        if (!tab) return;
        var name = tab.getAttribute('data-tab');
        activeTab = name;
        document.querySelectorAll('.archive-tab').forEach(function(t){ t.classList.toggle('active', t === tab); });
        document.getElementById('tabTickets').hidden = name !== 'tickets';
        document.getElementById('tabSurveys').hidden = name !== 'surveys';
        document.getElementById('tabFeedback').hidden = name !== 'feedback';
    });

    document.querySelector('.archive-filter-row').addEventListener('click', function(e) {
        var pill = e.target.closest('[data-af]');
        if (!pill) return;
        filterMode = pill.getAttribute('data-af');
        document.querySelectorAll('[data-af]').forEach(function(p){ p.classList.toggle('active', p === pill); });
        renderEventList();
    });

    document.getElementById('archiveSearch').addEventListener('input', function() {
        searchQ = this.value;
        renderEventList();
    });

})();
