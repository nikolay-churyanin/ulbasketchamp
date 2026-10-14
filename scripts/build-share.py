#!/usr/bin/env python3
"""Generate static Telegram/Open Graph share pages from the current season."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timedelta
from html import escape
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://ulbasketchamp.ru"
OG_IMAGE = f"{SITE}/data/og.jpg"
MONTHS = (
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)
TRANS = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "i",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "h",
    "ц": "c",
    "ч": "ch",
    "ш": "sh",
    "щ": "sch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


def team_slug(name: str) -> str:
    out = []
    for ch in str(name or "").lower():
        if ch in TRANS:
            out.append(TRANS[ch])
        elif ("a" <= ch <= "z") or ("0" <= ch <= "9"):
            out.append(ch)
        else:
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def clip(text: str, limit: int = 180) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    trimmed = text[: limit - 1].rsplit(" ", 1)[0]
    return trimmed + "…"


def format_date(value: str) -> str:
    parsed = datetime.strptime(value, "%Y-%m-%d").date()
    return f"{parsed.day} {MONTHS[parsed.month - 1]}"


def format_range(dates: list[str]) -> str:
    unique = sorted(set(dates))
    if not unique:
        return ""
    if len(unique) == 1:
        return format_date(unique[0])
    first = datetime.strptime(unique[0], "%Y-%m-%d").date()
    last = datetime.strptime(unique[-1], "%Y-%m-%d").date()
    if first.month == last.month:
        return f"{first.day}–{last.day} {MONTHS[first.month - 1]}"
    return f"{format_date(unique[0])} – {format_date(unique[-1])}"


def league_short(league: str) -> str:
    return {"A": "А", "B": "Б", "F": "Ж"}.get(league, league)


def has_score(info: dict) -> bool:
    score = info.get("score")
    return isinstance(score, str) and ":" in score


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def og_image_for_logo(logo: str | None) -> str:
    if not logo:
        return OG_IMAGE
    lower = logo.lower()
    if not lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
        return OG_IMAGE
    return f"{SITE}/{quote(logo.lstrip('/'), safe='/:')}"


def render_page(title: str, description: str, canonical: str, image: str, css_href: str, body: str) -> str:
    safe_title = escape(title)
    safe_desc = escape(description)
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{safe_title}</title>
    <meta name="description" content="{safe_desc}">
    <link rel="canonical" href="{escape(canonical)}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="ru_RU">
    <meta property="og:site_name" content="Чемпионат по баскетболу">
    <meta property="og:title" content="{safe_title}">
    <meta property="og:description" content="{safe_desc}">
    <meta property="og:url" content="{escape(canonical)}">
    <meta property="og:image" content="{escape(image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{safe_title}">
    <meta name="twitter:description" content="{safe_desc}">
    <meta name="twitter:image" content="{escape(image)}">
    <link rel="stylesheet" href="{css_href}">
</head>
<body>
    <div class="wrap">
        {body}
    </div>
</body>
</html>
"""


def game_row(info: dict, extra: str = "", score: str | None = None) -> str:
    time = escape(info.get("time") or "")
    match = escape(f"{info['team_a']} — {info['team_b']}")
    bits = []
    if extra:
        bits.append(extra)
    if score:
        bits.append(f'<span class="score">{escape(score)}</span>')
    meta = " ".join(bits)
    return (
        f'<div class="row"><span class="time">{time}</span>'
        f'<span class="match">{match}</span>'
        f'<span class="meta">{meta}</span></div>'
    )


def weekend_games(games: list[dict]) -> list[dict]:
    upcoming = []
    for game in games:
        info = game["match_info"]
        if has_score(info):
            continue
        upcoming.append(info)
    upcoming.sort(key=lambda item: (item["date"], item.get("time") or ""))
    if not upcoming:
        return []
    first = datetime.strptime(upcoming[0]["date"], "%Y-%m-%d").date()
    last = first + timedelta(days=2)
    cluster = []
    for info in upcoming:
        day = datetime.strptime(info["date"], "%Y-%m-%d").date()
        if first <= day <= last:
            cluster.append(info)
        elif day > last:
            break
    return cluster


def write_weekend(out_dir: Path, games: list[dict], season_id: str, season_label: str) -> None:
    cluster = weekend_games(games)
    canonical = f"{SITE}/s/weekend.html"
    if cluster:
        dates = [item["date"] for item in cluster]
        title = f"Ближайший тур · {format_range(dates)}"
        bits = [
            f"{item['time']} {item['team_a']} — {item['team_b']} ({league_short(item['league'])})"
            for item in cluster[:6]
        ]
        description = clip(f"{format_range(dates)}: " + "; ".join(bits))
        groups = {}
        for item in cluster:
            key = (item["date"], item.get("venue") or "")
            groups.setdefault(key, []).append(item)
        chunks = []
        for (day, venue), items in groups.items():
            heading = f"{format_date(day)} · {escape(venue)}" if venue else format_date(day)
            rows = "".join(
                game_row(item, extra=escape(f"лига {league_short(item['league'])}"))
                for item in items
            )
            chunks.append(f'<section class="group"><h2>{heading}</h2>{rows}</section>')
        body_main = "".join(chunks)
    else:
        title = "Ближайший тур"
        description = "Следующие игры появятся в расписании чемпионата Ульяновской области."
        body_main = '<p class="empty">Ближайших матчей пока нет. Следующий тур появится в расписании.</p>'

    body = f"""
        <p class="kicker">Ульяновская область · {escape(season_label)}</p>
        <h1>{escape(title)}</h1>
        <p class="lead">{escape(description)}</p>
        {body_main}
        <div class="actions">
            <a class="btn" href="/?season={quote(season_id)}">Открыть на сайте</a>
        </div>
    """
    (out_dir / "weekend.html").write_text(
        render_page(title, description, canonical, OG_IMAGE, "share.css", body),
        encoding="utf-8",
    )


def team_games(games: list[dict], team_name: str, league: str) -> tuple[list[dict], list[dict]]:
    played = []
    upcoming = []
    for game in games:
        info = game["match_info"]
        if info.get("league") != league:
            continue
        if team_name not in (info.get("team_a"), info.get("team_b")):
            continue
        if has_score(info):
            played.append(info)
        else:
            upcoming.append(info)
    played.sort(key=lambda item: (item["date"], item.get("time") or ""), reverse=True)
    upcoming.sort(key=lambda item: (item["date"], item.get("time") or ""))
    return played, upcoming


def record_for(played: list[dict], team_name: str) -> tuple[int, int]:
    wins = losses = 0
    for info in played:
        home, away = info["score"].split(":")
        try:
            score_home, score_away = int(home), int(away)
        except ValueError:
            continue
        is_home = info["team_a"] == team_name
        team_score = score_home if is_home else score_away
        opp_score = score_away if is_home else score_home
        if team_score > opp_score:
            wins += 1
        else:
            losses += 1
    return wins, losses


def opponent_of(info: dict, team_name: str) -> str:
    return info["team_b"] if info["team_a"] == team_name else info["team_a"]


def write_team_page(
    out_dir: Path,
    team: dict,
    league: str,
    league_name: str,
    games: list[dict],
    season_id: str,
    season_label: str,
    css_href: str,
) -> None:
    slug = team_slug(team["name"])
    folder = out_dir / league.lower()
    folder.mkdir(parents=True, exist_ok=True)
    played, upcoming = team_games(games, team["name"], league)
    wins, losses = record_for(played, team["name"])
    title = f"{team['name']} · {league_name}"
    parts = [f"Рекорд {wins}–{losses}."]
    if upcoming:
        nxt = upcoming[0]
        parts.append(
            f"Ближайший: {format_date(nxt['date'])} {nxt.get('time', '')} vs {opponent_of(nxt, team['name'])}."
        )
    elif played:
        last = played[0]
        parts.append(
            f"Последний: {format_date(last['date'])} vs {opponent_of(last, team['name'])} {last['score']}."
        )
    else:
        parts.append("Матчи появятся в расписании.")
    description = clip(" ".join(parts))
    canonical = f"{SITE}/s/{league.lower()}/{slug}.html"
    image = og_image_for_logo(team.get("logo"))

    upcoming_html = ""
    if upcoming:
        rows = "".join(
            game_row(item, extra=escape(item.get("venue") or ""))
            for item in upcoming[:8]
        )
        upcoming_html = f'<section class="group"><h2>Ближайшие матчи</h2>{rows}</section>'

    results_html = ""
    if played:
        rows = []
        for item in played[:6]:
            extra = escape(format_date(item["date"]))
            rows.append(game_row(item, extra=extra, score=item["score"]))
        results_html = f'<section class="group"><h2>Последние результаты</h2>{"".join(rows)}</section>'

    open_url = (
        f"/?season={quote(season_id)}&league={quote(league)}"
        f"&team={quote(team['name'])}"
    )
    body = f"""
        <p class="kicker">{escape(season_label)} · {escape(league_name)}</p>
        <h1>{escape(team['name'])}</h1>
        <p class="lead">{escape(description)}</p>
        {upcoming_html}
        {results_html}
        <div class="actions">
            <a class="btn" href="{open_url}">Открыть на сайте</a>
            <a class="btn ghost" href="/s/weekend.html">Ближайший тур</a>
        </div>
    """
    (folder / f"{slug}.html").write_text(
        render_page(title, description, canonical, image, css_href, body),
        encoding="utf-8",
    )


def main() -> None:
    catalog = load_json(ROOT / "data" / "seasons.json")
    season_id = catalog["current"]
    season_label = next(
        (item["label"] for item in catalog["seasons"] if item["id"] == season_id),
        season_id,
    )
    season_dir = ROOT / "data" / "seasons" / season_id
    games = load_json(season_dir / "games.json")
    teams = load_json(season_dir / "teams.json")
    leagues = load_json(season_dir / "leagues-config.json")

    out_dir = ROOT / "s"
    share_css = out_dir / "share.css"
    css_backup = share_css.read_text(encoding="utf-8") if share_css.exists() else None
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir()
    if css_backup is not None:
        share_css.write_text(css_backup, encoding="utf-8")

    write_weekend(out_dir, games, season_id, season_label)
    for team in teams:
        league = team["league"]
        league_name = leagues.get(league, {}).get("name") or league
        write_team_page(
            out_dir,
            team,
            league,
            league_name,
            games,
            season_id,
            season_label,
            "../share.css",
        )


if __name__ == "__main__":
    main()
