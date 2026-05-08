        m = location.search.match(/applyNo=(\d+)/);
        if (m) return m[1];
        m = location.pathname.match(/applyNo[\/=](\d+)/);
        if (m) return m[1];
        return null;
    }

    function getToken() {
        var TOKEN = "";
        document.cookie.split(';').forEach(function(c) {
            var p = c.trim().split('=');
            if (p[0] === 'token') TOKEN = p[1];
        });
        return TOKEN;
    }

    function cleanup() {
        if (currentObserver) {
            currentObserver.disconnect();
            currentObserver = null;
        }
        isReplacing = false;
    }

    function replaceAll(maskedToReal) {
        if (isReplacing) return 0;
        isReplacing = true;

        var count = 0;
        function walk(n) {
            if (n.nodeType === 3) {
                var t = n.textContent, changed = false;
                for (var m in maskedToReal) {
                    if (t.indexOf(m) !== -1) {
                        t = t.split(m).join(maskedToReal[m]);
                        changed = true; count++;
                    }
                }
                if (changed) n.textContent = t;
            } else if (n.nodeType === 1 && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') {
                if (n.tagName === 'INPUT' && n.value) {
                    var v = n.value, vc = false;
                    for (var m in maskedToReal) {
                        if (v.indexOf(m) !== -1) {
                            v = v.split(m).join(maskedToReal[m]);
                            vc = true; count++;
                        }
                    }
                    if (vc) n.value = v;
                }
                for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
            }
        }
        walk(document.body);
        isReplacing = false;
        return count;
    }

    function startObserver(maskedToReal) {
        cleanup();
        var debounceTimer = null;

        currentObserver = new MutationObserver(function(mutations) {
            var hasTextChange = false;
            for (var i = 0; i < mutations.length; i++) {
                var mut = mutations[i];
                if (mut.type === 'characterData' || mut.addedNodes.length > 0) {
                    hasTextChange = true;
                    break;
                }
            }
            if (!hasTextChange) return;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() {
                currentObserver.disconnect();
                var cnt = replaceAll(maskedToReal);
                if (cnt > 0) console.log('[号码替换] 动态替换', cnt, '处');
                currentObserver.observe(
                    document.body,
                    {childList: true, subtree: true, characterData: true}
                );
            }, 300);
        });

        currentObserver.observe(
            document.body,
            {childList: true, subtree: true, characterData: true}
        );
    }

    function startReplace(applyNo) {
        var TOKEN = getToken();
        if (!TOKEN) {
            console.log('[号码替换] 未找到Token，请确认已登录');
            return;
        }

        console.log('[号码替换] 启动 | applyNo:', applyNo);
        cleanup();

        var maskedToReal = {};

        // API 1: query1 - 本人号码
        try {
            var x1 = new XMLHttpRequest();
            x1.open('POST', '/ares-web/recall/baseinfo/query1', false);
            x1.setRequestHeader('token', TOKEN);
            x1.setRequestHeader('Content-Type', 'application/json');
            x1.send(JSON.stringify({applyNo: applyNo}));
            var d1 = JSON.parse(x1.responseText);
            if (d1.data && d1.data.base) {
                if (d1.data.base.phoneNumber && d1.data.base.plaintextPhone) {
                    maskedToReal[d1.data.base.phoneNumber] = d1.data.base.plaintextPhone;
                }
                if (d1.data.base.plaintextPhone) {
                    var plain = d1.data.base.plaintextPhone;
                    var masked = plain.substring(0, 3) + '****' + plain.substring(7);
                    if (d1.data.base.phoneNumber !== masked) {
                        maskedToReal[masked] = plain;
                    }
                }
            }
        } catch(e) { console.log('[号码替换] query1异常:', e.message); }

        // API 2: query2 - 配偶/亲属号码
        try {
            var x2 = new XMLHttpRequest();
            x2.open('POST', '/ares-web/recall/baseinfo/query2', false);
            x2.setRequestHeader('token', TOKEN);
            x2.setRequestHeader('Content-Type', 'application/json');
            x2.send(JSON.stringify({applyNo: applyNo}));
            var d2 = JSON.parse(x2.responseText);
            if (d2.data) {
                [d2.data.partnerList || [], d2.data.relativesList || []].forEach(function(l) {
                    l.forEach(function(c) {
                        if (c.phoneNumber && c.plaintextPhoneNumber) {
                            maskedToReal[c.phoneNumber] = c.plaintextPhoneNumber;
                        }
                        if (c.plaintextPhoneNumber) {
                            var plain = c.plaintextPhoneNumber;
                            var masked = plain.substring(0, 3) + '****' + plain.substring(7);
                            maskedToReal[masked] = plain;
                        }
                    });
                });
            }
        } catch(e) { console.log('[号码替换] query2异常:', e.message); }

        // API 3: getContact - 所有联系人
        try {
            var x3 = new XMLHttpRequest();
            x3.open('POST', '/ares-web/recall/recallContactInfo/getContact', false);
            x3.setRequestHeader('token', TOKEN);
            x3.setRequestHeader('Content-Type', 'application/json');
            x3.send(JSON.stringify({applyNo: applyNo}));
            var d3 = JSON.parse(x3.responseText);
            if (d3.data && d3.data.items) {
                d3.data.items.forEach(function(c) {
                    if (c.phone && c.plaintextPhone) {
                        maskedToReal[c.phone] = c.plaintextPhone;
                    }
                    if (c.plaintextPhone) {
                        var plain = c.plaintextPhone;
                        var masked = plain.substring(0, 3) + '****' + plain.substring(7);
                        maskedToReal[masked] = plain;
                    }
                });
            }
        } catch(e) { console.log('[号码替换] getContact异常:', e.message); }

        var total = Object.keys(maskedToReal).length;
        if (!total) {
            console.log('[号码替换] 未获取到号码映射');
            return;
        }
        console.log('[号码替换] 获取到', total, '个号码映射');

        var cnt = replaceAll(maskedToReal);
        console.log('[号码替换] 首次替换', cnt, '处');

        startObserver(maskedToReal);
        console.log('[号码替换] 运行中');
    }

    // 监听hash变化
    window.addEventListener('hashchange', function() {
        var applyNo = getApplyNo();
        if (applyNo && applyNo !== currentApplyNo) {
            currentApplyNo = applyNo;
            console.log('[号码替换] 页面切换，applyNo:', applyNo);
            startReplace(applyNo);
        }
    });

    // 初始检测
    var checkInterval = setInterval(function() {
        var applyNo = getApplyNo();
        if (!applyNo) return;
        currentApplyNo = applyNo;
        clearInterval(checkInterval);
        startReplace(applyNo);
    }, 1000);
})();
(function() {
    'use strict';

    console.log('[水印去除] 启动...');

    // 方法1：通过CSS覆盖设置opacity=0（最稳定）
    const style = document.createElement('style');
    style.id = 'watermark-hide-style';
    style.textContent = [
        /* 隐藏fixed+pointer-events:none的元素（水印特征） */
        '[style*="pointer-events: none"][style*="position: fixed"],',
        '[style*="pointer-events:none"][style*="position:fixed"],',
        '[style*="position: fixed"][style*="pointer-events: none"],',
        '[style*="position:fixed"][style*="pointer-events:none"] {',
        '    opacity: 0 !important;',
        '    visibility: hidden !important;',
        '}',
        /* 隐藏水印相关class/id */
        '[class*="watermark"], [class*="water-mark"], [class*="mask-layer"],',
        '[id*="watermark"], [id*="water-mark"], [id*="mask-layer"] {',
        '    opacity: 0 !important;',
        '    visibility: hidden !important;',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // 方法2：拦截getWatermark API（阻止水印重新生成）
    if (window.getWatermark) {
        const originalGetWatermark = window.getWatermark;
        window.getWatermark = function() { return null; };
        console.log('[水印去除] getWatermark API已拦截');
    }

    // 方法3：MutationObserver持续监控（兜底，应对动态刷新）
    var watermarkObserver = null;
    function hideWatermark() {
        document.querySelectorAll('*').forEach(function(el) {
            var s = getComputedStyle(el);
            // 水印特征：fixed定位 + 不可点击 + 有文本内容
            if (s.position === 'fixed' &&
                s.pointerEvents === 'none' &&
                el.innerText &&
                el.innerText.length > 5) {
                el.style.opacity = '0';
            }
        });
    }

    watermarkObserver = new MutationObserver(function(mutations) {
        hideWatermark();
    });

    // 立即执行一次
    hideWatermark();
    console.log('[水印去除] 首次清除完成');

    // 持续监控DOM变化
    watermarkObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    console.log('[水印去除] 已启动持续监控，页面刷新需重新执行');
})();