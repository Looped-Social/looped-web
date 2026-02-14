const body = {
  applinks: {
    apps: [],
    details: [
      {
        appID: "RAB89P8X48.com.mylooped.looped",
        paths: ["/p/*", "/u/*", "/app/*", "/login*", "/"],
      },
    ],
  },
};

export default function handler(_req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.status(200).send(JSON.stringify(body));
}
