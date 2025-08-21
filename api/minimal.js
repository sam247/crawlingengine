// @ts-check
export const config = {
  runtime: 'edge'
};

export default function handler(req) {
  return new Response(
    JSON.stringify({
      status: 'ok',
      message: 'Site Aura Crawler API',
      version: '1.0.0',
      runtime: 'edge'
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Accept'
      }
    }
  );
}