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
  if (!params.__skipLanguage) url.searchParams.set("language", "tr-TR");

  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith("__")) continue;
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
        { id: 1396, show: "Breaking Bad", people: [
          { actor: "Bryan Cranston", character: "Walter White" },
          { actor: "Aaron Paul", character: "Jesse Pinkman" }
        ]},
        { id: 70523, show: "Dark", people: [
          { actor: "Louis Hofmann", character: "Jonas Kahnwald" },
          { actor: "Lisa Vicari", character: "Martha Nielsen" }
        ]},
        { id: 1405, show: "Dexter", people: [
          { actor: "Michael C. Hall", character: "Dexter Morgan" }
        ]},
        { id: 2288, show: "Prison Break", people: [
          { actor: "Wentworth Miller", character: "Michael Scofield" },
          { actor: "Dominic Purcell", character: "Lincoln Burrows" }
        ]},
        { id: 63174, show: "Lucifer", people: [
          { actor: "Tom Ellis", character: "Lucifer Morningstar" }
        ]},
        { id: 66732, show: "Stranger Things", people: [
          { actor: "Millie Bobby Brown", character: "Eleven" },
          { actor: "David Harbour", character: "Jim Hopper" }
        ]},
        { id: 1402, show: "The Walking Dead", people: [
          { actor: "Andrew Lincoln", character: "Rick Grimes" },
          { actor: "Norman Reedus", character: "Daryl Dixon" }
        ]},
        { id: 62560, show: "Mr. Robot", people: [
          { actor: "Rami Malek", character: "Elliot Alderson" }
        ]},
        { id: 1399, show: "Game of Thrones", people: [
          { actor: "Kit Harington", character: "Jon Snow" },
          { actor: "Peter Dinklage", character: "Tyrion Lannister" },
          { actor: "Emilia Clarke", character: "Daenerys Targaryen" }
        ]},
        { id: 1622, show: "Supernatural", people: [
          { actor: "Jensen Ackles", character: "Dean Winchester" },
          { actor: "Jared Padalecki", character: "Sam Winchester" }
        ]},
        { id: 60059, show: "Better Call Saul", people: [
          { actor: "Bob Odenkirk", character: "Saul Goodman" }
        ]},
        { id: 76479, show: "The Boys", people: [
          { actor: "Antony Starr", character: "Homelander" },
          { actor: "Karl Urban", character: "Billy Butcher" }
        ]}
      ];

      const castLists = await Promise.all(
        curated.map(entry =>
          tmdb(`/tv/${entry.id}/credits`)
            .then(data => ({ entry, cast: data.cast || [] }))
            .catch(() => ({ entry, cast: [] }))
        )
      );

      const selected = [];
      for (const group of castLists) {
        for (const wanted of group.entry.people) {
          const person = group.cast.find(c => c.name === wanted.actor);
          if (!person) continue;
          selected.push({
            id: person.id,
            actor: person.name,
            character: wanted.character,
            show: group.entry.show,
            show_id: group.entry.id
          });
        }
      }

      const results = (await Promise.all(selected.map(async person => {
        try {
          const tagged = await tmdb(`/person/${person.id}/tagged_images`, {
            page: 1,
            __skipLanguage: true
          });
          const candidates = (tagged.results || []).filter(image => {
            const media = image.media || {};
            return media.media_type === "tv" && Number(media.id) === Number(person.show_id) && image.file_path;
          });

          candidates.sort((a, b) => {
            const ratioA = Number(a.aspect_ratio || 1.78);
            const ratioB = Number(b.aspect_ratio || 1.78);
            const portraitFitA = Math.abs(ratioA - 0.9);
            const portraitFitB = Math.abs(ratioB - 0.9);
            if (portraitFitA !== portraitFitB) return portraitFitA - portraitFitB;
            return Number(b.vote_count || 0) - Number(a.vote_count || 0) ||
              Number(b.vote_average || 0) - Number(a.vote_average || 0);
          });

          const image = candidates[0];
          if (!image) return null;
          return {
            ...person,
            image_path: image.file_path,
            aspect_ratio: Number(image.aspect_ratio || 1.78)
          };
        } catch {
          return null;
        }
      }))).filter(Boolean);

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
