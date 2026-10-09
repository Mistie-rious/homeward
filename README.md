# Homeward

A phone-first web app (installable PWA) for learning a language a little every day. A daily session of about 20 minutes: **review** (FSRS flashcards) → **learn something new** (Basics) → **read** (tap words or sentences to look up and save) → **write** (corrected by Claude) → **drill** today's mistakes. A **Talk** tab has role-play conversations with Claude, and an **Ask a question** chat is available next to every card, text and correction.

There's no server. Everything runs in the phone's browser:

- **Data**: SQLite (sql.js) saved in the browser's IndexedDB. *Me → My data* lets you browse/edit it, export CSV, and back up/restore the `.db` file (opens in any SQLite viewer).
- **Claude**: called directly from the phone with your own API key (Settings; stored only on the device, never in backups). Pick the model in Settings: Haiku 4.5 (default, cheapest), Sonnet 5.5 or Opus 5.5 (more reliable for a lower-resource language). Settings shows this month's spend, priced per model.
- **Without a key** it still works for the course, review, the offline dictionary and the built-in dialogues. Writing corrections, conversations, the question chat and the serial story need a key and say so clearly.
- **Hosting**: static files on GitHub Pages ($0).

## Review the content with a native speaker

The Basics units, lessons and dialogues (`web/js/course.js`, `web/js/lessons.js`) were written by an AI, not by a native speaker. They are kept to common words and short sentences, with tone marks and underdots, but **a native speaker should review them** before you rely on them. In the meantime the **✦ Ask a question** chat is there to double-check things: ask Claude whether a word, a sentence or a tone is right (it is told to say when it isn't sure). The same note is in Settings.

## Tone marks and underdots

The language needs diacritics (dotted letters and tone marks). The app:

- normalises all text to Unicode NFC, so a letter typed as several combining characters equals the precomposed one;
- tokenises by letters plus combining marks, so marked letters never split a word;
- falls back to marks-stripped matching in the dictionary (typing without marks still finds the word);
- counts a typed answer with missing marks or dots as **almost**, not wrong;
- shows a row of special characters above the on-screen keyboard (positioned with `visualViewport`) that inserts at the cursor in any text field;
- uses the system font for text in the language by default (the bundled display font has no glyphs for these letters); Settings can switch reading text to a serif.

🔊 buttons appear only if the phone has a speech voice for the language.

## Run locally

```sh
cd web && python3 -m http.server 8000   # http://localhost:8000
node --test tests/*.test.mjs             # tests
```

## Deploy

Push to `main` on GitHub. The workflow in `.github/workflows/pages.yml` runs the tests and publishes `web/`. Enable it once under the repo's Settings → Pages → Source: **GitHub Actions**. Then open the Pages URL on your phone and choose Share → **Add to Home Screen**.

## Storage and other apps

This app can share a GitHub Pages origin with other apps, so it keeps to its own names: IndexedDB `homeward`, every localStorage key prefixed `hw_`, and service-worker caches named `hw-v<N>` (only `hw-` caches are ever deleted by this app).

## Layout

```
web/
  index.html, app.css, sw.js, manifest.webmanifest
  js/course.js      Basics units (words + sentences) and the built-in dialogues
  js/basics.js      adding course items/units to the reviews, per-unit progress
  js/nlp.js         NFC, tokeniser, offline dictionary built from the course
  js/answers.js     typed-answer checking (marks → "almost")
  js/chars.js       the special-characters row above the keyboard
  js/speech.js      text-to-speech, only with a voice for the language
  js/db.js          SQLite schema, persistence, backup/restore
  js/srs.js         FSRS scheduling (ts-fsrs) + review queue
  js/claude.js      Claude API calls, model choice, cost meter
  js/correction.js  Claude corrections → errors → mistake cards
  js/content.js     texts, word lookups/saving, daily prompt
  js/talk.js, story.js, translate.js, lessons.js, progress.js, screentime.js
  js/views/         screens
  vendor/           sql.js, ts-fsrs
tests/              node --test
```

## Credits

[sql.js](https://github.com/sql-js/sql.js) (MIT), [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT), Instrument Serif (OFL).
