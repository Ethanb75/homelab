import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { KnowledgeDocument } from "./types"
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import pLimit from "p-limit";

const EMBEDDING_MODEL = "text-embedding-3-large";
const CHUNKING_MODEL = "gpt-4.1-nano";
const KNOWLEDGE_BASE_PATH = "./knowledge-base";
const AVERAGE_CHUNK_SIZE = 100;
const CHUNKING_CONCURRENCY = 10;
const CHROMA_COLLECTION = "docs";
const PROCESSED_DOC_VECTOR_DB_LOCATION = "./processed_db"

// eventually, run me once daily

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

interface Result {
  pageContent: string;
  metadata: { source: string; type: string };
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
            metadata: { source: document.source, type: document.type },
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

const createEmbeddings = async(chunks: Result[]) => {
    // handle chroma db... let's delete for dev, and not when node is in production
    // create a list of pageContent
    // calls embedding model with list
    // collection should already be made... get it
    // pushes list of vectors into the collection name (look into separate collections)
    // log collection count
    // answer node service will call the chromadb
}

const injest = async (): Promise<void> => {
    const documents = getAllDocuments(KNOWLEDGE_BASE_PATH);
    console.log(`loaded ${documents.length} documents`)
    const chunks = await convertDocumentsToChunks(documents);
    console.log(`loaded ${chunks.length} chunks`);
    // create embeddings
}

await injest();