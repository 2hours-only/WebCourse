# `docs/other/prj.py使用说明`
- 一键将项目代码打包成单个文本文件（方便复制给 AI 或备份）
- 也能从文本恢复整个项目。
- 实际使用的时候推荐复制到比工程文件高一级的位置使用, 这样不需要指定绝对路径也不会在工程文件中引入新代码。

#### 1. 打包代码 (`pack`)
基础格式为 `python prj.py pack  [参数]`。(或`python3 prj.py pack [参数]`, 取决于你的python环境)
**实用示例：**
*   **指定绝对路径打包：**
    ```bash
    python prj.py pack "" -d D:\MyProject
    ```
*   **跳过指定后缀文件（如日志、临时文件）：**
    ```bash
    python prj.py pack "" -s .log .tmp .bak
    ```
*   **只打包某几个指定文件（用逗号分隔，其余文件仅显示目录树占位）：**
    ```bash
    python prj.py pack "" -o index.html,js/main.js
    ```
*   **在一个txt文件中指定要打包的文件（见2.生成文件列表）：**
    ```bash
    python prj.py pack "" -o @
    ```
#### 2. 生成文件列表 (`list`)
如果觉得手敲 `-o` 后面的一对路径太麻烦，可以先生成列表：
```bash
python prj.py list
```
这会生成 `__prj_file_list__.txt`。打开它，在每一排的最前面用 `#` 注释掉你不想打包的文件或文件夹，然后执行上面的 `-o @` 命令，即可精准打包需要的代码。

如果注释掉一个文件夹, 里面的所有文件和子文件夹自动被注释。
#### 3. 解包恢复项目 (`unpack`)
从打包好的文本文件还原整个项目目录到当前文件夹。
```bash
python prj.py unpack prj.txt
```
#### 4. 其他功能
代码还有一些别的实用功能, 直接扔给AI就可以得到一个更具体的介绍。
