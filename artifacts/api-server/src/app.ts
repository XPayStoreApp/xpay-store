import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import adminRouter from "./routes/admin";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./lib/adminAuth";

const app: Express = express();
app.set("trust proxy", 1);

// قائمة النطاقات المسموح بها من متغير البيئة (يمكن فصلها بفواصل)
const allowedOrigins = process.env.CLIENT_URL?.split(",") || [
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // السماح للطلبات بدون origin (مثل mobile apps أو server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(sessionMiddleware);

app.use("/api", router);
app.use("/api", adminRouter);

export default app;