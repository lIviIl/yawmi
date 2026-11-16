#!/usr/bin/env python3
"""Yawmi hub generator. Reads config.json + src/, writes the static site into site/. Standard library only.
Run:  python3 build.py   then commit the site/ folder (Cloudflare serves it as is)."""
import hashlib, html, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC, SITE = ROOT / "src", ROOT / "site"
CFG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
esc = html.escape
BASE = (CFG.get("site_url") or "").rstrip("/")
LANGS = ("en", "ar")
GAMES = ("jidhr", "film", "mathal")

UI = {
    "en": dict(
        brand="Yawmi", share="Share", copy="Copy", save="Save image", copied="Copied!", daily="Daily", duel="Duel",
        puzzle="Puzzle", round="Round", score="Score", lowerBetter="Lower is better", next="Next round", finish="See result",
        nextIn="Next puzzle in", solvedIn="Solved in {n}", failed="Out of tries", missed="missed", notYet="Not played yet",
        today="Today: {n} of {t} done", start="Start duel", nick="Your nickname", nickPh="Nickname (optional)", friend="A friend",
        duelIntro="{n} puzzles, the same for everyone who opens your link. Fewer tries wins. No account needed.",
        challenged="{name} scored {n}. Can you beat it?", youBeat="You beat {name}!", tie="A tie!", theyWin="{name} wins this one",
        copyLink="Copy challenge link", played="Played", winPct="Win rate", streak="Streak",
        enter="Enter", **{"del": "Delete"}, guess="Guess", check="Check", clear="Clear",
        jidhr=dict(hint="Find the 3-letter root shared by these words. Roots read right to left.", short="Enter 3 letters"),
        film=dict(ph="Type a film title…", none="No match in our list", hint="Guess the Egyptian film from the emojis. Each wrong guess unlocks a clue.", words="Words in the title: {n}"),
        mathal=dict(hint="Meaning", first="First word", how="Tap the words in order to rebuild the proverb.", left="{n} of {m} words in the right place"),
        names=dict(jidhr=dict(en="Jidhr", ar="جذر"), film=dict(en="Film", ar="فيلم"), mathal=dict(en="Mathal", ar="مَثَل")),
        genres=dict(com="Comedy", drama="Drama", action="Action", thriller="Thriller", bio="Biography", rom="Romance", war="War", hist="Historical"),
        clue=dict(words="Title", genre="Genre", decade="Decade", actor="Lead", letter="Starts with", year="Year"),
        decades={}),
    "ar": dict(
        brand="يومي", share="مشاركة", copy="نسخ", save="حفظ كصورة", copied="تم النسخ!", daily="اليومي", duel="تحدٍّ",
        puzzle="اللغز", round="الجولة", score="النتيجة", lowerBetter="الأقل أفضل", next="الجولة التالية", finish="عرض النتيجة",
        nextIn="اللغز التالي بعد", solvedIn="تم الحل في {n}", failed="انتهت المحاولات", missed="فاتتك", notYet="لم تلعب بعد",
        today="اليوم: {n} من {t}", start="ابدأ التحدي", nick="اسمك", nickPh="اسمك (اختياري)", friend="صديقك",
        duelIntro="{n} ألغاز، نفسها لكل من يفتح رابطك. الأقل محاولات يفوز. بدون حساب.",
        challenged="{name} حصل على {n}. هل تتفوق عليه؟", youBeat="تفوقت على {name}!", tie="تعادل!", theyWin="فاز {name} هذه المرة",
        copyLink="نسخ رابط التحدي", played="لُعبت", winPct="نسبة الفوز", streak="التتابع",
        enter="تأكيد", **{"del": "حذف"}, guess="خمّن", check="تحقق", clear="مسح",
        jidhr=dict(hint="اكتشف الجذر الثلاثي المشترك بين هذه الكلمات. الجذر يُقرأ من اليمين إلى اليسار.", short="أدخل ٣ حروف"),
        film=dict(ph="اكتب اسم الفيلم…", none="لا يوجد فيلم بهذا الاسم", hint="خمّن الفيلم المصري من الإيموجي. كل إجابة خاطئة تكشف تلميحًا.", words="عدد كلمات العنوان: {n}"),
        mathal=dict(hint="المعنى", first="الكلمة الأولى", how="اضغط على الكلمات بالترتيب لتعيد بناء المثل.", left="{n} من {m} كلمات في مكانها"),
        names=dict(jidhr=dict(en="Jidhr", ar="جذر"), film=dict(en="Film", ar="فيلم"), mathal=dict(en="Mathal", ar="مَثَل")),
        genres=dict(com="كوميديا", drama="دراما", action="أكشن", thriller="إثارة", bio="سيرة ذاتية", rom="رومانسي", war="حرب", hist="تاريخي"),
        clue=dict(words="العنوان", genre="النوع", decade="العقد", actor="البطولة", letter="يبدأ بحرف", year="السنة"),
        decades={"1950": "الخمسينيات", "1960": "الستينيات", "1970": "السبعينيات", "1980": "الثمانينيات", "1990": "التسعينيات",
                 "2000": "الألفينات", "2010": "العقد ٢٠١٠", "2020": "العقد ٢٠٢٠"}),
}

TXT = {
    "en": dict(
        hub_title="Daily Arabic games: roots, films, proverbs", hub_desc="Three new Arabic puzzles every day: guess the root, name the Egyptian film from emojis, rebuild the proverb. Share your result and challenge a friend.",
        h1="One puzzle a day. In Arabic.", lead="Three new puzzles every midnight: find the root, name the film, rebuild the proverb. Finish one, share your result, then challenge a friend to a duel.",
        play="Play today's", duel="Duel", home="All games", how="How to play", privacy="Privacy", lang_label="العربية",
        about_h="Why daily Arabic games?", about=("Every puzzle is built on something Arabic speakers already love: the root system that builds the language, "
            "the classic Egyptian films everyone quotes, and the proverbs your grandmother used. There is no account and nothing to install. Your streaks stay in your browser. "
            "Learning Arabic? The English side shows the meaning of every word."),
        games=dict(
            jidhr=dict(t="Jidhr: guess the Arabic root", d="Guess the 3-letter Arabic root hidden behind a family of words.",
                       lead="Arabic words grow from roots. Read the family of words, then name the three letters they share.",
                       how=["Every Arabic word is built on a root, usually three letters, for example ك ت ب behind book, writer and library.",
                            "You start with two words from one family. Guess the root with three letters.",
                            "Teal means the right letter in the right place. Gold means the right letter in another place. Dark means it is not in the root.",
                            "Every wrong guess unlocks another word. You have six guesses."],
                       about="Jidhr (جذر) means \"root\". Arabic builds thousands of words from about 1,600 three-letter roots, so spotting the root is the fastest way to understand new words. A new root arrives every day."),
            film=dict(t="Film: guess the Egyptian movie from emojis", d="Name the classic Egyptian film from a handful of emojis.",
                      lead="A few emojis stand for a classic Egyptian film. Each wrong guess unlocks another clue.",
                      how=["Look at the emojis and type the film title. Suggestions appear as you type.",
                           "Each wrong guess unlocks a clue: genre, decade, lead actor, first letter and finally the year.",
                           "You have six guesses."],
                      about="Egyptian cinema is the shared memory of the Arab world. This game covers the golden age and the comedy hits of the 1990s and 2000s."),
            mathal=dict(t="Mathal: rebuild the Arabic proverb", d="Put the scrambled words back in order to rebuild an Arabic proverb.",
                        lead="The words of a well known proverb are scrambled. Put them back in order.",
                        how=["Tap the words in the order you think the proverb goes, then press Check.",
                             "Words in the right place lock in. The rest return to the pile.",
                             "After two checks you get a hint. You have five checks."],
                        about="Mathal (مثل) means \"proverb\". Classical sayings sit next to Egyptian street wisdom, and the English meaning is shown after you finish.")),
        priv_t="Privacy", priv=["Yawmi has no accounts and does not ask for personal data.", "Your streaks, results and nickname are stored only in your own browser (local storage) and never sent to us.",
                                "We may add advertising later. If we do, advertising partners can use cookies, and this page will say so.", "Contact: {email}"]),
    "ar": dict(
        hub_title="ألعاب عربية يومية: جذور وأفلام وأمثال", hub_desc="ثلاثة ألغاز عربية جديدة كل يوم: خمّن الجذر، وخمّن الفيلم المصري من الإيموجي، وأعد بناء المثل. شارك نتيجتك وتحدَّ صديقك.",
        h1="لغز جديد كل يوم. بالعربي.", lead="ثلاثة ألغاز جديدة كل منتصف ليل: اكتشف الجذر، خمّن الفيلم، أعد بناء المثل. أنهِ لغزًا، شارك نتيجتك، ثم تحدَّ صديقك.",
        play="العب لغز اليوم", duel="تحدٍّ", home="كل الألعاب", how="طريقة اللعب", privacy="الخصوصية", lang_label="English",
        about_h="لماذا ألعاب عربية يومية؟", about=("كل لغز مبني على شيء يحبه العرب: نظام الجذور الذي يبني اللغة، والأفلام المصرية الكلاسيكية التي يردد الجميع عباراتها، "
            "والأمثال التي كانت تقولها جدتك. لا حساب ولا تحميل، وإنجازاتك تبقى في متصفحك."),
        games=dict(
            jidhr=dict(t="جذر: خمّن الجذر العربي", d="اكتشف الجذر العربي الثلاثي المخفي وراء عائلة من الكلمات.",
                       lead="الكلمات العربية تنبت من جذور. اقرأ عائلة الكلمات ثم سمِّ الحروف الثلاثة المشتركة بينها.",
                       how=["كل كلمة عربية مبنية على جذر، غالبًا من ثلاثة حروف، مثل ك ت ب وراء كتاب وكاتب ومكتبة.",
                            "تبدأ بكلمتين من نفس العائلة. خمّن الجذر بثلاثة حروف.",
                            "الأخضر المزرق: حرف صحيح في مكانه. الذهبي: حرف صحيح في مكان آخر. الداكن: ليس في الجذر.",
                            "كل تخمين خاطئ يكشف كلمة جديدة. لديك ست محاولات."],
                       about="«جذر» هي الأصل الذي تنمو منه الكلمات. تبني العربية آلاف الكلمات من حوالي ١٦٠٠ جذر ثلاثي، لذلك فمعرفة الجذر أسرع طريق لفهم كلمة جديدة. جذر جديد كل يوم."),
            film=dict(t="فيلم: خمّن الفيلم المصري من الإيموجي", d="خمّن الفيلم المصري الكلاسيكي من بضعة إيموجي.",
                      lead="بضعة إيموجي تدل على فيلم مصري كلاسيكي. كل تخمين خاطئ يكشف تلميحًا جديدًا.",
                      how=["انظر إلى الإيموجي واكتب اسم الفيلم. تظهر اقتراحات أثناء الكتابة.",
                           "كل تخمين خاطئ يكشف تلميحًا: النوع، العقد، بطل الفيلم، الحرف الأول، ثم السنة.",
                           "لديك ست محاولات."],
                      about="السينما المصرية ذاكرة مشتركة للعالم العربي. تغطي اللعبة العصر الذهبي وأفلام الكوميديا في التسعينيات والألفينات."),
            mathal=dict(t="مثل: أعد بناء المثل العربي", d="رتّب الكلمات المبعثرة لتعيد بناء المثل العربي.",
                        lead="كلمات مثل شهير مبعثرة. أعدها إلى ترتيبها الصحيح.",
                        how=["اضغط على الكلمات بالترتيب الذي تظنه ثم اضغط تحقق.",
                             "الكلمات الصحيحة تثبت في مكانها والباقي يعود إلى الكومة.",
                             "بعد محاولتين يظهر تلميح. لديك خمس محاولات."],
                        about="«مثل» هو القول السائر. تجلس الأقوال الفصيحة بجانب حكمة الشارع المصري.")),
        priv_t="الخصوصية", priv=["لا يوجد حساب في يومي ولا نطلب بيانات شخصية.", "تُحفظ إنجازاتك ونتائجك واسمك في متصفحك فقط ولا تُرسل إلينا.",
                                 "قد نضيف إعلانات لاحقًا، وعندها قد يستخدم شركاء الإعلانات ملفات تعريف الارتباط وسنذكر ذلك هنا.", "للتواصل: {email}"]),
}

for _lang in UI:
    UI[_lang]["launch"] = CFG.get("launch_date", "2026-11-16")
    UI[_lang]["brand"] = CFG["brand"][_lang]

COLORS = dict(jidhr="red", film="teal", mathal="gold")
GLYPH = dict(jidhr="جـ", film="🎬", mathal="❝")
LOGO = ('<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="7" width="26" height="26" fill="#E0482F" stroke="#0A1026" stroke-width="2.5"/>'
        '<rect x="7" y="7" width="26" height="26" fill="#F5B72E" stroke="#0A1026" stroke-width="2.5" transform="rotate(45 20 20)"/>'
        '<circle cx="20" cy="20" r="5.5" fill="#16A9A4" stroke="#0A1026" stroke-width="2.5"/></svg>')
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Lalezar&display=swap">')


def name_pair(lang, nm):
    if lang == "ar":
        return f'{nm["ar"]}<span lang="en">{nm["en"]}</span>'
    return f'{nm["en"]}<span lang="ar">{nm["ar"]}</span>'


def stamp(name):
    return hashlib.sha1((SRC / name).read_bytes()).hexdigest()[:8]


def path(lang, tail=""):
    return ("/ar" if lang == "ar" else "") + "/" + tail


def head_extras():
    out = ""
    if CFG.get("adsense_client"):
        out += f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={esc(CFG["adsense_client"])}" crossorigin="anonymous"></script>'
    return out


def shell(lang, title, desc, body, tail, page, extra_script=True):
    t, other = TXT[lang], "ar" if lang == "en" else "en"
    here, there = path(lang, tail), path(other, tail)
    seo = (f'<link rel="canonical" href="{BASE}{here}"><link rel="alternate" hreflang="{lang}" href="{BASE}{here}">'
           f'<link rel="alternate" hreflang="{other}" href="{BASE}{there}">') if BASE else ""
    cf = (CFG.get("cf_analytics_token") or "").strip()
    beacon = ('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\''
              + json.dumps({"token": cf}) + '\'></script>') if cf else ""
    brand = CFG["brand"][lang]
    mail = (CFG.get("contact_email") or "").strip()
    contact = f' &nbsp; <a href="mailto:{esc(mail)}">{esc(mail)}</a>' if mail else ""
    scripts = (f'<script id="i18n" type="application/json">{json.dumps(UI[lang], ensure_ascii=False)}</script>'
               f'<script src="/assets/data.js?v={stamp("data.js")}"></script><script src="/assets/yawmi.js?v={stamp("yawmi.js")}"></script>') if extra_script else ""
    return (f'<!doctype html><html lang="{lang}" dir="{"rtl" if lang == "ar" else "ltr"}"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0F1B3D">'
            f'<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">{seo}'
            f'<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}"><meta property="og:type" content="website">'
            f'{FONTS}<link rel="stylesheet" href="/assets/yawmi.css?v={stamp("yawmi.css")}">{head_extras()}</head>'
            f'<body data-page="{page}"><div class="bunting" role="presentation"></div><div class="wrap">'
            f'<header class="top"><a class="brand" href="{path(lang)}">{LOGO}<span>{esc(brand)}</span></a>'
            f'<nav><a class="pill" href="{there}" hreflang="{other}">{t["lang_label"]}</a></nav></header>'
            f'{body}<footer><a href="{path(lang, "privacy/")}">{t["privacy"]}</a>{contact} &nbsp; {esc(brand)} &copy; 2026</footer></div>{scripts}{beacon}</body></html>')


def hub(lang):
    t = TXT[lang]
    tiles = ""
    for g in GAMES:
        gt = t["games"][g]
        nm = UI[lang]["names"][g]
        tiles += (f'<article class="tile c-{COLORS[g]}" data-game="{g}"><div class="glyph" aria-hidden="true">{GLYPH[g]}</div>'
                  f'<h2>{name_pair(lang, nm)}</h2><p>{gt["d"]}</p><p class="stat" data-stat></p>'
                  f'<div class="acts"><a class="btn" href="{path(lang, g + "/")}">{t["play"]}</a>'
                  f'<a class="btn ghost" href="{path(lang, g + "/")}?mode=duel">{t["duel"]}</a></div></article>')
    body = (f'<main><h1>{t["h1"]}</h1><p class="lead">{t["lead"]}</p><p class="today" id="today"></p>'
            f'<section class="tiles">{tiles}</section><section class="about"><h2>{t["about_h"]}</h2><p>{t["about"]}</p></section></main>')
    return shell(lang, f'{CFG["brand"][lang]}: {t["hub_title"]}', t["hub_desc"], body, "", "hub")


def game(lang, g):
    t, gt = TXT[lang], TXT[lang]["games"][g]
    nm = UI[lang]["names"][g]
    how = "".join(f"<li>{x}</li>" for x in gt["how"])
    body = (f'<main><p class="crumb"><a href="{path(lang)}">{t["home"]}</a></p>'
            f'<h1>{name_pair(lang, nm)}<small>{gt["lead"]}</small></h1><div id="game"></div>'
            f'<details class="how" open><summary>{t["how"]}</summary><ol>{how}</ol></details>'
            f'<section class="about"><p>{gt["about"]}</p></section></main>')
    return shell(lang, f'{gt["t"]} | {CFG["brand"][lang]}', gt["d"], body, g + "/", g)


def privacy(lang):
    t = TXT[lang]
    email = CFG.get("contact_email") or ("the site owner" if lang == "en" else "صاحب الموقع")
    paras = "".join(f"<p>{p.format(email=esc(email))}</p>" for p in t["priv"])
    body = f'<main class="legal"><h1>{t["priv_t"]}</h1>{paras}</main>'
    return shell(lang, f'{t["priv_t"]} | {CFG["brand"][lang]}', t["priv_t"], body, "privacy/", "privacy", extra_script=False)


def write(p, text):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def main():
    shutil.rmtree(SITE, ignore_errors=True)
    for name in ("yawmi.css", "yawmi.js", "data.js"):
        (SITE / "assets").mkdir(parents=True, exist_ok=True)
        shutil.copy(SRC / name, SITE / "assets" / name)
    urls = []
    for lang in LANGS:
        write(SITE / path(lang).strip("/") / "index.html" if lang == "ar" else SITE / "index.html", hub(lang))
        urls.append(BASE + path(lang))
        for g in GAMES:
            write(SITE / path(lang, g).strip("/") / "index.html", game(lang, g))
            urls.append(BASE + path(lang, g + "/"))
        write(SITE / path(lang, "privacy").strip("/") / "index.html", privacy(lang))
    nf = ('<main><h1>404</h1><p><a href="/">Yawmi</a> · <a href="/ar/">يومي</a></p></main>')
    write(SITE / "404.html", shell("en", "404 | Yawmi", "Page not found", nf, "", "404", extra_script=False))
    if BASE:
        write(SITE / "sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
              + "".join(f"<url><loc>{esc(u)}</loc></url>" for u in urls) + "</urlset>")
        write(SITE / "robots.txt", f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
    if CFG.get("adsense_client"):
        pub = CFG["adsense_client"].replace("ca-", "")
        write(SITE / "ads.txt", f"google.com, {pub}, DIRECT, f08c47fec0942fa0\n")
    print(f"built {len(list(SITE.rglob('*.html')))} pages into {SITE}")


if __name__ == "__main__":
    main()
