import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("/", "routes/admin.tsx", [
    index("routes/home.tsx"),
    route("verifications", "routes/verifications.tsx"),
    route("reports", "routes/reports.tsx"),
    route("appeals", "routes/appeals.tsx"),
    route("users", "routes/users.tsx"),
    route("posts", "routes/posts.tsx"),
    route("admins", "routes/admins.tsx"),
    route("audit", "routes/audit.tsx"),
  ]),
] satisfies RouteConfig;
