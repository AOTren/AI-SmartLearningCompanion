"""
AI 期末私教 — .env 配置编辑器
双击 env_editor.exe 即可打开图形化配置面板

功能：
- 读取 / 写入 backend/.env 文件
- 分组展示所有配置项，附带说明文字
- 密码字段可切换显示/隐藏
- 一键保存后直接启动后端服务器
"""

import os
import sys
import json
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path

# ──────────────────────────────────────────────
# 路径：exe 打包后 sys.frozen=True，路径为 exe 所在目录
# ──────────────────────────────────────────────
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).parent

ENV_PATH = BASE_DIR / ".env"
ENV_EXAMPLE_PATH = BASE_DIR / ".env.example"
APP_PY = BASE_DIR / "app.py"

# ──────────────────────────────────────────────
# 配置项定义
# ──────────────────────────────────────────────
CONFIG_GROUPS = [
    {
        "title": "🔑  Coze API 配置",
        "color": "#4f46e5",
        "fields": [
            {
                "key": "COZE_API_KEY",
                "label": "API Token (PAT)",
                "type": "password",
                "placeholder": "pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                "hint": "Coze 平台 → 空间设置 → API Token → 新建令牌",
                "required": True,
            },
            {
                "key": "COZE_BOT_ID",
                "label": "Bot ID（智能体 ID）",
                "type": "text",
                "placeholder": "7648266478655324196",
                "hint": "纯数字，不加 bot_ 前缀。URL 中 bot/ 后面的数字部分",
                "required": True,
            },
            {
                "key": "COZE_BASE_URL",
                "label": "API Base URL",
                "type": "choice",
                "choices": ["https://api.coze.cn", "https://api.coze.com"],
                "hint": "国内版选 api.coze.cn，国际版选 api.coze.com",
                "required": False,
            },
        ],
    },
    {
        "title": "⚙️  服务配置",
        "color": "#0891b2",
        "fields": [
            {
                "key": "HOST",
                "label": "监听主机",
                "type": "choice",
                "choices": ["127.0.0.1", "0.0.0.0"],
                "hint": "127.0.0.1 仅本机访问；0.0.0.0 允许局域网访问",
                "required": False,
            },
            {
                "key": "PORT",
                "label": "监听端口",
                "type": "text",
                "placeholder": "8000",
                "hint": "默认 8000，如端口被占用请更换",
                "required": False,
            },
            {
                "key": "CORS_ORIGINS",
                "label": "CORS 允许来源",
                "type": "text",
                "placeholder": '["http://localhost:5500"]',
                "hint": "前端地址，JSON 数组格式，多个用逗号分隔",
                "required": False,
            },
        ],
    },
    {
        "title": "🕐  高级设置",
        "color": "#059669",
        "fields": [
            {
                "key": "COZE_TIMEOUT",
                "label": "请求超时（秒）",
                "type": "text",
                "placeholder": "120",
                "hint": "等待 Coze API 响应的最大秒数",
                "required": False,
            },
            {
                "key": "SSE_HEARTBEAT_INTERVAL",
                "label": "SSE 心跳间隔（秒）",
                "type": "text",
                "placeholder": "15",
                "hint": "保持 SSE 连接活跃的心跳发送间隔",
                "required": False,
            },
            {
                "key": "LOG_LEVEL",
                "label": "日志级别",
                "type": "choice",
                "choices": ["INFO", "DEBUG", "WARNING", "ERROR"],
                "hint": "DEBUG 输出最详细；生产环境建议 INFO",
                "required": False,
            },
        ],
    },
]

# ──────────────────────────────────────────────
# 读取 .env 文件
# ──────────────────────────────────────────────
def load_env() -> dict:
    values = {}
    path = ENV_PATH if ENV_PATH.exists() else ENV_EXAMPLE_PATH
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            values[k.strip()] = v.strip()
    return values


# ──────────────────────────────────────────────
# 写入 .env 文件
# ──────────────────────────────────────────────
def save_env(values: dict):
    # 字段默认值表（空值时自动填入）
    DEFAULTS = {
        "PORT": "8000",
        "HOST": "0.0.0.0",
        "COZE_BASE_URL": "https://api.coze.cn",
        "COZE_API_VERSION": "/v3",
        "COZE_TIMEOUT": "120",
        "SSE_HEARTBEAT_INTERVAL": "15",
        "LOG_LEVEL": "INFO",
        "CORS_ORIGINS": '["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000"]',
    }

    lines = [
        "# ============================================",
        "# AI 期末私教 — 后端环境变量配置",
        "# 由 env_editor 自动生成，请勿手动大幅修改",
        "# ============================================",
        "",
    ]
    for group in CONFIG_GROUPS:
        lines.append(f"# ── {group['title']} ──")
        for field in group["fields"]:
            key = field["key"]
            val = values.get(key, "")
            if val == "" and key in DEFAULTS:
                val = DEFAULTS[key]
            lines.append(f"# {field['hint']}")
            lines.append(f"{key}={val}")
            lines.append("")
    ENV_PATH.write_text("\n".join(lines), encoding="utf-8")


# ──────────────────────────────────────────────
# 主 GUI 应用
# ──────────────────────────────────────────────
class EnvEditorApp:
    BRAND_COLOR = "#4f46e5"   # 紫色
    BG = "#f8fafc"             # 页面背景（浅灰）
    CARD_BG = "#ffffff"         # 卡片背景（白色）
    TEXT = "#1e293b"           # 正文文字（深灰）
    HINT = "#64748b"           # 提示文字（中灰）
    BORDER = "#e2e8f0"         # 边框（浅灰）
    SUCCESS = "#059669"         # 绿色（启动按钮）
    WARNING = "#d97706"         # 橙色（警告）

    def __init__(self, root: tk.Tk):
        self.root = root
        self.widgets: dict[str, tk.Variable] = {}
        self.show_password: dict[str, tk.BooleanVar] = {}
        self.env_values = load_env()
        self._server_process = None

        self._setup_window()
        self._build_ui()
        self._load_values()

    # ── 窗口基础设置 ──
    def _setup_window(self):
        self.root.title("AI 期末私教 — 配置编辑器")
        self.root.geometry("800x820")
        self.root.minsize(600, 600)
        self.root.configure(bg=self.BG)
        self.root.update_idletasks()
        x = (self.root.winfo_screenwidth() - 800) // 2
        y = (self.root.winfo_screenheight() - 820) // 2
        self.root.geometry(f"800x820+{x}+{y}")
        try:
            self.root.iconbitmap(default="")
        except Exception:
            pass

    # ── 构建整个 UI ──
    def _build_ui(self):
        # ★ 关键：先 pack 底部栏（side="bottom"），再 pack 中间内容区（expand=True）
        #   这样底部栏必定显示在窗口最下方，不会被挤出

        # ── ① 底部操作栏（先 pack，占据底部）──
        self._build_bottom_bar()

        # ── ② 顶部标题栏 ──
        self._build_header()

        # ── ③ 中间滚动内容区（占据剩余空间）──
        self._build_content()

        # 鼠标滚轮全局绑定
        self.root.bind_all("<MouseWheel>", self._on_mousewheel)

    # ── 顶部标题栏 ──
    def _build_header(self):
        header = tk.Frame(self.root, bg=self.BRAND_COLOR, height=64)
        header.pack(fill="x", side="top")
        header.pack_propagate(False)   # ★ 固定高度，内容不撑开

        tk.Label(
            header,
            text="🎓  AI 期末私教",
            font=("Microsoft YaHei", 16, "bold"),
            fg="white",
            bg=self.BRAND_COLOR,
        ).pack(side="left", padx=20, pady=16)

        self.status_dot = tk.Label(
            header,
            text="● 未保存",
            font=("Microsoft YaHei", 9),
            fg="#a5b4fc",
            bg=self.BRAND_COLOR,
        )
        self.status_dot.pack(side="right", padx=20)

        tk.Label(
            header,
            text=".env 配置面板",
            font=("Microsoft YaHei", 10),
            fg="#c7d2fe",
            bg=self.BRAND_COLOR,
        ).pack(side="right", padx=4)

    # ── 中间滚动内容区 ──
    def _build_content(self):
        content_frame = tk.Frame(self.root, bg=self.BG)
        # side="top" + expand=True：占据标题栏和底部栏之间的所有剩余空间
        content_frame.pack(fill="both", expand=True, side="top")

        canvas = tk.Canvas(content_frame, bg=self.BG, highlightthickness=0)
        scrollbar = ttk.Scrollbar(content_frame, orient="vertical", command=canvas.yview)

        scroll_frame = tk.Frame(canvas, bg=self.BG)

        scroll_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all")),
        )
        canvas.create_window((0, 0), window=scroll_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.bind(
            "<Configure>",
            lambda e: canvas.itemconfig(canvas.find_all()[0], width=e.width),
        )

        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        self.canvas = canvas
        self.scroll_frame = scroll_frame

        # 文件路径提示
        path_bar = tk.Frame(scroll_frame, bg=self.BG)
        path_bar.pack(fill="x", padx=16, pady=(12, 4))
        env_status = "✅ 已存在" if ENV_PATH.exists() else "⚠️ 尚未创建（保存后生成）"
        tk.Label(
            path_bar,
            text=f"配置文件：{ENV_PATH}   {env_status}",
            font=("Microsoft YaHei", 8),
            fg=self.HINT,
            bg=self.BG,
        ).pack(side="left")

        # 配置分组卡片
        for group in CONFIG_GROUPS:
            self._build_group_card(scroll_frame, group)

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    # ── 单个配置分组卡片 ──
    def _build_group_card(self, parent, group: dict):
        card = tk.Frame(
            parent,
            bg=self.CARD_BG,
            relief="flat",
            bd=0,
            highlightthickness=1,
            highlightbackground=self.BORDER,
        )
        card.pack(fill="x", padx=16, pady=6)

        # 分组标题条
        title_bar = tk.Frame(card, bg=group["color"], height=36)
        title_bar.pack(fill="x")
        title_bar.pack_propagate(False)   # ★ 固定高度
        tk.Label(
            title_bar,
            text=group["title"],
            font=("Microsoft YaHei", 10, "bold"),
            fg="white",
            bg=group["color"],
        ).pack(side="left", padx=12, pady=8)

        # 字段列表
        fields_frame = tk.Frame(card, bg=self.CARD_BG)
        fields_frame.pack(fill="x", padx=12, pady=8)

        for field in group["fields"]:
            self._build_field(fields_frame, field)

    # ── 单个字段 ──
    def _build_field(self, parent, field: dict):
        row = tk.Frame(parent, bg=self.CARD_BG)
        row.pack(fill="x", pady=5)

        # 左侧标签区（固定宽度 200px）
        label_frame = tk.Frame(row, bg=self.CARD_BG, width=200)
        label_frame.pack(side="left", fill="y")
        label_frame.pack_propagate(False)   # ★ 固定宽度

        label_text = field["label"]
        if field.get("required"):
            label_text += " *"

        tk.Label(
            label_frame,
            text=label_text,
            font=("Microsoft YaHei", 9, "bold"),
            fg=self.TEXT if not field.get("required") else self.BRAND_COLOR,
            bg=self.CARD_BG,
            anchor="w",
        ).pack(anchor="w")

        tk.Label(
            label_frame,
            text=field.get("hint", ""),
            font=("Microsoft YaHei", 7),
            fg=self.HINT,
            bg=self.CARD_BG,
            anchor="w",
            wraplength=190,
            justify="left",
        ).pack(anchor="w")

        # 右侧输入区
        input_frame = tk.Frame(row, bg=self.CARD_BG)
        input_frame.pack(side="left", fill="x", expand=True, padx=(8, 0))

        key = field["key"]
        field_type = field.get("type", "text")

        if field_type == "choice":
            var = tk.StringVar()
            self.widgets[key] = var
            combo = ttk.Combobox(
                input_frame,
                textvariable=var,
                values=field.get("choices", []),
                state="readonly",
                font=("Consolas", 9),
                width=38,
            )
            combo.pack(anchor="w", ipady=3)

        elif field_type == "password":
            var = tk.StringVar()
            show_var = tk.BooleanVar(value=False)
            self.widgets[key] = var
            self.show_password[key] = show_var

            pw_row = tk.Frame(input_frame, bg=self.CARD_BG)
            pw_row.pack(anchor="w", fill="x")

            entry = tk.Entry(
                pw_row,
                textvariable=var,
                show="●",
                font=("Consolas", 9),
                width=36,
                relief="solid",
                bd=1,
                fg=self.TEXT,
                bg="#fafafa",
            )
            entry.pack(side="left", ipady=4)

            def _make_toggle(ent=entry, sv=show_var):
                def _toggle():
                    sv.set(not sv.get())
                    ent.config(show="" if sv.get() else "●")
                return _toggle

            toggle_btn = tk.Button(
                pw_row,
                text="👁",
                command=_make_toggle(),
                relief="flat",
                bd=0,
                bg=self.CARD_BG,
                font=("Segoe UI Emoji", 10),
                cursor="hand2",
                width=3,
            )
            toggle_btn.pack(side="left", padx=(4, 0))

        else:
            var = tk.StringVar()
            self.widgets[key] = var
            placeholder = field.get("placeholder", "")
            entry = tk.Entry(
                input_frame,
                textvariable=var,
                font=("Consolas", 9),
                width=42,
                relief="solid",
                bd=1,
                fg=self.TEXT,
                bg="#fafafa",
            )
            entry.pack(anchor="w", ipady=4)
            if placeholder:
                entry.insert(0, placeholder)
                entry.config(fg=self.HINT)

                def _make_focus_handlers(ent=entry, ph=placeholder):
                    def on_focus_in(e):
                        if ent.get() == ph:
                            ent.delete(0, tk.END)
                            ent.config(fg=self.TEXT)
                    def on_focus_out(e):
                        if not ent.get():
                            ent.insert(0, ph)
                            ent.config(fg=self.HINT)
                    return on_focus_in, on_focus_out

                on_in, on_out = _make_focus_handlers()
                entry.bind("<FocusIn>", on_in)
                entry.bind("<FocusOut>", on_out)

    # ── 底部操作栏（固定在窗口底部）──
    def _build_bottom_bar(self):
        bar = tk.Frame(
            self.root,
            bg=self.CARD_BG,
            height=70,
            bd=0,
            highlightthickness=1,
            highlightbackground=self.BORDER,
        )
        # ★ 先 pack 底部栏，占据窗口最下方
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)   # ★ 固定高度 70px

        inner = tk.Frame(bar, bg=self.CARD_BG)
        inner.pack(expand=True, fill="both", padx=16, pady=10)

        # ── 保存配置按钮 ──
        save_btn = tk.Button(
            inner,
            text="💾  保存配置",
            command=self._save,
            bg=self.BRAND_COLOR,
            fg="white",
            font=("Microsoft YaHei", 10, "bold"),
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=20,
            pady=6,
        )
        save_btn.pack(side="left", padx=(0, 10))

        def _on_save_enter(e):
            save_btn.config(bg="#4338ca")
        def _on_save_leave(e):
            save_btn.config(bg=self.BRAND_COLOR)
        save_btn.bind("<Enter>", _on_save_enter)
        save_btn.bind("<Leave>", _on_save_leave)

        # ── 保存并启动后端按钮 ──
        run_btn = tk.Button(
            inner,
            text="🚀  保存并启动后端",
            command=self._save_and_run,
            bg=self.SUCCESS,
            fg="white",
            font=("Microsoft YaHei", 10, "bold"),
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=20,
            pady=6,
        )
        run_btn.pack(side="left", padx=(0, 10))

        def _on_run_enter(e):
            run_btn.config(bg="#047857")
        def _on_run_leave(e):
            run_btn.config(bg=self.SUCCESS)
        run_btn.bind("<Enter>", _on_run_enter)
        run_btn.bind("<Leave>", _on_run_leave)

        # ── 直接编辑文件按钮 ──
        open_btn = tk.Button(
            inner,
            text="📄  直接编辑文件",
            command=self._open_in_notepad,
            bg="#f1f5f9",
            fg=self.TEXT,
            font=("Microsoft YaHei", 9),
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=14,
            pady=6,
        )
        open_btn.pack(side="left")

        # 右侧：文件路径提示
        tk.Label(
            inner,
            text=f"📁 {ENV_PATH.name}",
            font=("Microsoft YaHei", 7),
            fg=self.HINT,
            bg=self.CARD_BG,
        ).pack(side="right", pady=6)

    # ── 加载现有 .env 值到控件 ──
    def _load_values(self):
        for group in CONFIG_GROUPS:
            for field in group["fields"]:
                key = field["key"]
                var = self.widgets.get(key)
                if var is None:
                    continue
                val = self.env_values.get(key, "")
                if val:
                    var.set(val)
                elif field.get("choices"):
                    var.set(field["choices"][0])

    # ── 收集控件当前值 ──
    def _collect_values(self) -> dict:
        values = {}
        for group in CONFIG_GROUPS:
            for field in group["fields"]:
                key = field["key"]
                var = self.widgets.get(key)
                if var:
                    val = var.get().strip()
                    placeholder = field.get("placeholder", "")
                    if val == placeholder and not field.get("required"):
                        val = ""
                    values[key] = val
        return values

    # ── 验证必填项 ──
    def _validate(self, values: dict) -> list:
        errors = []
        for group in CONFIG_GROUPS:
            for field in group["fields"]:
                if field.get("required") and not values.get(field["key"], "").strip():
                    errors.append(f"「{field['label']}」是必填项，请填写后再保存")
        return errors

    # ── 保存 ──
    def _save(self) -> bool:
        values = self._collect_values()
        errors = self._validate(values)
        if errors:
            messagebox.showwarning("⚠️ 请检查必填项", "\n".join(errors), parent=self.root)
            return False
        save_env(values)
        self.status_dot.config(text="✅ 已保存", fg="#86efac")
        messagebox.showinfo("✅ 保存成功", f".env 文件已更新：\n{ENV_PATH}", parent=self.root)
        return True

    # ── 保存并启动后端 ──
    def _save_and_run(self):
        if not self._save():
            return

        if not APP_PY.exists():
            messagebox.showerror(
                "❌ 找不到 app.py",
                f"请确认 app.py 与本程序在同一目录下：\n{BASE_DIR}",
                parent=self.root,
            )
            return

        try:
            python_exe = sys.executable if not getattr(sys, "frozen", False) else "python"
            subprocess.Popen(
                ["cmd", "/c", "start", "cmd", "/k",
                 f"cd /d \"{BASE_DIR}\" && python app.py"],
                shell=False,
                creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0,
            )
            messagebox.showinfo(
                "🚀 后端已启动",
                "已在新控制台窗口中启动后端服务。\n\n"
                "访问地址：http://localhost:8000\n"
                "API 文档：http://localhost:8000/docs\n\n"
                "关闭控制台窗口即可停止服务。",
                parent=self.root,
            )
        except Exception as ex:
            messagebox.showerror("❌ 启动失败", str(ex), parent=self.root)

    # ── 用记事本打开 .env ──
    def _open_in_notepad(self):
        if not ENV_PATH.exists():
            if messagebox.askyesno("文件不存在", ".env 文件还不存在，是否先保存再打开？", parent=self.root):
                if not self._save():
                    return
            else:
                return
        try:
            os.startfile(str(ENV_PATH))
        except Exception:
            subprocess.Popen(["notepad", str(ENV_PATH)])


# ──────────────────────────────────────────────
# 入口
# ──────────────────────────────────────────────
def main():
    root = tk.Tk()
    style = ttk.Style()
    try:
        style.theme_use("clam")
    except Exception:
        pass
    style.configure("TCombobox", padding=4, font=("Consolas", 9))

    app = EnvEditorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
