import os
import glob
import html
from urllib.parse import quote
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
# - setup api and expose it in various ways (ollama)
# - setup tests
# - setup scale test... containers for users that simply ping random endpoints?
# eventually it whips up a new docker container for each user and then kills it after a certain amount of time. maybe some kind of queue system to limit the number of containers running at once. maybe some kind of live logging
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


# --- File Explorer ---

ICON_MAP = {
    ".md": "&#128196;",   # page
    ".py": "&#128013;",   # snake
    ".json": "&#128230;", # package
    ".txt": "&#128221;",  # memo
    ".yaml": "&#9881;",   # gear
    ".yml": "&#9881;",
}
FOLDER_ICON = "&#128193;"
DEFAULT_FILE_ICON = "&#128196;"

KB_ROOT = os.path.join(os.path.dirname(__file__) or ".", "sample-knowledge-base")


def build_tree_html():
    lines = []
    lines.append("""
    <style>
        .kb-tree {
            font-family: 'Courier New', monospace;
            background: #0d1117;
            color: #c9d1d9;
            padding: 20px 24px;
            border-radius: 8px;
            border: 1px solid #30363d;
            line-height: 1.7;
            font-size: 14px;
        }
        .kb-tree .folder {
            color: #58a6ff;
            font-weight: bold;
        }
        .kb-tree .file {
            color: #8b949e;
        }
        .kb-tree a.file-link {
            color: #8b949e;
            text-decoration: none;
            cursor: pointer;
        }
        .kb-tree a.file-link:hover {
            color: #58a6ff;
            text-decoration: underline;
        }
        .kb-tree .ext {
            color: #7ee787;
            font-size: 11px;
            opacity: 0.7;
        }
        .kb-tree .size {
            color: #484f58;
            font-size: 11px;
            margin-left: 6px;
        }
        .kb-tree .branch {
            color: #30363d;
        }
        .kb-tree .root-label {
            color: #f0883e;
            font-weight: bold;
            font-size: 15px;
        }
        .kb-tree .stat-bar {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid #21262d;
            color: #484f58;
            font-size: 12px;
        }
        .kb-tree .stat-bar span {
            margin-right: 18px;
        }
        .kb-tree .stat-bar .num {
            color: #58a6ff;
            font-weight: bold;
        }
    </style>
    """)
    lines.append('<div class="kb-tree">')
    lines.append(f'<div class="root-label">{FOLDER_ICON} sample-knowledge-base/</div>')

    total_files = 0
    total_dirs = 0

    for root, dirs, files in sorted(os.walk(KB_ROOT)):
        dirs.sort()
        files.sort()
        depth = root.replace(KB_ROOT, "").count(os.sep)
        rel = os.path.relpath(root, KB_ROOT)

        if rel != ".":
            total_dirs += 1
            indent = "&nbsp;" * 4 * depth
            connector = '<span class="branch">&#9500;&#9472;&#9472;</span> ' if depth == 1 else '<span class="branch">&#9474;&nbsp;&nbsp;&nbsp;&#9500;&#9472;&#9472;</span> '
            dirname = os.path.basename(root)
            lines.append(f'<div>{indent}{connector}<span class="folder">{FOLDER_ICON} {dirname}/</span></div>')

        for i, fname in enumerate(files):
            total_files += 1
            ext = os.path.splitext(fname)[1].lower()
            icon = ICON_MAP.get(ext, DEFAULT_FILE_ICON)
            fpath = os.path.join(root, fname)
            size_bytes = os.path.getsize(fpath)
            if size_bytes < 1024:
                size_str = f"{size_bytes} B"
            else:
                size_str = f"{size_bytes / 1024:.1f} KB"

            file_depth = depth + 1
            indent = "&nbsp;" * 4 * file_depth
            is_last = (i == len(files) - 1)
            branch = '<span class="branch">&#9492;&#9472;&#9472;</span> ' if is_last else '<span class="branch">&#9500;&#9472;&#9472;</span> '
            ext_label = f' <span class="ext">[{ext}]</span>' if ext else ""
            rel_path = os.path.relpath(fpath, KB_ROOT)
            if ext == ".md":
                href = f"http://localhost:3000/simple-rag-example/sample-knowledge-base/{quote(rel_path)}"
                file_span = f'<a class="file-link" href="{href}" target="_blank">{icon} {html.escape(fname)}</a>'
            else:
                file_span = f'<span class="file">{icon} {html.escape(fname)}</span>'
            lines.append(f'<div>{indent}{branch}{file_span}{ext_label}<span class="size">{size_str}</span></div>')

    lines.append(f'<div class="stat-bar">'
                 f'<span><span class="num">{total_dirs}</span> directories</span>'
                 f'<span><span class="num">{total_files}</span> files</span>'
                 f'</div>')
    lines.append('</div>')
    return "\n".join(lines)


with gr.Blocks(title="Insurellm Knowledge Base") as view:
    with gr.Tab("Chat"):
        gr.ChatInterface(chat)
    with gr.Tab("Knowledge Base Explorer"):
        gr.HTML(build_tree_html())

view.launch(inbrowser=True)