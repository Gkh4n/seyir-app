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

const GENRES = {
  tv: {
    action: [10759],
    drama: [18],
    comedy: [35],
    crime: [80],
    mystery: [9648],
    scifi: [10765],
    documentary: [99]
  },
  movie: {
    action: [28],
    adventure: [12],
    comedy: [35],
    drama: [18],
    horror: [27],
    thriller: [53],
    scifi: [878],
    romance: [10749],
    mystery: [9648]
  },
  anime: {
    action: { tv: [10759], movie: [28] },
    adventure: { tv: [10759], movie: [12] },
    comedy: { tv: [35], movie: [35] },
    drama: { tv: [18], movie: [18] },
    mystery: { tv: [9648], movie: [9648] },
    scifi: { tv: [10765], movie: [878, 14] },
    family: { tv: [10751], movie: [10751] }
  }
};

function wantedGenreIds(type, genre, mediaType) {
  if (!genre || genre === "all") return [];
  if (type === "anime") {
    const config = GENRES.anime[genre];
    return config ? (config[mediaType] || []) : [];
  }
  return (GENRES[type] && GENRES[type][genre]) || [];
}

function matchesGenre(item, type, genre) {
  const ids = wantedGenreIds(type, genre, item.media_type || type);
  if (!ids.length) return !genre || genre === "all";
  const itemGenres = Array.isArray(item.genre_ids) ? item.genre_ids : [];
  return ids.some(id => itemGenres.includes(id));
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");

  const { action, q, type, id, season, genre, sort } = req.query;

  try {
    if (action === "status") {
      return send(res, 200, { configured: Boolean(process.env.TMDB_API_KEY) });
    }

    if (action === "search") {
      if (!q || String(q).trim().length < 2) {
        return send(res, 400, { error: "En az 2 karakter gir." });
      }

      const query = String(q).trim();

      if (type === "anime") {
        const [tv, movies] = await Promise.all([
          tmdb("/search/tv", {
            query,
            include_adult: "false",
            page: 1
          }),
          tmdb("/search/movie", {
            query,
            include_adult: "false",
            page: 1
          })
        ]);

        const results = [
          ...(tv.results || []).map(item => ({ ...item, media_type: "tv" })),
          ...(movies.results || []).map(item => ({ ...item, media_type: "movie" }))
        ].filter(item =>
          item.original_language === "ja" &&
          Array.isArray(item.genre_ids) &&
          item.genre_ids.includes(16)
        ).sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));

        return send(res, 200, { results });
      }

      const data = await tmdb("/search/multi", {
        query,
        include_adult: "false",
        page: 1
      });

      data.results = (data.results || []).filter(item => {
        if (item.media_type !== "movie" && item.media_type !== "tv") return false;
        if (type === "tv") return item.media_type === "tv" && matchesGenre(item, "tv", genre);
        if (type === "movie") return item.media_type === "movie" && matchesGenre(item, "movie", genre);
        return true;
      });

      return send(res, 200, data);
    }

    if (action === "profile_avatars") {
      const curated = [
        { id: 1399, show: "Game of Thrones", people: ["Kit Harington", "Peter Dinklage", "Emilia Clarke"] },
        { id: 1396, show: "Breaking Bad", people: ["Bryan Cranston", "Aaron Paul"] },
        { id: 70523, show: "Dark", people: ["Louis Hofmann", "Lisa Vicari"] },
        { id: 1405, show: "Dexter", people: ["Michael C. Hall", "Jennifer Carpenter"] },
        { id: 2288, show: "Prison Break", people: ["Wentworth Miller", "Dominic Purcell"] },
        { id: 63174, show: "Lucifer", people: ["Tom Ellis", "Lauren German"] },
        { id: 66732, show: "Stranger Things", people: ["Millie Bobby Brown", "Finn Wolfhard"] },
        { id: 1402, show: "The Walking Dead", people: ["Andrew Lincoln", "Norman Reedus"] },
        { id: 62560, show: "Mr. Robot", people: ["Rami Malek", "Christian Slater"] },
        { id: 1622, show: "Supernatural", people: ["Jensen Ackles", "Jared Padalecki"] },
        { id: 76479, show: "The Boys", people: ["Antony Starr", "Karl Urban"] },
        { id: 60059, show: "Better Call Saul", people: ["Bob Odenkirk", "Rhea Seehorn"] }
      ];

      const castLists = await Promise.all(
        curated.map(entry =>
          tmdb(`/tv/${entry.id}/credits`)
            .then(data => ({ entry, cast: data.cast || [] }))
            .catch(() => ({ entry, cast: [] }))
        )
      );

      const results = [];
      for (const group of castLists) {
        for (const wanted of group.entry.people) {
          const person = group.cast.find(c => c.name === wanted);
          if (!person || !person.profile_path) continue;
          results.push({
            id: person.id,
            actor: person.name,
            character: person.character || person.name,
            show: group.entry.show,
            show_id: group.entry.id,
            profile_path: person.profile_path
          });
        }
      }

      return send(res, 200, { results });
    }

    if (action === "trending") {
      const data = await tmdb("/trending/all/week");
      data.results = (data.results || []).filter(
        item => item.media_type === "movie" || item.media_type === "tv"
      );
      return send(res, 200, data);
    }

    if (action === "catalog") {
      const order = sort === "popular" ? "popular" : "rating";
      const sortBy = order === "popular" ? "popularity.desc" : "vote_average.desc";

      if (type === "anime") {
        const animeGenre = genre && genre !== "all" ? genre : null;
        const tvIds = animeGenre ? wantedGenreIds("anime", animeGenre, "tv") : [];
        const movieIds = animeGenre ? wantedGenreIds("anime", animeGenre, "movie") : [];
        const tvGenres = ["16", ...tvIds.map(String)].join(",");
        const movieExtra = movieIds.length > 1 ? movieIds.join("|") : (movieIds[0] ? String(movieIds[0]) : "");
        const movieGenres = ["16", movieExtra].filter(Boolean).join(",");

        const common = {
          page: 1,
          sort_by: sortBy,
          with_original_language: "ja"
        };
        if (order === "rating") common["vote_count.gte"] = 100;

        const [tv, movies] = await Promise.all([
          tmdb("/discover/tv", {
            ...common,
            with_genres: tvGenres
          }),
          tmdb("/discover/movie", {
            ...common,
            with_genres: movieGenres
          })
        ]);

        const results = [
          ...(tv.results || []).map(item => ({ ...item, media_type: "tv" })),
          ...(movies.results || []).map(item => ({ ...item, media_type: "movie" }))
        ].sort((a, b) => {
          if (order === "popular") return Number(b.popularity || 0) - Number(a.popularity || 0);
          return Number(b.vote_average || 0) - Number(a.vote_average || 0) ||
            Number(b.vote_count || 0) - Number(a.vote_count || 0);
        });

        return send(res, 200, { results: results.slice(0, 30) });
      }

      if (!["movie", "tv"].includes(type)) {
        return send(res, 400, { error: "Geçersiz katalog türü." });
      }

      const ids = wantedGenreIds(type, genre, type);
      const params = {
        page: 1,
        sort_by: sortBy
      };
      if (ids.length) params.with_genres = ids.join("|");
      if (order === "rating") params["vote_count.gte"] = type === "movie" ? 300 : 200;

      const data = await tmdb(`/discover/${type}`, params);
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

    if (action === "recommendations") {
      if (type !== "tv" || !id) {
        return send(res, 400, { error: "Geçersiz öneri bilgisi." });
      }

      const data = await tmdb(`/tv/${id}/recommendations`, { page: 1 });
      data.results = (data.results || []).map(item => ({
        ...item,
        media_type: "tv"
      }));
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
