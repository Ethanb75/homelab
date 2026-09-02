import os
import glob
from dotenv import load_dotenv
from pathlib import Path
import gradio as gr
from openai import OpenAI

# todo
# - DONE - setup simple example
# - Docker container, setup docker composes
# - setup environment variables for Docker/simple
# - setup maybe a custom server for this route OR maybe some kind of middleware to track ips to prevent abuse
# - deploy it
# - setup api and expose it in various ways
# - setup tests
# - setup scale test... containers for users that simply ping random endpoints?
print("hello from simple.py")

load_dotenv(override=True)
openai_api_key = os.getenv('OPENAI_API_KEY')
if openai_api_key:
    print(f"OpenAI API Key exists and begins {openai_api_key[:8]}")
else:
    print("OpenAI API Key not set")

MODEL = "gpt-5.4-nano"
openai = OpenAI()

# Load knowledge base into memory (yuck!)
knowledge = {}

filenames = glob.glob("sample-knowledge-base/employees/*")

for filename in filenames:
    name = Path(filename).stem.split(' ')[-1]
    with open(filename, "r", encoding="utf-8") as f:
        knowledge[name.lower()] = f.read()


# print(knowledge)

SYSTEM_PREFIX = """
You represent Insurellm, the Insurance Tech company.
You are an expert in answering questions about Insurellm; its employees and its products.
You are provided with additional context that might be relevant to the user's question.
Give brief, accurate answers. If you don't know the answer, say so.

Relevant context:
"""

# very simple retreival. we just look for words in the message that match keys in the knowledge base
def get_relevant_context(message):
    text = ''.join(ch for ch in message if ch.isalpha() or ch.isspace())
    words = text.lower().split()
    return [knowledge[word] for word in words if word in knowledge]   

# append the additional context to the system message. if there's more than 1 topic found, append all relevant knowledge
def additional_context(message):
    relevant_context = get_relevant_context(message)
    if not relevant_context:
        result = "There is no additional context relevant to the user's question."
    else:
        result = "The following additional context might be relevant in answering the user's question:\n\n"
        result += "\n\n".join(relevant_context)
    return result

def chat(message, history):
    system_message = SYSTEM_PREFIX + additional_context(message)
    messages = [{"role": "system", "content": system_message}] + history + [{"role": "user", "content": message}]
    # print(f"Messages sent to the model: {messages}")
    response = openai.chat.completions.create(model=MODEL, messages=messages)
    return response.choices[0].message.content

view = gr.ChatInterface(chat).launch(inbrowser=True)