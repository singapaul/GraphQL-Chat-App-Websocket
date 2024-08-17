import { ApolloServer } from "@apollo/server";
import { expressMiddleware as apolloMiddleware } from "@apollo/server/express4";
import cors from "cors";
import express from "express";
import { createServer as createHTTPServer } from "node:http";
import { useServer as useWsServer } from "graphql-ws/lib/use/ws";
import { readFile } from "node:fs/promises";
import { authMiddleware, handleLogin } from "./auth.js";
import { resolvers } from "./resolvers.js";
import { WebSocketServer } from "ws";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { decodeToken } from "./auth.js";
const PORT = 9000;

const app = express();
app.use(cors(), express.json());

app.post("/login", handleLogin);

function getHTTPContext({ req }) {
  if (req.auth) {
    return { user: req.auth.sub };
  }
  return {};
}

const typeDefs = await readFile("./schema.graphql", "utf8");
const schema = makeExecutableSchema({ typeDefs, resolvers });
const apolloServer = new ApolloServer({ schema });
await apolloServer.start();
app.use(
  "/graphql",
  authMiddleware,
  apolloMiddleware(apolloServer, {
    context: getHTTPContext,
  })
);

function getWsContext({ connectionParams }) {
  const accessToken = connectionParams?.accessToken;
  if (accessToken) {
    const payload = decodeToken(accessToken);
    console.log(payload);
    return { user: payload.sub };
  }
  return {};
}

const httpServer = createHTTPServer(app);
// we pass in a HTTP server instance
const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
useWsServer({ schema, context: getWsContext }, wsServer);

httpServer.listen({ port: PORT }, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
});
