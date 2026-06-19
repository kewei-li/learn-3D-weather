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
（本仓库的 `config.js` 已含一个可用 token，且被 `.gitignore` 忽略。公开部署请换 ion 受限 token。）

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
