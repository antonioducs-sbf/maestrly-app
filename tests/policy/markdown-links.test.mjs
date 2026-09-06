import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { checkMarkdownLinks } from '../../scripts/check-markdown-links.mjs'

const temporary = []

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'maestrly-markdown-links-'))
  temporary.push(root)
  return root
}

afterEach(() => {
  while (temporary.length > 0) rmSync(temporary.pop(), { recursive: true, force: true })
})

test('accepts local files, fragments, images, angle paths, and external targets', () => {
  const root = fixture()
  mkdirSync(path.join(root, 'folder'))
  writeFileSync(path.join(root, 'guide.md'), '# Intro\n')
  writeFileSync(path.join(root, 'image.png'), '')
  writeFileSync(path.join(root, 'folder', 'with space.md'), '# Space\n')
  writeFileSync(
    path.join(root, 'README.md'),
    [
      '[Guide](guide.md)',
      '[Section](guide.md#intro)',
      '![Preview](image.png)',
      '[Space](<folder/with space.md>)',
      '[Web](https://example.com/missing)',
      '[Email](mailto:maintainer@example.com)',
      '[Heading](#local-heading)',
    ].join('\n')
  )

  assert.deepEqual(checkMarkdownLinks(root, ['README.md']), [])
})

test('reports the source and target for a missing local file', () => {
  const root = fixture()
  writeFileSync(path.join(root, 'README.md'), '[Missing](docs/missing.md)\n')

  const failures = checkMarkdownLinks(root, ['README.md'])

  assert.equal(failures.length, 1)
  assert.match(failures[0], /README\.md/)
  assert.match(failures[0], /docs\/missing\.md/)
})

test('ignores Markdown-looking links inside fenced code blocks', () => {
  const root = fixture()
  writeFileSync(
    path.join(root, 'README.md'),
    ['```md', '[Example](not-a-real-file.md)', '```', '~~~md', '[Other](also-not-real.md)', '~~~'].join('\n')
  )

  assert.deepEqual(checkMarkdownLinks(root, ['README.md']), [])
})
