import asyncio
import aiohttp
import json
import time
import os

# --- 配置区 ---
TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
# 确保保存到 data 文件夹
DATA_DIR = "data"
OUTPUT_FILE = os.path.join(DATA_DIR, "dbmovie-data.json")

DB_BASE_URL = "https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie"

REGIONS = [
    {"title": "全部", "type": "", "limit": 300},
    {"title": "华语", "type": "华语", "limit": 100},
    {"title": "欧美", "type": "欧美", "limit": 100},
    {"title": "韩国", "type": "韩国", "limit": 100},
    {"title": "日本", "type": "日本", "limit": 100}
]

async def fetch_douban_list(session, region):
    params = {"start": 0, "limit": region["limit"], "type": region["type"]}
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
        "Referer": "https://m.douban.com/movie/"
    }
    try:
        async with session.get(DB_BASE_URL, params=params, headers=headers) as resp:
            if resp.status != 200: return []
            data = await resp.json()
            return data.get("items", [])
    except: return []

async def fetch_tmdb_detail(session, item, cache):
    db_title = item.get("title", "").strip()
    subtitle = item.get("card_subtitle", "")
    db_year = subtitle.split('/')[0].strip() if subtitle else None
    if db_year and not (db_year.isdigit() and len(db_year) == 4): db_year = None

    cache_key = f"{db_title}_{db_year}"
    if cache_key in cache: return cache[cache_key]

    url = "https://api.themoviedb.org/3/search/movie"
    headers = {"accept": "application/json"}
    params = {"query": db_title, "language": "zh-CN"}
    
    # 自动处理 Bearer Token 或 API Key
    if TMDB_API_KEY.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {TMDB_API_KEY}"
    else:
        params["api_key"] = TMDB_API_KEY

    if db_year: params["primary_release_year"] = db_year

    try:
        async with session.get(url, params=params, headers=headers) as resp:
            if resp.status != 200: return None
            data = await resp.json()
            results = data.get("results", [])
            if not results: return None

            for res in results:
                tmdb_t = (res.get("title") or "").lower()
                tmdb_o = (res.get("original_title") or "").lower()
                target = db_title.lower()
                is_title_ok = (tmdb_t == target or tmdb_o == target)
                is_year_ok = True
                if db_year and res.get("release_date"):
                    is_year_ok = res["release_date"].startswith(db_year)
                
                if is_title_ok and is_year_ok:
                    info = {
                        "id": res["id"],
                        "type": "tmdb",
                        "title": res["title"],
                        "description": res["overview"],
                        "rating": res.get("vote_average"),
                        "releaseDate": res.get("release_date"),
                        "posterPath": f"https://image.tmdb.org/t/p/w500{res.get('poster_path')}" if res.get('poster_path') else None,
                        "backdropPath": f"https://image.tmdb.org/t/p/w500{res.get('backdrop_path')}" if res.get('backdrop_path') else None,
                        "mediaType": "movie"
                    }
                    cache[cache_key] = info
                    return info
    except: pass
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
        print("❌ Error: TMDB_API_KEY is missing")
        return

    # 自动创建 data 目录
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    async with aiohttp.ClientSession() as session:
        final_result = {}
        cache = {}
        for region in REGIONS:
            print(f"Processing: {region['title']}")
            items = await fetch_douban_list(session, region)
            matched = await batch_process(session, items, 8, cache)
            final_result[region["title"]] = matched

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_result, f, ensure_ascii=False, indent=2)
    print(f"✅ Data saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
