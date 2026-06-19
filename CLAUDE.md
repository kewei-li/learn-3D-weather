# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 天气现场 / Weather, as you'd feel it

> 这份文件是给 Claude Code 的接手上下文。读完即可在不丢失设计意图的前提下继续开发。

## 仓库现状（已恢复为可运行）
工作目录早先是 `weather-live.zip` 的一份**被拍平的、不完整**拷贝；现已补齐缺失文件，可直接起服务跑。
- 现有：`index.html` / `config.js`(token, 已 .gitignore) / `config.example.js` / `src/datasources.js` /
  `.gitignore` / `README.md` / `CLAUDE.md` / `.claude/launch.json` / `weather-live.zip`。**不是 git 仓库。**
- `index.html` 加载 `config.js` 与 `src/datasources.js`，两者现都就位。根目录原先那份多余的 `datasources.js` 已删除
  （唯一权威副本在 `src/`）。
- `weather-live.zip` 是原始完整包（含 `prototypes/` 两个 Three.js demo），保留作参考/备份；如需 `prototypes/` 解压它即可。

## 运行 / Commands
纯静态站点，无构建步骤、无测试套件、无 lint。**必须用 http 起服务**（Cesium 的 worker 在 `file://` 下会失败）。
```bash
python3 -m http.server 8080      # 然后开 http://localhost:8080/
# 或： npx --yes serve -l 8080 .
```
（预览面板用 `.claude/launch.json` 的 `weather-live` 配置，python3 起在 :8137。）
**数据/逻辑层可在 node 里验证**（无需浏览器）——`src/datasources.js` 末尾导出到 `globalThis`，可直接 require/eval：
```bash
node -e 'const fs=require("fs");eval(fs.readFileSync("src/datasources.js","utf8"));
  WeatherData.pickForLocation(49.265,-123.115).then(r=>console.log(r.preset,r.intensity,r.daynight,r.debug));'
```
**渲染层（Cesium 粒子/场景）只能浏览器肉眼验证。** 改 `index.html` 内联 `<script>` 后务必 `node --check` 防语法错——
内联脚本一处语法错会整块不执行（`viewer` 不创建、但 `src/datasources.js` 仍加载，症状很迷惑）。
⚠️ 编辑器易把代码里的 ASCII 直引号 `"` 自动替换成中文弯引号 `“ ”`，在 JS 字符串里会直接 SyntaxError——改完用
`node --check` 或 grep 弯引号自查。

## 目标与受众
为**普通用户**做"站在天气里"的直观、真实体验：不是给气象专家的判读仪表盘，而是
让人一眼认出"这是一场风暴/一场雪/一片雾/一堵沙墙"。最终形态是**真实地图(Cesium)+ 真实数据**的实时天气模拟。

## 设计主线（不要偏离）
1. **体感层 + 数据层 双层**：同一现象既有"人能感受到的样子"(粒子/云/雨/雾/光)，也有"可判读的数据"(雷达体素/廓线)。普通用户看体感层，专业用户可切到数据层。当前应用只实现了体感层；数据层(MRMS 体素)是任务②。
2. **3D 只用在它挣得到的地方**：垂直结构(风暴顶、高悬冰雹核、逆温、切变)是 2D 给不了的，那里才上 3D；其余别为 3D 而 3D。
3. **诚实对待数据缺口**：实时数据有盲区(雷达锥顶盲区、波束展宽、雷达地平线)，要显式表达，不要用插值抹平。参考 `prototypes/nexrad-volume-threejs.html` 里对盲区的处理。

## 复用引擎框架（这是整个项目的骨架）
NOAA JetStream "types of weather phenomena" 清单(降水/遮蔽/大风三类)几乎全是近地面、可感知现象，
可用**同一套引擎**覆盖，只调四个旋钮：
- **粒子外观**：精灵(条状/柔粒)、尺寸、颜色
- **浮沉**：重力/下落速度、悬浮
- **运动场**：均匀风 / 平移锋 / 绕轴涡旋(龙卷) — 三类均已实现：均匀风(各预设) + 涡旋(`tornado` Rankine) + **平移锋**(`front` 预设：锋面沿 `frontMove` 扫过场景)
- **大气**：雾浓度/颜色 + 天空

映射示例：rain/drizzle/sleet/hail/graupel/snow = 下落预设调参；fog/mist/smoke/haze/dust/sand =
悬浮+雾预设；squall/tornado/waterspout/dust-devil/haboob = 粒子+运动场。

## 当前状态（已构建）
`index.html`：CesiumJS 1.142 + Cesium World Terrain，落点温哥华北岸(LON=-123.115, LAT=49.265)。
- **3D 建筑**：`Cesium.createOsmBuildingsAsync()` → `scene.primitives.add()`，全球 OSM 建筑作为 3D Tiles 在地形上长出立体楼体
  (免费 ion asset 96188，用现有 token)。`depthTestAgainstTerrain=true` 让楼体正确贴地。
- ⚠️ **HDR 必须关**：`scene.highDynamicRange=false`。开启后其自动曝光会被密集亮色粒子带偏，把整个场景压暗(发黑)。
  这是 multiplier=1 让粒子可见后才暴露的坑——粒子一多就必须关 HDR。
- **中英双语(默认英文)**：`I18N={en,zh}` 词表 + `applyLang(l)` 统一刷新所有 UI(标题/note/pills/强度/昼夜/实况按钮+状态/复位提示/`document.title`/`<html lang>`)。
  右上角 `#langtog`(EN/中)切换。动态文本也走词表：现象标题 `updateHead()`、实况状态 `liveStatText()`(由 `lastLive` 重渲染，切语言不重新请求)、WMO 现在天气名。
  pill 主标用当前语言、副标用另一语言(`.nm`/`.en` 互换)。新增 UI 文案务必同时加到 `I18N.en` 和 `I18N.zh`。
- `window.viewer` 暴露为调试句柄(可在 console 查 camera/scene/primitives)。
- **复位按钮**(右下角圆形 `#recenter`)：`camera.flyTo(HOME_VIEW)` 平滑飞回"最佳观测角度"。
  `HOME_VIEW`(机位 320m / heading 348° / pitch 2°)是初始视角与复位的**唯一真源**；改机位只改这一处。
- **六个现象** `PRESETS = {storm, snow, fog, dust, tornado, front}`，共用一个 `Cesium.ParticleSystem`，切换即重建。
- 粒子系统定位：**多数预设跟随相机**(`scene.preUpdate` 把 modelMatrix 设到相机上方，"身处其中")；**唯独 `tornado` 不跟随**，
  锚定到世界地面点 `tornadoBase`(相机在外面看)。`preUpdate` 里按 `cur==='tornado'` 分支。
- 力场 `forceFactory(P)` = updateCallback：重力(指向地心) + 东/北向风(可被实况风/`frontWind`覆盖) + 摆动 + **涡旋场**(有 `P.vortex` 时)。
  - 涡旋绕 **`tornadoBase` 的世界竖直轴**(非相机)旋转(Rankine) + 把碎屑约束到漏斗锥面 `funnelR(h)` + 沿柱轴上抬；`tornado` 的 `vortex:{omega,core,inflow,lift}`。
- **龙卷(`tornado` · 世界锚定 · 会翻腾/旋转/移动的漏斗)** — 两次迭代修好：先修"嵌相机里看不到形/不动"(改世界锚定 `tornadoBase`)；
  再修"像玻璃锥、不像龙卷"(改**滚动噪声**)。三层全读同一个移动锚点 `tornadoBase`：
  - **漏斗** = `tornFunnel`(一个圆锥 `Cesium.Primitive` + **自定义 Fabric 材质** `tornFunnelMat`)。材质把噪声贴图 `TORN_NOISE` 沿
    圆周(s)+竖直(t)用 `czm_frameNumber` 滚动 → 表面翻腾旋转；噪声驱动 alpha → 破碎边缘。这是"像龙卷"的关键(静态条纹锥不行)。
    `tornFunnelMM()` 每帧在 `preUpdate` 把它的 modelMatrix 摆到 `base+up*FUNNEL_TOP/2` 的 ENU 帧 → 随锚点平移。
  - **暗云墙**(顶, `tornWall`) + **扬尘云**(根, `tornWhirl`) = 软云 `billboard`(`IMG_CLOUD` 蓬松软贴图 + `sizeInMeters`)，
    `color` 染暗/染褐、软边。**别用实心 ellipsoid**(硬边像黑盖/褐盘)。位置 `CallbackProperty` 读 `tornadoBase`。
  - **碎屑** = `CircleEmitter` 从地面盘升起、被涡旋甩成上升螺旋(辅助层；主形靠几何+云)。
  - **移动** = `tornadoBase` 沿 `tornTrack`(≈垂直视线,横扫)正弦平移(`TORN_AMP`/`TORN_W`,~20m/s)；漏斗+两片云+碎屑一起动。
  - ⚠️ Cesium 1.142 坑：**没有 `CylinderEmitter`**(只有 Box/Circle/Cone/Sphere，底部用 `CircleEmitter`)；
    自定义材质 `Cesium.Material({fabric})` 的 `.type` 是自动生成的随机串(别用 `==='Fabric'` 找它，按 `uniforms.u_noise` 找)；
    `Primitive.modelMatrix` 只在真渲染(`preUpdate`)时更新——`clock.tick()` 不触发，`CallbackProperty` 才是按需求值。
- **锋面过境(`front` 预设 · 平移锋)**：`onTick` 推进 `frontPhase`→`frontDCam`(锋面到相机的有符号距离，>0锋前/<0锋后，过0即到达)。
  - **降水带** `bandProfile(d,type)` 调发射率：冷锋窄而强(峰在锋后 d≈-350)、暖锋宽而缓(峰在锋前 d≈+1600)——站着能感到雨"接近→骤强→过境→转晴"。
  - **可见云墙**：`frontWall`(Cesium `wall` 实体 + `CallbackProperty`)沿 `frontMove`(移向 SSE,正对机位迎面)推进，位置 = `camG - frontMove*frontDCam`(锋前在上风侧/相机正前方)。
  - **风切变**(`frontWind` 锋前西南→锋后西北)、**雾随锋面临近加浓**、**冷锋仅在带峰值附近打闪**。dock 上 `#fronttog`(冷/暖锋)仅在 front 时显示。
- ⚠️ **时钟必须前进**：`viewer.clock.multiplier=1`(原为 0)。Cesium ParticleSystem 用仿真时间增量发射/老化粒子，
  multiplier=0 会**冻结整个体感层**(粒子不发射、不动)。昼夜由 `applyMood` 切换时把 `currentTime` 重新钉到固定时刻(几分钟漂移可忽略)。
- 白天/夜晚 = 移动太阳(`globe.enableLighting` + 设 `viewer.clock.currentTime`)；强度 = 发射率。LIVE 时 `is_day` 自动设昼夜。
- 雷暴有 `strike()` 闪电(发光 polyline + 背景骤亮)。
- 情绪(mood) `applyMood(P)`：`scene.fog.density` / `skyAtmosphere` 偏移 / `backgroundColor`。
- token 外置到 `config.js`(读 `window.CESIUM_ION_TOKEN`)。
- **dock 上"⟳ 实况 LIVE"按钮是开关**（任务①完成）：开启→`pickForLocation`(Open-Meteo)→设 preset+intensity+昼夜+**实况风**，
  每 5 分钟轮询(`POLL_MS`)；状态行显示"现象·强度·气温·风·更新时刻"。手动点现象 pill 会 `exitLive()` 退出实况。
  实况风经 `wind_direction_10m` 算出东/北分量存入 `liveWind`，在 `forceFactory` 里覆盖预设风。

## 真实数据接缝
- **可客户端直接跑（已接通）**：`src/datasources.js`。
  - **Open-Meteo（全球，含加拿大，主用）**：`pickForLocation(lat,lon)` → `current`(WMO weather_code/visibility/is_day)
    → `toPresetFromWmo()` 映射到 preset + intensity + daynight。**LIVE 按钮走这条。**
  - **api.weather.gov / NWS（仅美国本土，保留）**：`pickForLocationNWS(lat,lon)` → 最近站点 METAR → `toPreset()`。
    ⚠️ **NWS 不覆盖加拿大**：温哥华(49.265,-123.115) `/points` 返回 404 `InvalidPoint`，故主路径改用 Open-Meteo。
  - 数据缺口（诚实记一笔）：Open-Meteo 的 WMO current 不含沙尘/扬沙码 → `dust` 预设只能手动选（或走 NWS 文本路径）。
- **需后端(浏览器拿不到原始 GRIB2/NetCDF)**：MRMS(体素)、HRRR(风场)、GLM(闪电)。见 datasources 注释。

数据→参数绑定：降水类型/强度/昼夜←Open-Meteo·METAR现在天气；风←HRRR·METAR；能见度←METAR/visibility→雾浓度；
闪电←GLM→`strike()` 落到真实经纬度；某地"显示哪个现象"←Open-Meteo 实况(美国点位可改走 NWS)。

## Cesium 关键事实(1.142)
- `Cesium.ParticleSystem`(emitter / image / startColor-endColor / minimum~maximumParticleLife /
  minimum~maximumSpeed / imageSize / emissionRate / lifetime / emitter / updateCallback)。
- **体素渲染**已广泛支持(把体数据当一格格 cube)：MRMS 三维反射率 → 体素 3D Tiles。
- **time-dynamic 3D Tiles**：时间维动画。
- GPU 粒子做风场(>1万粒子需 GPU)是成熟范式。
- 加载用官方 CDN `cesium.com/downloads/cesiumjs/releases/1.142/...`(会自动处理 CESIUM_BASE_URL)。

## token 处理
`config.js` 含真实 ion token，已 `.gitignore`。**任何客户端 token 对打开页面的人可见**；
公开部署前去 ion 后台建**受限 token**(只授权 Cesium World Terrain 等用到的资产)替换。

## 下一步任务（按优先级）
1. ✅ **已完成 · 第一个真·实时闭环**：dock"⟳ 实况 LIVE"开关 → Open-Meteo → 自动设 preset+intensity+昼夜+**实况风**，
   每 5 分钟轮询。（原计划用 api.weather.gov，但其不覆盖加拿大，改用全球 Open-Meteo；NWS 保留给美国点位。已在浏览器验证。）
3. ✅ **已完成 · 运动场家族凑齐**：涡旋(`tornado` Rankine) + **平移锋**(`front` 预设：锋面过境，冷/暖锋可切，含推进云墙 + 降水带 + 风切变)。
   参考 geographylens 锋面天气教学站做的体感版；如需"数据层"教学剖面图(标注冷锋后/暖锋前雨区、锋面坡度)可另起。
2. **MRMS → 体素数据层**：搭一个最小后端，定时拉 MRMS MergedReflectivityQC，转 Cesium 体素 3D Tiles；
   在 Cesium 里加"体感层/数据层"切换；用体素强度驱动粒子密度。
4. **HRRR 风场**：后端取 UGRD/VGRD → 风场网格 → updateCallback 查询施加(现已有 `liveWind` 单点风，可升级为网格风)。
5. **现场调参**(见下，需浏览器肉眼)。

## 已知待调参（均为合理起点值）
- **粒子密度普遍偏高 → 高强度时"白化/褐化"**：相机嵌在发射球里，强度调高(雪 100%、龙卷 45%+)会被粒子糊满屏。
  雪在 ~28% 能看清飘落；先降各预设 `rate` 或 `color1` 的 alpha，或缩小 `SphereEmitter` 半径。
- **`tornado` 漏斗观感**(已重做为滚动噪声漏斗 Primitive + 软云 billboard)：漏斗材质 GLSL 里的滚动速度/octave、alpha 阈值(`n*1.9-0.6`)、
  顶/底渐隐(`vlow/vhi`)、`CylinderGeometry` 的 top/bottomRadius(现 300/34)、`tornWall/tornWhirl` 软云的 `width/height/color/alpha`、
  `tornBase0` 前推距离(现 2000m)、`TORN_AMP/TORN_W`(平移)、碎屑 `rate/vortex` 都需肉眼调。结构+平移已验证(漏斗随锚点移~20m/s)，
  翻腾旋转靠 `czm_frameNumber` 滚动(只能在真浏览器看运动)。下一步可加：多片云墙增体积、把扬尘也换成噪声 Primitive、漏斗做成绳状/不规则。
- **`front` 锋面观感**：`FRONT_CYCLE`(过境周期34s)、`bandProfile` 的带宽/峰位、`frontMove` 朝向(现 168° 迎面)、
  云墙 `frontWall` 的高/色/alpha、`FRONT_R` 扫掠半程，都需肉眼调。逻辑已验证(墙推进、冷锋雨在锋后/暖锋雨在锋前)，
  但容器预览常截到空白帧，墙+雨的"好看"程度要在真实浏览器里调。
- 粒子 `imageSize` / `emissionRate` / `SphereEmitter` 半径 / `gravity`：Cesium 粒子可见尺寸最磨人。
- `applyMood` 的 `fog.density` 与 `skyAtmosphere` 偏移：浓雾/沙尘的"被吃掉的天空"是否到位。
- 相机机位 `setView`(heading 348°, pitch 2°)：是否对准北岸群山。
- 闪电频率 `nextStrike` 与背景骤亮时长。
- ⚠️ 预览环境提示：用 `.claude/launch.json` 的 python3 静态服起在 :8137；反复 reload 后 Cesium ion 地形流有时streaming不全(地面变纯色)，
  首次干净加载正常。粒子层(体感层)与地形无关，照常渲染。

## 早期探索(prototypes/，仅参考)
- `weather-scene-threejs.html`：纯 Three.js 的沉浸式引擎 demo(同款四现象切换、自定义粒子 shader)。
- `nexrad-volume-threejs.html`：NEXRAD 单雷达体扫的"数据层"demo，含数据盲区的诚实表达 + RHI 剖面。
  (注：单雷达体扫天生稀疏，故主线转向 MRMS 体素 + 体感层粒子。)
