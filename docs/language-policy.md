# Source language

Identifiers, comments, documentation, diagnostics, model instructions, and test
names use English. User-facing text uses the shared translation catalogs. English
is the source language; Brazilian Portuguese remains a supported interface locale.

The following non-English data is intentional:

- `src/shared/i18n/pt-BR/` contains translated interface and agent-facing text.
- `src/shared/locale.ts` displays the native language name in the locale picker.
- Transcript importers recognize historical Portuguese bootstrap and role markers.
  Changing these matchers would break imports of existing user-authored transcripts.
- Multilingual request classification recognizes the language of user input.
- Tests of localization, Unicode normalization, and byte limits retain representative
  non-English input. Their surrounding comments and assertions explain the purpose
  in English.

Never translate user content, rewrite saved notes, or rename persisted user data
as part of a source-language cleanup. Review prose as well as accented characters:
Portuguese words without accents are still Portuguese. A regex scan is a useful
review aid, not proof that every comment and string has been reviewed.
