import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

type StaticModuleOptions = {
  mediaDir: string;
  acceptanceDir: string;
  tenantHeaders: readonly string[];
  apiContractHeaders: readonly string[];
};

export function registerStaticModule(app: FastifyInstance, options: StaticModuleOptions): void {
  app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  });

  app.register(fastifyStatic, {
    root: options.mediaDir,
    prefix: "/media/",
  });

  app.register(fastifyStatic, {
    root: options.acceptanceDir,
    prefix: "/acceptance/",
    decorateReply: false,
  });

  app.addHook("onRequest", async (req, reply) => {
    const allowHeaders = [
      "Content-Type",
      "Authorization",
      ...options.apiContractHeaders,
      ...options.tenantHeaders,
    ].join(", ");
    const exposeHeaders = ["Content-Type", "x-api-contract-version"].join(", ");

    reply.header("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    reply.header("Vary", "Origin");
    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", allowHeaders);
    reply.header("Access-Control-Expose-Headers", exposeHeaders);

    if (req.method === "OPTIONS") return reply.code(204).send();
  });
}
