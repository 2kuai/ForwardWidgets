import asyncio
import aiohttp
import os

from data_contract import normalize_media, write_validated_json

# --- 配置区 ---
TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
DATA_DIR = "data"
OUTPUT_FILE = os.path.join(DATA_DIR, "dbtv-data.json")

DB_BASE_URL = "https://m.douban.com/rexxar/api/v2/subject/recent_hot/tv"

# 类型映射表
GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片", 18: "剧情", 
    10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐", 9648: "悬疑", 
    10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚", 10752: "战争", 37: "西部", 
    10759: "动作冒险", 10762: "儿童", 10763: "新闻", 10764: "真人秀", 10765: "科幻奇幻", 
    10766: "肥皂剧", 10767: "脱口秀", 10768: "战争政治"
}

REGIONS = [
    { "title": "全部剧集", "value": "tv", "limit": 300},
    { "title": "国产剧", "value": "tv_domestic", "limit": 150 },
    { "title": "欧美剧", "value": "tv_american", "limit": 150},
    { "title": "日剧", "value": "tv_japanese", "limit": 150 },
    { "title": "韩剧", "value": "tv_korean", "limit": 150},
    { "title": "动画", "value": "tv_animation", "limit": 150 },
    { "title": "纪录片", "value": "tv_documentary", "limit": 150 },
    { "title": "国内综艺", "value": "show_domestic", "limit": 150},
    { "title": "国外综艺", "value": "show_foreign", "limit": 150 }
]

async def fetch_douban_list(session, region):
    # 使用配置中的 value 作为豆瓣接口的 type 参数
    params = {"start": 0, "limit": region["limit"], "type": region["value"]}
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        "Referer": "https://m.douban.com/movie/"
    }
    async with session.get(DB_BASE_URL, params=params, headers=headers) as response:
        if response.status != 200:
            raise RuntimeError(f"Douban {region['title']} request failed with HTTP {response.status}.")
        data = await response.json()
        items = data.get("items")
        if not isinstance(items, list):
            raise RuntimeError(f"Douban {region['title']} response does not contain an items list.")
        return items

async def fetch_tmdb_detail(session, item, cache):
    db_title = item.get("title", "").strip()
    subtitle = item.get("card_subtitle", "")
    db_year = subtitle.split('/')[0].strip() if subtitle else None
    if db_year and not (db_year.isdigit() and len(db_year) == 4): db_year = None

    cache_key = f"{db_title}_{db_year}"
    if cache_key in cache: return cache[cache_key]

    url = "https://api.themoviedb.org/3/search/tv"
    headers = {"accept": "application/json"}
    params = {"query": db_title, "language": "zh-CN"}
    
    if TMDB_API_KEY.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {TMDB_API_KEY}"
    else:
        params["api_key"] = TMDB_API_KEY

    if db_year: params["first_air_date_year"] = db_year

    async with session.get(url, params=params, headers=headers) as response:
        if response.status != 200:
            raise RuntimeError(f"TMDB search for {db_title!r} failed with HTTP {response.status}.")
        data = await response.json()
        results = data.get("results", [])
        if not results:
            return None

        for res in results:
            tmdb_t = (res.get("name") or "").lower()
            tmdb_o = (res.get("original_name") or "").lower()
            target = db_title.lower()

            is_title_ok = (tmdb_t == target or tmdb_o == target)
            first_air = res.get("first_air_date")
            is_year_ok = True
            if db_year and first_air:
                is_year_ok = first_air.startswith(db_year)

            if is_title_ok and is_year_ok:
                genre_ids = res.get("genre_ids", [])
                genre_names = ",".join([GENRE_MAP.get(gid) for gid in genre_ids if GENRE_MAP.get(gid)])

                info = normalize_media({**res, "genreTitle": genre_names}, "tv")
                cache[cache_key] = info
                return info
    return None

async def batch_process(session, items, size, cache):
    results = []
    for i in range(0, len(items), size):
        chunk = items[i:i + size]
        tasks = [fetch_tmdb_detail(session, item, cache) for item in chunk]
        chunk_results = await asyncio.gather(*tasks)
        results.extend([r for r in chunk_results if r is not None])
    return results

async def main():
    if not TMDB_API_KEY:
        raise RuntimeError("TMDB_API_KEY environment variable is required.")

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as session:
        final_result = {}
        cache = {}
        for region in REGIONS:
            print(f"[data] Fetching Douban TV list: {region['title']}")
            items = await fetch_douban_list(session, region)
            matched = await batch_process(session, items, 8, cache)
            final_result[region["value"]] = matched

    write_validated_json(
        OUTPUT_FILE,
        final_result,
        "Douban TV lists",
        required_collections=[(region["value"],) for region in REGIONS],
    )

if __name__ == "__main__":
    asyncio.run(main())
