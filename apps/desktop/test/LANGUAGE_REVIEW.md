# Test source language

The imported test tree was reviewed for English identifiers, test descriptions,
comments, diagnostics, and fixture prose. Hosted-only cases were retired; local
behavior and provider invariants were retained. Compiler checks, focused suites,
and the aggregate test command verify the resulting contracts.

Non-English input remains only where it represents localization, Unicode behavior,
multilingual request detection, or historical transcripts. Examples include the
Portuguese locale expectations, accented command-name normalization, UTF-8 byte
limits, and legacy Portuguese conversation role markers. These are test data;
explanatory prose and assertions use English.

See [the language policy](../../../docs/language-policy.md) for the maintained source
rules and intentional multilingual cases.
