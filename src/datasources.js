/* =====================================================================
   src/datasources.js — 真实天气数据源
   ---------------------------------------------------------------------
   能客户端直接跑（已实现，CORS 开放、免密钥）:
     · Open-Meteo（全球，含加拿大）—— **主用**。点位 → current 天气
       (WMO weather_code / visibility / is_day) → 映射到引擎预设(preset)
       + 强度(intensity) + 昼夜(daynight)。pickForLocation() 走这条。
     · api.weather.gov / NWS（仅美国本土）—— 备用/参考。温哥华(BC, 加拿大)
       /points 返回 404("Data Unavailable For Requested Point")，故主路径改用
       Open-Meteo；NWS 函数保留给美国点位（pickForLocationNWS）。
   需要后端的（仅文档，浏览器拿不到原始 GRIB2/NetCDF）:
     · MRMS 三维反射率  → 解码后转 Cesium 体素 3D Tiles（数据层/风暴本体）
     · HRRR/RAP 风场    → 解码后做风场网格，喂给粒子 updateCallback
     · GLM 闪电         → 实时闪击经纬度，触发 index.html 的 strike()
   ===================================================================== */
(function (global) {
  async function getJSON(url, headers) {
    const r = await fetch(url, headers ? { headers } : undefined);
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  }

  /* ---------- Open-Meteo（全球，主用） ---------- */
  const OM = "https://api.open-meteo.com/v1/forecast";

  async function openMeteoCurrent(lat, lon) {
    const q = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=weather_code,visibility,wind_speed_10m,wind_direction_10m,temperature_2m,is_day&wind_speed_unit=ms`;
    const j = await getJSON(`${OM}?${q}`);
    return j.current; // {time, weather_code, visibility(m), wind_speed_10m(m/s), wind_direction_10m(°), temperature_2m(°C), is_day(0|1)}
  }

  // WMO weather code → 引擎预设。
  // 注意：WMO current 不含沙尘/扬沙码，故 dust 预设仅手动选择（或走 NWS 文本路径）。
  function toPresetFromWmo(c) {
    const code = c.weather_code, visM = c.visibility; // meters | undefined
    let preset = "storm", intensity = 0.25;            // 默认

    if ([45, 48].includes(code)) { preset = "fog"; intensity = 0.6; }                 // 雾/雾凇
    else if ([71, 73, 75, 77, 85, 86].includes(code)) {                               // 雪
      preset = "snow";
      intensity = (code === 75 || code === 86) ? 0.8 : code === 73 ? 0.6 : 0.5;
    }
    else if ([95, 96, 99].includes(code)) { preset = "storm"; intensity = 0.9; }      // 雷暴(含冰雹)
    else if ([65, 82].includes(code)) { preset = "storm"; intensity = 0.85; }         // 大雨/强阵雨
    else if ([63, 81].includes(code)) { preset = "storm"; intensity = 0.6; }          // 中雨/阵雨
    else if ([51,53,55,56,57,61,66,80].includes(code)) { preset="storm"; intensity=0.45; } // 小雨/毛毛雨/冻雨/阵雨
    else if (code <= 3) { preset = "storm"; intensity = 0.2; }                         // 晴/少云/阴 → 极轻("细雨"占位)

    // 能见度收尾：极低且非雪/雷暴 → 当雾处理；较低则加重一点
    if (visM != null && visM < 1000 && preset !== "snow" && intensity < 0.9) {
      preset = "fog"; intensity = Math.max(intensity, 0.7);
    } else if (visM != null && visM < 4000 && preset !== "fog") {
      intensity = Math.min(1, intensity + 0.15);
    }

    const daynight = c.is_day ? "day" : "night";
    // 风：气象习惯 wind_direction_10m 是“风从哪来”的方位角(度, 0=N,90=E)。
    // 吹向(to)的水平分量：E = -spd·sin(dir), N = -spd·cos(dir)。
    const spd = c.wind_speed_10m, dir = c.wind_direction_10m;
    let windE = null, windN = null;
    if (spd != null && dir != null) {
      const a = dir * Math.PI / 180;
      windE = -spd * Math.sin(a);
      windN = -spd * Math.cos(a);
    }
    return {
      preset, intensity, daynight,
      wind: { speed: spd, dir, E: windE, N: windN },
      debug: { code, visM, wind: spd, dir, temp: c.temperature_2m }
    };
  }

  // 全球主用：点位 → 当前实况 → 预设/强度/昼夜
  async function pickForLocation(lat, lon) {
    const cur = await openMeteoCurrent(lat, lon);
    return Object.assign(toPresetFromWmo(cur), { source: "open-meteo", raw: cur });
  }

  /* ---------- api.weather.gov / NWS（仅美国本土，保留） ---------- */
  const NWS = "https://api.weather.gov";
  // NWS 建议带标识性 User-Agent（浏览器里此头可能被忽略，但保留）
  const H = { "User-Agent": "weather-live/0.1 (replace-with-your-contact)", "Accept": "application/geo+json" };

  async function points(lat, lon) {
    return getJSON(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`, H);
  }

  async function latestObservation(lat, lon) {
    const p = await points(lat, lon);
    const stations = await getJSON(p.properties.observationStations, H);
    const stationId = stations.features[0].properties.stationIdentifier;
    const obs = await getJSON(`${NWS}/stations/${stationId}/observations/latest`, H);
    return { station: stationId, props: obs.properties };
  }

  // METAR textDescription → 预设（NWS 路径）。present weather 文本与可见度最可靠。
  // props.visibility.value 单位为米。
  function toPreset(props) {
    const wx = (props.textDescription || "").toLowerCase();
    const visM = props.visibility && props.visibility.value;
    let preset = "storm", intensity = 0.5;

    if (/snow|sleet|flurr|graupel|ice pellets|blowing snow/.test(wx)) { preset = "snow"; intensity = 0.6; }
    else if (/dust|sand|ash|haboob/.test(wx)) { preset = "dust"; intensity = 0.7; }
    else if (/fog|mist|haze|smoke/.test(wx) || (visM != null && visM < 2000)) { preset = "fog"; intensity = 0.6; }
    else if (/thunder|storm|t-storm|squall|tornado/.test(wx)) { preset = "storm"; intensity = 0.9; }
    else if (/rain|shower|drizzle/.test(wx)) { preset = "storm"; intensity = 0.55; }
    else if (visM != null && visM > 12000) { preset = "storm"; intensity = 0.25; } // 晴/少云 → 轻

    if (visM != null && visM < 4000 && preset !== "fog") intensity = Math.min(1, intensity + 0.2);
    return { preset, intensity, debug: { wx, visM } };
  }

  // 美国点位：NWS 最近站点最新观测 → 预设
  async function pickForLocationNWS(lat, lon) {
    const { station, props } = await latestObservation(lat, lon);
    return Object.assign(toPreset(props), { source: station, raw: props });
  }

  /* ---- 后端任务（占位，需服务端解码 GRIB2/NetCDF）---- */
  // MRMS: MergedReflectivityQC 3D 体（33 层高度）→ Cesium 体素 3D Tiles。
  //   驱动: 粒子密度(体感层) + 体素渲染(数据层)。time-dynamic 3D Tiles 做动画。
  // HRRR: UGRD/VGRD 各气压层 → 风场网格 JSON → forceFactory 里查询施加。
  // GLM:  实时闪击经纬度流 → index.html 调 strike() 落到真实位置。
  async function mrmsVoxels() { throw new Error("MRMS → 体素：需后端，见 CLAUDE.md 任务②"); }
  async function hrrrWindField() { throw new Error("HRRR 风场：需后端，见 CLAUDE.md 任务②"); }

  global.WeatherData = {
    // 全球主用（Open-Meteo）
    pickForLocation, openMeteoCurrent, toPresetFromWmo,
    // 美国/NWS
    pickForLocationNWS, points, latestObservation, toPreset,
    // 后端占位
    mrmsVoxels, hrrrWindField
  };
})(typeof window !== "undefined" ? window : globalThis);
