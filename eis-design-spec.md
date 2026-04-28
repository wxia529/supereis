# EIS 解析工作站 - 完整设计规范 v1.0

**日期：** 2026-04-28  
**目标用户：** 专业电化学研究人员（无编程基础）  
**核心价值：** 一键批量EIS数据拟合 + 可视化 + 结果导出

---

## 1. 工作流程

```
用户工作流：
1. [电路设计] 在画布上拖拽元素 (R, C, CPE, W) → 自动生成公式
2. [数据导入] 批量选择数据文件 (.txt/.csv/.xlsx)
3. [拟合执行] 点击"开始拟合" → 后端实时推送进度
4. [结果导出] 导出 Excel 包含所有数据集的拟合参数 + 误差指标
```

---

## 2. 前端架构

### 2.1 UI 布局（响应式）

```
┌─────────────────────────────────────────────────────────┐
│ 菜单栏 (File | Edit | View | Help)                      │
├─────────────────────────────────────────┬───────────────┤
│                                         │               │
│   电路绘制工作台                        │  数据导入面板 │
│  (60% 宽, Konva 画布)                  │  (40% 宽)     │
│                                         │               │
│  - 元素库 (R,C,L,CPE,W)                │ - 文件树      │
│  - 电路画布                            │ - 导入控制    │
│  - 公式显示: R0-p(R1,CPE1)-W1          │ - 进度条      │
│  - 初始参数滑块                        │ (i/N)         │
│                                         │               │
├─────────────────────────────────────────┼───────────────┤
│  可视化结果区 (100% 宽, 40% 高)         │               │
│  ┌─ Nyquist ┬─ Bode ┬─ 误差表 ─────────┤               │
│  │ [Plotly 图表，显示所有拟合结果对比]   │               │
│  └─────────────────────────────────────┘               │
├─────────────────────────────────────────────────────────┤
│ 操作栏: [开始拟合] [停止] [导出结果] [设置]              │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心交互

| 模块 | 功能 | 状态管理 |
|------|------|---------|
| **电路编辑器** | 拖拽放置元素 → 连接线逻辑 → 自动公式生成 | Redux (circuit state) |
| **数据导入** | 文件选择 → 预加载检查 → 批量导入列表 | Redux (dataset state) |
| **拟合映射** | 可选：为不同数据集分配不同电路/参数组合 | Redux (mapping state) |
| **拟合控制** | WebSocket 连接 → 实时进度 → 结果汇聚 | Redux (fitting state) |
| **可视化** | Plotly.js 标签页切换 → 严格 1:1 轴比例 (Nyquist) | React State |

---

## 3. 后端 API 规范

### 3.1 电路解析
```
POST /api/v1/circuit/parse
请求：
{
  "formula": "R0-p(R1,CPE1)-W1"
}
响应：
{
  "parameters": [
    {"name": "R0", "unit": "Ω", "initial": null},
    {"name": "R1", "unit": "Ω", "initial": null},
    {"name": "CPE1_Y", "unit": "S*s^n", "initial": null},
    {"name": "CPE1_n", "unit": "dimensionless", "initial": null, "bounds": [0, 1]},
    {"name": "W1", "unit": "s^0.5", "initial": null}
  ]
}
```

### 3.2 单次拟合
```
POST /api/v1/fit/single
请求：
{
  "frequencies": [1e5, 7.9e4, ...],
  "z_real": [4.5, 4.63, ...],
  "z_imag": [-0.16, -1.35, ...],
  "circuit_formula": "R0-p(R1,CPE1)-W1",
  "initial_params": {"R0": 4.0, "R1": 50.0, ...},
  "algorithm": "LM"
}
响应：
{
  "status": "success",
  "parameters": [
    {"name": "R0", "value": 4.12, "error_pct": 1.2},
    ...
  ],
  "fitted_curve": {
    "z_real_fit": [...],
    "z_imag_fit": [...]
  },
  "metrics": {
    "chi_square": 0.0015,
    "r_squared": 0.9987
  }
}
```

### 3.3 批量拟合（WebSocket）
```
WebSocket: ws://localhost:8000/api/v1/fit/batch

前端发送：
{
  "type": "start_batch",
  "datasets": [
    {
      "id": "file1",
      "frequencies": [...],
      "z_real": [...],
      "z_imag": [...],
      "circuit_formula": "R0-p(R1,CPE1)",      // 可选字段
      "initial_params": {...}                   // 可选，若无则用默认
    },
    {
      "id": "file2",
      "circuit_formula": "R0-p(R1,CPE1)-W1",  // 不同电路
      ...
    }
  ]
}

后端推送（每完成一个）：
{
  "type": "progress",
  "current": 3,
  "total": 10,
  "dataset_id": "file3",
  "result": {...fitted data...}
}

完成时：
{
  "type": "complete",
  "summary": {
    "total_fitted": 10,
    "failed": 0
  }
}
```

### 3.4 数据导出
```
GET /api/v1/export/batch?job_id=xyz
响应: Excel 文件下载
- Sheet1: 汇总（所有参数对比）
- Sheet2-N: 每个数据集的详细拟合结果 + Nyquist/Bode 坐标
```

---

## 4. 技术栈

| 层 | 技术 | 原因 |
|----|------|------|
| **桌面壳层** | Tauri 2.0 + Rust | 低内存占用，无需内嵌Chromium |
| **前端框架** | React 18 + TypeScript | 类型安全，状态管理清晰 |
| **样式** | TailwindCSS | 快速原型，响应式设计 |
| **电路绘制** | Konva.js | 高性能 2D 画布 |
| **数据可视化** | Plotly.js + react-plotly.js | 严格轴比例，1:1 Nyquist |
| **数据导出** | XLSX / Python openpyxl | 标准格式，易于二次处理 |
| **后端** | FastAPI + Python 3.10 | 轻量级，异步原生 |
| **拟合算法** | impedance.py + SciPy | 成熟的电化学库 |

---

## 5. 实现阶段

### Phase 1: 后端核心（基础拟合）
- FastAPI 项目结构
- `/api/v1/circuit/parse` 实现
- `/api/v1/fit/single` 实现（Levenberg-Marquardt）
- 智能初始值估算模块

### Phase 2: 前端基础（UI 骨架 + 集成）
- Tauri 项目初始化
- 布局和菜单
- 电路编辑器骨架（Konva）
- Plotly 集成
- 与后端对接

### Phase 3: 批量拟合 + WebSocket
- 后端 WebSocket 服务
- 前端进度管理
- 数据导出逻辑

### Phase 4: 打包 + 优化
- Tauri Sidecar 集成
- PyInstaller 打包 Python 后端
- 性能优化（大数据集处理）

---

## 6. 关键技术细节

### 6.1 数据导入格式
支持格式：`.txt`、`.csv` (制表符或逗号分隔)
- 格式：**3 列**（频率、Z_real、Z_imag），无表头
- 例：`1.000E+05	4.496E+00	-1.603E-01`
- 自动检测分隔符（制表符 > 逗号 > 空格）

### 6.2 电路公式格式
遵循 `impedance.py` 标准，例如：
- `R0` — 串联电阻
- `p(R1,CPE1)` — R1 和 CPE1 并联
- `W1` — Warburg 阻抗
- 支持嵌套：`R0-p(R1,p(CPE1,L1))-W1`

### 6.3 Nyquist 图的轴比例
```javascript
// Plotly 配置
{
  xaxis: { scaleanchor: "y", scaleratio: 1 },
  yaxis: { scaleanchor: "x", scaleratio: 1 }
}
```
**必须**保证 1:1 比例，否则半圆显示为椭圆。

### 6.4 灵活拟合策略
- **单一模式（默认）：** 所有数据集用同一电路 + 参数
- **混合模式（可选）：** 为每个数据集指定不同电路（在导入数据后显示映射表）

### 6.5 批量拟合的错误恢复
- 单个数据集拟合失败 → 继续下一个（记录失败日志）
- 超时保护：单个拟合 > 30s 时自动 skip
- 用户可随时点击 "停止" 终止批处理

---

## 7. 数据流示意

```
[电路绘制] 
    ↓
[自动公式] R0-p(R1,CPE1)-W1
    ↓
[参数初始化] 调用 /api/v1/circuit/parse 获得参数架构
    ↓ [用户设置初始值滑块]
    ↓
[导入数据集] file1.txt, file2.txt, ...
    ↓ [用户点击"开始拟合"]
    ↓
[WebSocket 连接] ws://localhost:8000/api/v1/fit/batch
    ↓ [后端逐个拟合]
[实时推送进度] {current: i, total: N, result: {...}}
    ↓ [前端实时更新 UI + Plotly]
    ↓ [拟合完成]
[导出结果] GET /api/v1/export/batch → Excel 文件
```

---

## 8. 成功标准

- ✅ 用户不写代码，纯 GUI 操作完成拟合
- ✅ 单个数据集拟合 < 5s（典型情况）
- ✅ 批量拟合 100 个数据集 < 10 分钟
- ✅ Nyquist 图严格 1:1 轴比例
- ✅ 导出 Excel 包含所有拟合参数 + 原始数据
- ✅ 无崩溃、无数据丢失

---

## 附录：文件结构参考

```
eispro/
├── backend/
│   ├── main.py                    # FastAPI 启动点
│   ├── api/
│   │   ├── circuit.py             # /circuit/parse 路由
│   │   ├── fitting.py             # /fit 路由
│   │   └── export.py              # /export 路由
│   ├── models/
│   │   ├── circuit_parser.py      # 公式解析逻辑
│   │   ├── fitter.py              # 拟合算法（SciPy 包装）
│   │   └── initial_guess.py       # 智能初始值
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CircuitEditor.tsx  # 电路绘制
│   │   │   ├── DataImport.tsx     # 数据导入
│   │   │   ├── FittingProgress.tsx# 进度管理
│   │   │   └── Visualization.tsx  # Plotly 集成
│   │   ├── hooks/
│   │   │   ├── useCircuit.ts      # 电路状态管理
│   │   │   ├── useFitting.ts      # 拟合状态管理
│   │   │   └── useWebSocket.ts    # WebSocket 钩子
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
└── tauri/
    └── tauri.conf.json            # Tauri 配置 + Sidecar 定义
```
