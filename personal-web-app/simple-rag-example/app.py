import html
import os
from urllib.parse import quote

import gradio as gr

from answer import answer_question


def chat(question: str, history: list[dict]) -> str:
    response, _docs = answer_question(question, history)
    return response


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


with gr.Blocks(title="Insurellm Assistant") as demo:
    with gr.Tab("Chat"):
        gr.ChatInterface(chat)
    with gr.Tab("Knowledge Base Explorer"):
        gr.HTML(build_tree_html())


if __name__ == "__main__":
    demo.launch()
