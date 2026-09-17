import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { answerQuestion } from "./answer";

const rl = readline.createInterface({ input: stdin, output: stdout });

const main = async () => {
    const history: { role: string; content: string }[] = [];

    console.log("Knowledge Assistant CLI. Type 'exit' to quit.\n");

    while (true) {
        const question = await rl.question("You: ");

        if (question.trim().toLowerCase() === "exit") {
            break;
        }

        const { answer } = await answerQuestion(question, history);
        console.log(`\nAssistant: ${answer}\n`);

        history.push({ role: "user", content: question });
        history.push({ role: "assistant", content: answer });
    }

    rl.close();
};

main();
