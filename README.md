# yt-2-mp4 API

Docker tabanlı YouTube → MP4 dönüştürücü REST API.  
`yt-dlp` + `ffmpeg` kullanır, Node.js/Express ile yazılmıştır.

---

## 🚀 Başlatma

```bash
docker-compose up --build -d
```

---

## 📡 API Endpoints

### `GET /health`
Servis sağlık kontrolü.

```bash
curl http://localhost:3000/health
```

---

### `GET /api/qualities`
Desteklenen kalite seçenekleri.

```bash
curl http://localhost:3000/api/qualities
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "qualities": ["best", "1080", "720", "480", "360", "240"]
  }
}
```

---

### `POST /api/info`
Video bilgilerini döndürür (indirmez).

```bash
curl -X POST http://localhost:3000/api/info \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

**Yanıt:**
```json
{
  "success": true,
  "data": {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "duration": 212,
    "durationString": "3:32",
    "thumbnail": "https://...",
    "uploader": "Rick Astley",
    "formats": [
      { "quality": "1080p", "height": 1080 },
      { "quality": "720p",  "height": 720 }
    ]
  }
}
```

---

### `POST /api/download`
Videoyu MP4 olarak indirir ve stream eder.

```bash
# En iyi kalitede
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "quality": "best"}' \
  -o video.mp4

# 720p
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtu.be/dQw4w9WgXcQ", "quality": "720"}' \
  -o video_720p.mp4
```

**Body parametreleri:**

| Alan      | Tip    | Zorunlu | Açıklama                              |
|-----------|--------|---------|---------------------------------------|
| `url`     | string | ✅      | YouTube video URL'i                   |
| `quality` | string | ❌      | `best`, `1080`, `720`, `480`, `360`, `240` (varsayılan: `best`) |

---

## 🛠 Desteklenen URL Formatları

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`

---

## ⚙️ Yapılandırma

| Env Değişkeni  | Varsayılan       | Açıklama                  |
|----------------|------------------|---------------------------|
| `PORT`         | `3000`           | Dinlenecek port           |
| `DOWNLOADS_DIR`| `/tmp/downloads` | Geçici dosya dizini       |

---

## 📦 Proje Yapısı

```
yt-2-mp4/
├── src/
│   ├── index.js              # Express uygulama giriş noktası
│   ├── routes/
│   │   └── download.js       # API route'ları
│   └── utils/
│       └── downloader.js     # yt-dlp wrapper
├── Dockerfile
├── docker-compose.yml
└── package.json
```
