export type KnowledgeDocument = {
    type: string;
    source: string;
};

export type DocumentChunk = {
    headline: string;
    summary: string;
    originalText: string;
};

export type ChunkResult = {
    pageContent: string;
    metadata: {
        source: string;
        type: string;
        contentHash: string;
    };
};
