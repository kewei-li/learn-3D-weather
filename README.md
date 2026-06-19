# 天气现场 · Weather, as you'd feel it

一套 GPU 粒子 + 大气引擎，在真实地球(CesiumJS + Cesium World Terrain)上呈现近地面天气现象，
为普通用户提供"站在天气里"的直观感受，并朝接入真实数据演进。

## 快速运行

需要本地静态服务（Cesium 的 worker 在 `file://` 下会失败，必须用 http）：

```bash
# 任选其一
npm run dev      # → npx serve, http://localhost:8080
npm start        # → python3 -m http.server 8080
```

打开 `http://localhost:8080/`（即 `index.html`）。

首次运行前，复制 token 配置：

```bash
cp config.example.js config.js   # 然后在 config.js 填入你的 Cesium ion token
```
（`config.js` 含真实 token，被 `.gitignore` 忽略，不进仓库。）

## 部署 / Deploy (Vercel)

`config.js` 不在仓库里，所以**部署端必须另给 token**，否则页面会卡在 “streaming terrain…”（缺 token → 地形 401 → 不流）。
本仓库已配好免提交的安全做法：

1. Vercel → 项目 → **Settings → Environment Variables** 添加 `CESIUM_ION_TOKEN`（填你的 ion token），保存。
2. 重新部署（Redeploy）。

原理：`vercel.json` 把 `/config.js` 重写到 serverless 函数 [`api/config.js`](api/config.js)，该函数从 `CESIUM_ION_TOKEN`
环境变量吐出 `window.CESIUM_ION_TOKEN`。token 只存在 Vercel 环境变量里，**不进公开仓库**。本地开发仍用根目录的 `config.js` 文件（同一个 `<script src="config.js">` 两边都能用）。
⚠️ 客户端 token 对任何打开页面的人可见 → 公开站请在 ion 后台建**受限 token**（只授权 World Terrain + OSM Buildings，并锁定域名）。
> 想图省事也可以直接把 token 提交进仓库（公开仓库不推荐，会被扫号机器人盗刷免费额度）。

## 目录

- `index.html` — Cesium 主应用：五个现象(雷暴/大雪/浓雾/沙尘暴/龙卷)共用一套粒子引擎，
  跟随相机、白天/夜晚、雷暴闪电、涡旋风场。真实地形 + **OSM 3D 建筑**(在地形上长出立体楼体)。
  dock 上"实况 LIVE"按钮接 Open-Meteo 实时天气。落点温哥华北岸。
- `config.js` / `config.example.js` — ion token（前者 gitignore）。
- `src/datasources.js` — 真实数据源。**Open-Meteo**(全球、免密钥、CORS) 可客户端直接跑，驱动 dock 的"实况 LIVE"按钮；
  `api.weather.gov`(仅美国) 保留作备用；MRMS/HRRR/GLM 需后端。
- `prototypes/` — 早期 Three.js 探索（沉浸式引擎 demo、NEXRAD 体扫数据层 demo），仅作参考。
- `CLAUDE.md` — 给 Claude Code 的完整上下文与下一步任务。

详见 `CLAUDE.md`。
