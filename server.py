"""
NEXUS MAILER — Python Backend Server
Flask SMTP relay for bulk email transmission

Install:
    pip install flask flask-cors

Run:
    python server.py

The frontend will send requests to http://localhost:5000
"""

import smtplib
import ssl
import re
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s  %(message)s'
)

app = Flask(__name__)
CORS(app)


# ─── SMTP HELPERS ──────────────────────────────────────────────────

def smtp_connect(cfg: dict):
    """Create and return an authenticated SMTP connection."""
    host     = cfg.get('host', 'smtp.gmail.com')
    port     = int(cfg.get('port', 587))
    user     = cfg.get('user', '')
    password = cfg.get('pass', '')

    ctx = ssl.create_default_context()

    if port == 465:
        server = smtplib.SMTP_SSL(host, port, context=ctx, timeout=10)
    else:
        server = smtplib.SMTP(host, port, timeout=10)
        server.ehlo()
        server.starttls(context=ctx)
        server.ehlo()

    server.login(user, password)
    return server


def build_mime(cfg: dict, recipient: dict, subject: str, body_html: str):
    """Build a MIME email message."""
    from_name  = cfg.get('fromName', '')
    from_email = cfg.get('fromEmail') or cfg.get('user', '')

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From']    = formataddr((from_name, from_email))
    msg['To']      = recipient.get('email', '')

    # Strip tags for plain-text
    plain = re.sub(r'<[^>]+>', '', body_html).strip()
    msg.attach(MIMEText(plain,    'plain'))
    msg.attach(MIMEText(body_html, 'html'))
    return msg


# ─── ROUTES ────────────────────────────────────────────────────────

@app.route('/api/test', methods=['POST'])
def test_connection():
    """Test SMTP connectivity without sending."""
    data = request.get_json(force=True) or {}
    cfg  = data.get('cfg', data)  # allow flat or nested

    try:
        server = smtp_connect(cfg)
        server.quit()
        logging.info('SMTP test OK — %s:%s', cfg.get('host'), cfg.get('port'))
        return jsonify({'ok': True, 'message': 'Connection successful'})
    except Exception as e:
        logging.error('SMTP test FAILED — %s', e)
        return jsonify({'ok': False, 'error': str(e)}), 400


@app.route('/api/send', methods=['POST'])
def send_email():
    """Send a single personalised email."""
    data = request.get_json(force=True) or {}
    cfg       = data.get('cfg', {})
    recipient = data.get('recipient', {})
    subject   = data.get('subject', '')
    body      = data.get('body', '')

    if not recipient.get('email'):
        return jsonify({'ok': False, 'error': 'Missing recipient email'}), 400

    try:
        msg    = build_mime(cfg, recipient, subject, body)
        server = smtp_connect(cfg)
        server.sendmail(
            cfg.get('fromEmail') or cfg.get('user', ''),
            [recipient['email']],
            msg.as_string()
        )
        server.quit()
        logging.info('SENT -> %s', recipient['email'])
        return jsonify({'ok': True})
    except Exception as e:
        logging.error('FAIL -> %s  error: %s', recipient.get('email'), e)
        return jsonify({'ok': False, 'error': str(e)}), 500


@app.route('/api/send_bulk', methods=['POST'])
def send_bulk():
    """
    Send to a full list in one call (opens one SMTP connection per batch).
    Body: { cfg, recipients:[{name,email}], subject, body }
    Returns: { ok, sent, failed, errors:[...] }
    """
    data       = request.get_json(force=True) or {}
    cfg        = data.get('cfg', {})
    recipients = data.get('recipients', [])
    subject    = data.get('subject', '')
    body_tpl   = data.get('body', '')

    sent   = 0
    failed = 0
    errors = []

    try:
        server = smtp_connect(cfg)
    except Exception as e:
        return jsonify({'ok': False, 'error': 'SMTP auth failed: ' + str(e)}), 500

    from_addr = cfg.get('fromEmail') or cfg.get('user', '')

    for r in recipients:
        email = r.get('email', '')
        name  = r.get('name', email.split('@')[0])

        def personalise(tpl):
            return tpl.replace('{name}', name).replace('{email}', email)

        try:
            msg = build_mime(cfg, r, personalise(subject), personalise(body_tpl))
            server.sendmail(from_addr, [email], msg.as_string())
            sent += 1
            logging.info('BULK SENT -> %s', email)
        except smtplib.SMTPServerDisconnected:
            # Reconnect and retry
            try:
                server = smtp_connect(cfg)
                server.sendmail(from_addr, [email], msg.as_string())
                sent += 1
            except Exception as retry_err:
                failed += 1
                errors.append({'email': email, 'error': str(retry_err)})
        except Exception as e:
            failed += 1
            errors.append({'email': email, 'error': str(e)})
            logging.error('BULK FAIL -> %s  %s', email, e)

    try:
        server.quit()
    except Exception:
        pass

    logging.info('Bulk complete — sent:%d failed:%d', sent, failed)
    return jsonify({'ok': True, 'sent': sent, 'failed': failed, 'errors': errors})


@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({'ok': True, 'service': 'NEXUS_MAILER', 'version': '3.7.1'})


# ─── RUN ───────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("""
╔══════════════════════════════════════════════╗
║   NEXUS MAILER — Python SMTP Backend         ║
║   Running on http://localhost:5000           ║
║   Set frontend API mode to: PYTHON BACKEND  ║
╚══════════════════════════════════════════════╝
""")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
