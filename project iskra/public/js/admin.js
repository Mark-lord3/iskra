(function () {
    'use strict';

    function esc(s) {
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function compressImage(file, maxPx, quality) {
        maxPx = maxPx || 1200;
        quality = quality || 0.8;
        return new Promise(function(resolve) {
            if (!file.type.startsWith('image/') || file.size < 200 * 1024) { resolve(file); return; }
            var img = new Image();
            var url = URL.createObjectURL(file);
            img.onload = function() {
                URL.revokeObjectURL(url);
                var w = img.width, h = img.height;
                if (w <= maxPx && h <= maxPx) { resolve(file); return; }
                if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
                else { w = Math.round(w * maxPx / h); h = maxPx; }
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob(function(blob) {
                    if (!blob) { resolve(file); return; }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                }, 'image/jpeg', quality);
            };
            img.onerror = function() { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    }

    function fmt(iso, opts) {
        if (!iso) return '-';
        try {
            return new Date(iso).toLocaleString('uk-UA', opts || {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch (e) { return iso; }
    }

    function fmtShort(iso) {
        return fmt(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function initials(str) {
        if (!str) return '?';
        var parts = str.trim().split(/[\s@]/);
        return (parts[0][0] || '?').toUpperCase();
    }

    function toast(elId, msg, isErr, ms) {
        var el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.className = 'toast ' + (isErr ? 'err' : 'ok');
        clearTimeout(el._t);
        el._t = setTimeout(function () { el.className = 'toast'; }, ms || 3500);
    }

    function setBadge(id, n) {
        var el = document.getElementById(id);
        if (!el) return;
        if (n > 0) { el.textContent = n > 99 ? '99+' : n; el.classList.add('visible'); }
        else el.classList.remove('visible');
    }

    function api(method, path, body) {
        var opts = {
            method: method,
            credentials: 'include',
            headers: {}
        };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        return fetch(path, opts).then(function (r) {
            return r.json().then(function (d) {
                d._status = r.status;
                d._ok = r.ok;
                return d;
            });
        });
    }
    var myId = null;
    var authGate = document.getElementById('authGate');
    var adminApp = document.getElementById('adminApp');
    var loginForm = document.getElementById('loginForm');
    var loginError= document.getElementById('loginError');
    var loginBtn  = document.getElementById('loginBtn');
    var pwEye     = document.getElementById('pwEye');
    var lockTimer = null;

    api('GET', '/api/admin/me').then(function (d) {
        if (d._ok) onAuthed();
    }).catch(function () {});

    if (pwEye) {
        pwEye.addEventListener('click', function () {
            var inp = document.getElementById('loginPw');
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });
    }

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        loginError.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Входимо...';

        var identifier = document.getElementById('loginId').value.trim();
        var password   = document.getElementById('loginPw').value;

        api('POST', '/api/admin/login', { email: identifier, password: password })
            .then(function (d) {
                if (d._ok) {
                    onAuthed();
                } else if (d.code === 'LOCKED') {
                    startLockCountdown(d.retryAfter || 30);
                } else {
                    showLoginError(d.error || 'Невірний логін або пароль');
                }
            })
            .catch(function () {
                showLoginError('Помилка з\'єднання із сервером');
            })
            .finally(function () {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Увійти';
            });
    });

    function showLoginError(msg) {
        loginError.textContent = msg;
        loginError.style.display = 'block';
    }

    function startLockCountdown(minutes) {
        var pw  = document.getElementById('loginPw');
        var btn = loginBtn;
        pw.disabled = btn.disabled = true;
        if (lockTimer) clearInterval(lockTimer);

        var endsAt = Date.now() + minutes * 60 * 1000;
        function tick() {
            var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
            var m = Math.floor(left / 60), s = left % 60;
            showLoginError('Акаунт заморожено. Спробуйте через ' + m + ':' + (s < 10 ? '0' : '') + s);
            if (left <= 0) {
                clearInterval(lockTimer);
                pw.disabled = btn.disabled = false;
                loginError.style.display = 'none';
            }
        }
        tick();
        lockTimer = setInterval(tick, 1000);
    }

    function onAuthed() {
        authGate.style.display = 'none';
        adminApp.removeAttribute('hidden');
        api('GET', '/api/admin/me').then(function (d) {
            if (d._ok && d.id) myId = d.id;
        });
        loadAll();

        var el = document.getElementById('dashDate');
        if (el) el.textContent = new Date().toLocaleDateString('uk-UA', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }

    ['logoutBtn', 'logoutBtnMob'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', function () {
            api('POST', '/api/admin/logout')
                .finally(function () { location.reload(); });
        });
    });
    var SECTIONS = ['dashboard', 'events', 'tickets', 'users', 'gallery'];
    var TITLES   = { dashboard:'Дашборд', events:'Події', tickets:'Резервації', users:'Користувачі' };
    var currentSec = 'dashboard';

    document.querySelectorAll('[data-sec]').forEach(function (el) {
        el.addEventListener('click', function () {
            showSection(this.getAttribute('data-sec'));
        });
    });

    function showSection(name) {
        if (!SECTIONS.includes(name)) return;
        currentSec = name;

        SECTIONS.forEach(function (s) {
            var el = document.getElementById('sec' + cap(s));
            if (el) el.classList.toggle('hidden', s !== name);
        });

        document.querySelectorAll('.nav-item[data-sec]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-sec') === name);
        });

        document.querySelectorAll('.bn-item[data-sec]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-sec') === name);
        });

        var ttl = document.getElementById('topbarTitle');
        if (ttl) ttl.textContent = TITLES[name] || '';

        if (name === 'events'  && !loaded.events)  { loaded.events  = true; loadEvents(); }
        if (name === 'tickets' && !loaded.tickets)  { loaded.tickets = true; loadTickets(); }
        if (name === 'users'   && !loaded.users)    { loaded.users   = true; loadUsers(); }
        if (name === 'gallery' && !loaded.gallery)  { loaded.gallery = true; loadGallery(); }
    }

    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    var loaded = {};

    function loadAll() {
        Promise.all([
            api('GET', '/api/admin/events'),
            api('GET', '/api/admin/tickets'),
            api('GET', '/api/admin/users')
        ]).then(function (res) {
            var evs     = res[0].events  || [];
            var tickets = res[1].tickets || [];
            var users   = res[2].users   || [];

            var activeEvs = evs.filter(function (e) { return e.active !== false; });

            setText('dEvents',  activeEvs.length);
            setText('dTickets', tickets.length);
            setText('dUsers',   users.length);

            setBadge('nbEvents',  evs.length);
            setBadge('nbTickets', tickets.length);

            cache.events  = evs;
            cache.tickets = tickets;
            cache.users   = users;
        }).catch(function () {});

        loadClub();
    }

    var cache = { events: [], tickets: [], users: [] };

    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }
    var clubToggle = document.getElementById('clubToggle');
    var clubLabel  = document.getElementById('clubLabel');

    function loadClub() {
        api('GET', '/api/club').then(function (d) {
            clubToggle.checked = !!d.isOpen;
            updateClubLabel(d.isOpen);
            var msgEl = document.getElementById('clubMsg');
            if (msgEl) msgEl.value = d.message || '';
        }).catch(function () {});
    }

    clubToggle.addEventListener('change', function () {
        updateClubLabel(this.checked);
        api('PATCH', '/api/admin/club', {
            isOpen: clubToggle.checked,
            message: (document.getElementById('clubMsg').value || '').trim()
        }).then(function (d) {
            toast('clubToast', d._ok ? 'Збережено' : (d.error || 'Помилка'), !d._ok);
        }).catch(function () {
            toast('clubToast', 'Помилка з\'єднання', true);
        });
    });

    function updateClubLabel(open) {
        clubLabel.textContent = open ? 'Івенти доступні' : 'Івенти закриті';
        clubLabel.style.color = open ? 'var(--green)' : 'var(--red)';
    }

    document.getElementById('saveClubBtn').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        api('PATCH', '/api/admin/club', {
            isOpen: clubToggle.checked,
            message: (document.getElementById('clubMsg').value || '').trim()
        }).then(function (d) {
            toast('clubToast', d._ok ? 'Збережено' : (d.error || 'Помилка'), !d._ok);
        }).catch(function () {
            toast('clubToast', 'Помилка з\'єднання', true);
        }).finally(function () { btn.disabled = false; });
    });
    function loadEvents() {
        api('GET', '/api/admin/events').then(function (d) {
            cache.events = d.events || [];
            renderEvents(cache.events);
        }).catch(function () {
            document.getElementById('eventsList').innerHTML = '<div class="empty-state">Помилка завантаження</div>';
        });
    }

    function renderEvents(evs) {
        var list = document.getElementById('eventsList');
        if (!evs || evs.length === 0) {
            list.innerHTML = '<div class="empty-state">Подій ще немає.<br>Створіть першу подію.</div>';
            return;
        }

        var sorted = evs.slice().sort(function (a, b) {
            if ((a.active !== false) !== (b.active !== false)) return a.active === false ? 1 : -1;
            return (a.date || '').localeCompare(b.date || '');
        });

        list.innerHTML = sorted.map(function (ev) {
            var isArchived = ev.active === false;
            var badge = isArchived
                ? '<span class="event-badge archived">Архів</span>'
                : '<span class="event-badge active">Активна</span>';
            var priceStr = ev.price > 0 ? 'До оплати: ' + ev.price + ' $' : 'Безкоштовно';
            var cap = ev.capacity ? '· Місць: ' + ev.capacity : '';

            return '<div class="event-card' + (isArchived ? ' archived' : '') + '" data-id="' + esc(ev.id) + '">' +
                '<div class="event-color-dot"></div>' +
                '<div class="event-info">' +
                    '<div class="event-name">' + esc(ev.title) + '</div>' +
                    '<div class="event-meta">' +
                        '<span class="event-meta-item">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
                            esc(fmt(ev.date)) +
                        '</span>' +
                        (ev.location ? '<span class="event-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' + esc(ev.location) + '</span>' : '') +
                        '<span class="event-meta-item">' + esc(priceStr) + ' ' + esc(cap) + '</span>' +
                    '</div>' +
                '</div>' +
                badge +
                '<div class="event-actions">' +
                    '<button class="btn-ev edit" data-edit="' + esc(ev.id) + '">Ред.</button>' +
                    '<button class="btn-ev ' + (isArchived ? 'toggle-off' : 'toggle-on') + '" data-toggle="' + esc(ev.id) + '" data-active="' + (!isArchived) + '">' +
                        (isArchived ? 'Відновити' : 'Архів') +
                    '</button>' +
                    '<button class="btn-ev del" data-del="' + esc(ev.id) + '">Видалити</button>' +
                '</div>' +
            '</div>';
        }).join('');

        list.querySelectorAll('[data-edit]').forEach(function (btn) {
            btn.addEventListener('click', function (e) { e.stopPropagation(); openEventModal(this.getAttribute('data-edit')); });
        });
        list.querySelectorAll('[data-toggle]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = this.getAttribute('data-toggle');
                var makeActive = this.getAttribute('data-active') === 'true';
                toggleEvent(id, makeActive);
            });
        });
        list.querySelectorAll('[data-del]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteEvent(this.getAttribute('data-del'));
            });
        });
    }

    function toggleEvent(id, makeActive) {
        api('PUT', '/api/admin/events/' + encodeURIComponent(id), { active: makeActive })
            .then(function () { loadEvents(); })
            .catch(function () { alert('Помилка. Спробуйте ще раз.'); });
    }

    function deleteEvent(id) {
        if (!confirm('Архівувати цю подію? Всі резервації та опитування будуть збережені в архіві. Відновити можна будь-коли.')) return;
        api('DELETE', '/api/admin/events/' + encodeURIComponent(id))
            .then(function (d) {
                loadEvents();
                if (d._ok) alert('Подію переміщено в архів. Знайти її можна в розділі «Архів подій».');
            })
            .catch(function () { alert('Помилка.'); });
    }

    var eventModal      = document.getElementById('eventModal');
    var modalTitle      = document.getElementById('modalTitle');
    var saveEventBtn    = document.getElementById('saveEventBtn');

    document.getElementById('openEventFormBtn').addEventListener('click', function () { openEventModal(null); });
    document.getElementById('closeEventModal').addEventListener('click', closeEventModal);
    document.getElementById('cancelEventModal').addEventListener('click', closeEventModal);

    var evSelectedFile = null;

    document.addEventListener('paste', function(e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        var evOpen = !eventModal.hasAttribute('hidden');
        var galOpen = !galleryModal.hasAttribute('hidden');
        if (!evOpen && !galOpen) return;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                var file = items[i].getAsFile();
                if (!file) continue;
                e.preventDefault();
                if (galOpen) {
                    compressImage(file).then(function(compressed) { handleGalFile(compressed); });
                    toast('galleryToast', 'Фото вставлено з буфера обміну');
                } else {
                    compressImage(file).then(function(compressed) {
                        evSelectedFile = compressed;
                        var reader = new FileReader();
                        reader.onload = function(ev) {
                            var img = document.getElementById('evPreviewImg');
                            img.src = ev.target.result;
                            img.style.display = '';
                            document.getElementById('evImagePlaceholder').style.display = 'none';
                            document.getElementById('evClearImageBtn').style.display = '';
                        };
                        reader.readAsDataURL(compressed);
                    });
                    toast('eventToast', 'Фото вставлено з буфера обміну');
                }
                break;
            }
        }
    });

    document.getElementById('evUploadBtn').addEventListener('click', function() {
        document.getElementById('evFileInput').click();
    });

    document.getElementById('evFileInput').addEventListener('change', function() {
        if (!this.files.length) return;
        var file = this.files[0];
        if (!file.type.startsWith('image/')) return;
        compressImage(file).then(function(compressed) {
            evSelectedFile = compressed;
            var reader = new FileReader();
            reader.onload = function(e) {
                var img = document.getElementById('evPreviewImg');
                img.src = e.target.result;
                img.style.display = '';
                document.getElementById('evImagePlaceholder').style.display = 'none';
                document.getElementById('evClearImageBtn').style.display = '';
            };
            reader.readAsDataURL(compressed);
        });
    });

    document.getElementById('evClearImageBtn').addEventListener('click', function() {
        evSelectedFile = null;
        document.getElementById('evImage').value = '';
        document.getElementById('evPreviewImg').style.display = 'none';
        document.getElementById('evImagePlaceholder').style.display = '';
        this.style.display = 'none';
        document.getElementById('evFileInput').value = '';
    });

    document.getElementById('evGalleryPickBtn').addEventListener('click', function() {
        var grid = document.getElementById('galleryPickerGrid');
        grid.innerHTML = '<div class="gallery-picker-empty">Завантаження...</div>';
        document.getElementById('galleryPickerModal').removeAttribute('hidden');
        api('GET', '/api/gallery').then(function(d) {
            var items = d.images || [];
            if (!items.length) { grid.innerHTML = '<div class="gallery-picker-empty">Галерея порожня</div>'; return; }
            grid.innerHTML = items.map(function(img) {
                return '<div class="gallery-picker-item" data-url="' + esc(img.url) + '"><img src="' + esc(img.url) + '" alt="' + esc(img.alt || '') + '" loading="lazy"></div>';
            }).join('');
            grid.querySelectorAll('.gallery-picker-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    var url = this.getAttribute('data-url');
                    document.getElementById('evImage').value = url;
                    var previewImg = document.getElementById('evPreviewImg');
                    previewImg.src = url;
                    previewImg.style.display = '';
                    document.getElementById('evImagePlaceholder').style.display = 'none';
                    document.getElementById('evClearImageBtn').style.display = '';
                    evSelectedFile = null;
                    document.getElementById('galleryPickerModal').setAttribute('hidden', '');
                });
            });
        }).catch(function() {
            grid.innerHTML = '<div class="gallery-picker-empty">Помилка завантаження</div>';
        });
    });

    document.getElementById('closeGalleryPicker').addEventListener('click', function() {
        document.getElementById('galleryPickerModal').setAttribute('hidden', '');
    });
    document.getElementById('galleryPickerModal').addEventListener('click', function(e) {
        if (e.target === this) this.setAttribute('hidden', '');
    });

    eventModal.addEventListener('click', function (e) {
        if (e.target === eventModal) closeEventModal();
    });

    function openEventModal(editId) {
        var ev = editId ? (cache.events || []).find(function (e) { return e.id === editId; }) : null;
        document.getElementById('editEventId').value = editId || '';

        modalTitle.textContent = ev ? 'Редагувати подію' : 'Нова подія';
        saveEventBtn.textContent = ev ? 'Зберегти зміни' : 'Створити подію';

        document.getElementById('evTitle').value    = ev ? (ev.title || '') : '';
        document.getElementById('evDesc').value     = ev ? (ev.description || '') : '';
        document.getElementById('evImage').value    = ev ? (ev.image || '') : '';
        document.getElementById('evLocation').value = ev ? (ev.location || '') : '';
        document.getElementById('evArtist').value   = ev ? (ev.artist || '') : '';
        document.getElementById('evVenue').value    = ev ? (ev.venue || '') : '';
        var evImgVal = ev ? (ev.image || '') : '';
        document.getElementById('evImage').value = evImgVal;
        var previewImg = document.getElementById('evPreviewImg');
        var placeholder = document.getElementById('evImagePlaceholder');
        var clearBtn = document.getElementById('evClearImageBtn');
        if (evImgVal) {
            previewImg.src = evImgVal;
            previewImg.style.display = '';
            placeholder.style.display = 'none';
            clearBtn.style.display = '';
        } else {
            previewImg.style.display = 'none';
            placeholder.style.display = '';
            clearBtn.style.display = 'none';
        }
        document.getElementById('evPrice').value    = ev ? (ev.price || 0) : 0;
        document.getElementById('evCapacity').value = ev ? (ev.capacity || '') : '';

        if (ev && ev.date) {

            var d = new Date(ev.date);
            var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('evDate').value = local;
        } else {
            document.getElementById('evDate').value = '';
        }

        evSelectedFile = null;
        var t = document.getElementById('eventToast');
        if (t) t.className = 'toast';

        eventModal.removeAttribute('hidden');
        document.getElementById('evTitle').focus();
    }

    function closeEventModal() {
        eventModal.setAttribute('hidden', '');
    }


    saveEventBtn.addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        btn.textContent = 'Збереження...';

        var title    = document.getElementById('evTitle').value.trim();
        var dateVal  = document.getElementById('evDate').value;
        var editId   = document.getElementById('editEventId').value;

        if (!title) {
            toast('eventToast', 'Введіть назву події', true);
            btn.disabled = false; btn.textContent = editId ? 'Зберегти зміни' : 'Створити подію';
            return;
        }
        if (!dateVal) {
            toast('eventToast', 'Виберіть дату та час', true);
            btn.disabled = false; btn.textContent = editId ? 'Зберегти зміни' : 'Створити подію';
            return;
        }

        function saveEvent(imageUrl) {
            var body = {
                title:       title,
                description: document.getElementById('evDesc').value.trim(),
                image:       imageUrl || document.getElementById('evImage').value.trim(),
                date:        dateVal,
                location:    document.getElementById('evLocation').value.trim(),
                artist:      document.getElementById('evArtist').value.trim(),
                venue:       document.getElementById('evVenue').value.trim(),
                price:       parseFloat(document.getElementById('evPrice').value) || 0,
                capacity:    parseInt(document.getElementById('evCapacity').value) || null
            };

            var method = editId ? 'PUT' : 'POST';
            var path   = editId ? '/api/admin/events/' + editId : '/api/admin/events';

            api(method, path, body).then(function (d) {
                if (d._ok) {
                    closeEventModal();
                    loadEvents();
                } else {
                    toast('eventToast', d.error || 'Помилка збереження', true);
                }
            }).catch(function () {
                toast('eventToast', 'Помилка з\'єднання', true);
            }).finally(function () {
                btn.disabled = false;
                btn.textContent = editId ? 'Зберегти зміни' : 'Створити подію';
            });
        }

        if (evSelectedFile) {
            var fd = new FormData();
            fd.append('file', evSelectedFile);
            fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    if (d.url) saveEvent(d.url);
                    else { toast('eventToast', d.error || 'Помилка завантаження фото', true); btn.disabled = false; btn.textContent = editId ? 'Зберегти зміни' : 'Створити подію'; }
                })
                .catch(function() { toast('eventToast', 'Помилка завантаження фото', true); btn.disabled = false; btn.textContent = editId ? 'Зберегти зміни' : 'Створити подію'; });
        } else {
            saveEvent(null);
        }

    });

    var ticketFilter = 'all';
    var ticketQuery  = '';

    function loadTickets() {
        api('GET', '/api/admin/tickets').then(function (d) {
            cache.tickets = d.tickets || [];
            renderTickets();
        }).catch(function () {
            document.getElementById('ticketsList').innerHTML = '<div class="empty-state">Помилка завантаження</div>';
        });
    }

    function renderTickets() {
        var list = document.getElementById('ticketsList');
        var q    = ticketQuery.toLowerCase();
        var data = (cache.tickets || []).filter(function (t) {
            var matchFilter = ticketFilter === 'all' || t.status === ticketFilter;
            var matchQuery  = !q ||
                (t.eventTitle || '').toLowerCase().includes(q) ||
                (t.buyerEmail || '').toLowerCase().includes(q) ||
                (t.buyerName  || '').toLowerCase().includes(q) ||
                (t.buyerPhone || '').toLowerCase().includes(q) ||
                (t.qrCode     || '').toLowerCase().includes(q);
            return matchFilter && matchQuery;
        });

        if (data.length === 0) {
            list.innerHTML = '<div class="empty-state">' + (q ? 'Нічого не знайдено' : 'Резервацій ще немає') + '</div>';
            return;
        }

        data = data.slice().sort(function (a, b) {
            return (b.purchasedAt || '').localeCompare(a.purchasedAt || '');
        });

        list.innerHTML = data.map(function (t) {
            var st  = t.status || 'active';
            var buyer = esc(t.buyerName || t.buyerEmail || t.buyerPhone || 'Невідомо');
            var contact = t.buyerEmail || t.buyerPhone || '';
            var buyerLine = buyer + (contact && contact !== t.buyerName ? ' · ' + esc(contact) : '');
            var priceStr = t.price > 0 ? 'До оплати: ' + t.price + ' $' : 'Безкоштовно';
            var priceClass = t.price > 0 ? '' : ' free';
            var stLabel = { active: 'Дійсний', used: 'Оплачено', cancelled: 'Скасовано' }[st] || st;
            var usedLine = st === 'used' && t.usedAt ? ' · ' + fmtShort(t.usedAt) : '';

            return '<div class="ticket-card">' +
                '<div class="ticket-status-dot ' + esc(st) + '"></div>' +
                '<div class="ticket-main">' +
                    '<div class="ticket-event-name">' + esc(t.eventTitle || '-') + '</div>' +
                    '<div class="ticket-buyer">' + buyerLine + ' · ' + esc(fmtShort(t.purchasedAt)) + '</div>' +
                '</div>' +
                '<div class="ticket-price' + priceClass + '">' + esc(priceStr) + '</div>' +
                '<div class="ticket-badge ' + esc(st) + '">' + esc(stLabel) + esc(usedLine) + '</div>' +
            '</div>';
        }).join('');
    }

    document.getElementById('ticketFilters').addEventListener('click', function (e) {
        var pill = e.target.closest('.filter-pill');
        if (!pill) return;
        ticketFilter = pill.getAttribute('data-filter');
        document.querySelectorAll('#ticketFilters .filter-pill').forEach(function (p) {
            p.classList.toggle('active', p === pill);
        });
        renderTickets();
    });

    var ticketSearch = document.getElementById('ticketSearch');
    ticketSearch.addEventListener('input', function () {
        ticketQuery = this.value;
        renderTickets();
    });
    var userQuery = '';

    function loadUsers() {
        api('GET', '/api/admin/users').then(function (d) {
            cache.users = d.users || [];
            renderUsers();
        }).catch(function () {
            document.getElementById('usersList').innerHTML = '<div class="empty-state">Помилка завантаження</div>';
        });
    }

    function renderUsers() {
        var list = document.getElementById('usersList');
        var q    = userQuery.toLowerCase();
        var data = (cache.users || []).filter(function (u) {
            return !q ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.phone || '').toLowerCase().includes(q);
        });

        if (data.length === 0) {
            list.innerHTML = '<div class="empty-state">' + (q ? 'Нічого не знайдено' : 'Користувачів немає') + '</div>';
            return;
        }

        data = data.slice().sort(function (a, b) {
            if (a.role === b.role) return 0;
            return a.role === 'admin' ? -1 : 1;
        });

        list.innerHTML = data.map(function (u) {
            var contact    = u.email || u.phone || '-';
            var isAdmin    = u.role === 'admin';
            var avatarLetter = initials(contact);
            var avatarClass  = isAdmin ? 'admin-avatar' : '';
            var roleBadge    = isAdmin
                ? '<span class="role-badge admin">Адмін</span>'
                : '<span class="role-badge user">Користувач</span>';
            var meta = u.createdAt ? 'Реєстрація: ' + fmtShort(u.createdAt) : '';

            return '<div class="user-card">' +
                '<div class="user-avatar ' + avatarClass + '">' + esc(avatarLetter) + '</div>' +
                '<div class="user-info">' +
                    '<div class="user-contact">' + esc(contact) + '</div>' +
                    '<div class="user-meta">' + esc(meta) + '</div>' +
                '</div>' +
                roleBadge +
                '<div class="user-actions">' +
                    '<button class="dots-btn" data-uid="' + esc(u.id) + '" data-role="' + esc(u.role) + '" data-contact="' + esc(contact) + '">⋮</button>' +
                    '<div class="dots-menu" id="menu-' + esc(u.id) + '">' +
                        (isAdmin
                            ? '<button class="dots-item" data-action="demote" data-uid="' + esc(u.id) + '">Понизити до користувача</button>'
                            : '<button class="dots-item" data-action="promote" data-uid="' + esc(u.id) + '">Зробити адміном</button>') +
                        '<button class="dots-item" data-action="password" data-uid="' + esc(u.id) + '" data-contact="' + esc(contact) + '">Змінити пароль</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        list.querySelectorAll('.dots-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var menu = document.getElementById('menu-' + this.getAttribute('data-uid'));
                document.querySelectorAll('.dots-menu.active').forEach(function (m) { if (m !== menu) m.classList.remove('active'); });
                menu.classList.toggle('active');
            });
        });

        list.querySelectorAll('.dots-item').forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                var action = this.getAttribute('data-action');
                var uid = this.getAttribute('data-uid');
                document.querySelectorAll('.dots-menu.active').forEach(function (m) { m.classList.remove('active'); });
                if (action === 'promote') toggleUserRole(uid, 'admin');
                else if (action === 'demote') toggleUserRole(uid, 'user');
                else if (action === 'password') openPwModal(uid, this.getAttribute('data-contact'));
            });
        });
    }

    function openPwModal(uid, contact) {
        document.getElementById('pwModalUser').textContent = contact;
        document.getElementById('pwModalInput').value = '';
        document.getElementById('pwModalError').style.display = 'none';
        document.getElementById('pwModal').hidden = false;
        document.getElementById('pwModal').dataset.uid = uid;
        var isSelf = myId && uid === myId;
        var cpRow = document.getElementById('pwCurrentRow');
        if (cpRow) cpRow.style.display = isSelf ? '' : 'none';
        var cpInput = document.getElementById('pwModalCurrent');
        if (cpInput) cpInput.value = '';
        document.getElementById('pwModalInput').focus();
    }

    function closePwModal() {
        document.getElementById('pwModal').hidden = true;
    }

    function toggleUserRole(uid, newRole) {
        if (newRole === 'user' && !confirm('Понизити цього користувача до рівня "користувач"? Він втратить доступ до адмінки.')) return;
        api('PATCH', '/api/admin/users/' + encodeURIComponent(uid) + '/role', { role: newRole })
            .then(function (d) {
                if (d._ok) {
                    loadUsers();
                } else {
                    alert(d.error || 'Помилка зміни ролі');
                }
            })
            .catch(function () { alert('Помилка з\'єднання'); });
    }

    document.getElementById('userSearch').addEventListener('input', function () {
        userQuery = this.value;
        renderUsers();
    });

    document.addEventListener('click', function () {
        document.querySelectorAll('.dots-menu.active').forEach(function (m) { m.classList.remove('active'); });
    });

    document.getElementById('pwModalClose').addEventListener('click', closePwModal);
    document.getElementById('pwModalCancel').addEventListener('click', closePwModal);
    document.getElementById('pwModal').addEventListener('click', function (e) { if (e.target === this) closePwModal(); });
    document.getElementById('pwModalSubmit').addEventListener('click', function () {
        var uid = document.getElementById('pwModal').dataset.uid;
        var newPw = document.getElementById('pwModalInput').value;
        var errEl = document.getElementById('pwModalError');
        errEl.style.display = 'none';
        if (!newPw || newPw.length < 6) {
            errEl.textContent = 'Пароль має бути щонайменше 6 символів';
            errEl.style.display = 'block';
            return;
        }
        var isSelf = myId && uid === myId;
        var payload = { password: newPw };
        if (isSelf) {
            var cp = document.getElementById('pwModalCurrent');
            if (!cp || !cp.value) {
                errEl.textContent = 'Введіть поточний пароль';
                errEl.style.display = 'block';
                return;
            }
            payload.currentPassword = cp.value;
        }
        var contact = document.getElementById('pwModalUser').textContent;
        if (!confirm('Змінити пароль користувачу ' + contact + '?')) return;
        api('PATCH', '/api/admin/users/' + encodeURIComponent(uid) + '/password', payload)
            .then(function (d) {
                if (d._ok) {
                    document.getElementById('pwModal').hidden = true;
                    alert('Пароль змінено');
                } else {
                    errEl.textContent = d.error || 'Помилка зміни пароля';
                    errEl.style.display = 'block';
                }
            })
            .catch(function () {
                errEl.textContent = 'Помилка з\'єднання';
                errEl.style.display = 'block';
            });
    });

    document.addEventListener('keydown', function (e) {
        if (!adminApp || adminApp.hasAttribute('hidden')) return;

        if (e.key === 'Escape') {
            closeEventModal();
            var gm = document.getElementById('galleryModal');
            if (gm) gm.setAttribute('hidden', '');
        }

        if (e.altKey && e.key >= '1' && e.key <= '6') {
            showSection(SECTIONS[parseInt(e.key) - 1]);
        }
    });

    var galleryModal = document.getElementById('galleryModal');
    var galleryList = document.getElementById('galleryList');

    document.getElementById('addGalleryBtn').addEventListener('click', function () {
        document.getElementById('galUrl').value = '';
        document.getElementById('galAlt').value = '';
        var t = document.getElementById('galleryToast');
        if (t) t.className = 'toast';
        galleryModal.removeAttribute('hidden');
        document.getElementById('galUrl').focus();
    });

    document.getElementById('closeGalleryModal').addEventListener('click', function () {
        galleryModal.setAttribute('hidden', '');
    });
    document.getElementById('cancelGalleryModal').addEventListener('click', function () {
        galleryModal.setAttribute('hidden', '');
    });
    galleryModal.addEventListener('click', function (e) {
        if (e.target === this) this.setAttribute('hidden', '');
    });

    document.getElementById('saveGalleryBtn').addEventListener('click', function () {
        var btn = this;
        var alt = document.getElementById('galAlt').value.trim();
        
        function saveGalleryImage(url) {
            btn.disabled = true;
            btn.textContent = 'Додавання...';
            api('POST', '/api/admin/gallery', { url: url, alt: alt }).then(function (d) {
                if (d._ok) {
                    galleryModal.setAttribute('hidden', '');
                    loadGallery();
                    resetGalleryModal();
                } else {
                    toast('galleryToast', d.error || 'Помилка', true);
                }
            }).catch(function () {
                toast('galleryToast', 'Помилка з\'єднання', true);
            }).finally(function () {
                btn.disabled = false;
                btn.textContent = 'Додати';
            });
        }

        if (galActiveTab === 'upload' && galSelectedFile) {
            var fd = new FormData();
            fd.append('file', galSelectedFile);
            fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    if (d.url) saveGalleryImage(d.url);
                    else toast('galleryToast', d.error || 'Помилка завантаження', true);
                })
                .catch(function() { toast('galleryToast', 'Помилка завантаження', true); });
        } else {
            var url = document.getElementById('galUrl').value.trim();
            if (!url) { toast('galleryToast', 'Введіть URL або завантажте файл', true); return; }
            saveGalleryImage(url);
        }
    });

    function resetGalleryModal() {
        galSelectedFile = null;
        if (galPreview) galPreview.style.display = 'none';
        if (galDropzone) galDropzone.style.display = '';
        if (galFileInput) galFileInput.value = '';
        document.getElementById('galUrl').value = '';
        document.getElementById('galAlt').value = '';
        document.querySelectorAll('[data-galtab]').forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-galtab') === 'upload'); });
        document.getElementById('galUploadTab').classList.remove('hidden');
        document.getElementById('galUrlTab').classList.add('hidden');
    }

    var galActiveTab = 'upload';
    var galSelectedFile = null;

    document.querySelectorAll('[data-galtab]').forEach(function(tab) {
        tab.addEventListener('click', function() {
            galActiveTab = this.getAttribute('data-galtab');
            document.querySelectorAll('[data-galtab]').forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-galtab') === galActiveTab); });
            document.getElementById('galUploadTab').classList.toggle('hidden', galActiveTab !== 'upload');
            document.getElementById('galUrlTab').classList.toggle('hidden', galActiveTab !== 'url');
        });
    });

    var galDropzone = document.getElementById('galDropzone');
    var galFileInput = document.getElementById('galFileInput');
    var galPreview = document.getElementById('galPreview');
    var galPreviewImg = document.getElementById('galPreviewImg');

    if (galDropzone) {
        galDropzone.addEventListener('click', function() { galFileInput.click(); });
        galDropzone.addEventListener('dragover', function(e) { e.preventDefault(); this.style.borderColor = '#e63946'; });
        galDropzone.addEventListener('dragleave', function() { this.style.borderColor = ''; });
        galDropzone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '';
            if (e.dataTransfer.files.length) handleGalFile(e.dataTransfer.files[0]);
        });
    }

    if (galFileInput) {
        galFileInput.addEventListener('change', function() {
            if (this.files.length) handleGalFile(this.files[0]);
        });
    }

    function handleGalFile(file) {
        if (!file.type.startsWith('image/')) { toast('galleryToast', 'Тільки зображення', true); return; }
        if (file.size > 5 * 1024 * 1024) { toast('galleryToast', 'Максимум 5MB', true); return; }
        compressImage(file).then(function(compressed) {
            galSelectedFile = compressed;
            var reader = new FileReader();
            reader.onload = function(e) {
                galPreviewImg.src = e.target.result;
                galPreview.style.display = '';
                galDropzone.style.display = 'none';
            };
            reader.readAsDataURL(compressed);
        });
    }

    document.getElementById('galPreviewRemove').addEventListener('click', function() {
        galSelectedFile = null;
        galPreview.style.display = 'none';
        galDropzone.style.display = '';
        galFileInput.value = '';
    });

    function loadGallery() {
        api('GET', '/api/gallery').then(function (d) {
            var items = d.images || [];
            if (items.length === 0) {
                galleryList.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3);">Немає фото. Додайте перше!</div>';
                return;
            }
            galleryList.innerHTML = items.map(function (img) {
                return '<div class="gallery-admin-card" data-id="' + img.id + '">' +
                    '<img src="' + esc(img.url) + '" alt="' + esc(img.alt || '') + '" class="gallery-admin-img">' +
                    '<div class="gallery-admin-info">' +
                        '<span class="gallery-admin-alt">' + esc(img.alt || 'Без підпису') + '</span>' +
                        '<button class="btn-delete-sm gallery-del-btn" data-id="' + img.id + '" title="Видалити">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>' +
                        '</button>' +
                    '</div>' +
                '</div>';
            }).join('');
            galleryList.querySelectorAll('.gallery-del-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = this.getAttribute('data-id');
                    if (!confirm('Видалити це фото?')) return;
                    api('DELETE', '/api/admin/gallery/' + id).then(function (d) {
                        if (d._ok) loadGallery();
                    });
                });
            });
        }).catch(function () {
            galleryList.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,100,100,0.5);">Помилка завантаження</div>';
        });
    }

})();
