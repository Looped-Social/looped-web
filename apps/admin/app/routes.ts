import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  route("/", "routes/admin.tsx", [
    index("routes/home.tsx"),
    route("analytics", "routes/analytics.tsx"),
    route("analytics/kpis", "routes/analytics-kpis.tsx"),
    route("verifications", "routes/verifications.tsx"),
    route("communities", "routes/communities.tsx"),
    route("sectors", "routes/sectors.tsx"),
    route("settings/specializations", "routes/settings-specializations.tsx"),
    route("settings/profile", "routes/settings-profile.tsx"),
    route("community-requests", "routes/community-requests.tsx"),
    route("reports", "routes/reports.tsx"),
    route("announcements", "routes/announcements.tsx"),
    route("appeals", "routes/appeals.tsx"),
    route("users", "routes/users.tsx"),
    route("posts", "routes/posts.tsx"),
    route("admins", "routes/admins.tsx"),
    route("audit", "routes/audit.tsx"),
  ]),
] satisfies RouteConfig;
