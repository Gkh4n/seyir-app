const BASE = "https://api.themoviedb.org/3";

function send(res, status, payload) {
  res.status(status).json(payload);
}

async function tmdb(path, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    const error = new Error("TMDB_API_KEY_MISSING");
    error.code = "TMDB_API_KEY_MISSING";
    throw error;
  }

  const url = new URL(BASE + path);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "tr-TR");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error("TMDB_REQUEST_FAILED");
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return response.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");

  const { action, q, type, id, season } = req.query;

  try {
    if (action === "status") {
      return send(res, 200, { configured: Boolean(process.env.TMDB_API_KEY) });
    }

    if (action === "search") {
      if (!q || String(q).trim().length < 2) {
        return send(res, 400, { error: "En az 2 karakter gir." });
      }

      const data = await tmdb("/search/multi", {
        query: String(q).trim(),
        include_adult: "false",
        page: 1
      });

      data.results = (data.results || []).filter(item => {
        if (item.media_type !== "movie" && item.media_type !== "tv") return false;
        if (type === "tv") return item.media_type === "tv";
        if (type === "movie") return item.media_type === "movie";
        if (type === "anime") {
          return item.original_language === "ja" &&
            Array.isArray(item.genre_ids) &&
            item.genre_ids.includes(16);
        }
        return true;
      });

      return send(res, 200, data);
    }

    if (action === "trending") {
      const data = await tmdb("/trending/all/week");
      data.results = (data.results || []).filter(
        item => item.media_type === "movie" || item.media_type === "tv"
      );
      return send(res, 200, data);
    }

    if (action === "catalog") {
      if (type === "anime") {
        const [tv, movies] = await Promise.all([
          tmdb("/discover/tv", {
            page: 1,
            sort_by: "popularity.desc",
            with_genres: "16",
            with_original_language: "ja"
          }),
          tmdb("/discover/movie", {
            page: 1,
            sort_by: "popularity.desc",
            with_genres: "16",
            with_original_language: "ja"
          })
        ]);

        const results = [
          ...(tv.results || []).map(item => ({ ...item, media_type: "tv" })),
          ...(movies.results || []).map(item => ({ ...item, media_type: "movie" }))
        ].sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));

        return send(res, 200, { results: results.slice(0, 30) });
      }

      if (!["movie", "tv"].includes(type)) {
        return send(res, 400, { error: "Geçersiz katalog türü." });
      }

      const data = await tmdb(`/${type}/popular`, { page: 1 });
      data.results = (data.results || []).map(item => ({
        ...item,
        media_type: type
      }));
      return send(res, 200, data);
    }

    if (action === "details") {
      if (!["movie", "tv"].includes(type) || !id) {
        return send(res, 400, { error: "Geçersiz yapım bilgisi." });
      }

      const data = await tmdb(`/${type}/${id}`, {
        append_to_response: "credits"
      });

      return send(res, 200, data);
    }

    if (action === "season") {
      if (type !== "tv" || !id || !season) {
        return send(res, 400, { error: "Geçersiz sezon bilgisi." });
      }

      const data = await tmdb(`/tv/${id}/season/${season}`);
      return send(res, 200, data);
    }

    return send(res, 400, { error: "Bilinmeyen işlem." });
  } catch (error) {
    if (error.code === "TMDB_API_KEY_MISSING") {
      return send(res, 503, {
        configured: false,
        error: "TMDB bağlantısı henüz yapılandırılmadı."
      });
    }

    return send(res, error.status || 500, {
      error: "TMDB isteği başarısız oldu."
    });
  }
};
