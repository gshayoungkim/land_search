export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    vworldApiKey: process.env.VWORLD_API_KEY || '',
    kakaoAppKey: process.env.KAKAO_APP_KEY || '',
  });
}
