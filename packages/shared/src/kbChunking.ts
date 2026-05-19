import { encode, decode } from 'gpt-tokenizer'

export interface ChunkOptions {
  targetTokens: number
  overlapTokens: number
}

export interface ArticleChunk {
  chunkIndex: number
  content: string
  tokenCount: number
}

export function chunkArticleBody(body: string, opts: ChunkOptions): ArticleChunk[] {
  if (!body.trim()) throw new Error('Cannot chunk empty body')
  if (opts.overlapTokens >= opts.targetTokens) {
    throw new Error(`overlapTokens (${opts.overlapTokens}) must be < targetTokens (${opts.targetTokens})`)
  }
  const tokens = encode(body)
  if (tokens.length <= opts.targetTokens) {
    return [{ chunkIndex: 0, content: body, tokenCount: tokens.length }]
  }
  const out: ArticleChunk[] = []
  const stride = opts.targetTokens - opts.overlapTokens
  let start = 0
  let index = 0
  while (start < tokens.length) {
    const end = Math.min(start + opts.targetTokens, tokens.length)
    const slice = tokens.slice(start, end)
    out.push({ chunkIndex: index++, content: decode(slice), tokenCount: slice.length })
    if (end >= tokens.length) break
    start += stride
  }
  return out
}
