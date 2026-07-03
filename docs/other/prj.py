#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
project_packer.py — 项目打包 / 解包工具

用法:
  交互模式
    python project_packer.py

  命令行打包
    python project_packer.py pack ["项目描述"]

  命令行解包
    python project_packer.py unpack <txt文件路径>

  保留注释打包
    python project_packer.py pack --keep-comments ["项目描述"]

  包含二进制文件内容
    python project_packer.py pack --include-binary ["项目描述"]

  跳过指定后缀
    python project_packer.py pack --skip-ext .log .tmp .bak ["项目描述"]

  仅打包指定文件（其他文件仅在目录树中显示名字，代码部分用占位符替代）
    python project_packer.py pack "项目描述" --include-only main.py src/utils.py
    (建议将项目描述放在前面，或使用逗号分隔文件以避免歧义：--include-only main.py,src/utils.py)

  支持从文件读取需要打包的文件列表（一行一个路径，支持 # 注释）
    python project_packer.py pack "项目描述" --include-only @list.txt

  【新增】指定打包目录的绝对路径（不指定则默认当前工作目录）
    python project_packer.py pack "项目描述" --dir /Users/you/MyProject
    python project_packer.py pack "项目描述" -d /Users/you/MyProject

  【新增】生成相对路径列表文件用于 include-only
    python project_packer.py list [target_dir] [true|false] [previous_list.txt]

    target_dir: 要生成列表的项目目录，默认当前工作目录
    true|false: 是否初始全部注释。true 表示默认注释所有路径，false 表示默认保留所有路径。
    previous_list.txt: 之前的列表文件路径，出现过的路径保持原有注释状态。

  输出文件 prj.txt 和 prj_list.txt 始终生成在 prj.py 所在目录下。
"""
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
project_packer.py — 项目打包 / 解包工具
"""

import os
import sys
import re
import base64
from pathlib import Path

OUTPUT_FILENAME = "prj.txt"
LIST_FILENAME = "__prj_file_list__.txt"

EXCLUDE_DIRS = {
    ".git", ".svn", "node_modules", "__pycache__", ".idea", ".vscode",
    "dist", "build", ".next", ".cache", "venv", ".venv", "target", "out",
    "coverage", ".tox",
}
EXCLUDE_FILES = {".DS_Store", "Thumbs.db", "desktop.ini"}

TREE_MARKER = "===== 目录结构 ====="
CODE_MARKER = "===== 项目代码 ====="
FILE_SEP_L = "---=== "
FILE_SEP_R = " ===---"
FILE_HEADER_RE = re.compile(
    r"^" + re.escape(FILE_SEP_L) + r"(.+?)" + re.escape(FILE_SEP_R) + r"\s*$",
    re.MULTILINE,
)

TREE_CHARS_RE = re.compile(r'^[│├└─\s]+')

TEXT_EXTENSIONS = {
    ".html", ".htm", ".xhtml", ".css", ".scss", ".less", ".sass",
    ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
    ".py", ".pyw", ".rb", ".pl", ".pm", ".php",
    ".java", ".scala", ".kt",
    ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh", ".hxx",
    ".cs", ".go", ".rs", ".swift",
    ".json", ".json5", ".xml", ".xsl", ".xslt",
    ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".md", ".markdown", ".rst", ".txt", ".log",
    ".sh", ".bash", ".zsh", ".fish", ".bat", ".cmd", ".ps1",
    ".sql", ".vue", ".svelte",
    ".glsl", ".hlsl", ".wgsl", ".vert", ".frag",
    ".cmake", ".mk", ".csv", ".lua", ".dart",
}
TEXT_FILENAMES = {
    "Makefile", "Dockerfile", "Rakefile", "Gemfile", "Vagrantfile",
    "Jenkinsfile", ".gitignore", ".gitattributes", ".editorconfig",
    ".babelrc", ".eslintrc", ".prettierrc", ".npmrc", ".nvmrc",
    ".env", ".env.local", ".env.production", ".python-version",
    "README", "LICENSE", "COPYING", "AUTHORS",
}
BINARY_EXTENSIONS = {
    ".bin", ".dat", ".exe", ".dll", ".so", ".dylib", ".o", ".obj",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tiff",
    ".zip", ".tar", ".gz", ".bz2", ".xz", ".rar", ".7z",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp3", ".mp4", ".wav", ".ogg", ".flac", ".avi", ".mov", ".mkv",
    ".pyc", ".class", ".jar", ".war", ".wasm",
    ".sqlite", ".db", ".pkl", ".pickle", ".npy", ".npz", ".parquet",
}


class C:
    RST = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    ITAL = "\033[3m"
    RED = "\033[31m"
    GRN = "\033[32m"
    YEL = "\033[33m"
    BLU = "\033[34m"
    MAG = "\033[35m"
    CYN = "\033[36m"
    WHT = "\033[37m"
    B_RED = "\033[1;31m"
    B_GRN = "\033[1;32m"
    B_YEL = "\033[1;33m"
    B_BLU = "\033[1;34m"
    B_MAG = "\033[1;35m"
    B_CYN = "\033[1;36m"
    B_WHT = "\033[1;37m"

    @staticmethod
    def supports_color():
        if os.getenv("NO_COLOR"):
            return False
        if not hasattr(sys.stdout, "isatty"):
            return False
        if not sys.stdout.isatty():
            return False
        if os.getenv("TERM") == "dumb":
            return False
        return True

if not C.supports_color():
    for attr in dir(C):
        if attr.startswith("_"):
            continue
        val = getattr(C, attr)
        if isinstance(val, str) and val.startswith("\033["):
            setattr(C, attr, "")


def s_ok(msg):   return f"{C.B_GRN}+{C.RST} {msg}"
def s_fail(msg): return f"{C.B_RED}x{C.RST} {C.B_RED}{msg}{C.RST}"
def s_warn(msg): return f"{C.B_YEL}!{C.RST} {C.YEL}{msg}{C.RST}"
def s_info(msg): return f"{C.B_BLU}>{C.RST} {msg}"
def s_tip(msg):  return f"{C.B_CYN}*{C.RST} {C.CYN}{msg}{C.RST}"
def s_skip(msg): return f"{C.DIM}>{C.RST} {C.DIM}{msg}{C.RST}"

CAT_ART = [" /\_/\\", " ( -.- )", " > ^ <"]

def banner(title, width=56):
    cat = CAT_ART
    inner_w = width - len(cat[1]) * 2 - 2
    raw_title = f" {title} "
    dash_total = max(0, inner_w - len(raw_title))
    left_d = dash_total // 2
    right_d = dash_total - left_d
    lines = []
    gap0 = width - len(cat[0]) * 2
    lines.append(f"{C.CYN}{cat[0]}{C.RST}{' ' * gap0}{C.CYN}{cat[0]}{C.RST}")
    lines.append(
        f"{C.CYN}{cat[1]}{C.RST} {C.DIM}{C.CYN}{'─' * left_d}{C.RST} "
        f"{C.BOLD}{C.CYN}{raw_title}{C.RST}{C.DIM}{C.CYN}{'─' * right_d}{C.RST}"
        f" {C.CYN}{cat[1]}{C.RST}"
    )
    gap2 = width - len(cat[2]) * 2
    lines.append(f"{C.CYN}{cat[2]}{C.RST}{' ' * gap2}{C.CYN}{cat[2]}{C.RST}")
    return "\n".join(lines)

def divider():
    return f"{C.DIM}{'─' * 52}{C.RST}"

def path_highlight(p):
    parts = p.rsplit("/", 1) if "/" in p else ("", p)
    if len(parts) == 2:
        return f"{C.DIM}{parts[0]}/{C.RST}{C.WHT}{parts[1]}{C.RST}"
    return f"{C.WHT}{p}{C.RST}"

def norm_ext(ext):
    ext = ext.strip().lower()
    if ext and not ext.startswith("."):
        ext = "." + ext
    return ext

def parse_skip_ext_input(raw):
    raw = raw.strip()
    if not raw:
        return set()
    raw = raw.replace(",", " ").replace(";", " ")
    result = set()
    for part in raw.split():
        e = norm_ext(part)
        if e:
            result.add(e)
    return result


# ========================== 路径提取与列表解析 ==========================

def extract_path(line):
    line = line.strip()
    if line.startswith("#"):
        line = line[1:].strip()
    line = TREE_CHARS_RE.sub('', line)
    return line.strip()


def read_paths_from_file(filepath):
    if not os.path.exists(filepath):
        print(s_warn(f"List file not found: {filepath}"))
        return set(), set()
    included = set()
    excluded = set()
    in_block = False
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.rstrip("\n").rstrip("\r")
                stripped = line.strip()
                if stripped == "#<<<":
                    in_block = True
                    continue
                if stripped == "#>>>":
                    in_block = False
                    continue
                if in_block:
                    path = extract_path(line)
                    if path:
                        path = path.replace("\\", "/")
                        if path.startswith("./"):
                            path = path[2:]
                        path = path.rstrip("/")
                        if path:
                            excluded.add(path)
                    continue
                if not stripped:
                    continue
                is_commented = stripped.startswith("#")
                path = extract_path(stripped)
                if not path:
                    continue
                path = path.replace("\\", "/")
                if path.startswith("./"):
                    path = path[2:]
                path = path.rstrip("/")
                if path:
                    if is_commented:
                        excluded.add(path)
                    else:
                        included.add(path)
    except Exception as e:
        print(s_warn(f"Failed to read list file {filepath}: {e}"))
    return included, excluded


def parse_include_only_input(raw):
    raw = raw.strip()
    if not raw:
        return set(), set()
    raw = raw.replace(",", " ").replace(";", " ")
    included = set()
    excluded = set()
    for part in raw.split():
        part = part.strip()
        if not part:
            continue
        if part.startswith("@"):
            file_path = part[1:]
            if not file_path:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                file_path = os.path.join(script_dir, LIST_FILENAME)
                if not os.path.exists(file_path):
                    print(s_fail(f"Default list file not found: {file_path}"))
                    print(s_tip("Run 'python project_packer.py list' to generate it first."))
                    continue
            inc, exc = read_paths_from_file(file_path)
            included.update(inc)
            excluded.update(exc)
        else:
            p = part.replace("\\", "/")
            if p.startswith("./"):
                p = p[2:]
            if p:
                included.add(p.rstrip("/"))
    return included, excluded


def should_include_file(relpath, included, excluded):
    if not included and not excluded:
        return True
    parts = relpath.split("/")
    for i in range(1, len(parts)):
        parent = "/".join(parts[:i])
        if parent in excluded:
            return False
    if relpath in excluded:
        return False
    if relpath in included:
        return True
    for i in range(1, len(parts)):
        parent = "/".join(parts[:i])
        if parent in included:
            return True
    return False


# ========================== 工具函数 ==========================

def is_text_file(filepath):
    ext = Path(filepath).suffix.lower()
    name = os.path.basename(filepath)
    if ext in TEXT_EXTENSIONS or name in TEXT_FILENAMES:
        return True
    if ext in BINARY_EXTENSIONS:
        return False
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            f.read(8192)
        return True
    except (UnicodeDecodeError, PermissionError, OSError):
        return False

def get_file_size_str(filepath):
    try:
        return format_size(os.path.getsize(filepath))
    except OSError:
        return "unknown"

def format_size(n):
    if n >= 1048576:
        return f"{n / 1048576:.1f} MB"
    elif n >= 1024:
        return f"{n / 1024:.1f} KB"
    else:
        return f"{n} bytes"

def remove_comments(text, filepath):
    ext = Path(filepath).suffix.lower()
    if ext in (".json", ".json5"):
        return text
    if ext in (".html", ".htm", ".xhtml", ".xml", ".xsl", ".xslt"):
        return re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    if ext in (".css", ".scss", ".less", ".sass"):
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
        text = re.sub(r"//.*?$", "", text, flags=re.MULTILINE)
        return text
    if ext in (".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".c", ".cpp", ".cc",
               ".cxx", ".h", ".hpp", ".hh", ".hxx", ".java", ".scala", ".kt", ".cs",
               ".go", ".rs", ".swift", ".glsl", ".hlsl", ".wgsl", ".vert", ".frag",
               ".vue", ".svelte"):
        text = re.sub(r"//.*?$", "", text, flags=re.MULTILINE)
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
        return text
    if ext in (".py", ".pyw", ".rb", ".pl", ".pm", ".sh", ".bash", ".zsh", ".fish",
               ".yaml", ".yml", ".toml", ".lua", ".dart"):
        text = re.sub(r"#.*?$", "", text, flags=re.MULTILINE)
        return text
    if ext == ".sql":
        text = re.sub(r"--.*?$", "", text, flags=re.MULTILINE)
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
        return text
    if ext in (".bat", ".cmd"):
        text = re.sub(r"^\s*REM\b.*$", "", text, flags=re.MULTILINE | re.IGNORECASE)
        text = re.sub(r"^\s*::.*$", "", text, flags=re.MULTILINE)
        return text
    return text

def clean_empty_lines(text):
    lines = text.split("\n")
    result, empty = [], 0
    for line in lines:
        if line.strip() == "":
            empty += 1
            if empty <= 1:
                result.append("")
        else:
            empty = 0
            result.append(line)
    while result and result[0].strip() == "":
        result.pop(0)
    while result and result[-1].strip() == "":
        result.pop()
    return "\n".join(result)

def _should_exclude_entry(name):
    return (name in EXCLUDE_FILES or name == OUTPUT_FILENAME or name == LIST_FILENAME)

def generate_tree(root_dir, skip_exts=None):
    if skip_exts is None:
        skip_exts = set()
    root_name = os.path.basename(root_dir) or os.path.basename(os.getcwd())
    self_name = os.path.basename(__file__)
    lines = [f"{root_name}/"]
    def walk(dir_path, prefix):
        try:
            entries = sorted(os.listdir(dir_path))
        except PermissionError:
            return
        filtered = []
        for e in entries:
            full = os.path.join(dir_path, e)
            if os.path.isdir(full):
                if e in EXCLUDE_DIRS: continue
                filtered.append(e)
            else:
                if _should_exclude_entry(e) or e == self_name: continue
                if skip_exts and Path(full).suffix.lower() in skip_exts: continue
                filtered.append(e)
        dirs = sorted(e for e in filtered if os.path.isdir(os.path.join(dir_path, e)))
        files = sorted(e for e in filtered if not os.path.isdir(os.path.join(dir_path, e)))
        all_entries = dirs + files
        for i, entry in enumerate(all_entries):
            full = os.path.join(dir_path, entry)
            is_last = i == len(all_entries) - 1
            conn = "└── " if is_last else "├── "
            ext_pre = "    " if is_last else "│   "
            if os.path.isdir(full):
                lines.append(f"{prefix}{conn}{entry}/")
                walk(full, prefix + ext_pre)
            else:
                lines.append(f"{prefix}{conn}{entry}")
    walk(root_dir, "")
    return "\n".join(lines)

def generate_display_tree(root_dir, skip_exts=None, include_binary=False,
                          include_only=None, excluded_paths=None):
    if skip_exts is None: skip_exts = set()
    if include_only is None: include_only = set()
    if excluded_paths is None: excluded_paths = set()
    root_name = os.path.basename(root_dir) or os.path.basename(os.getcwd())
    self_name = os.path.basename(__file__)
    lines = []
    def walk(dir_path, prefix):
        try:
            entries = sorted(os.listdir(dir_path))
        except PermissionError:
            return
        filtered = []
        for e in entries:
            full = os.path.join(dir_path, e)
            if os.path.isdir(full):
                if e in EXCLUDE_DIRS: continue
                filtered.append(e)
            else:
                if _should_exclude_entry(e) or e == self_name: continue
                filtered.append(e)
        dirs = sorted(e for e in filtered if os.path.isdir(os.path.join(dir_path, e)))
        files = sorted(e for e in filtered if not os.path.isdir(os.path.join(dir_path, e)))
        all_entries = dirs + files
        for i, entry in enumerate(all_entries):
            full = os.path.join(dir_path, entry)
            is_last = i == len(all_entries) - 1
            conn = "└── " if is_last else "├── "
            ext_pre = "    " if is_last else "│   "
            if os.path.isdir(full):
                lines.append(f"{C.DIM}{prefix}{conn}{C.RST}{C.B_CYN}{entry}/{C.RST}")
                walk(full, prefix + ext_pre)
            else:
                relpath = os.path.relpath(full, root_dir).replace("\\", "/")
                file_ext = Path(full).suffix.lower()
                size_str = get_file_size_str(full)
                size_col = f"{C.DIM}({size_str}){C.RST}"
                if file_ext in skip_exts:
                    name = f"{C.DIM}{entry}{C.RST}"
                    marker = f" {C.YEL}[skip: {file_ext}]{C.RST}"
                elif include_only and not should_include_file(relpath, include_only, excluded_paths):
                    name = f"{C.DIM}{entry}{C.RST}"
                    marker = f" {C.YEL}[omitted]{C.RST}"
                elif not is_text_file(full):
                    if include_binary:
                        name = f"{C.MAG}{entry}{C.RST}"
                        marker = f" {C.MAG}[binary]{C.RST}"
                    else:
                        name = f"{C.DIM}{entry}{C.RST}"
                        marker = f" {C.DIM}[binary, skip]{C.RST}"
                else:
                    name = f"{C.WHT}{entry}{C.RST}"
                    marker = ""
                lines.append(f"{C.DIM}{prefix}{conn}{C.RST}{name} {size_col}{marker}")
    lines.append(f" {C.B_WHT}{root_name}/{C.RST}")
    walk(root_dir, " ")
    return "\n".join(lines)


# ========================== 打包 ==========================

def pack(description, keep_comments=False, include_binary=False, skip_exts=None,
         include_only=None, target_dir=None, excluded_paths=None):
    if target_dir:
        root_dir = os.path.abspath(target_dir)
        if not os.path.isdir(root_dir):
            print(s_fail(f"Target directory not found: {root_dir}"))
            return
    else:
        root_dir = os.getcwd()
    self_name = os.path.basename(__file__)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if skip_exts is None: skip_exts = set()
    if include_only is None: include_only = set()
    if excluded_paths is None: excluded_paths = set()

    tree_str = generate_tree(root_dir, skip_exts=skip_exts)
    file_entries = []
    skipped_binaries = []
    skipped_by_ext = 0
    skipped_by_include = 0
    errors = 0

    for dirpath, dirnames, filenames in os.walk(root_dir):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDE_DIRS)
        for filename in sorted(filenames):
            if _should_exclude_entry(filename) or filename == self_name:
                continue
            filepath = os.path.join(dirpath, filename)
            relpath = os.path.relpath(filepath, root_dir).replace("\\", "/")
            file_ext = Path(filepath).suffix.lower()
            if file_ext in skip_exts:
                skipped_by_ext += 1
                continue
            if is_text_file(filepath):
                if include_only and not should_include_file(relpath, include_only, excluded_paths):
                    size_str = get_file_size_str(filepath)
                    placeholder = f"[file content omitted -- not in include list, {size_str}]"
                    file_entries.append((relpath, placeholder, False))
                    skipped_by_include += 1
                else:
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            content = f.read()
                        if not keep_comments:
                            content = remove_comments(content, filepath)
                        content = clean_empty_lines(content)
                        file_entries.append((relpath, content, False))
                    except Exception:
                        errors += 1
            else:
                if include_binary:
                    try:
                        with open(filepath, "rb") as f:
                            data = f.read()
                        content = base64.b64encode(data).decode("ascii")
                        file_entries.append((relpath, content, True))
                    except Exception:
                        errors += 1
                else:
                    size_str = get_file_size_str(filepath)
                    placeholder = f"[binary file omitted -- {size_str}]"
                    file_entries.append((relpath, placeholder, False))
                    skipped_binaries.append((relpath, size_str))

    parts = [description, "", TREE_MARKER, "", tree_str, "", CODE_MARKER]
    for relpath, content, is_binary in file_entries:
        parts.append("")
        tag = f"{FILE_SEP_L}{relpath}{' [binary]' if is_binary else ''}{FILE_SEP_R}"
        parts.append(tag)
        parts.append(content)
    output = "\n".join(parts)
    output_path = os.path.join(script_dir, OUTPUT_FILENAME)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(output)
    output_size = os.path.getsize(output_path)
    output_s = format_size(output_size)
    print(banner("PROJECT PACKER"))
    print()
    if target_dir:
        print(s_info(f"Target directory: {C.YEL}{root_dir}{C.RST}"))
    if skip_exts:
        print(s_info(f"Skip extensions: {C.YEL}{', '.join(sorted(skip_exts))}{C.RST}"))
    if include_only:
        print(s_info(f"Include only files: {C.YEL}{', '.join(sorted(include_only))}{C.RST}"))
    if excluded_paths:
        print(s_info(f"Excluded paths: {C.YEL}{', '.join(sorted(excluded_paths))}{C.RST}"))
    print()
    print(generate_display_tree(root_dir, skip_exts=skip_exts, include_binary=include_binary,
                                include_only=include_only, excluded_paths=excluded_paths))
    print()
    print(divider())
    print(s_ok(f"Pack complete, Size {C.BOLD}{output_s}{C.RST}"))
    print(s_info(f"Output: {C.YEL}{output_path}{C.RST}"))
    if skipped_by_include:
        print(s_tip(f"{skipped_by_include} file(s) omitted from code section"))
    if skipped_binaries:
        print(s_tip("Use --include-binary to pack binary file content"))
    if errors:
        print(s_warn(f"{errors} file(s) failed to read"))


# ========================== 解包 ==========================

def unpack(txt_filepath):
    if not os.path.exists(txt_filepath):
        print(s_fail(f"File not found: {txt_filepath}"))
        return
    print(banner("PROJECT UNPACKER"))
    print()
    with open(txt_filepath, "r", encoding="utf-8") as f:
        text = f.read()
    code_idx = text.find(CODE_MARKER)
    if code_idx == -1:
        print(s_fail("Format error: code marker not found"))
        return
    code_section = text[code_idx + len(CODE_MARKER):]
    matches = list(FILE_HEADER_RE.finditer(code_section))
    if not matches:
        print(s_fail("Format error: no file entries found"))
        return
    files = []
    placeholders = []
    for i, m in enumerate(matches):
        raw = m.group(1)
        is_binary = "[binary]" in raw
        relpath = raw.replace(" [binary]", "").strip()
        start = m.end()
        if start < len(code_section) and code_section[start] == "\n":
            start += 1
        end = matches[i + 1].start() if i + 1 < len(matches) else len(code_section)
        content = code_section[start:end].rstrip("\n")
        files.append((relpath, content, is_binary))
        if content.strip().startswith("[binary file omitted") or content.strip().startswith("[file content omitted"):
            placeholders.append(relpath)
    print(s_info(f"Found {C.BOLD}{len(files)}{C.RST} file(s)"))
    print()
    for relpath, content, is_binary in files:
        if content.strip().startswith("[binary file omitted") or content.strip().startswith("[file content omitted"):
            print(f" {C.DIM}{relpath} (placeholder){C.RST}")
        elif is_binary:
            print(f" {C.MAG}{relpath} (binary){C.RST}")
        else:
            print(f" {C.WHT}{relpath}{C.RST}")
    if placeholders:
        print()
        print(s_warn(f"{len(placeholders)} file(s) are placeholders, cannot be restored:"))
        for p in placeholders:
            print(f" {C.DIM}-- {p}{C.RST}")
    print()
    print(divider())
    try:
        confirm = input(f" {C.BOLD}Continue?{C.RST} [y/N] ").strip().lower()
    except EOFError:
        confirm = "n"
    if confirm != "y":
        print(s_skip("Cancelled."))
        return
    print()
    root_dir = os.getcwd()
    count = 0
    for relpath, content, is_binary in files:
        if content.strip().startswith("[binary file omitted") or content.strip().startswith("[file content omitted"):
            print(s_skip(f"Skip placeholder: {path_highlight(relpath)}"))
            continue
        filepath = os.path.join(root_dir, relpath)
        dirpath = os.path.dirname(filepath)
        if dirpath:
            os.makedirs(dirpath, exist_ok=True)
        try:
            if is_binary:
                with open(filepath, "wb") as f:
                    f.write(base64.b64decode(content))
            else:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
            print(s_ok(f"Created {path_highlight(relpath)}"))
            count += 1
        except Exception as e:
            print(s_fail(f"{relpath}: {e}"))
    print()
    print(divider())
    print(s_ok(f"Unpack complete, {C.BOLD}{count}{C.RST} file(s) created"))
    if placeholders:
        print(s_warn(f"{len(placeholders)} binary/omitted file(s) not restored"))


# ========================== 生成文件列表 ==========================

def generate_list_entries(root_dir):
    self_name = os.path.basename(__file__)
    entries = []
    def walk(dir_path, prefix, rel_base):
        try:
            items = sorted(os.listdir(dir_path))
        except PermissionError:
            return
        filtered = []
        for e in items:
            full = os.path.join(dir_path, e)
            if os.path.isdir(full):
                if e in EXCLUDE_DIRS: continue
                filtered.append(e)
            else:
                if _should_exclude_entry(e) or e == self_name: continue
                filtered.append(e)
        dirs = sorted(e for e in filtered if os.path.isdir(os.path.join(dir_path, e)))
        files = sorted(e for e in filtered if not os.path.isdir(os.path.join(dir_path, e)))
        all_items = dirs + files
        for i, entry in enumerate(all_items):
            full = os.path.join(dir_path, entry)
            is_last = i == len(all_items) - 1
            conn = "└── " if is_last else "├── "
            ext_pre = "    " if is_last else "│   "
            if rel_base:
                relpath = f"{rel_base}/{entry}"
            else:
                relpath = entry
            if os.path.isdir(full):
                entries.append((relpath + "/", True, prefix + conn))
                walk(full, prefix + ext_pre, relpath)
            else:
                entries.append((relpath, False, prefix + conn))
    walk(root_dir, "", "")
    return entries


def generate_list_file(root_dir, all_commented, inherit_file=None):
    old_included = set()
    old_excluded = set()
    if inherit_file:
        if os.path.exists(inherit_file):
            old_included, old_excluded = read_paths_from_file(inherit_file)
            print(s_info(f"Inherited from: {C.YEL}{inherit_file}{C.RST}"))
        else:
            print(s_warn(f"Inheritance file not found: {inherit_file}"))
    entries = generate_list_entries(root_dir)
    lines = []
    lines.append("# " + "=" * 62)
    lines.append("# Project File List — generated by project_packer.py")
    lines.append("# " + "=" * 62)
    lines.append("#")
    lines.append("# 用法说明:")
    lines.append("#   - 以 # 开头的行 = 已注释 = 不打包该文件/目录")
    lines.append("#   - 去掉行首的 # 即可取消注释 = 打包该文件/目录")
    lines.append("#   - 以 / 结尾的行是目录")
    lines.append("#   - 如果目录被注释, 其下所有文件和子目录都不打包, 即使子文件(夹)未被注释")
    lines.append("#   - 如果目录未被注释, 其下所有文件默认打包 (除非单独注释该文件)")
    lines.append("#   - 块注释: 在单独一行写 #<<< 开始, #>>> 结束, 中间所有行都被注释")
    lines.append("#   - 树符号 (│├└─) 仅供视觉参考, 不影响路径解析")
    lines.append("#   - 使用方式: python project_packer.py pack -o @")
    lines.append("#     (或: python project_packer.py pack '描述' --include-only @)")
    lines.append("#")
    lines.append("# " + "=" * 62)
    lines.append("# 文件列表 (编辑下方注释来选择要打包的文件)")
    lines.append("# " + "=" * 62)
    lines.append("#")
    if not entries:
        lines.append("# (no files found)")
    else:
        for relpath, is_dir, tree_prefix in entries:
            normalized = relpath.rstrip("/")
            if normalized in old_included:
                commented = False
            elif normalized in old_excluded:
                commented = True
            else:
                commented = all_commented
            if commented:
                lines.append(f"# {tree_prefix}{relpath}")
            else:
                lines.append(f"{tree_prefix}{relpath}")
    return "\n".join(lines) + "\n"


def list_command(target_dir=None, all_commented=False, inherit_file=None):
    if target_dir:
        root_dir = os.path.abspath(target_dir)
        if not os.path.isdir(root_dir):
            print(s_fail(f"Target directory not found: {root_dir}"))
            return
    else:
        root_dir = os.getcwd()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, LIST_FILENAME)
    if inherit_file == "@":
        inherit_file = os.path.join(script_dir, LIST_FILENAME)
    print(banner("PROJECT LIST GEN"))
    print()
    print(s_info(f"Target directory: {C.YEL}{root_dir}{C.RST}"))
    print(s_info(f"Default all commented: {C.YEL}{'Yes' if all_commented else 'No'}{C.RST}"))
    if inherit_file:
        print(s_info(f"Inherit from: {C.YEL}{inherit_file}{C.RST}"))
    print()
    print(generate_display_tree(root_dir))
    print()
    content = generate_list_file(root_dir, all_commented, inherit_file)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)
    output_size = os.path.getsize(output_path)
    output_s = format_size(output_size)
    print(divider())
    print(s_ok(f"List file generated, Size {C.BOLD}{output_s}{C.RST}"))
    print(s_info(f"Output: {C.YEL}{output_path}{C.RST}"))
    print()
    print(s_tip("Edit the file to comment/uncomment paths, then run:"))
    print(f"  {C.CYN}python project_packer.py pack 'description' -o @{C.RST}")


# ========================== 主入口 ==========================

def main():
    print(banner("PROJECT PACKER"))
    print()
    print(f" {C.BOLD}1{C.RST} {C.WHT}Pack{C.RST}   -- scan directory, generate description file")
    print(f" {C.BOLD}2{C.RST} {C.WHT}Unpack{C.RST} -- restore project from description file")
    print(f" {C.BOLD}3{C.RST} {C.WHT}List{C.RST}   -- generate file list for selective packing")
    print()
    try:
        choice = input(f" {C.B_CYN}>{C.RST} Select mode [1/2/3]: ").strip()
    except EOFError:
        choice = ""
    if choice == "1":
        try:
            desc = input(f" {C.B_CYN}>{C.RST} Project description: ").strip() or "Project"
        except EOFError:
            desc = "Project"
        try:
            target_dir = input(f" {C.B_CYN}>{C.RST} Target directory (empty=current dir): ").strip()
        except EOFError:
            target_dir = ""
        target_dir = target_dir or None
        try:
            keep = input(f" {C.B_CYN}>{C.RST} Keep comments? [y/N]: ").strip().lower() == "y"
        except EOFError:
            keep = False
        try:
            ibin = input(f" {C.B_CYN}>{C.RST} Include binary content? [y/N]: ").strip().lower() == "y"
        except EOFError:
            ibin = False
        try:
            skip_raw = input(f" {C.B_CYN}>{C.RST} Skip extensions (e.g. .log .tmp): ").strip()
        except EOFError:
            skip_raw = ""
        skip_exts = parse_skip_ext_input(skip_raw)
        try:
            include_raw = input(f" {C.B_CYN}>{C.RST} Include only paths (comma/space, @ or @file, empty=all): ").strip()
        except EOFError:
            include_raw = ""
        include_only, excluded_paths = parse_include_only_input(include_raw)
        print()
        pack(desc, keep_comments=keep, include_binary=ibin, skip_exts=skip_exts,
             include_only=include_only, target_dir=target_dir, excluded_paths=excluded_paths)
    elif choice == "2":
        try:
            path = input(f" {C.B_CYN}>{C.RST} Description file path: ").strip().strip('"').strip("'")
        except EOFError:
            path = ""
        print()
        if path:
            unpack(path)
        else:
            print(s_fail("No file path provided."))
    elif choice == "3":
        try:
            target_dir = input(f" {C.B_CYN}>{C.RST} Target directory (empty=current dir): ").strip()
        except EOFError:
            target_dir = ""
        target_dir = target_dir or None
        try:
            all_c = input(f" {C.B_CYN}>{C.RST} All commented? [y/N]: ").strip().lower() == "y"
        except EOFError:
            all_c = False
        try:
            inherit_raw = input(f" {C.B_CYN}>{C.RST} Inherit from file (empty=none, @=default list): ").strip()
        except EOFError:
            inherit_raw = ""
        inherit_file = inherit_raw or None
        if inherit_file == "@":
            script_dir = os.path.dirname(os.path.abspath(__file__))
            inherit_file = os.path.join(script_dir, LIST_FILENAME)
        print()
        list_command(target_dir=target_dir, all_commented=all_c, inherit_file=inherit_file)
    else:
        print(s_skip("Invalid choice."))


if __name__ == "__main__":
    if len(sys.argv) >= 2:
        mode = sys.argv[1].lower()
        if mode in ("pack", "1"):
            args = sys.argv[2:]
            keep_comments = False
            include_binary = False
            skip_exts = set()
            include_only = set()
            excluded_paths = set()
            target_dir = None
            desc_parts = []
            collecting_skip = collecting_include = collecting_dir = False
            for a in args:
                if a in ("--keep-comments", "--keep", "-k"):
                    keep_comments = True
                    collecting_skip = collecting_include = collecting_dir = False
                elif a in ("--include-binary", "--binary", "-b"):
                    include_binary = True
                    collecting_skip = collecting_include = collecting_dir = False
                elif a in ("--skip-ext", "--skip", "-s"):
                    collecting_skip = True
                    collecting_include = collecting_dir = False
                elif a in ("--include-only", "--only", "-o"):
                    collecting_include = True
                    collecting_skip = collecting_dir = False
                elif a in ("--dir", "-d"):
                    collecting_dir = True
                    collecting_skip = collecting_include = False
                elif a.startswith("-"):
                    collecting_skip = collecting_include = collecting_dir = False
                elif collecting_skip:
                    ext = norm_ext(a)
                    if ext: skip_exts.add(ext)
                elif collecting_include:
                    inc, exc = parse_include_only_input(a)
                    include_only.update(inc)
                    excluded_paths.update(exc)
                elif collecting_dir:
                    target_dir = a
                    collecting_dir = False
                else:
                    desc_parts.append(a)
            desc = " ".join(desc_parts) or "Project"
            pack(desc, keep_comments=keep_comments, include_binary=include_binary,
                 skip_exts=skip_exts, include_only=include_only,
                 target_dir=target_dir, excluded_paths=excluded_paths)
        elif mode in ("unpack", "2"):
            if len(sys.argv) < 3:
                print(s_fail("Usage: python project_packer.py unpack <txt_file_path>"))
                sys.exit(1)
            unpack(sys.argv[2])
        elif mode in ("list", "3"):
            args = sys.argv[2:]
            target_dir = None
            all_commented = False
            inherit_file = None
            collecting_dir = collecting_inherit = False
            for a in args:
                if a in ("--dir", "-d"):
                    collecting_dir = True
                    collecting_inherit = False
                elif a in ("--all-commented", "--all", "-a", "-c"):
                    all_commented = True
                    collecting_dir = collecting_inherit = False
                elif a in ("--inherit", "-i"):
                    collecting_inherit = True
                    collecting_dir = False
                elif a.startswith("-"):
                    collecting_dir = collecting_inherit = False
                elif collecting_dir:
                    target_dir = a
                    collecting_dir = False
                elif collecting_inherit:
                    inherit_file = a
                    collecting_inherit = False
                else:
                    inherit_file = a
            if collecting_inherit:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                inherit_file = os.path.join(script_dir, LIST_FILENAME)
            list_command(target_dir=target_dir, all_commented=all_commented,
                         inherit_file=inherit_file)
        elif mode in ("help", "-h", "--help"):
            print(__doc__)
        else:
            print(s_fail(f"Unknown argument: {mode}"))
            print(__doc__)
            sys.exit(1)
    else:
        main()
