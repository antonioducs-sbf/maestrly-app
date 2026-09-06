#!/usr/bin/env node

import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'

function parseArgs(argv) {
  const args = { count: 5000 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--list') args.list = true
    else if (a === '--db') args.db = argv[++i]
    else if (a === '--conv') args.conv = argv[++i]
    else if (a === '--count') args.count = Math.max(1, parseInt(argv[++i], 10) || 5000)
  }
  return args
}

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const CODE_BLOCK =
  '```ts\n' +
  'export function fib(n: number): number {\n' +
  '  let [a, b] = [0, 1]\n' +
  '  for (let i = 0; i < n; i++) [a, b] = [b, a + b]\n' +
  '  return a\n' +
  '}\n' +
  '```'

function longMarkdown(i) {
  return (
    `## Resposta ${i}\n\n` +
    `This is a **long** explanation with Markdown elements to stress parsing and highlighting.\n\n` +
    `- item one for topic ${i}\n- item two with \`inline code\`\n- item three\n\n` +
    `Here is a code block:\n\n${CODE_BLOCK}\n\n` +
    `| coluna A | coluna B |\n| --- | --- |\n| ${i} | ${i * 2} |\n| x | y |\n\n` +
    `> Quotation in turn ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod ` +
    `tempor incididunt ut labore et dolore magna aliqua.\n`
  )
}

function buildMessage(conversationId, i, seq) {
  const id = randomUUID()
  const base = { id, conversation_id: conversationId, seq, created_at: Date.now() + seq }
  const mod = i % 6
  if (i % 2 === 0) {
    const parts =
      i % 12 === 0
        ? [
            { type: 'text', id: randomUUID(), text: `Question ${i} with an attached image.` },
            {
              type: 'file',
              id: randomUUID(),
              name: `img-${i}.png`,
              mediaType: 'image/png',
              kind: 'image',
              data: TINY_PNG,
            },
          ]
        : [{ type: 'text', id: randomUUID(), text: `Short question number ${i}?` }]
    return { ...base, role: 'user', parts_json: JSON.stringify(parts), meta_json: null }
  }

  const parts = [{ type: 'text', id: randomUUID(), text: longMarkdown(i) }]
  if (mod === 1) {
    parts.push({
      type: 'tool',
      id: randomUUID(),
      toolCallId: randomUUID(),
      toolName: 'read',
      input: { path: `src/file-${i}.ts` },
      state: { status: 'completed', output: `file contents ${i}\n`.repeat(8) },
    })
    parts.push({ type: 'text', id: randomUUID(), text: `Done, I read file ${i}.` })
  }
  const meta = {
    model: { providerId: 'seed', modelId: i % 60 === 1 ? 'seed-model-b' : 'seed-model-a' },
    finishReason: 'stop',
    usage: { input: 1000 + i, output: 200 + (i % 50), contextInput: 1500 + i },
  }
  return { ...base, role: 'assistant', parts_json: JSON.stringify(parts), meta_json: JSON.stringify(meta) }
}

function main() {
  const args = parseArgs(process.argv)
  if (!args.db) {
    console.error('ERROR: specify the database with --db "<path>/maestrly-agents.db". Use --list to list chats.')
    process.exit(1)
  }
  const db = new DatabaseSync(args.db)
  db.exec('PRAGMA foreign_keys = ON;')

  if (args.list) {
    const rows = db
      .prepare(
        `SELECT c.id, c.name, COUNT(m.id) AS n
         FROM conversations c LEFT JOIN chat_messages m ON m.conversation_id = c.id
         WHERE c.cli = 'chat' GROUP BY c.id ORDER BY n DESC`
      )
      .all()
    if (rows.length === 0) {
      console.log('No conversation with cli="chat". Create one in the app and run again.')
    } else {
      console.log('Chat conversations (id — name — message count):')
      for (const r of rows) console.log(`  ${r.id}  —  ${r.name}  —  ${r.n} msgs`)
    }
    db.close()
    return
  }

  if (!args.conv) {
    console.error('ERROR: specify a conversation with --conv <conversationId> (use --list to find it).')
    process.exit(1)
  }
  const conv = db.prepare('SELECT id, cli FROM conversations WHERE id = ?').get(args.conv)
  if (!conv) {
    console.error(`ERROR: conversation ${args.conv} does not exist in this database.`)
    process.exit(1)
  }
  if (conv.cli !== 'chat') {
    console.error(
      `ERROR: conversation ${args.conv} does not belong to Maestrly Chat (cli="${conv.cli}"). Aborting to preserve other CLI data.`
    )
    process.exit(1)
  }

  const startSeq = db
    .prepare('SELECT COALESCE(MAX(seq), -1) + 1 AS n FROM chat_messages WHERE conversation_id = ?')
    .get(args.conv).n
  const insert = db.prepare(
    `INSERT INTO chat_messages (id, conversation_id, role, parts_json, meta_json, seq, created_at)
     VALUES (@id, @conversation_id, @role, @parts_json, @meta_json, @seq, @created_at)`
  )
  const tx = db.prepare('BEGIN')
  tx.run()
  for (let i = 0; i < args.count; i++) {
    insert.run(buildMessage(args.conv, i, startSeq + i))
  }
  db.prepare('COMMIT').run()
  const total = db.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE conversation_id = ?').get(args.conv).n
  console.log(
    `OK: inserted ${args.count} messages into conversation ${args.conv} (seq ${startSeq}..${startSeq + args.count - 1}).`
  )
  console.log(`New total: ${total} messages. Open the conversation in the app to measure rendering.`)
  db.close()
}

main()
