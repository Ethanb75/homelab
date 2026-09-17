import "dotenv/config";
import { generateText, Output, embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { z } from "zod";

const FINAL_K = 10;
const RETRIEVAL_K = 20;
const QUESTION_REWRITE_MODEL = "gpt-4.1-nano";
const RERANK_MODEL = "gpt-4.1-nano";
const ANSWER_MODEL = "gpt-4.1-nano";
// below needs to be an env variable. 
const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 3072);
const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME;
const QDRANT_URL = process.env.QDRANT_URL ?? "http://192.168.1.131:6333";

const qdrant = new QdrantClient({ url: QDRANT_URL });

interface Chunk {
    pageContent: string;
    metadata: { source: string; type: string; contentHash: string };
}

const makeRAGMessage = (question: string, history: any[], chunks: Chunk[]) => {
    // FIX ME - move me up, to top env vars
    const SYSTEM_PROMPT = `
        You are a knowledgeable, friendly assistant representing the company Insurellm.
        You are chatting with a user about Insurellm.
        Your answer will be evaluated for accuracy, relevance and completeness, so make sure it only answers the question and fully answers it.
        If you don't know the answer, say so.
        For context, here are specific extracts from the Knowledge Base that might be directly relevant to the user's question:
        {context}

        With this context, please answer the user's question. Be accurate, relevant and complete.
    `;

    const context = chunks
        .map(chunk => `Extract from ${chunk.metadata.source}:\n${chunk.pageContent}`)
        .join("\n\n");
    const systemPrompt = SYSTEM_PROMPT.replace("{context}", context);

    return {
        system: systemPrompt,
        messages: [
            ...history,
            { role: "user", content: question },
        ],
    };
}

const fetchUnrankedChunks = async (question: string): Promise<Chunk[]> => {
    if (!QDRANT_COLLECTION_NAME) {
        throw new Error("Please set QDRANT_COLLECTION_NAME");
    }

    const { embedding } = await embed({
        model: openai.embedding(EMBEDDING_MODEL),
        value: question,
        providerOptions: {
            openai: {
                dimensions: EMBEDDING_DIMENSIONS,
            },
        },
    });

    const results = await qdrant.query(QDRANT_COLLECTION_NAME, {
        query: embedding,
        limit: RETRIEVAL_K,
        with_payload: true,
    });

    return results.points.map(point => {
        const payload = point.payload as { document: string; source: string; type: string; contentHash: string };
        return {
            pageContent: payload.document,
            metadata: { source: payload.source, type: payload.type, contentHash: payload.contentHash },
        };
    });
}

const rewriteQuery = async (question: string, history: any): Promise<string> => {
    const rewritePrompt = `
        You are in a conversation with a user.
        You are about to look up information in a Knowledge Base to answer the user's question.

        This is the history of your conversation so far with the user:
        ${history}

        And this is the user's current question:
        ${question}

        Since the conversation is contextual, understand the meaning of the user question and add details based on the history.
        Condense everything in a single contextually-rich VERY short and specific question, most likely to surface content.

        EXAMPLE:
        user: Who is the founder? -> Query: who is the founder?
        assistant: The founder is FooBar
        user: What role covers? -> Query: What role FooBar covers?
        ...

        IMPORTANT: Respond ONLY with the precise knowledgebase query, nothing else.
    `;

    const { text } = await generateText({
        model: openai(QUESTION_REWRITE_MODEL),
        prompt: rewritePrompt,
    });

    return text;
}

const mergeChunks = (chunks: Chunk[], reranked: Chunk[]): Chunk[] => {
    const merged = [...chunks];
    const existing = chunks.map(chunk => chunk.pageContent);
    for (const chunk of reranked) {
        if (!existing.includes(chunk.pageContent)) {
            merged.push(chunk);
        }
    }
    return merged;
}

const RankOrderSchema = z.object({
    order: z.array(z.number()).describe(
        "The order of relevance of chunks, from most relevant to least relevant, by chunk id number"
    ),
});

const reRank = async (question: string, chunks: Chunk[]): Promise<Chunk[]> => {
    const systemPrompt = `
You are a document re-ranker.
You are provided with a question and a list of relevant chunks of text from a query of a knowledge base.
The chunks are provided in the order they were retrieved; this should be approximately ordered by relevance, but you may be able to improve on that.
You must rank order the provided chunks by relevance to the question, with the most relevant chunk first.
Reply only with the list of ranked chunk ids, nothing else. Include all the chunk ids you are provided with, reranked.
`;

    let userPrompt = `The user has asked the following question:\n\n${question}\n\nOrder all the chunks of text by relevance to the question, from most relevant to least relevant. Include all the chunk ids you are provided with, reranked.\n\n`;
    userPrompt += "Here are the chunks:\n\n";
    chunks.forEach((chunk, index) => {
        userPrompt += `# CHUNK ID: ${index + 1}:\n\n${chunk.pageContent}\n\n`;
    });
    userPrompt += "Reply only with the list of ranked chunk ids, nothing else.";

    const { output } = await generateText({
        model: openai(RERANK_MODEL),
        output: Output.object({ schema: RankOrderSchema }),
        system: systemPrompt,
        prompt: userPrompt,
    });

    return output.order.map((id: number) => chunks[id - 1]);
}

const fetchContext = async (question: string, history: any) => {
    const rewrittenQuestion = await rewriteQuery(question, history);
    console.log('question, re-written: ', rewrittenQuestion);
    const rewrittenFetchedChunks = await fetchUnrankedChunks(rewrittenQuestion);
    const originalQuestionFetchedChunks = await fetchUnrankedChunks(question);
    const chunks = mergeChunks(rewrittenFetchedChunks, originalQuestionFetchedChunks);
    console.log("chunks[0]: ", chunks[0]);
    const reRankedChunks = await reRank(question, chunks);

    return reRankedChunks.splice(0, FINAL_K);
}

export const answerQuestion = async (question: string, history: any) => {
    // fetch relevant context chunks
    const chunks = await fetchContext(question, history);
    // make RAG message
    const { system, messages } = makeRAGMessage(question, history, chunks);

    const { text } = await generateText({
        model: openai(ANSWER_MODEL),
        system,
        messages,
    });

    return { answer: text, chunks };
}