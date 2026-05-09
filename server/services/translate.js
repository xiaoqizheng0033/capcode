const https = require('https');

/**
 * Detect if text is primarily English (ASCII-based)
 * Returns true if >50% of alpha chars are ASCII letters
 */
function isEnglish(text) {
  const alphaChars = text.match(/[a-zA-Z\u4e00-\u9fff]/g) || [];
  if (alphaChars.length === 0) return false;
  const asciiCount = alphaChars.filter(c => /[a-zA-Z]/.test(c)).length;
  return asciiCount / alphaChars.length > 0.5;
}

/**
 * Translate English text to Chinese using Google Translate API
 */
function translateEnToZh(text) {
  return new Promise((resolve) => {
    if (!text || !isEnglish(text)) {
      return resolve(text);
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const translated = parsed[0]?.map(p => p[0]).join('');
          resolve(translated || text);
        } catch {
          resolve(text);
        }
      });
    });

    req.on('error', () => resolve(text));
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(text);
    });
  });
}

module.exports = { translateEnToZh };
