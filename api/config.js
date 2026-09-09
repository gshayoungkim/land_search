export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    kakaoAppKey: process.env.KAKAO_APP_KEY || '',
  });
}
