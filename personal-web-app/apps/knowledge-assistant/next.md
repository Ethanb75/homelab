// http://192.168.1.131:6333/
/*
Create one collection for your knowledge chunks

I'd name it something explicit like:

personal_knowledge

Each Qdrant point is effectively:

{
  id: "...",
  vector: [...],
  payload: {
    text: "...",
    source: "...",
    type: "...",
    headline: "...",
    summary: "...",
    ...
  }
}

Qdrant calls the metadata attached to vectors a payload, and it can later be filtered during searches.

I'd expand your current chunk metadata slightly:

interface ChunkPayload {
  pageContent: string;

  source: string;
  type: string;

  headline: string;
  summary: string;
  originalText: string;

  documentId: string;
  chunkIndex: number;
  contentHash: string;

  embeddingModel: string;
  ingestedAt: string;
}

documentId and contentHash will become surprisingly useful once you start re-ingesting changed documents.

Lock down your embedding configuration

This is important because a Qdrant collection has a fixed vector dimension.

You're currently using:

const EMBEDDING_MODEL = "text-embedding-3-large";

text-embedding-3-large supports configurable output dimensions through the embeddings API.

I would make both the model and dimensions explicit:

EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

QDRANT_URL=http://192.168.1.xxx:6333
QDRANT_COLLECTION=personal_knowledge

You could deliberately choose fewer dimensions later to reduce storage/memory, but don't casually change it after ingestion. If you change embedding model or vector size, create/rebuild the collection.
*/