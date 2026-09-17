import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { KnowledgeDocument } from "./types"
import { embedMany, generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import pLimit from "p-limit";
import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "node:crypto";



// eventually, run me once daily

const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 3072);
const CHUNKING_MODEL = "gpt-4.1-nano";
const KNOWLEDGE_BASE_PATH = "./knowledge-base";
const AVERAGE_CHUNK_SIZE = 100;
const CHUNKING_CONCURRENCY = 10;
// const VECTOR_DB_NAME = process.env.VECTOR_DB_NAME;
const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME;
// todo: change default to local dev server
const QDRANT_URL = process.env.QDRANT_URL ?? "http://192.168.1.131:6333"

const qdrant = new QdrantClient({ url: QDRANT_URL });

const createContentHash = (content: string): string => {
  return createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

// Qdrant point IDs must be an unsigned integer or a UUID, so deterministically
// derive a UUID (v4 format) from an arbitrary identifying string.
const toDeterministicUuid = (input: string): string => {
  const hex = createContentHash(input).slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

// TODO, stream? or maybe we process in batches for large datasets
const getAllDocuments = (path: string): KnowledgeDocument[] => {
    const documents: KnowledgeDocument[] = []

    for (const entry of readdirSync(path, { withFileTypes: true })) {
        const entryPath = join(path, entry.name)

        if (entry.isDirectory()) {
            documents.push(...getAllDocuments(entryPath))
        } else {
            documents.push({
                type: basename(path),
                source: entryPath,
                text: readFileSync(entryPath, "utf-8"),
            })
        }
    }

    return documents
}

interface Chunk {
  headline: string;
  summary: string;
  originalText: string;
}

// 
interface Result {
  pageContent: string;
  metadata: { source: string; type: string, contentHash: string; };
}

const createChunksFromDocument = async (document: KnowledgeDocument): Promise<Result[]> => {
    const numChunks = Math.trunc(document.text.length / AVERAGE_CHUNK_SIZE) + 1;

    const chatTemplate = `
        You take a document and you split the document into overlapping chunks for a KnowledgeBase.

        The document is from the shared drive of a company called Insurellm.
        The document is of type: ${document["type"]}
        The document has been retrieved from: ${document["source"]}

        A chatbot will use these chunks to answer questions about the company.
        You should divide up the document as you see fit, being sure that the entire document is returned across the chunks - don't leave anything out.
        This document should probably be split into at least ${numChunks} chunks, but you can have more or less as appropriate, ensuring that there are individual chunks to answer specific questions.
        There should be overlap between the chunks as appropriate; typically about 25% overlap or about 50 words, so you have the same text in multiple chunks for best retrieval results.

        For each chunk, you should provide a headline, a summary, and the original text of the chunk.
        Together your chunks should represent the entire document with overlap.

        Here is the document:

        ${document["text"]}

        Respond with the chunks.
    `;

    function chunkToResult(chunk: Chunk): Result {
        return {
            pageContent: `${chunk.headline}\n\n${chunk.summary}\n\n${chunk.originalText}`,
            metadata: { source: document.source, type: document.type, contentHash: createContentHash(chunk.originalText) },
        };
    }

    // call embedd model
    const { output } = await generateText({
        model: openai(CHUNKING_MODEL),
        output: Output.object({
            schema: z.object({
                chunks: z.array(z.object({
                    headline: z.string(),
                    summary: z.string(),
                    originalText: z.string()
                }))
            })
        }),
        prompt: chatTemplate,
    });

    return output.chunks.map(chunk => chunkToResult(chunk));
}


const convertDocumentsToChunks = async (documents: KnowledgeDocument[]): Promise<Result[]> => {
    // limit 5 calls at a time
    const limit = pLimit(CHUNKING_CONCURRENCY);
    const results = await Promise.allSettled(documents.map(doc => limit(() => createChunksFromDocument(doc))));

    const chunks: Result[] = [];

    for (const result of results) {
        if (result.status === "fulfilled") {
            chunks.push(...result.value);
        } else {
            console.warn(`failed to chunk document: ${result.reason}`);
        }
    }

    return chunks;
}

const createEmbeddings = async (chunks: Result[]) => {
    // const now = new Date();
    if(!QDRANT_COLLECTION_NAME) {
        throw new Error("Please set QDRANT_COLLECTION_NAME")
    }

    const qDrantCollection = await qdrant.getCollection(QDRANT_COLLECTION_NAME)

    if(!qDrantCollection) {
        throw new Error('Please setup qdrant collection. qdrant collection not found')
    }
    // handle chroma db... let's delete for dev, and not when node is in production
    // create a list of pageContent
    const values = chunks.map(el => el.pageContent);

    const { embeddings } = await embedMany({
        model: openai.embedding(EMBEDDING_MODEL),
        values,
        providerOptions: {
            openai: {
                dimensions: EMBEDDING_DIMENSIONS,
            },
        },
    });

    const ids = chunks.map((chunk, i) => toDeterministicUuid(`${chunk.metadata.source}${i}${chunk.metadata.contentHash}`));
    const metadatas = chunks.map(chunk => chunk.metadata);

    const points = chunks.map((_, i) => ({
        id: ids[i],
        vector: embeddings[i],
        payload: {
            document: values[i],
            ...metadatas[i], // source and type
        },
    }));

    await qdrant.upsert(QDRANT_COLLECTION_NAME, {
        wait: true,
        points,
    });

    console.log(`upserted ${points.length} points into collection "${QDRANT_COLLECTION_NAME}":`, points.map(p => p.id));

    return embeddings;
}

const injest = async (): Promise<void> => {
    const documents = getAllDocuments(KNOWLEDGE_BASE_PATH);
    console.log(`loaded ${documents.length} documents`)
    const chunks = await convertDocumentsToChunks(documents);
    console.log(`loaded ${chunks.length} chunks`);
    console.log('yum sample!', chunks[0]);
    console.log('creating embeddings...');
    const embeddings = await createEmbeddings(chunks);
    console.log('embed[0]: ', embeddings[0]);

    const stats = await qdrant.getCollection(QDRANT_COLLECTION_NAME!);
    console.log('\ncollection stats: ', stats);
    console.log('\nDocument Injest Complete\n');
}

await injest();