const body = {
  applinks: {
    apps: [],
    details: [
      {
        appID: 'RAB89P8X48.com.mylooped.looped',
        paths: ['/p/*', '/u/*', '/c/*', '/app/*', '/login*', '/'],
      },
    ],
  },
};

export function loader() {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
}
