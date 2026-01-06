import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/marketing/home.tsx"),
  route("about", "routes/marketing/about.tsx"),
  route("contact", "routes/marketing/contact.tsx"),
  route("privacy", "routes/marketing/privacy.tsx"),
  route("privacy-policy", "routes/marketing/privacy-policy.tsx"),
  route("cookies", "routes/marketing/cookies.tsx"),
  route("terms", "routes/marketing/terms.tsx"),
  route("community-rules", "routes/marketing/community-rules.tsx"),
  route("community-request", "routes/marketing/community-request.tsx"),
  route("faq", "routes/marketing/faq.tsx"),
  route("attributions", "routes/marketing/attributions.tsx"),
  route("app", "routes/app/app.tsx"),
  route("app/profile", "routes/app/profile.tsx"),
  route("login", "routes/marketing/login.tsx"),
  route("delete-account", "routes/marketing/delete-account.tsx"),
] satisfies RouteConfig;
