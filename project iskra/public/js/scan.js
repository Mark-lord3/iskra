(function () {
    'use strict';

    var scanLayout = document.getElementById('scanLayout');
    var authGuard = document.getElementById('authGuard');
    var resultArea = document.getElementById('resultArea');
    var scanHint = document.getElementById('scanHint');
    var cameraCol = document.getElementById('cameraCol');

    var scanner = null;
    var isPaused = false;
    var lastScannedCode = '';
    var lastScanDebounce = 0;

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    function formatDate(str) {
        if (!str) return '---';
        try { return new Date(str).toLocaleString('uk-UA'); } catch (e) { return str; }
    }

    function playBeep() {
        try {
            var actx = window.AudioContext || window.webkitAudioContext;
            if (!actx) return;
            var audioCtx = new actx();
            var oscillator = audioCtx.createOscillator();
            var gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = 1500;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.12);
            setTimeout(function () { audioCtx.close(); }, 200);
        } catch (e) {}
    }

    function checkAuth() {
        fetch('/api/admin/me', { credentials: 'include' })
            .then(function (r) {
                if (r.ok) onAuthOk();
                else onAuthFail();
            })
            .catch(function () { onAuthFail(); });
    }

    function onAuthOk() {
        scanLayout.style.display = 'flex';
        authGuard.style.display = 'none';
        bindManualInput();
        initScanner();
    }

    function onAuthFail() {
        authGuard.style.display = 'flex';
        scanLayout.style.display = 'none';
    }

    function pauseScanner() {
        if (scanner && !isPaused) {
            try { scanner.pause(true); isPaused = true; } catch (e) {}
        }
    }

    function resumeScanner() {
        if (scanner && isPaused) {
            try { scanner.resume(); isPaused = false; } catch (e) {}
        }
    }

    function clearToWaiting() {
        resultArea.innerHTML =
            '<div class="empty-result">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">' +
                    '<path d="M3 7V5a2 2 0 012-2h2M3 17v2a2 2 0 002 2h2M17 3h2a2 2 0 012 2v2M17 21h2a2 2 0 002-2v-2"></path>' +
                    '<rect x="7" y="7" width="10" height="10" rx="1"></rect>' +
                '</svg>' +
                '<p style="font-size:0.88rem;">Очікування сканування...</p>' +
            '</div>';
        renderManualInput();
        resumeScanner();
        if (scanHint) scanHint.textContent = 'Наведіть камеру на QR-код';
    }

    function bindManualInput() {
        var input = document.getElementById('manualInput');
        var btn = document.getElementById('manualBtn');
        if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') manualCheck(); });
        if (btn) btn.addEventListener('click', manualCheck);
    }

    function renderManualInput() {
        if (document.getElementById('manualInput')) return;
        var html =
            '<div class="manual-label">Або введіть код вручну</div>' +
            '<div class="manual-row">' +
                '<input id="manualInput" placeholder="TKT-XXXXXXXXXXXXXXXX" autocomplete="off" spellcheck="false">' +
                '<button id="manualBtn">Знайти</button>' +
            '</div>';
        resultArea.insertAdjacentHTML('beforeend', html);
        document.getElementById('manualInput').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') manualCheck();
        });
        document.getElementById('manualBtn').addEventListener('click', manualCheck);
    }

    function showResult(data) {
        var valid = data.valid;
        var redeemed = data.redeemed;
        var t = data.ticket || {};
        var num = t.ticketNumber || '';

        var alertClass, alertLabel, alertDesc;
        if (valid && !redeemed) {
            var isPaid = t.paymentStatus === 'paid' || t.paymentStatus === 'free';
            alertClass = 'valid';
            alertLabel = (isPaid ? 'Оплачено' : 'Не оплачено') + (num ? ' #' + num : '');
            alertDesc = 'Квиток дійсний - ' + (isPaid ? 'очікує сканування' : 'очікує оплати');
        } else if (redeemed) {
            alertClass = 'used';
            alertLabel = 'Використано' + (num ? ' #' + num : '');
            alertDesc = t.usedAt
                ? 'Підтверджено: ' + esc(formatDate(t.usedAt))
                : 'Квиток вже використано раніше';
        } else {
            alertClass = 'invalid';
            alertLabel = 'Недійсна резервація';
            alertDesc = 'Резервація не знайдена або скасована';
        }

        var html = '<div class="result-alert ' + alertClass + '">' + alertLabel +
                   '<small>' + alertDesc + '</small></div>';

        if (t.id) {
            html += '<div class="result-card">';
            if (t.eventTitle)    html += field('Подія',    esc(t.eventTitle));
            if (t.eventDate)     html += field('Дата події', esc(formatDate(t.eventDate)));
            if (t.eventLocation) html += field('Місце',    esc(t.eventLocation));
            if (t.buyerName)     html += field('Ім\'я',        esc(t.buyerName));
            if (t.buyerEmail)    html += field('Email',        esc(t.buyerEmail));
            if (t.buyerPhone)    html += field('Телефон',      esc(t.buyerPhone));
            if (t.price != null && t.price > 0) html += field('Ціна',         t.price + ' $');
            var payStatus = t.paymentStatus === 'paid' ? 'Оплачено' : t.paymentStatus === 'free' ? 'Безкоштовно' : t.paymentStatus === 'pending' ? 'Не оплачено' : t.paymentStatus || '';
            if (payStatus) html += field('Статус оплати', payStatus);
            if (t.purchasedAt)   html += field('Куплено', esc(formatDate(t.purchasedAt)));
            html += field('QR-код', '<span class="result-value mono">' + esc(t.qrCode || '') + '</span>', true);
            html += '</div>';
        }

        if (valid && !redeemed && t.id) {
            html += '<button class="result-btn redeem" id="redeemBtn">Підтвердити вхід</button>';
        }

        html += '<button class="result-btn next" id="scanNextBtn">Сканувати наступний</button>';

        resultArea.innerHTML = html;

        var nextBtn = document.getElementById('scanNextBtn');
        if (nextBtn) nextBtn.addEventListener('click', clearToWaiting);

        if (valid && !redeemed && t.id) {
            document.getElementById('redeemBtn').addEventListener('click', function () {
                redeemTicket(t.id, t);
            });
        }
    }

    function field(label, valueHtml, raw) {
        return '<div class="result-field">' +
               '<div class="result-label">' + label + '</div>' +
               '<div class="result-value">' + valueHtml + '</div>' +
               '</div>';
    }

    function showRedeemSuccess(ticket) {
        var name = ticket ? (ticket.buyerName || ticket.buyerEmail || '') : '';
        resultArea.innerHTML =
            '<div class="redeem-success">' +
                '<div class="check">\u2713</div>' +
                '<h3>Вхід підтверджено!</h3>' +
                '<p>' + (name ? esc(name) + ' - ' : '') + esc(ticket.eventTitle || '') + '</p>' +
            '</div>' +
            '<button class="result-btn next" id="scanNextBtn">Сканувати наступний</button>';
        document.getElementById('scanNextBtn').addEventListener('click', clearToWaiting);
        renderManualInput();
    }

    function verifyTicket(qrCode) {
        if (!qrCode) return;
        pauseScanner();
        if (scanHint) scanHint.textContent = 'Перевірка...';

        resultArea.innerHTML =
            '<div class="waiting-state">' +
                '<div class="spinner"></div>' +
                '<div>Перевірка резервації...</div>' +
            '</div>';

        fetch('/api/tickets/verify/' + encodeURIComponent(qrCode), { credentials: 'include' })
            .then(function (r) {
                if (r.status === 404) {
                    return { valid: false, redeemed: false, cancelled: false, ticket: {} };
                }
                return r.json();
            })
            .then(function (data) {
                showResult(data);
                if (scanHint) scanHint.textContent = 'Наведіть камеру на QR-код';
            })
            .catch(function () {
                showResult({ valid: false, redeemed: false, cancelled: false, ticket: {} });
                if (scanHint) scanHint.textContent = 'Наведіть камеру на QR-код';
            });
    }

    function redeemTicket(ticketId, ticketData) {
        var btn = document.getElementById('redeemBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Підтвердження...'; }

        fetch('/api/admin/tickets/' + encodeURIComponent(ticketId) + '/redeem', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.error) {
                    showResult({
                        valid: false,
                        redeemed: true,
                        cancelled: false,
                        ticket: d.ticket || ticketData
                    });
                } else {
                    showRedeemSuccess(d.ticket || ticketData);
                }
            })
            .catch(function () {
                if (btn) { btn.disabled = false; btn.textContent = 'Підтвердити вхід'; }
                alert('Помилка сервера. Спробуйте ще раз.');
            });
    }

    function manualCheck() {
        var input = document.getElementById('manualInput');
        if (!input) return;
        var code = input.value.trim().toUpperCase();
        if (!code) return;
        input.value = '';
        verifyTicket(code);
    }

    function showCameraError(msg) {
        if (scanHint) scanHint.style.display = 'none';
        var el = document.getElementById('qr-reader');
        if (el) el.style.display = 'none';
        cameraCol.insertAdjacentHTML('beforeend',
            '<div class="camera-error-box">' +
                '<h2>Камера недоступна</h2>' +
                '<p>' + esc(msg) + '</p>' +
                '<button id="retryCameraBtn">Спробувати знову</button>' +
            '</div>'
        );
        document.getElementById('retryCameraBtn').addEventListener('click', function () {
            location.reload();
        });
    }

    function startScanner() {
        var el = document.getElementById('qr-reader');
        if (!el) return;

        scanner = new Html5Qrcode('qr-reader', { verbose: false });

        var config = {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
            disableFlip: false,
            formatsToSupport: [0],
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        };

        scanner.start(
            { facingMode: 'environment' },
            config,
            function onScanSuccess(decodedText) {
                if (isPaused) return;
                var now = Date.now();
                var code = decodedText.trim();
                if (code === lastScannedCode && now - lastScanDebounce < 3000) return;
                lastScannedCode = code;
                lastScanDebounce = now;
                playBeep();
                verifyTicket(code);
            },
            function onScanFailure() { }
        ).then(function () {
            if (scanHint) scanHint.textContent = 'Наведіть камеру на QR-код';
        }).catch(function (err) {
            var s = String(err || '');
            var msg = 'Не вдалося запустити камеру.';
            if (s.indexOf('NotAllowedError') !== -1 || s.indexOf('Permission') !== -1) {
                msg = 'Доступ до камери заборонено. Надайте дозвіл у налаштуваннях браузера та перезавантажте сторінку.';
            } else if (s.indexOf('NotFoundError') !== -1 || s.indexOf('DevicesNotFound') !== -1) {
                msg = 'Камера не знайдена. Перевірте, що камера підключена до пристрою.';
            } else if (s.indexOf('NotReadableError') !== -1) {
                msg = 'Камера зайнята іншим додатком. Закрийте інші вкладки та перезавантажте.';
            }
            showCameraError(msg);
        });
    }

    function initScanner() {
        if (typeof Html5Qrcode === 'undefined') {
            showCameraError('Бібліотека сканування не завантажена. Перезавантажте сторінку.');
            return;
        }

        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'camera' }).then(function (result) {
                if (result.state === 'granted') {
                    startScanner();
                } else if (result.state === 'prompt') {
                    startScanner();
                } else {
                    showCameraError('Доступ до камери заборонено. Надайте дозвіл у налаштуваннях браузера.');
                }
            }).catch(function () {
                startScanner();
            });
        } else {
            startScanner();
        }
    }

    checkAuth();

})();
