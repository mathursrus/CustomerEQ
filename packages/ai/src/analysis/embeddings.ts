import OpenAI from 'openai'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536

/**
 * Generate a vector embedding for the given text using OpenAI's embedding API.
 * Returns a 1536-dimensional float array suitable for pgvector storage.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = new OpenAI() // uses OPENAI_API_KEY env var
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  })
  return response.data[0].embedding
}
