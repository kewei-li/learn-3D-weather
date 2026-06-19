// Vercel serverless function — serves the Cesium ion token from an env var,
// so the token lives in Vercel project settings (NOT in the public git repo).
// vercel.json rewrites /config.js → /api/config.js, so index.html's
// <script src="config.js"> picks it up on Vercel; locally the real config.js file is used.
// Set CESIUM_ION_TOKEN in: Vercel → Project → Settings → Environment Variables, then redeploy.
module.exports = (req, res) => {
  const token = process.env.CESIUM_ION_TOKEN || "";
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send("window.CESIUM_ION_TOKEN=" + JSON.stringify(token) + ";");
};
