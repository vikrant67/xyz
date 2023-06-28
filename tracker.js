
class Helper {
    constructor() { }
    // Method to get the value of a cookie
    getCookie(name) {
        const cookieName = `${name}=`;
        const decodedCookie = decodeURIComponent(document.cookie);
        const cookieArray = decodedCookie.split(';');

        for (let i = 0; i < cookieArray.length; i++) {
            let cookie = cookieArray[i];
            while (cookie.charAt(0) === ' ') {
                cookie = cookie.substring(1);
            }
            if (cookie.indexOf(cookieName) === 0) {
                return cookie.substring(cookieName.length, cookie.length);
            }
        }
        return '';
    }

    // Method to set a cookie
    setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        const expires = `expires=${date.toUTCString()}`;
        document.cookie = `${name}=${value};${expires};path=/`;
    }
}

class SociollaTracker {
    constructor() {
        this.config = {
            tracker_url: 'https://uat-analytics-api.sociolabs.io/sessions/me',

        };
        this.helper = new Helper();
    }

    q() {
        while (window.sib.equeue.length) {
            const obj = window.sib.equeue.shift();
            for (const k in obj) {
                if (typeof window.sib[k] === 'function') {
                    setTimeout(() => {
                        if (typeof window.sib[k] === 'function') {
                            window.sib[k](obj[k][0], obj[k][1], obj[k][2], obj[k][3]);
                        }
                    }, 200);
                }
            }
        }
    }

    mo(t, ...args) {
        const to = Object(t);
        for (const n of args) {
            if (n != null) {
                for (const k in n) {
                    if (Object.prototype.hasOwnProperty.call(n, k)) {
                        to[k] = n[k];
                    }
                }
            }
        }
        return to;
    }

    sr(o) {
        const s = [];
        for (const p in o) {
            if (Object.prototype.hasOwnProperty.call(o, p)) {
                s.push(`${encodeURIComponent(p)}=${encodeURIComponent(o[p])}`);
            }
        }
        return s.join('&');
    }

    br(d) {
        const td = {
            key: window.sib.client_key,
            cuid: this.helper.cookie.get('sib_cuid'),
            ma_url: window.location.href,
        };
        if (window.sib.email_id) {
            td.email_id = window.sib.email_id;
        }
        return this.mo(td, d);
    }

    generateReqHeaders() {
        return {
            'Content-Type': 'application/json;charset=UTF-8',
            session_id: this.helper.getCookie('SOCIOLLA_SESSION_ID'),
        };
    }

    setReqHeaders(req, hdrs) {
        for (const key in hdrs) {
            req.setRequestHeader(key, hdrs[key]);
        }
    }

    send(d, cb) {
        const u = `${this.config.url}?${this.sr(this.br(d))}`;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', u, true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    cb && cb();
                } else {
                    throw new Error(this.config.com_err_msg);
                }
            }
        };
        this.setReqHeaders(xhr, { 'Content-Type': 'application/x-www-form-urlencoded' });
        xhr.send();
    }

    sendEvent(event_type, reqBody, cb) {
        const headers = this.generateReqHeaders();
        const url = `${this.config.tracker_url}`;
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    cb && cb();
                } else {
                    throw new Error('Failed to track event');
                }
            }
        };
        this.setReqHeaders(xhr, headers);
        xhr.send(JSON.stringify(reqBody));
    }


    trackEvent(event_type, d, cb) {
        this.sendEvent(event_type, d, cb);
    }
}

// Usage example
const InternalTracker = new SociollaTracker();
