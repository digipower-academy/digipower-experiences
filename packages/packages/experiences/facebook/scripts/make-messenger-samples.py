#!/usr/bin/env python3
"""Writes the synthetic Messenger samples of the facebook experience:

  packages/lib/data-samples/facebook-messenger.zip       (JSON export)
  packages/lib/data-samples/facebook-messenger-html.zip  (HTML export, French)

Both hold the same fictional conversations, laid out like a real export
(your_facebook_activity/messages/<folder>/<thread>/message_N.json|html).
Every person and message is made up. Run from anywhere:

  python3 packages/packages/experiences/facebook/scripts/make-messenger-samples.py
"""
import html
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SAMPLES = Path(__file__).resolve().parents[4] / 'lib' / 'data-samples'
OWNER = 'Camille Exemple'
DELETED = 'Utilisateur(ice) Facebook'
# fixed zip entry dates, so the samples are reproducible
ZIP_DATE = (2026, 10, 14, 15, 23, 0)
EXPORT_TIME = '2026-10-14T15:23Z'


def t(text):
    """UTC 'YYYY-MM-DD HH:MM:SS' → milliseconds."""
    date = datetime.strptime(text, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
    return int(date.timestamp() * 1000)


def msg(sender, when, content=None, **extra):
    message = {'sender_name': sender, 'timestamp_ms': t(when)}
    if content is not None:
        message['content'] = content
    message.update(extra)
    return message


# (folder, thread folder name, title, participants, messages)
THREADS = [
    ('inbox', 'alicemartin_10102289880000013', 'Alice Martin', ['Alice Martin', OWNER], [
        msg('Alice Martin', '2012-01-15 09:30:00', 'Salut ! Tu viens au café ce soir ?'),
        msg(OWNER, '2012-01-15 09:41:12', 'Oui, à tout à l’heure 🙂'),
        msg('Alice Martin', '2013-02-03 18:05:44', 'Regarde cette photo',
            photos=[{'uri': 'your_facebook_activity/messages/inbox/alicemartin_10102289880000013/photos/101.jpg',
                     'creation_timestamp': 1359914744}]),
        msg(OWNER, '2014-03-21 12:00:00', 'Magnifique !',
            reactions=[{'reaction': '😍', 'actor': 'Alice Martin'}]),
        msg('Alice Martin', '2016-04-10 22:15:00', is_unsent=True),
        msg(OWNER, '2016-04-10 22:16:30', 'Tu as retiré un message ?'),
        msg('Alice Martin', '2019-05-01 07:45:09', 'Bon 1er mai !'),
    ]),
    ('inbox', 'utilisateuricefacebook_10101989430000023', DELETED, [DELETED, OWNER], [
        msg(DELETED, '2008-06-12 14:02:33', 'On se voit à la conférence ?'),
        msg(OWNER, '2008-06-12 14:10:00', 'Oui, jeudi.'),
        msg(DELETED, '2009-07-08 08:00:00', 'Merci pour les notes.'),
        msg(DELETED, '2010-08-30 19:30:00', 'Je pars en voyage, à bientôt.'),
    ]),
    ('inbox', 'randonneedudimanche_1096618500000033', 'Randonnée du dimanche',
     [OWNER, 'Alice Martin', DELETED, 'Jean Dupuis'], [
        msg('Jean Dupuis', '2015-09-06 07:00:00', 'Départ à 8h devant la gare'),
        msg(DELETED, '2015-09-06 07:05:00', 'Je prends le pique-nique'),
        msg('Alice Martin', '2015-10-11 06:55:00', ''),
        msg(OWNER, '2015-11-15 07:20:00', 'Il pleut, on reporte ?'),
        msg(DELETED, '2015-12-20 10:00:00', 'Joyeuses fêtes à tous !'),
    ]),
    ('filtered_threads', 'bobdupont_10103379680000043', 'Bob Dupont', ['Bob Dupont', OWNER], [
        msg('Bob Dupont', '2017-01-25 16:40:00', 'Bonjour, vous vendez toujours le vélo ?'),
        msg('Bob Dupont', '2017-02-02 16:41:00', 'Je peux passer samedi.'),
    ]),
    ('message_requests', 'carolelee_10104575190000053', 'Carole Lee', ['Carole Lee', OWNER], [
        msg('Carole Lee', '2021-03-14 11:11:11', 'Hello, we met at the workshop!'),
    ]),
    ('archived_threads', 'david_5581460000', 'David', ['David', OWNER], [
        msg('David', '2007-10-09 21:12:00', 'hey, long time no see'),
        msg(OWNER, '2007-10-10 08:03:00', 'indeed!'),
    ]),
    ('inbox', 'emmajones_10102289880000063', 'Emma Jones', ['Emma Jones', OWNER], [
        msg('Emma Jones', '2018-06-02 10:00:00', 'Are you around in June?'),
        msg(OWNER, '2018-06-02 10:30:00', 'Yes, from the 10th.'),
        msg('Emma Jones', '2018-07-14 20:00:00', 'Fireworks tonight 🎆'),
        msg(OWNER, '2018-08-15 09:00:00', 'Back from holidays.'),
        msg('Emma Jones', '2018-09-21 17:30:00', 'This video is not available in your country.',
            is_geoblocked_for_viewer=True),
        msg(OWNER, '2018-10-31 23:59:59', 'Happy Halloween'),
        msg('Emma Jones', '2018-11-11 11:00:00', 'Lunch next week?'),
        msg(OWNER, '2018-12-24 18:00:00', 'Merry Christmas!'),
    ]),
    ('e2ee_cutover', '10102977430000073', 'Farid Haddad', ['Farid Haddad', OWNER], [
        msg('Farid Haddad', '2023-02-14 12:00:00', 'Tu as reçu mon colis ?'),
        msg(OWNER, '2023-02-14 12:30:00', 'Oui merci !'),
    ]),
]

# JSON exports split long conversations into message_1.json, message_2.json, …
CHUNK = 5


def facebook_json(value):
    """JSON the way Facebook writes it: non-ASCII text as escaped UTF-8 bytes (mojibake)."""
    text = json.dumps(value, ensure_ascii=False, indent=2)
    return ''.join(
        c if ord(c) < 128 else ''.join(f'\\u00{b:02x}' for b in c.encode('utf-8'))
        for c in text
    )


def write_zip(path, files):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, content in files:
            info = zipfile.ZipInfo(name, ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, content.encode('utf-8'))


def json_files():
    for folder, name, title, participants, messages in THREADS:
        # newest first, as in real exports
        ordered = sorted(messages, key=lambda m: m['timestamp_ms'], reverse=True)
        chunks = [ordered[i:i + CHUNK] for i in range(0, len(ordered), CHUNK)]
        for index, chunk in enumerate(chunks, 1):
            yield (f'your_facebook_activity/messages/{folder}/{name}/message_{index}.json', facebook_json({
                'participants': [{'name': p} for p in participants],
                'messages': chunk,
                'title': title,
                'is_still_participant': True,
                'thread_path': f'{folder}/{name}',
                'magic_words': [],
            }))


MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']


def html_date(ms):
    # real exports show local time; this sample uses UTC so that it matches the JSON sample
    d = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    hour = d.hour % 12 or 12
    return f"{MONTHS_FR[d.month - 1]} {d.day:02d}, {d.year} {hour}:{d.minute:02d}:{d.second:02d} {'am' if d.hour < 12 else 'pm'}"


def html_message(m):
    content = ''
    if 'content' in m and not m.get('is_unsent'):
        content = html.escape(m['content'])
    media = ''.join(f'<div><img src="{html.escape(p["uri"])}" class="_a6_o" /></div>' for p in m.get('photos', []))
    reactions = ''
    if m.get('reactions'):
        items = ''.join(f'<li><span>{html.escape(r["reaction"] + r["actor"])}</span></li>' for r in m['reactions'])
        reactions = f'<div><ul class="_a6-q">{items}</ul></div>'
    return (
        f'<section class="_a6-g"><h2 class="_2ph_ _a6-h _a6-i">{html.escape(m["sender_name"])}</h2>'
        f'<div class="_2ph_ _a6-p"><div><div></div><div>{content}</div><div>{media}</div><div>{reactions}</div></div></div>'
        f'<footer class="_3-94 _a6-o"><div class="_a72d">{html_date(m["timestamp_ms"])}</div></footer></section>'
    )


def html_files():
    for folder, name, title, participants, messages in THREADS:
        sections = ''
        if len(participants) > 2:
            others = [p for p in participants if p != OWNER]
            names = [OWNER] + others
            line = ', '.join(names[:-1]) + ' et ' + names[-1]
            sections += f'<section class="_a6-g"><h2 class="_2ph_ _a6-h">Participants : {html.escape(line)}</h2></section>'
            sections += '<section class="_a6-g"><h2 class="_2ph_ _a6-h">Lien d’invitation au groupe : désactivé</h2></section>'
        # newest first, as in real exports
        for m in sorted(messages, key=lambda m: m['timestamp_ms'], reverse=True):
            sections += html_message(m)
        page = (
            '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'
            f'<base href="../../../../" /><title>{html.escape(title)}</title></head>'
            '<body class="_5vb_ _2yq _a7o5"><div class="_li"><div class="_a705">'
            '<header class="_as-_ _a709"><div class="_a70d">'
            f'<h1>{html.escape(title)}</h1>'
            f'<aside role="contentinfo" class="_aoaa">Générée par {OWNER} le '
            f'<time datetime="{EXPORT_TIME}">Le Mercredi 14 octobre 2026 à 17:23 (UTC+02:00)</time></aside>'
            '</div></header>'
            f'<main class="_a706" role="main">{sections}</main>'
            '</div></div></body></html>'
        )
        yield (f'your_facebook_activity/messages/{folder}/{name}/message_1.html', page)


if __name__ == '__main__':
    write_zip(SAMPLES / 'facebook-messenger.zip', json_files())
    write_zip(SAMPLES / 'facebook-messenger-html.zip', html_files())
    print('wrote', SAMPLES / 'facebook-messenger.zip', SAMPLES / 'facebook-messenger-html.zip')
