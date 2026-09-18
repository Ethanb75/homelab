import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "node:crypto";
import { ChunkResult } from "./types";

const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME;
const QDRANT_URL = process.env.QDRANT_URL;

export const qdrant = new QdrantClient({ url: QDRANT_URL });

// Qdrant point IDs must be an unsigned integer or a UUID, so deterministically
// derive a UUID (v4 format) from an arbitrary identifying string.
const toDeterministicUuid = (input: string): string => {
    const hex = createHash("sha256").update(input, "utf8").digest("hex").slice(0, 32).split("");
    hex[12] = "4";
    hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
    const s = hex.join("");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
};

const requireCollectionName = (): string => {
    if (!QDRANT_COLLECTION_NAME) {
        throw new Error("Please set QDRANT_COLLECTION_NAME");
    }
    return QDRANT_COLLECTION_NAME;
};

export const ensureCollectionExists = async (): Promise<string> => {
    const collectionName = requireCollectionName();
    const collection = await qdrant.getCollection(collectionName);

    if (!collection) {
        throw new Error("Please setup qdrant collection. qdrant collection not found");
    }

    return collectionName;
};

export const upsertChunks = async (chunks: ChunkResult[], embeddings: number[][]): Promise<void> => {
    const collectionName = await ensureCollectionExists();

    const points = chunks.map((chunk, i) => ({
        id: toDeterministicUuid(`${chunk.metadata.source}${i}${chunk.metadata.contentHash}`),
        vector: embeddings[i],
        payload: {
            document: chunk.pageContent,
            ...chunk.metadata,
        },
    }));

    await qdrant.upsert(collectionName, {
        wait: true,
        points,
    });

    console.log(`upserted ${points.length} points into collection "${collectionName}":`, points.map(p => p.id));
};

export const getCollectionStats = async () => {
    const collectionName = requireCollectionName();
    return qdrant.getCollection(collectionName);
};
