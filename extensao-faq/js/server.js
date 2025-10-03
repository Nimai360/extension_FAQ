/*
  Servidor HTTP para persistência de usuários no MongoDB Atlas
  Endpoints:
    - POST /users { name, phone }  -> upsert por phone (se presente), senão insert
    - GET  /health                 -> status da API e do Mongo

  Execução:
    npm install express cors mongodb
    node server.js
*/

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

// Configurações
const PORT = Number(process.env.PORT) || 3000;
const DB_NAME = process.env.MONGO_DB || "ExtensaoAtlas";
const COLLECTION_NAME = process.env.MONGO_COLLECTION || "users";
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://atlas_db_user:tKOGlLdQ0Z1b1ZYf@extensaoatlas.ysfanon.mongodb.net/?retryWrites=true&w=majority&appName=ExtensaoAtlas";

// Cliente MongoDB (Stable API - ServerApiVersion.v1)
const client = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let collection = null;

async function initMongo() {
  if (collection) return collection;
  try {
    console.log("Conectando ao MongoDB...");
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    const db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);
    // Índice por telefone (não exclusivo para permitir múltiplos registros sem phone duplicado obrigatório)
    try {
      await collection.createIndex(
        { phone: 1 },
        { unique: true, partialFilterExpression: { phone: { $type: "string", $ne: "" } } }
      );
    } catch (idxErr) {
      console.warn("Aviso ao criar índice 'phone':", idxErr && idxErr.message ? idxErr.message : idxErr);
    }
    console.log("MongoDB conectado e coleção pronta:", `${DB_NAME}.${COLLECTION_NAME}`);
    return collection;
  } catch (err) {
    console.error("Falha ao conectar ao MongoDB:", err && err.message ? err.message : err);
    try {
      await client.close();
    } catch (_) {}
    collection = null;
    throw err;
  }
}

function normalizePhone(phone) {
  const s = String(phone || "").trim();
  if (!s) return "";
  // Mantém + e dígitos; remove espaços e pontuação
  const cleaned = s.replace(/[^+\d]/g, "");
  // Normalização simples: se começar com 00, troca por +
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  return cleaned;
}

const app = express();
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Length", "ETag"],
  credentials: false,
  maxAge: 86400,
};
app.use(cors(corsOptions));
// Trata preflight explicitamente para todos os endpoints
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "128kb" }));
// Log simples de requisições HTTP
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

app.get("/health", async (req, res) => {
  try {
    const ok = Boolean(collection);
    if (!ok) await initMongo();
    res.json({ ok: true, mongo: Boolean(collection) });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

app.post("/users", async (req, res) => {
  try {
    if (!collection) await initMongo();
    if (!collection) return res.status(503).json({ ok: false, error: "Mongo indisponível" });

    let { name, phone } = req.body || {};
    name = String(name || "").trim();
    phone = normalizePhone(phone);

    if (!name && !phone) {
      return res.status(400).json({ ok: false, error: "Informe ao menos name ou phone" });
    }

    // Se o nome for um telefone, usa como phone
    if (!phone && name) {
      const asPhone = normalizePhone(name);
      if (asPhone && /\d{4,}/.test(asPhone)) {
        phone = asPhone;
      }
    }

    const now = new Date();
    const base = { name, phone, updatedAt: now };

    // 1) Quando temos telefone: upsert por phone
    if (phone) {
      const up = await collection.updateOne(
        { phone },
        { $set: base, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );

      // Mescla com possível registro pendente por nome (sem phone) criado anteriormente
      if (name) {
        try {
          await collection.deleteOne({ name, $or: [{ phone: "" }, { phone: { $exists: false } }] });
        } catch (_) {}
      }
      return res.json({ ok: true, mode: "upsert_by_phone", result: up });
    }

    // 2) Sem telefone: cria/atualiza "pendente" por nome
    const pendingFilter = { name, $or: [{ phone: "" }, { phone: { $exists: false } }] };
    const upd = await collection.updateOne(
      pendingFilter,
      { $set: { name, updatedAt: now }, $setOnInsert: { phone: "", createdAt: now } },
      { upsert: true }
    );
    return res.json({ ok: true, mode: "pending_by_name", result: upd });
  } catch (e) {
    console.error("Erro em POST /users:", e);
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

// Diagnóstico opcional: últimos 20 registros
app.get("/users", async (req, res) => {
  try {
    if (!collection) await initMongo();
    const list = await collection.find({}).sort({ updatedAt: -1 }).limit(20).toArray();
    res.json({ ok: true, count: list.length, users: list });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

// Tenta conectar no MongoDB ao iniciar a API para expor status imediatamente
initMongo().catch((e) => {
  console.error("Conexão inicial com MongoDB falhou:", e && e.message ? e.message : e);
});

const server = app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});

// Encerramento gracioso
async function shutdown() {
  try {
    await client.close();
  } catch (_) {}
  try {
    server.close(() => process.exit(0));
  } catch (_) {
    process.exit(0);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
