"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_express = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_dotenv = __toESM(require("dotenv"));
var import_mongoose = __toESM(require("mongoose"));
var import_db = __toESM(require("./config/db"));
var import_keyRotation = require("./crons/keyRotation");
var import_env = require("./config/env");
var import_authRoutes = __toESM(require("./routes/authRoutes"));
var import_caseRoutes = __toESM(require("./routes/caseRoutes"));
var import_searchRoutes = __toESM(require("./routes/searchRoutes"));
var import_userRoutes = __toESM(require("./routes/userRoutes"));
var import_toolRoutes = __toESM(require("./routes/toolRoutes"));
var import_kaliToolsRoutes = __toESM(require("./routes/kaliToolsRoutes"));
var import_socialMediaFinderRoutes = __toESM(require("./routes/socialMediaFinderRoutes"));
var import_reportRoutes = __toESM(require("./routes/reportRoutes"));
var import_intelligenceReportRoutes = __toESM(require("./routes/intelligenceReportRoutes"));
var import_admin = __toESM(require("./routes/admin"));
var import_osintAnalystRoutes = __toESM(require("./routes/osintAnalystRoutes"));
var import_chatRoutes = __toESM(require("./routes/chatRoutes"));
import_dotenv.default.config();
(0, import_env.getJwtSecret)();
const startServer = async () => {
  try {
    await (0, import_db.default)();
    (0, import_keyRotation.initKeyRotationCron)();
    const PORT2 = process.env.PORT || 5e3;
    const server = app.listen(PORT2, () => {
      console.log(`\u{1F680} Server running on port ${PORT2}`);
    });
    server.timeout = 3e5;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};
const app = (0, import_express.default)();
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.shadowscan.me",
  "https://shadowscan.me",
  "https://shadowscan.duckdns.org",
  "http://www.shadowscan.me",
  "http://shadowscan.me",
  "http://localhost:5173",
  "http://localhost:5000"
];
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || DEFAULT_ALLOWED_ORIGINS[0];
const FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(",");
const allowedOrigins = Array.from(new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...FRONTEND_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
  FRONTEND_URL
].filter(Boolean)));
const normalizeOrigin = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
};
const originMatches = (requestOrigin, allowedOrigin) => {
  const request = normalizeOrigin(requestOrigin);
  const allowed = normalizeOrigin(allowedOrigin);
  if (request === allowed) return true;
  try {
    const requestUrl = new URL(request);
    const allowedUrl = new URL(allowed);
    const requestHost = requestUrl.hostname.replace(/^www\./i, "");
    const allowedHost = allowedUrl.hostname.replace(/^www\./i, "");
    return requestUrl.protocol === allowedUrl.protocol && requestHost === allowedHost;
  } catch {
    return false;
  }
};
const isAllowedOrigin = (origin) => allowedOrigins.some((allowedOrigin) => originMatches(origin, allowedOrigin));
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length > 0) {
      return callback(null, isAllowedOrigin(origin));
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token", "x-sudo-token", "Accept", "Origin", "X-Requested-With"],
  credentials: true,
  maxAge: 86400
  // Cache preflight for 24h
};
app.use((0, import_cors.default)(corsOptions));
app.use((req, res, next) => {
  const requestOrigin = req.header("Origin");
  let originToSet = FRONTEND_URL || "*";
  if (requestOrigin && isAllowedOrigin(requestOrigin)) {
    originToSet = requestOrigin;
  }
  res.setHeader("Access-Control-Allow-Origin", originToSet);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-csrf-token, x-sudo-token, Accept, Origin, X-Requested-With");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(import_express.default.json({ limit: "50mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
const PORT = process.env.PORT || 5e3;
app.get("/", (req, res) => {
  res.send("<h1>Fsociety ShadowScan API</h1><p>Status: ONLINE</p><p>Use the frontend to access the dashboard.</p>");
});
app.get("/api/health", (req, res) => {
  const dbStatus = import_mongoose.default.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    message: "Fsociety ShadowScan API is running",
    database: dbStatus
  });
});
app.use("/api/auth", import_authRoutes.default);
app.use("/api/cases", import_caseRoutes.default);
app.use("/api/search", import_searchRoutes.default);
app.use("/api/users", import_userRoutes.default);
app.use("/api/tools", import_toolRoutes.default);
app.use("/api/kali-tools", import_kaliToolsRoutes.default);
app.use("/api/social-media", import_socialMediaFinderRoutes.default);
app.use("/api/reports", import_reportRoutes.default);
app.use("/api/intelligence", import_intelligenceReportRoutes.default);
app.use("/api/admin", import_admin.default);
app.use("/api/osint-analyst", import_osintAnalystRoutes.default);
app.use("/api/chat", import_chatRoutes.default);
app.use((err, req, res, next) => {
  console.error("[Global Error Handler] Caught error:", err);
  const requestOrigin = req.header("Origin");
  let originToSet = FRONTEND_URL || "*";
  if (requestOrigin && isAllowedOrigin(requestOrigin)) {
    originToSet = requestOrigin;
  }
  res.setHeader("Access-Control-Allow-Origin", originToSet);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-csrf-token, x-sudo-token, Accept, Origin, X-Requested-With");
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "An internal error occurred during the request",
    details: process.env.NODE_ENV === "production" ? void 0 : err.stack || err
  });
});
startServer();
