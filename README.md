# NEXUS MAILER — Setup Guide

## Bestanden
```
index.html      → Dashboard UI
style.css       → Futuristische HUD styling
script.js       → Email bot engine (JavaScript)
server.py       → Python SMTP backend (Flask)
requirements.txt
```

## Snel starten (Frontend-only mode)

1. Open `index.html` in een browser
2. Vul SMTP gegevens in
3. Laad ontvangers
4. Klik **INITIATE TRANSMISSION**

In frontend-only mode simuleert de app emails (geen echte verzending).

---

## Echte emails versturen (Python backend)

### Installeer afhankelijkheden
```bash
pip install -r requirements.txt
```

### Start de server
```bash
python server.py
```
Server draait op: `http://localhost:5000`

### Stel de frontend in
- Zet **API Mode** op `PYTHON BACKEND`
- API Host: `http://localhost:5000`
- Klik **TEST CONNECTION** om te controleren

---

## SMTP Configuraties

### Gmail
```
Host:  smtp.gmail.com
Port:  587
User:  jouw@gmail.com
Pass:  App-wachtwoord (maak aan via Google Account > Beveiliging)
```
> Schakel "App-wachtwoorden" in via je Google-account (2FA vereist).

### Outlook / Hotmail
```
Host:  smtp.office365.com
Port:  587
User:  jouw@outlook.com
Pass:  jouw wachtwoord
```

### Custom SMTP / VPS
```
Host:  mail.jouwdomein.nl
Port:  587 (of 465 voor SSL)
User:  noreply@jouwdomein.nl
Pass:  jouw wachtwoord
```

---

## Variabelen in templates

Gebruik in onderwerp en berichttekst:
- `{name}` → Naam van ontvanger
- `{email}` → E-mailadres van ontvanger

**Voorbeeld:**
```
Onderwerp: Hallo {name}, jouw aanbieding is klaar!
Bericht:   <h1>Beste {name}</h1><p>Klik hier om {email} te bevestigen.</p>
```

---

## CSV formaat

Elke regel: naam,email
```
Jan Jansen,jan@example.com
Maria,maria@test.nl
Piet Pietersen,piet@werk.com
```

Of alleen emails:
```
jan@example.com
maria@test.nl
```

---

## API Endpoints (Python backend)

| Method | Endpoint         | Beschrijving              |
|--------|------------------|---------------------------|
| GET    | /api/status      | Server status             |
| POST   | /api/test        | Test SMTP verbinding      |
| POST   | /api/send        | Verstuur 1 email          |
| POST   | /api/send_bulk   | Verstuur bulk (lijst)     |

---

## Tips voor hoge deliverability

1. Gebruik een eigen domein met SPF, DKIM en DMARC records
2. Verwarm nieuwe domeinen op (begin met 50/dag, bouw geleidelijk op)
3. Gebruik een lage verzendssnelheid (200-500ms vertraging)
4. Verwijder bounces direct uit je lijst
5. Voeg altijd een uitschrijflink toe aan je emails
