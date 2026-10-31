#!/usr/bin/env python3
"""Rebuild the server-only Hangman dictionary from pinned, licensed source data.

Requires Python 3.10+, Node.js, and the Python msgpack package. Source downloads
are build-time only; the deployed game does not contact a dictionary service.
Run: python3 scripts/build-privategames-dictionary.py --download
"""
from __future__ import annotations

import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
import urllib.request

import msgpack

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/privategames"
VERSION = "wordnet30-wordfreq32-1"
WF_COMMIT = "42233e6c36ce792031bcccfa17cdd0cec9af5fa7"
SOURCES = {
    "WNdb-3.0.tar.gz": (
        "https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz",
        "658b1ba191f5f98c2e9bae3e25c186013158f30ef779f191d2a44e5d25046dc8",
    ),
    "wordnet-LICENSE.txt": (
        "https://wordnetcode.princeton.edu/3.0/LICENSE",
        "7731175a77952e259390b496fab905e57118b8d19ad3a8383c67eee724ff443f",
    ),
    "large_en.msgpack.gz": (
        f"https://raw.githubusercontent.com/rspeer/wordfreq/{WF_COMMIT}/wordfreq/data/large_en.msgpack.gz",
        "dffae8066b78dce0a6667cf5f58e567054f902674667090a7ac8a8a44628b05c",
    ),
    "wordfreq-NOTICE.md": (
        f"https://raw.githubusercontent.com/rspeer/wordfreq/{WF_COMMIT}/NOTICE.md",
        "d9b104dafe63886af55e7cea7484824e32e12d4e1f57f319923dd643b36d6b15",
    ),
    "wordfreq-LICENSE.txt": (
        f"https://raw.githubusercontent.com/rspeer/wordfreq/{WF_COMMIT}/LICENSE.txt",
        "8990c551671a51765c4dfe9428f3e1d58dc327f49aca346a32d28cc0fcc7aa88",
    ),
}

# A transparent family-game filter, not a claim of certified classroom review.
# Keep ordinary medical/science terms; remove explicit/slur senses, not every
# word that also has an adult sense. Proper-name spellings are removed separately.
BLOCKED_HEADWORDS = frozenset("""
ass arse arsehole asshole bastard bitch bullshit cock cunt dick douchebag fag
faggot fuck goddamn jackass kike motherfucker nigger nigga piss prick pussy shit
slut spic twat wanker wetback whore chink gook coon redskin retard retarded
sex sexy sexual sexually intercourse coitus coital dildo vibrator rape rapist
molest molester molestation sodomy sodomite buggery bugger gangbang handjob blowjob
bollock bollocks dickhead cockhead cockteaser prickteaser tit titty titties raped
raping rapes jerkoff jackoff
""".split())
BLOCKED_PREFIXES = re.compile(
    r"^(?:fuck|motherfuck|shit|bullshit|cunt|porn|masturbat|fornicat|copulat|"
    r"ejaculat|orgasm|erot|bestial|nigg|whor|slut|dild|fellat|cunniling|"
    r"sodom|pedophil|paedophil|incest|necrophil|zoophil|asshole|arsehole|"
    r"bitch|bastard|wank|piss|cocksuck)", re.I
)
UNSUITABLE_SENSE = re.compile(
    r"\b(?:vulgar|obscene|offensive|derogatory|disparaging|pejorative|"
    r"ethnic slur|racial slur|sexual intercourse|sexual activity|sexual arousal|"
    r"sexual gratification|sexual desire|sexual excitement|sexual pleasure|"
    r"sexual penetration|sex act|sex appeal|pornograph\w*|masturbat\w*|ejaculat\w*|"
    r"orgasm\w*|fellat\w*|cunniling\w*|copulat\w*|coitus|"
    r"fuck\w*|cunt\w*|nigger\w*|shit|bullshit|asshole|bitch|slut|whore)\b", re.I
)
LEVELS = [
    ("easy", "Easy", "Estimated common vocabulary (wordfreq Zipf frequency 4.5 or higher).", 1),
    ("middle", "Middle school", "Estimated moderate vocabulary (Zipf 3.5–4.49), plus the original 50 curated words; not a certified grade list.", 2),
    ("advanced", "Advanced", "Estimated less-common vocabulary (Zipf 2.0–3.49); includes technical terms.", 4),
    ("dictionary", "Full dictionary", "All playable entries in the bundled dictionary, including rare and technical words; names, nonalphabetic entries and filtered senses are excluded.", 8),
]


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_sources(directory: Path, download: bool) -> dict[str, bytes]:
    directory.mkdir(parents=True, exist_ok=True)
    files = {}
    for name, (url, expected) in SOURCES.items():
        target = directory / name
        if not target.exists():
            if not download:
                raise SystemExit(f"Missing {target}; rerun with --download.")
            with urllib.request.urlopen(url, timeout=45) as response:
                data = response.read()
            if sha(data) != expected:
                raise SystemExit(f"Source checksum mismatch for {name}; no output written.")
            target.write_bytes(data)
        data = target.read_bytes()
        if sha(data) != expected:
            raise SystemExit(f"Source checksum mismatch for {name}; no output written.")
        files[name] = data
    return files


def word_frequencies(data: bytes) -> dict[str, int]:
    bins = msgpack.unpackb(gzip.decompress(data), raw=False)
    if bins[0] != {"format": "cB", "version": 1}:
        raise SystemExit("Unexpected wordfreq source format.")
    # Source bins store hundredths of -log10(frequency); Zipf = 9 + log10(f).
    # We only look up lowercase ASCII headwords, so tokenization is unnecessary.
    return {word: 900 - index for index, group in enumerate(bins[1:]) for word in group}


def definition(gloss: str, headword: str) -> str:
    # Examples tend to disclose the answer, so keep the actual definition only.
    text = gloss.split('; "', 1)[0].strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\b" + re.escape(headword) + r"\b", "____", text, flags=re.I)
    if len(text) > 234:
        text = text[:232].rsplit(" ", 1)[0] + "…"
    if text:
        text = text[0].upper() + text[1:]
        if text[-1] not in ".!?…":
            text += "."
    return text


def build_entries(files: dict[str, bytes], source_dir: Path):
    frequencies = word_frequencies(files["large_en.msgpack.gz"])
    stats = collections.Counter()
    entries = {}
    with tarfile.open(source_dir / "WNdb-3.0.tar.gz", "r:gz") as archive:
        sense_ranks = {}
        for line in archive.extractfile("dict/index.sense").read().decode().splitlines():
            sense, offset, number, tagged = line.split()
            headword, rest = sense.split("%", 1)
            pos = rest[0]
            if pos == "5":
                pos = "3"  # adjective satellites share the adjective data file
            sense_ranks[(headword, offset, pos)] = (int(tagged), -int(number))
        for posname, posnumber in (("noun", "1"), ("verb", "2"), ("adj", "3"), ("adv", "4")):
            for line in archive.extractfile(f"dict/data.{posname}").read().decode().splitlines():
                if not line or line.startswith(" "):
                    continue
                metadata, gloss = line.split(" | ", 1)
                fields = metadata.split()
                count = int(fields[3], 16)
                pointer_index = 4 + 2 * count
                pointer_count = int(fields[pointer_index])
                # Instance hypernyms identify named individuals/places, including
                # the occasional lowercase form in the original database.
                if any(fields[pointer_index + 1 + 4 * i] == "@i" for i in range(pointer_count)):
                    stats["named_instance_senses_removed"] += 1
                    continue
                if UNSUITABLE_SENSE.search(gloss):
                    stats["filtered_senses"] += 1
                    continue
                for i in range(count):
                    raw_word = fields[4 + 2 * i]
                    word = re.sub(r"\((?:a|p|ip)\)$", "", raw_word)
                    if not re.fullmatch(r"[a-z]{3,15}", word):
                        continue
                    if word in BLOCKED_HEADWORDS or BLOCKED_PREFIXES.search(word):
                        stats["filtered_headword_occurrences"] += 1
                        continue
                    clue = definition(gloss, word)
                    if len(clue) < 8 or clue.lower() in {"____.", "a ____.", "the ____."}:
                        continue
                    rank = sense_ranks.get((word, fields[0], posnumber), (0, -999))
                    # Prefer a common recorded sense; ties preserve noun/verb/
                    # adjective/adverb source order instead of arbitrary offsets.
                    if word not in entries or rank > entries[word][1]:
                        entries[word] = (clue, rank)
    legacy = json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e",
        "import {WORD_BANK} from './src/privategames/words.mjs'; console.log(JSON.stringify(WORD_BANK));",
    ], cwd=ROOT, text=True))
    legacy_words = {entry["word"] for entry in legacy}
    for entry in legacy:
        entries[entry["word"]] = (entry["clue"], (999999, 0))
    rows = []
    for word, (clue, _rank) in sorted(entries.items()):
        frequency = frequencies.get(word, 0)
        mask = 8
        if frequency >= 450:
            mask |= 1
        elif frequency >= 350:
            mask |= 2
        elif frequency >= 200:
            mask |= 4
        if word in legacy_words:
            mask |= 2
        rows.append((word, mask, clue))
    stats["legacy_curated_entries"] = len(legacy)
    return rows, dict(stats)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=Path(tempfile.gettempdir()) / "hangman-dictionary-sources")
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    files = load_sources(args.source_dir, args.download)
    rows, statistics = build_entries(files, args.source_dir)
    packed = "\n".join(f"{word}\t{mask}\t{clue}" for word, mask, clue in rows)
    packed_hash = sha(packed.encode())
    attribution = (
        "Definitions adapted from Princeton WordNet 3.0 (Copyright 2006 Princeton University; WordNet License). "
        "Familiarity estimates derived from wordfreq 3.2 by Robyn Speer (Copyright 2022; data CC BY-SA 4.0). "
        "The adapted dictionary data is available under CC BY-SA 4.0 with the original WordNet notice preserved. "
        "The original 50 game clues are retained. Difficulty is estimated, not a certified reading grade."
    )
    notices = (
        "HANGMAN DICTIONARY DATA — ATTRIBUTION AND LICENSES\n\n" + attribution + "\n\n"
        "Adaptations: lowercase alphabetic entries of 3–15 letters; proper-name and family-game sense filtering; "
        "one sense selected per word; examples removed; clues shortened to 235 characters and headword occurrences redacted; "
        "frequency-based level flags attached; original curated clues retained.\n\n"
        "Adapted dictionary data license: Creative Commons Attribution-ShareAlike 4.0 International\n"
        "https://creativecommons.org/licenses/by-sa/4.0/\n"
        "https://creativecommons.org/licenses/by-sa/4.0/legalcode\n\n"
        "WordNet source: https://wordnet.princeton.edu/\n"
        "WordNet recommended reference: Princeton University, WordNet, https://wordnet.princeton.edu/\n\n"
        + files["wordnet-LICENSE.txt"].decode() + "\n\n"
        "wordfreq source: https://github.com/rspeer/wordfreq\n"
        "Robyn Speer. (2022). rspeer/wordfreq: v3.0 (v3.0.2). Zenodo. https://doi.org/10.5281/zenodo.7199437\n\n"
        + files["wordfreq-NOTICE.md"].decode() + "\n\n"
        + files["wordfreq-LICENSE.txt"].decode()
    )
    license_header = (
        "/*!\n" + notices.replace("*/", "* /") + "\n*/\n"
        "// Generated by scripts/build-privategames-dictionary.py. SERVER ONLY.\n"
    )
    # Keep each source file below connector payload limits. Split on complete
    # records and rejoin with exactly one newline; PACKED_WORDS stays byte-exact.
    part_limit = 180_000
    literal_budget = part_limit - len((license_header + "export default ").encode()) - 2
    chunks, chunk, literal_bytes = [], [], 2  # JSON string's opening/closing quotes
    for line in packed.split("\n"):
        encoded_length = len(json.dumps(line, ensure_ascii=False).encode()) - 2
        addition = encoded_length + (2 if chunk else 0)  # escaped newline
        if chunk and literal_bytes + addition > literal_budget:
            chunks.append("\n".join(chunk))
            chunk, literal_bytes = [], 2
            addition = encoded_length
        chunk.append(line)
        literal_bytes += addition
    if chunk:
        chunks.append("\n".join(chunk))
    assert "\n".join(chunks) == packed
    part_sources = [license_header + "export default " + json.dumps(chunk, ensure_ascii=False) + ";\n" for chunk in chunks]
    assert all(len(part.encode()) <= part_limit for part in part_sources)
    part_names = [f"part-{index:03d}.mjs" for index in range(len(chunks))]
    imports = "".join(f"import part{index:03d} from './dictionary-parts/{name}';\n" for index, name in enumerate(part_names))
    data_text = (
        license_header + imports + "\n"
        f"export const DICTIONARY_VERSION = {json.dumps(VERSION)};\n"
        f"export const DICTIONARY_SHA256 = {json.dumps(packed_hash)};\n"
        "export const PACKED_WORDS = [" + ", ".join(f"part{index:03d}" for index in range(len(chunks))) + "].join('\\n');\n"
    )
    levels = []
    for level_id, label, description, flag in LEVELS:
        counts = {str(length): sum(1 for word, mask, _ in rows if len(word) == length and mask & flag) for length in range(3, 16)}
        levels.append({"id": level_id, "label": label, "description": description,
                       "count": sum(counts.values()), "countsByLength": counts})
    public_metadata = {
        "source": "Princeton WordNet 3.0 + wordfreq 3.2",
        "label": "Playable English dictionary",
        "total": len(rows), "levels": levels, "minLength": 3, "maxLength": 15,
        "attribution": attribution,
        "estimatedDifficulty": True,
        "version": VERSION,
    }
    manifest = {
        "version": VERSION, "entries": len(rows), "packedSha256": packed_hash,
        "moduleSha256": sha(data_text.encode()), "moduleBytes": len(data_text.encode()),
        "moduleGzipBytes": len(gzip.compress(data_text.encode(), compresslevel=9, mtime=0)),
        "packaging": "split-esm-v1", "partCount": len(part_sources), "partMaximumBytes": part_limit,
        "parts": [{"file": f"src/privategames/dictionary-parts/{name}", "sha256": sha(text.encode()),
                   "bytes": len(text.encode()), "records": len(chunk.split("\n"))}
                  for name, text, chunk in zip(part_names, part_sources, chunks)],
        "totalSourceBytes": len(data_text.encode()) + sum(len(text.encode()) for text in part_sources),
        "totalSourceGzipBytes": len(gzip.compress((data_text + "".join(part_sources)).encode(), compresslevel=9, mtime=0)),
        "sources": [{"file": name, "url": url, "sha256": checksum, "bytes": len(files[name])}
                    for name, (url, checksum) in SOURCES.items()],
        "wordfreqCommit": WF_COMMIT, "filters": statistics, "metadata": public_metadata,
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    parts_directory = OUTPUT / "dictionary-parts"
    parts_directory.mkdir(parents=True, exist_ok=True)
    for old_part in parts_directory.glob("part-[0-9][0-9][0-9].mjs"):
        if old_part.name not in part_names:
            old_part.unlink()
    for name, text in zip(part_names, part_sources):
        (parts_directory / name).write_text(text)
    (OUTPUT / "dictionary-data.mjs").write_text(data_text)
    (OUTPUT / "dictionary-metadata.mjs").write_text(
        "// Generated aggregate metadata only: no words, answers, or clues.\n"
        "export const DICTIONARY_METADATA = " + json.dumps(public_metadata, ensure_ascii=False, indent=2) + ";\n"
    )
    documentation = ROOT / "docs/privategames-dictionary"
    documentation.mkdir(parents=True, exist_ok=True)
    (documentation / "NOTICES.txt").write_text(notices)
    (documentation / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: manifest[key] for key in ("entries", "packedSha256", "moduleBytes", "partCount", "totalSourceBytes", "totalSourceGzipBytes", "filters")}))
    print(json.dumps({level["id"]: level["count"] for level in levels}))


if __name__ == "__main__":
    main()
