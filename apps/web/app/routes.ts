import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("contact", "routes/contact.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("privacy-policy", "routes/privacy-policy.tsx"),
  route("cookies", "routes/cookies.tsx"),
  route("terms", "routes/terms.tsx"),
  route("community-rules", "routes/community-rules.tsx"),
  route("faq", "routes/faq.tsx"),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
