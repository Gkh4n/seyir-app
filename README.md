# Seyir

Türkçe odaklı dizi + film kişisel puanlama, bölüm analizi ve izleme profili.

## v0.2

- TMDB üzerinden gerçek dizi ve film arama
- Haftalık popüler yapımlar
- Gerçek posterler ve TMDB topluluk puanları
- Film/dizi detay sayfaları
- Dizi sezon ve bölüm verileri
- Her bölüm için kişisel puan
- Genel puan / kişisel puan karşılaştırması
- Favoriler ve izleme listesi
- Film günlüğü: tekrar izleme sayısı + kısa not
- Kişisel puanların tarayıcıda saklanması
- Mobil uyumlu karanlık arayüz
- TMDB anahtarını tarayıcıya açmadan Vercel API katmanı

## TMDB bağlantısı

Vercel proje ayarlarında şu environment variable tanımlanmalı:

`TMDB_API_KEY`

Gerçek anahtarı repoya veya `.env.example` dosyasına yazmayın.

## Veri mimarisi

Şu anda kişisel puanlar ve listeler localStorage içinde tutuluyor. Sonraki aşamada Supabase Auth ve veritabanına taşınacak.

## Sonraki aşama

1. Supabase kullanıcı hesabı
2. Kullanıcı puanlarını veritabanında saklama
3. Paylaşılabilir profiller
4. Arkadaşlarla zevk uyumu
5. Tür / yönetmen / oyuncu bazlı kişisel analiz
6. Yıllık “Seyir Özeti”
