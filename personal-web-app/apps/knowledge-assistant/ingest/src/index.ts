import "dotenv/config";
import { discoverDocuments, createContentHash, loadDocument } from "./documents";
import { convertDocumentsToChunks } from "./chunk";
import { createEmbeddings } from "./embeddings";
import { ensureCollectionExists, upsertChunks, getCollectionStats } from "./qdrant";

const KNOWLEDGE_BASE_PATH = process.env.KNOWLEDGE_BASE_PATH ?? "../../../knowledge-base";

const ingestOLD = async (): Promise<void> => {
    const documents = discoverDocuments(KNOWLEDGE_BASE_PATH);
    console.log(`loaded ${documents.length} documents`);

    const chunks = await convertDocumentsToChunks(documents);
    console.log(`loaded ${chunks.length} chunks`);
    console.log("yum sample!", chunks[0]);

    await ensureCollectionExists();

    console.log("creating embeddings...");
    const embeddings = await createEmbeddings(chunks.map(chunk => chunk.pageContent));
    console.log("embed[0]: ", embeddings[0]);

    await upsertChunks(chunks, embeddings);

    const stats = await getCollectionStats();
    console.log("\ncollection stats: ", stats);
    console.log("\nDocument ingest complete\n");
};

// await ingest();

const ingest = async (): Promise<void> => {
    const create = [];
    const update = [];

    //important!
    // const { EMBEDDING_DIMENSIONS, QDRANT_URL, QDRANT_COLLECTION_NAME } = process.env;

    // if(!EMBEDDING_DIMENSIONS || !QDRANT_COLLECTION_NAME || !QDRANT_URL) {
    //     throw new Error("Please set EMBEDDING_DIMENSIONS, QDRANT_URL, QDRANT_COLLECTION_NAME")
    // }
    const documents = discoverDocuments(KNOWLEDGE_BASE_PATH);
    // console.log('documents', documents);
    // console.log(`loaded ${documents.length} documents`);

    const test = [];

    for(const doc of documents) {
        // console.log('doc', doc)
        const docLoaded = loadDocument(doc.source);
        const docHash = createContentHash(docLoaded);
        test.push({
            docLoaded,
            docHash
        })
    }

    console.log('docs: ', test[0]);
    
    // start with no concurrency at first
    // health check first, make sure knowledge base exists, env vars are set, etc.
    // find all documents, don't load them all in mem
    // get content hash
    // compare content hash against state? vector db?
    // if change, push to vectordb and embed, push meta to update list
    // if new, push to vectordb and embed, push meta to new list
    // compare lists against state, remove orphan items
}

await ingest();


// async function main() {
//   const files = await discoverDocuments();

//   for (const file of files) {
//     await ingestDocument(file);
//   }

//   await removeDeletedDocuments(files);
// }

// await main();